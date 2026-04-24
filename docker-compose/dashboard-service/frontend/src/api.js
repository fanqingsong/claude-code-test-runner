// Use relative paths to avoid CORS issues
// In production, these will be proxied through the dashboard service
const TEST_API = window.location.hostname === 'localhost'
  ? 'http://localhost:8011/api/v1'
  : '/api/test-case';

const DASHBOARD_API = window.location.hostname === 'localhost'
  ? 'http://localhost:8013/api'
  : '/api';

// For testing - hardcoded token (in production, this should be stored securely)
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6MTc3Njk1NDQ1Nn0.6mD3nX5XS1_RIGXnPQ53Ud4zv951CJ9-0mHbOXznCMQ';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${TOKEN}`
});

export const getTests = async () => {
  try {
    const response = await fetch(`${TEST_API}/test-definitions/`, {
      headers: getAuthHeaders(),
      mode: 'cors'
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch tests: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching tests:', error);
    // Return mock data if API fails
    return {
      items: [
        {
          id: 1,
          name: 'Sample Login Test',
          description: 'A sample test for login functionality',
          test_id: 'sample-login-test',
          url: 'https://example.com/login',
          environment: {},
          tags: ['sample', 'login'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'Checkout Test',
          description: 'Test the checkout process',
          test_id: 'checkout-test',
          url: 'https://example.com/checkout',
          environment: {},
          tags: ['e2e', 'checkout'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      total: 2
    };
  }
};

export const createTest = async (testData) => {
  try {
    const { test_steps, ...testInfo } = testData;

    // Create test
    const testResponse = await fetch(`${TEST_API}/test-definitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(testInfo),
      mode: 'cors'
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
        }),
        mode: 'cors'
      });

      if (!stepResponse.ok) {
        throw new Error(`Failed to add step: ${stepResponse.statusText}`);
      }
    }

    return test;
  } catch (error) {
    console.error('Error creating test:', error);
    throw new Error('Failed to create test. Please try again.');
  }
};

// Dashboard API
export const getDashboardData = async (days = 30) => {
  try {
    const response = await fetch(`${DASHBOARD_API}/dashboard?days=${days}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};

export const getTestRuns = async (limit = 20) => {
  try {
    const response = await fetch(`${DASHBOARD_API}/test-runs?limit=${limit}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch test runs: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching test runs:', error);
    throw error;
  }
};

// Get test job status
export const getJobStatus = async (jobId) => {
  try {
    const response = await fetch(`http://localhost:8012/api/v1/jobs/${jobId}`, {
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors'
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch job status: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching job status:', error);
    throw error;
  }
};

// Get all jobs
export const getJobs = async () => {
  try {
    const response = await fetch('http://localhost:8012/api/v1/jobs/', {
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors'
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
};

export const getTestStats = async () => {
  try {
    const response = await fetch(`${DASHBOARD_API}/dashboard`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch test stats: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching test stats:', error);
    throw error;
  }
};