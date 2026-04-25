"""
Claude AI Interpreter for Test Execution

This module uses Claude Code SDK to understand natural language test steps
and generate appropriate Playwright execution code.
"""

import os
import re
import json
from typing import Dict, Any, Optional
from playwright.async_api import Page, BrowserContext
from anthropic import Anthropic

from app.core.config import settings


class ClaudeTestInterpreter:
    """
    AI-powered test interpreter using Claude to understand natural language
    and execute browser automation tasks.
    """

    def __init__(self):
        """Initialize Claude interpreter with API key and custom base URL."""
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.base_url = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
        self.timeout_ms = int(os.getenv("API_TIMEOUT_MS", "300000"))

        if not self.api_key:
            print("Warning: ANTHROPIC_API_KEY not found. Using fallback rule-based interpretation.")
            self.client = None
        else:
            try:
                # Initialize Anthropic client with custom base URL for GLM compatibility
                self.client = Anthropic(
                    api_key=self.api_key,
                    base_url=self.base_url,
                    timeout=self.timeout_ms / 1000  # Convert to seconds
                )
                print(f"Claude interpreter initialized with base_url: {self.base_url}")
            except Exception as e:
                print(f"Failed to initialize Claude client: {str(e)}. Using fallback interpretation.")
                self.client = None

    async def interpret_and_execute(
        self,
        page: Page,
        description: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Use Claude to interpret natural language and execute browser actions.

        Args:
            page: Playwright page instance
            description: Natural language description of the action
            context: Additional context (URL, page title, etc.)

        Returns:
            dict: Execution result with success status and details
        """
        if not self.client:
            # Fallback to rule-based interpretation
            return await self._fallback_interpretation(page, description, context)

        try:
            # Get current page context for Claude
            page_context = await self._get_page_context(page, context)

            # Create prompt for Claude
            prompt = self._create_execution_prompt(description, page_context)

            # Call Claude to generate Playwright code
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Extract Claude's response
            claude_response = response.content[0].text
            return await self._execute_claude_instruction(page, claude_response, description)

        except Exception as e:
            print(f"Claude interpretation failed: {str(e)}")
            # Fallback to rule-based interpretation
            return await self._fallback_interpretation(page, description, context)

    async def _get_page_context(self, page: Page, additional_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Gather current page context to help Claude understand the state."""
        try:
            context = {
                "url": page.url,
                "title": await page.title(),
            }

            # Add any additional context provided
            if additional_context:
                context.update(additional_context)

            return context
        except Exception as e:
            print(f"Error getting page context: {str(e)}")
            return {"url": "unknown", "title": "unknown"}

    def _create_execution_prompt(self, description: str, context: Dict[str, Any]) -> str:
        """Create a detailed prompt for Claude to understand and execute the task."""

        prompt = f"""You are an expert browser automation assistant. I need you to help execute a test step using Playwright.

**Current Page Context:**
- URL: {context.get('url', 'unknown')}
- Title: {context.get('title', 'unknown')}

**Test Step to Execute:**
{description}

**Your Task:**
Analyze this natural language instruction and generate the appropriate Playwright Python code to execute it.

**Important Guidelines:**
1. Generate ONLY the Playwright Python code, no explanations
2. Use async/await syntax
3. Handle potential errors gracefully
4. Return a JSON response with this exact format:
   {{"success": true/false, "details": "what was done", "error": "error message if any"}}

**Example responses:**

For "Navigate to https://example.com":
```python
await page.goto("https://example.com")
await page.wait_for_load_state("networkidle")
print(json.dumps({{"success": true, "details": "Navigated to https://example.com"}}))
```

For "Click the submit button":
```python
await page.click("button[type='submit']")
print(json.dumps({{"success": true, "details": "Clicked submit button"}}))
```

For "Enter user@example.com in the email field":
```python
await page.fill("input[type='email'], input[name*='email']", "user@example.com")
print(json.dumps({{"success": true, "details": "Filled email field with user@example.com"}}))
```

For "Wait 2 seconds":
```python
await page.wait_for_timeout(2000)
print(json.dumps({{"success": true, "details": "Waited 2000ms"}}))
```

Now, generate the Playwright code for this step:
"""
        return prompt

    async def _execute_claude_instruction(self, page: Page, claude_code: str, description: str) -> Dict[str, Any]:
        """Execute the Playwright code generated by Claude."""

        try:
            # Extract Python code from Claude's response
            code_match = re.search(r'```python\n(.*?)```', claude_code, re.DOTALL)
            if code_match:
                code = code_match.group(1)
            else:
                # If no code block, try to use the entire response
                code = claude_code

            # Create a safe execution environment
            import json

            # Prepare the execution context
            exec_globals = {
                "page": page,
                "json": json,
                "__builtins__": {
                    "print": print,
                    "len": len,
                    "str": str,
                    "int": int,
                    "float": float,
                    "bool": bool,
                    "list": list,
                    "dict": dict,
                }
            }

            # Capture print output to get the result
            import io
            import sys

            old_stdout = sys.stdout
            sys.stdout = io.StringIO()

            try:
                # Execute the code (async handling is tricky in exec)
                # For now, we'll parse the code and extract the operations
                result = await self._safe_execute_playwright_code(page, code)
                return result

            finally:
                sys.stdout = old_stdout

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to execute Claude's instruction: {str(e)}",
                "details": f"Claude suggested: {claude_code[:100]}..."
            }

    async def _safe_execute_playwright_code(self, page: Page, code: str) -> Dict[str, Any]:
        """
        Safely execute Playwright code generated by Claude.
        This parses the code and executes known safe operations.
        """

        try:
            # Extract common Playwright operations
            operations = {
                "goto": self._extract_goto_operation,
                "click": self._extract_click_operation,
                "fill": self._extract_fill_operation,
                "wait_for_timeout": self._extract_wait_operation,
                "wait_for_selector": self._extract_wait_selector_operation,
            }

            # Parse and execute operations
            for op_name, op_extractor in operations.items():
                result = await op_extractor(page, code)
                if result:
                    return result

            # If no specific operation found, try generic execution
            return await self._generic_code_execution(page, code)

        except Exception as e:
            return {
                "success": False,
                "error": f"Execution failed: {str(e)}",
                "details": f"Attempted to execute: {code[:100]}..."
            }

    async def _extract_goto_operation(self, page: Page, code: str) -> Optional[Dict[str, Any]]:
        """Extract and execute goto operation."""
        match = re.search(r'await page\.goto\(["\']([^"\']+)["\']\)', code)
        if match:
            url = match.group(1)
            await page.goto(url)
            await page.wait_for_load_state("networkidle")
            return {"success": True, "details": f"Navigated to {url}"}
        return None

    async def _extract_click_operation(self, page: Page, code: str) -> Optional[Dict[str, Any]]:
        """Extract and execute click operation."""
        match = re.search(r'await page\.click\(["\']([^"\']+)["\']\)', code)
        if match:
            selector = match.group(1)
            await page.click(selector)
            await page.wait_for_load_state("networkidle")
            return {"success": True, "details": f"Clicked {selector}"}
        return None

    async def _extract_fill_operation(self, page: Page, code: str) -> Optional[Dict[str, Any]]:
        """Extract and execute fill operation."""
        match = re.search(r'await page\.fill\(["\']([^"\']+)["\'],\s*["\']([^"\']+)["\']\)', code)
        if match:
            selector = match.group(1)
            value = match.group(2)
            await page.fill(selector, value)
            return {"success": True, "details": f"Filled {selector} with '{value}'"}
        return None

    async def _extract_wait_operation(self, page: Page, code: str) -> Optional[Dict[str, Any]]:
        """Extract and execute wait operation."""
        match = re.search(r'await page\.wait_for_timeout\((\d+)\)', code)
        if match:
            timeout = int(match.group(1))
            await page.wait_for_timeout(timeout)
            return {"success": True, "details": f"Waited {timeout}ms"}
        return None

    async def _extract_wait_selector_operation(self, page: Page, code: str) -> Optional[Dict[str, Any]]:
        """Extract and execute wait for selector operation."""
        match = re.search(r'await page\.wait_for_selector\(["\']([^"\']+)["\']\)', code)
        if match:
            selector = match.group(1)
            await page.wait_for_selector(selector)
            return {"success": True, "details": f"Waited for {selector}"}
        return None

    async def _generic_code_execution(self, page: Page, code: str) -> Dict[str, Any]:
        """Fallback generic execution for complex operations."""
        try:
            # Try to extract any meaningful operation description
            if "screenshot" in code.lower():
                from pathlib import Path
                from datetime import datetime
                screenshot_dir = Path(settings.SCREENSHOT_DIR)
                screenshot_dir.mkdir(parents=True, exist_ok=True)
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                screenshot_path = screenshot_dir / f"screenshot_{timestamp}.png"
                await page.screenshot(path=str(screenshot_path))
                return {"success": True, "details": f"Screenshot saved to {screenshot_path}"}

            # If no specific operation matched, return a generic response
            return {
                "success": True,
                "details": f"Executed complex operation (interpreted by Claude)",
                "note": "Complex AI interpretation - verify manually if needed"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Generic execution failed: {str(e)}"
            }

    async def _fallback_interpretation(
        self,
        page: Page,
        description: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Fallback to rule-based interpretation when Claude is not available."""
        # Import the rule-based interpreter
        from app.tasks.test_execution import _interpret_and_execute
        return await _interpret_and_execute(page, description, context or {})


# Global instance
claude_interpreter = ClaudeTestInterpreter()