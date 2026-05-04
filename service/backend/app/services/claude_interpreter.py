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
                from claude_agent_sdk import query, ClaudeAgentOptions

                self.query = query
                self.ClaudeAgentOptions = ClaudeAgentOptions
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

            # Execute using Claude Code Agent SDK
            result = await self._execute_with_agent_sdk(page, description, page_context)

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

    async def _execute_with_agent_sdk(
        self,
        page: Page,
        description: str,
        page_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute the test step using Claude Code Agent SDK with full autonomy.

        This method allows Claude to autonomously execute browser actions by using
        Playwright CLI through the Bash tool, maintaining full control and autonomy.
        """
        try:
            # Build the prompt for Claude
            prompt = self._build_execution_prompt(description, page_context)

            # Configure Agent SDK options with Bash tool for Playwright CLI access
            options = self.ClaudeAgentOptions(
                allowed_tools=[
                    "Bash",           # For executing Playwright CLI commands
                    "Read",           # For reading test files and configs
                    "Write",          # For creating temporary test scripts
                    "Grep"            # For searching in files
                ],
                permission_mode="auto"  # Auto-approve actions
            )

            # Execute using Claude Code Agent SDK with full autonomy
            from claude_agent_sdk import AssistantMessage, ResultMessage

            execution_log = []
            final_result = None
            iteration_count = 0

            print(f"[Claude SDK] Starting autonomous execution for: {description}")

            async for message in self.query(
                prompt=prompt,
                options=options
            ):
                iteration_count += 1
                print(f"[Claude SDK] Iteration {iteration_count}")

                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, "text"):
                            text_content = block.text[:200]  # Limit log length
                            execution_log.append(f"Claude: {text_content}")
                            print(f"[Claude SDK] Claude: {text_content}")
                        elif hasattr(block, "name"):
                            tool_name = block.name
                            execution_log.append(f"Tool called: {tool_name}")
                            print(f"[Claude SDK] Tool: {tool_name}")

                elif isinstance(message, ResultMessage):
                    final_result = message
                    execution_log.append(f"Done: {message.subtype}")
                    print(f"[Claude SDK] Done: {message.subtype}")
                    break  # Exit loop on completion

            print(f"[Claude SDK] Execution completed. Success: {final_result.subtype if final_result else 'unknown'}")

            # Return execution result with proper boolean success status
            success_status = final_result.subtype == "success" if final_result else False

            return {
                "success": success_status,  # Boolean value for status checking
                "details": "\n".join(execution_log),
                "action": description,
                "mode": "autonomous_claude_sdk",
                "raw_subtype": final_result.subtype if final_result else "unknown"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Agent SDK execution failed: {str(e)}",
                "details": f"Attempted: {description}"
            }

    def _build_execution_prompt(self, description: str, context: Dict[str, Any]) -> str:
        """Build the prompt for Claude Code Agent SDK with Playwright CLI instructions."""
        return f"""You are an expert browser automation assistant with full autonomous control over browser testing.

**Current Page Context:**
- URL: {context.get('url', 'unknown')}
- Title: {context.get('title', 'unknown')}

**Test Step to Execute:**
{description}

**Your Capabilities:**
You have FULL AUTONOMOUS ACCESS to browser automation through Playwright CLI. You can:

1. **Use Bash tool to execute Playwright commands:**
   - `playwright codegen <url>` - Record and generate code
   - `playwright test` - Run tests
   - `npx playwright screenshot <file> --url=<url>` - Take screenshot
   - Node.js scripts with Playwright API

2. **Create and execute JavaScript files** with Playwright:
   ```bash
   cat > test.js << 'EOF'
   const {{ chromium }} = require('playwright');
   (async () => {{
     const browser = await chromium.launch();
     const page = await browser.newPage();
     await page.goto('https://example.com');
     await page.click('#button');
     await browser.close();
   }})();
   EOF
   node test.js
   ```

3. **Direct Playwright CLI operations:**
   - `npx playwright-cli screenshot <url> <file>`
   - `npx playwright-cli pdf <url> <file>`
   - `npx playwright-cli codegen <url>`

**Execution Strategy:**
1. Create temporary JavaScript files using Write tool
2. Execute them using Bash tool with Node.js and Playwright
3. Verify results and take screenshots for debugging
4. Report detailed execution results

**Example Workflow:**
```bash
# Create test script
cat > /tmp/test_step.js << 'EOF'
const {{ chromium }} = require('playwright');
(async () => {{
  const browser = await chromium.launch({{ headless: true }});
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.fill('#username', 'testuser');
  await page.click('#login-btn');
  await page.screenshot({{ path: '/tmp/result.png' }});
  await browser.close();
}})();
EOF

# Execute the script
node /tmp/test_step.js
```

**Instructions:**
1. Analyze the test step
2. Create appropriate Playwright scripts
3. Execute them autonomously using Bash
4. Take screenshots for verification
5. Report detailed results

Execute the test step now using Playwright CLI through Bash commands.
"""

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
