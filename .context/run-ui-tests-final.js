const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Ensure screenshots directory exists
const screenshotDir = path.join(__dirname, 'ui-test-screenshots');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// Test results tracking
const results = {
  passed: [],
  failed: [],
  skipped: []
};

// Helper function for test assertions
function assert(testId, condition, expected, actual, screenshotPath = null) {
  if (condition) {
    console.log(`STEP_PASS|${testId}|${expected}`);
    results.passed.push({ testId, evidence: expected });
  } else {
    console.log(`STEP_FAIL|${testId}|${expected} → ${actual}|${screenshotPath}`);
    results.failed.push({ testId, expected, actual, screenshotPath });
  }
}

async function runTests() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    console.log('\n=== GROUP A: Login Authentication Tests ===\n');

    // Test 1: empty-login
    console.log('Test 1: empty-login');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Try to find and click the submit button to trigger form validation
    const submitButton = await page.locator('button[type="submit"], button:has-text("Sign In")').first();

    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(1000);

      // Check for validation error
      const hasValidationError = await page.locator('text=/Please enter your username|Please enter your password|error|required/i').count() > 0;

      if (hasValidationError) {
        assert('empty-login', true, 'validation error appeared', 'validation error found');
      } else {
        const screenshotPath = path.join(screenshotDir, 'empty-login.png');
        await page.screenshot({ path: screenshotPath });
        assert('empty-login', false, 'validation error to appear', 'no validation error found', screenshotPath);
      }
    } else {
      const screenshotPath = path.join(screenshotDir, 'empty-login-no-button.png');
      await page.screenshot({ path: screenshotPath });
      assert('empty-login', false, 'Submit button to be present', 'button not found', screenshotPath);
    }

    // Test 2: wrong-credentials
    console.log('\nTest 2: wrong-credentials');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const usernameInput = await page.locator('input[type="text"], input[name="username"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();

    if (await usernameInput.isVisible() && await passwordInput.isVisible()) {
      await usernameInput.fill('wrong');
      await passwordInput.fill('wrong');

      const submitBtn = await page.locator('button[type="submit"], button:has-text("Sign In")').first();
      await submitBtn.click();
      await page.waitForTimeout(1500);

      const hasErrorMessage = await page.locator('text=/error|invalid|incorrect|failed|Invalid credentials/i').count() > 0;

      if (hasErrorMessage) {
        assert('wrong-credentials', true, 'error message appeared', 'error message found');
      } else {
        const screenshotPath = path.join(screenshotDir, 'wrong-credentials.png');
        await page.screenshot({ path: screenshotPath });
        assert('wrong-credentials', false, 'error message to appear', 'no error message found', screenshotPath);
      }
    } else {
      const screenshotPath = path.join(screenshotDir, 'wrong-credentials-no-form.png');
      await page.screenshot({ path: screenshotPath });
      assert('wrong-credentials', false, 'login form to be present', 'form inputs not found', screenshotPath);
    }

    // Test 3: rapid-submit
    console.log('\nTest 3: rapid-submit');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    let submissionCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes('/login') || request.url().includes('/auth')) {
        submissionCount++;
      }
    });

    const submitBtn = await page.locator('button[type="submit"], button:has-text("Sign In")').first();
    if (await submitBtn.isVisible()) {
      // Fill in some data to avoid validation blocking submission
      await page.locator('input[name="username"]').fill('test');
      await page.locator('input[name="password"]').fill('test');

      await submitBtn.click();
      await submitBtn.click();
      await submitBtn.click();
      await page.waitForTimeout(1500);

      const isDisabled = await submitBtn.isDisabled();
      const actualSubmissions = submissionCount;

      if (isDisabled || actualSubmissions <= 1) {
        assert('rapid-submit', true, 'only one submission occurred', `button disabled: ${isDisabled}, submissions: ${actualSubmissions}`);
      } else {
        const screenshotPath = path.join(screenshotDir, 'rapid-submit.png');
        await page.screenshot({ path: screenshotPath });
        assert('rapid-submit', false, 'only one submission', `${actualSubmissions} submissions detected`, screenshotPath);
      }
    } else {
      results.skipped.push({ testId: 'rapid-submit', reason: 'Submit button not found' });
      console.log('STEP_SKIP|rapid-submit|Submit button not found');
    }

    // Test 4: unauth-access
    console.log('\nTest 4: unauth-access');
    const newContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const newPage = await newContext.newPage();

    await newPage.goto('http://localhost:8080/#sso', { waitUntil: 'networkidle' });
    await newPage.waitForTimeout(1500);

    const currentUrl = newPage.url();
    const isRedirectedToLogin = currentUrl.includes('#login') || currentUrl.includes('#signin') ||
                               await newPage.locator('text=/sign in|login|authenticate/i').count() > 0;

    if (isRedirectedToLogin) {
      assert('unauth-access', true, 'redirected to login', `URL: ${currentUrl}`);
    } else {
      const screenshotPath = path.join(screenshotDir, 'unauth-access.png');
      await newPage.screenshot({ path: screenshotPath });
      assert('unauth-access', false, 'redirect to login', `stayed on ${currentUrl}`, screenshotPath);
    }

    await newContext.close();

    console.log('\n=== GROUP B: Routing and Navigation Tests ===\n');

    // Test 5: invalid-route
    console.log('Test 5: invalid-route');
    await page.goto('http://localhost:8080/#invalid-route-12345', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const has404 = await page.locator('text=/404|not found|page not found/i').count() > 0;
    const hasFallback = await page.locator('text=/home|dashboard|default/i').count() > 0;
    const hasContent = await page.locator('body > *:not(:empty)').count() > 0;

    if (has404 || hasFallback || hasContent) {
      assert('invalid-route', true, 'graceful handling', `404: ${has404}, fallback: ${hasFallback}, content: ${hasContent}`);
    } else {
      const screenshotPath = path.join(screenshotDir, 'invalid-route.png');
      await page.screenshot({ path: screenshotPath });
      assert('invalid-route', false, 'graceful handling or 404', 'blank page or crash', screenshotPath);
    }

    // Test 10: browser-back
    console.log('\nTest 10: browser-back');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    await page.goto('http://localhost:8080/#sso', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const beforeBackUrl = page.url();

    await page.goBack();
    await page.waitForTimeout(500);

    const afterBackUrl = page.url();
    const hashRoutingWorks = !afterBackUrl.includes('#sso') || afterBackUrl.includes('#/');

    if (hashRoutingWorks) {
      assert('browser-back', true, 'hash routing works', `went from ${beforeBackUrl} to ${afterBackUrl}`);
    } else {
      const screenshotPath = path.join(screenshotDir, 'browser-back.png');
      await page.screenshot({ path: screenshotPath });
      assert('browser-back', false, 'hash routing to navigate back', `stayed on ${afterBackUrl}`, screenshotPath);
    }

    console.log('\n=== GROUP C: SSO Configuration Tests ===\n');

    // First, log in to access SSO page
    console.log('Logging in to access SSO page...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const loginUsername = await page.locator('input[name="username"]').first();
    const loginPassword = await page.locator('input[name="password"]').first();

    if (await loginUsername.isVisible()) {
      await loginUsername.fill('admin');
      await loginPassword.fill('admin123');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
    }

    // Test 6: sso-form-empty
    console.log('\nTest 6: sso-form-empty');
    await page.goto('http://localhost:8080/#sso', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const addConfigButton = await page.locator('button:has-text("添加配置")').first();

    if (await addConfigButton.isVisible()) {
      await addConfigButton.click();
      await page.waitForTimeout(1500);

      const submitButton = await page.locator('button:has-text("保存")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await page.waitForTimeout(1000);

        const hasValidationError = await page.locator('text=/required|error|请填写|必填/i').count() > 0;

        if (hasValidationError) {
          assert('sso-form-empty', true, 'validation errors appeared', 'validation errors found');
        } else {
          const screenshotPath = path.join(screenshotDir, 'sso-form-empty.png');
          await page.screenshot({ path: screenshotPath });
          assert('sso-form-empty', false, 'validation errors to appear', 'no validation errors found', screenshotPath);
        }
      } else {
        results.skipped.push({ testId: 'sso-form-empty', reason: 'Submit button not found' });
        console.log('STEP_SKIP|sso-form-empty|Submit button not found');
      }

      // Close modal
      const cancelButton = await page.locator('button:has-text("取消")').first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      results.skipped.push({ testId: 'sso-form-empty', reason: 'Add Config button not found' });
      console.log('STEP_SKIP|sso-form-empty|Add Config button not found');
    }

    // Test 7: sso-invalid-url
    console.log('\nTest 7: sso-invalid-url');
    await page.goto('http://localhost:8080/#sso', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const addConfigButton2 = await page.locator('button:has-text("添加配置")').first();

    if (await addConfigButton2.isVisible()) {
      await addConfigButton2.click();
      await page.waitForTimeout(1500);

      // Try to find any input
      const allInputs = await page.locator('input').all();
      let foundInput = false;

      for (const input of allInputs) {
        const isVisible = await input.isVisible();
        if (isVisible) {
          await input.fill('not-a-url');
          foundInput = true;
          break;
        }
      }

      if (foundInput) {
        const submitButton = await page.locator('button:has-text("保存")').first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(1000);

          const hasUrlError = await page.locator('text=/url|invalid|endpoint|格式错误/i').count() > 0;

          if (hasUrlError) {
            assert('sso-invalid-url', true, 'URL validation error appeared', 'URL validation error found');
          } else {
            const screenshotPath = path.join(screenshotDir, 'sso-invalid-url.png');
            await page.screenshot({ path: screenshotPath });
            assert('sso-invalid-url', false, 'URL validation error to appear', 'no URL validation error found', screenshotPath);
          }
        }
      } else {
        results.skipped.push({ testId: 'sso-invalid-url', reason: 'No input fields found' });
        console.log('STEP_SKIP|sso-invalid-url|No input fields found');
      }

      // Close modal
      const cancelButton2 = await page.locator('button:has-text("取消")').first();
      if (await cancelButton2.isVisible()) {
        await cancelButton2.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      results.skipped.push({ testId: 'sso-invalid-url', reason: 'Add Config button not found' });
      console.log('STEP_SKIP|sso-invalid-url|Add Config button not found');
    }

    // Test 8: toggle-sso-config
    console.log('\nTest 8: toggle-sso-config');
    await page.goto('http://localhost:8080/#sso', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const toggleButton = await page.locator('button:has-text("启用"), button:has-text("禁用")').first();

    if (await toggleButton.isVisible()) {
      const beforeState = await toggleButton.textContent();

      await toggleButton.click();
      await page.waitForTimeout(1000);

      const afterState = await toggleButton.textContent();
      const stateChanged = beforeState !== afterState;

      if (stateChanged) {
        assert('toggle-sso-config', true, 'state updated', `changed from ${beforeState} to ${afterState}`);
      } else {
        const screenshotPath = path.join(screenshotDir, 'toggle-sso-config.png');
        await page.screenshot({ path: screenshotPath });
        assert('toggle-sso-config', false, 'state to update', `state remained ${beforeState}`, screenshotPath);
      }
    } else {
      results.skipped.push({ testId: 'toggle-sso-config', reason: 'Toggle button not found' });
      console.log('STEP_SKIP|toggle-sso-config|Toggle button not found');
    }

    // Test 9: delete-sso-config
    console.log('\nTest 9: delete-sso-config');
    await page.goto('http://localhost:8080/#sso', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const deleteButton = await page.locator('button:has-text("删除")').first();

    if (await deleteButton.isVisible()) {
      const itemsBefore = await page.locator('tr, [role="row"], .sso-config-item').count();

      await deleteButton.click();
      await page.waitForTimeout(1000);

      const cancelButton = await page.locator('button:has-text("取消")').first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      const itemsAfter = await page.locator('tr, [role="row"], .sso-config-item').count();
      const noDeletion = itemsBefore === itemsAfter;

      if (noDeletion) {
        assert('delete-sso-config', true, 'no deletion occurred', `items count remained ${itemsBefore}`);
      } else {
        const screenshotPath = path.join(screenshotDir, 'delete-sso-config.png');
        await page.screenshot({ path: screenshotPath });
        assert('delete-sso-config', false, 'no deletion', `items changed from ${itemsBefore} to ${itemsAfter}`, screenshotPath);
      }
    } else {
      results.skipped.push({ testId: 'delete-sso-config', reason: 'Delete button not found' });
      console.log('STEP_SKIP|delete-sso-config|Delete button not found');
    }

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Tests: ${results.passed.length + results.failed.length + results.skipped.length}`);
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`Pages visited: 5`);
  const totalTests = results.passed.length + results.failed.length;
  const passRate = totalTests > 0 ? Math.round((results.passed.length / totalTests) * 100) : 0;
  console.log(`Pass rate: ${passRate}%`);

  if (results.failed.length > 0) {
    console.log('\nFailed tests:');
    results.failed.forEach(f => {
      console.log(`  - ${f.testId}: ${f.expected} → ${f.actual}`);
      if (f.screenshotPath) {
        console.log(`    Screenshot: ${f.screenshotPath}`);
      }
    });
  }

  if (results.skipped.length > 0) {
    console.log('\nSkipped tests:');
    results.skipped.forEach(s => {
      console.log(`  - ${s.testId}: ${s.reason}`);
    });
  }
}

runTests().catch(console.error);
