import { chromium } from 'playwright';
import { readFileSync } from 'fs';

async function runTest() {
    console.log('🎭 Starting Playwright Direct Test...');
    console.log('📁 Loading test case from: ../samples/pdca-e2e-tests.json');

    const testCases = JSON.parse(readFileSync('../samples/pdca-e2e-tests.json', 'utf8'));
    const testCase = testCases[0];

    console.log(`\n📋 Test Case: ${testCase.description}`);
    console.log(`🆔 Test ID: ${testCase.id}`);
    console.log('📝 Steps:');
    testCase.steps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.description}`);
    });

    // Launch browser in non-headless mode so you can see it
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000 // Slow down actions so you can see them
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    try {
        console.log('\n🚀 Starting test execution...');

        // Step 1: Navigate to localhost:5173
        console.log('\n➡️  Step 1: Navigating to localhost:5173...');
        await page.goto('http://localhost:5173');
        console.log('✅ Step 1 completed: Navigation successful');
        await page.screenshot({ path: './results/step1-navigate.png' });

        // Step 2: Enter email address
        console.log('\n➡️  Step 2: Entering email address...');
        await page.waitForTimeout(1000);

        // Look for email input field
        const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"], #email');
        if (emailInput) {
            await emailInput.fill('admin@example.com');
            console.log('✅ Step 2 completed: Email entered');
        } else {
            console.log('⚠️  Email input not found, trying alternative selectors...');
            // Try to find any input that might be for email
            const inputs = await page.$$('input');
            console.log(`   Found ${inputs.length} input elements`);
        }
        await page.screenshot({ path: './results/step2-email.png' });

        // Step 3: Enter password
        console.log('\n➡️  Step 3: Entering password...');
        await page.waitForTimeout(1000);

        const passwordInput = await page.$('input[type="password"], input[name="password"], #password');
        if (passwordInput) {
            await passwordInput.fill('changethis');
            console.log('✅ Step 3 completed: Password entered');
        } else {
            console.log('⚠️  Password input not found');
        }
        await page.screenshot({ path: './results/step3-password.png' });

        // Step 4: Click login button
        console.log('\n➡️  Step 4: Clicking login button...');
        await page.waitForTimeout(1000);

        const loginButton = await page.$('button[type="submit"], button:has-text("Login"), button:has-text("Sign In"), #login-button');
        if (loginButton) {
            await loginButton.click();
            console.log('✅ Step 4 completed: Login button clicked');
        } else {
            console.log('⚠️  Login button not found, trying to find any button...');
            const buttons = await page.$$('button');
            console.log(`   Found ${buttons.length} button elements`);
        }
        await page.screenshot({ path: './results/step4-click.png' });

        // Step 5: Verify successful login
        console.log('\n➡️  Step 5: Verifying successful login...');
        await page.waitForTimeout(2000);

        // Check if we're still on login page or moved to dashboard
        const currentUrl = page.url();
        console.log(`   Current URL: ${currentUrl}`);

        // Look for success indicators
        const hasWelcomeMessage = await page.$('text=/welcome|dashboard|success/i');
        const hasLogoutButton = await page.$('button:has-text("Logout"), a:has-text("Logout")');

        if (hasWelcomeMessage || hasLogoutButton || currentUrl.includes('/dashboard') || currentUrl.includes('/home')) {
            console.log('✅ Step 5 completed: Login verification successful');
        } else {
            console.log('❌ Step 5 failed: Could not verify successful login');
        }
        await page.screenshot({ path: './results/step5-verify.png' });

        console.log('\n🎉 Test execution completed!');
        console.log('📸 Screenshots saved to ./results/ directory');

    } catch (error) {
        console.error('\n❌ Test execution failed:', error.message);
    } finally {
        // Keep browser open for a few seconds so you can see the final state
        console.log('\n⏳ Keeping browser open for 5 seconds so you can see the result...');
        await page.waitForTimeout(5000);
        await browser.close();
        console.log('👋 Browser closed');
    }
}

// Create results directory if it doesn't exist
import { mkdir } from 'fs/promises';
try {
    await mkdir('./results', { recursive: true });
} catch (error) {
    // Directory might already exist
}

// Run the test
runTest().catch(console.error);
