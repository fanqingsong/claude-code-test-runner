const TEST_API = 'http://localhost:8011/api/v1';

// For testing - hardcoded token (in production, this should be stored securely)
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6MTc3Njk1NDQ1Nn0.6mD3nX5XS1_RIGXnPQ53Ud4zv951CJ9-0mHbOXznCMQ';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${TOKEN}`
});

export const getTests = async () => {
  const response = await fetch(`${TEST_API}/test-definitions/`, {
    headers: getAuthHeaders()
  });
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
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
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
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
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
