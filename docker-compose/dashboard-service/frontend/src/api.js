const TEST_API = 'http://localhost:8011/api/v1';

export const getTests = async () => {
  const response = await fetch(`${TEST_API}/test-definitions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch tests: ${response.statusText}`);
  }
  return response.json();
};

export const createTest = async (testData) => {
  const { test_steps, ...testInfo } = testData;
  
  // Create test
  const testResponse = await fetch(`${TEST_API}/test-definitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testInfo)
  });
  
  if (!testResponse.ok) {
    throw new Error(`Failed to create test: ${testResponse.statusText}`);
  }
  
  const test = await testResponse.json();
  
  // Add steps
  for (const step of test_steps) {
    const stepResponse = await fetch(`${TEST_API}/test-steps/test-definition/${test.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step_type: step.step_type,
        selector: step.selector || null,
        value: step.value || null,
        order: step.order
      })
    });
    
    if (!stepResponse.ok) {
      throw new Error(`Failed to add step: ${stepResponse.statusText}`);
    }
  }
  
  return test;
};
