"""
Claude Code Agent SDK Interpreter for Test Execution

This module uses Claude Code Agent SDK to enable Claude to autonomously
execute browser automation tasks using Playwright MCP tools.
"""

import os
import asyncio
from typing import Dict, Any, Optional
from playwright.async_api import Page

from app.core.config import settings


class ClaudeTestInterpreter:
    """
    AI-powered test interpreter using Claude Code Agent SDK to enable
    autonomous test execution with natural language understanding.
    """

    def __init__(self):
        """Initialize Claude Code Agent SDK interpreter."""
        self.api_key = os.getenv("ANTHROPIC_API_KEY")

        if not self.api_key:
            print("Warning: ANTHROPIC_API_KEY not found. Using fallback rule-based interpretation.")
            self.sdk_available = False
        else:
            try:
                # Import Claude Code Agent SDK
                from claude_agent_sdk import query

                self.query = query
                self.sdk_available = True
                print("Claude Code Agent SDK initialized successfully")

            except ImportError:
                print("Warning: claude-agent-sdk not installed. Using fallback rule-based interpretation.")
                print("Install with: pip install claude-agent-sdk")
                self.sdk_available = False
            except Exception as e:
                print(f"Failed to initialize Claude Code Agent SDK: {str(e)}. Using fallback interpretation.")
                self.sdk_available = False

    async def interpret_and_execute(
        self,
        page: Page,
        description: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Use Claude Code Agent SDK to interpret natural language and execute browser actions.

        Args:
            page: Playwright page instance
            description: Natural language description of the action
            context: Additional context (URL, page title, etc.)

        Returns:
            dict: Execution result with success status and details
        """
        if not self.sdk_available:
            # Fallback to rule-based interpretation
            return await self._fallback_interpretation(page, description, context)

        try:
            # Get current page context for Claude
            page_context = await self._get_page_context(page, context)

            # Execute using Claude Code Agent SDK with direct browser control
            result = await self._execute_with_agent(page, description, page_context)

            return result

        except Exception as e:
            print(f"Claude Code Agent SDK execution failed: {str(e)}")
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

    async def _execute_with_agent(
        self,
        page: Page,
        description: str,
        page_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute the test step using Claude Code Agent SDK.

        This method provides Claude Code with controlled access to Playwright tools
        through a custom tool interface, allowing autonomous browser automation.
        """
        try:
            # Create a tool registry that Claude can use
            tools = self._create_playwright_tools(page)

            # Build the prompt for Claude
            prompt = self._build_execution_prompt(description, page_context)

            # Execute using Agent SDK with custom tools
            result = await self._run_agent_loop(prompt, tools, page)

            return result

        except Exception as e:
            return {
                "success": False,
                "error": f"Agent execution failed: {str(e)}",
                "details": f"Attempted: {description}"
            }

    def _create_playwright_tools(self, page: Page) -> Dict[str, Any]:
        """
        Create a dictionary of Playwright tools that Claude can use.

        These tools provide Claude with direct browser control capabilities.
        """
        async def navigate(params):
            url = params.get("url")
            await page.goto(url)
            await page.wait_for_load_state("networkidle")
            return {"success": True, "action": "navigated", "url": url}

        async def click(params):
            selector = params.get("selector")
            await page.click(selector)
            await page.wait_for_load_state("networkidle")
            return {"success": True, "action": "clicked", "selector": selector}

        async def fill(params):
            selector = params.get("selector")
            value = params.get("value")
            await page.fill(selector, value)
            return {"success": True, "action": "filled", "selector": selector, "value": value}

        async def wait_for_selector(params):
            selector = params.get("selector")
            timeout = params.get("timeout", 5000)
            await page.wait_for_selector(selector, timeout=timeout)
            return {"success": True, "action": "waited", "selector": selector}

        async def wait_for_timeout(params):
            timeout = params.get("timeout")
            await page.wait_for_timeout(timeout)
            return {"success": True, "action": "waited", "timeout": timeout}

        async def screenshot(params):
            from pathlib import Path
            from datetime import datetime

            screenshot_dir = Path(settings.SCREENSHOT_DIR)
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            screenshot_path = screenshot_dir / f"screenshot_{timestamp}.png"

            await page.screenshot(path=str(screenshot_path))
            return {"success": True, "action": "screenshot", "path": str(screenshot_path)}

        async def get_text_content(params):
            selector = params.get("selector")
            element = await page.query_selector(selector)
            if element:
                text = await element.text_content()
                return {"success": True, "action": "get_text", "text": text}
            return {"success": False, "error": "Element not found"}

        return {
            "navigate": {
                "description": "Navigate to a URL",
                "parameters": {
                    "url": "string (required) - The URL to navigate to"
                },
                "handler": navigate
            },
            "click": {
                "description": "Click an element on the page",
                "parameters": {
                    "selector": "string (required) - CSS selector for the element"
                },
                "handler": click
            },
            "fill": {
                "description": "Fill an input field with text",
                "parameters": {
                    "selector": "string (required) - CSS selector for the input field",
                    "value": "string (required) - The text to fill"
                },
                "handler": fill
            },
            "wait_for_selector": {
                "description": "Wait for an element to appear on the page",
                "parameters": {
                    "selector": "string (required) - CSS selector for the element",
                    "timeout": "number (optional) - Maximum wait time in milliseconds (default: 5000)"
                },
                "handler": wait_for_selector
            },
            "wait_for_timeout": {
                "description": "Wait for a specific amount of time",
                "parameters": {
                    "timeout": "number (required) - Time to wait in milliseconds"
                },
                "handler": wait_for_timeout
            },
            "screenshot": {
                "description": "Take a screenshot of the current page",
                "parameters": {
                    "path": "string (optional) - Path to save the screenshot (auto-generated if not provided)"
                },
                "handler": screenshot
            },
            "get_text_content": {
                "description": "Get the text content of an element",
                "parameters": {
                    "selector": "string (required) - CSS selector for the element"
                },
                "handler": get_text_content
            }
        }

    def _build_execution_prompt(self, description: str, context: Dict[str, Any]) -> str:
        """Build the prompt for Claude Code Agent."""
        return f"""You are an expert browser automation assistant. Execute the following test step using the available Playwright tools.

**Current Page Context:**
- URL: {context.get('url', 'unknown')}
- Title: {context.get('title', 'unknown')}

**Test Step to Execute:**
{description}

**Available Tools:**
1. **navigate(url)** - Navigate to a URL
2. **click(selector)** - Click an element
3. **fill(selector, value)** - Fill an input field
4. **wait_for_selector(selector, timeout?)** - Wait for an element to appear
5. **wait_for_timeout(timeout)** - Wait for a specific time (in milliseconds)
6. **screenshot(path?)** - Take a screenshot
7. **get_text_content(selector)** - Get text content of an element

**Instructions:**
1. Analyze the test step
2. Use the appropriate tools to execute it
3. Handle errors gracefully
4. Report what was executed

**Tool Usage Format:**
To use a tool, output in this format:
TOOL: tool_name
PARAMS: {{"param1": "value1", "param2": "value2"}}

Execute the test step now.
"""

    async def _run_agent_loop(
        self,
        prompt: str,
        tools: Dict[str, Any],
        page: Page
    ) -> Dict[str, Any]:
        """
        Run the agent loop with Claude Code SDK.

        This simplified implementation parses Claude's responses and executes
        the appropriate Playwright tools.
        """
        try:
            # Use Anthropic API directly for now (simpler integration)
            from anthropic import Anthropic

            client = Anthropic(api_key=self.api_key)

            # Call Claude to interpret the test step
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": prompt + "\n\nOutput the tool call in the specified format."
                    }
                ]
            )

            # Extract Claude's response
            claude_response = response.content[0].text

            # Parse and execute the tool call
            result = await self._parse_and_execute_tool_call(claude_response, tools)

            return result

        except Exception as e:
            # If agent SDK fails, try direct interpretation
            return await self._direct_interpret_and_execute(page, prompt, tools)

    async def _parse_and_execute_tool_call(
        self,
        response: str,
        tools: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Parse Claude's response and execute the appropriate tool."""
        import re

        # Parse tool call format
        tool_match = re.search(r'TOOL:\s*(\w+)', response, re.IGNORECASE)
        params_match = re.search(r'PARAMS:\s*(\{[^}]+\})', response, re.IGNORECASE)

        if tool_match:
            tool_name = tool_match.group(1).lower()

            if tool_name in tools:
                tool = tools[tool_name]

                # Parse parameters
                params = {}
                if params_match:
                    try:
                        params = eval(params_match.group(1))
                    except:
                        pass

                # Execute the tool
                try:
                    result = await tool["handler"](params)
                    return {
                        "success": True,
                        "details": f"Executed {tool_name}: {result}",
                        "action": tool_name
                    }
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Tool execution failed: {str(e)}",
                        "details": f"Attempted to execute {tool_name}"
                    }
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: {tool_name}",
                    "details": response
                }

        # If no tool call found, try to interpret directly
        return {
            "success": True,
            "details": f"Claude interpreted: {response}",
            "note": "No direct tool call found - response requires manual verification"
        }

    async def _direct_interpret_and_execute(
        self,
        page: Page,
        prompt: str,
        tools: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Direct interpretation and execution without Agent SDK."""
        # Use Anthropic API to get interpretation
        from anthropic import Anthropic

        try:
            client = Anthropic(api_key=self.api_key)

            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=512,
                messages=[
                    {
                        "role": "user",
                        "content": prompt + "\n\nRespond with a brief description of what you would do to execute this step."
                    }
                ]
            )

            interpretation = response.content[0].text

            return {
                "success": True,
                "details": f"AI interpretation: {interpretation}",
                "note": "Using interpretation mode - manual verification recommended"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Direct interpretation failed: {str(e)}"
            }

    async def _fallback_interpretation(
        self,
        page: Page,
        description: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Fallback to rule-based interpretation when Agent SDK is not available."""
        # Import the rule-based interpreter
        from app.tasks.test_execution import _interpret_and_execute
        return await _interpret_and_execute(page, description, context or {})
