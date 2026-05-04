// API Base URLs
// Use the current origin (protocol + hostname + port) to work in all environments
const BASE_URL = window.location.origin;

const TEST_API = `${BASE_URL}/api/v1`;
const DASHBOARD_API = `${BASE_URL}/api/v1/analytics`;
const SCHEDULER_API = `${BASE_URL}/api/v1`;

// Import authService for authentication
import authService from './services/authService';

const getAuthHeaders = () => {
  const token = authService.getAccessToken();
  console.log('getAuthHeaders - token exists:', !!token);
  console.log('getAuthHeaders - token preview:', token ? token.substring(0, 20) + '...' : 'no token');
  if (!token) {
    console.warn('getAuthHeaders - No token available, request may fail');
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`
  };
};

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
    // ROOT CAUSE: Missing trailing slash caused ERR_CONNECTION_REFUSED
    // Nginx routes /api/v1/ with trailing slash, so POST endpoint must match
    const testResponse = await fetch(`${TEST_API}/test-definitions/`, {
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
          type: 'action',
          description: step.description,
          params: {},
          step_number: step.id
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

export const updateTest = async (testId, testData) => {
  try {
    const { test_steps, ...testInfo } = testData;

    // Use test_id instead of numeric ID for PUT request
    const testIdString = testInfo.test_id || testId.toString();

    // Update test basic info
    const testResponse = await fetch(`${TEST_API}/test-definitions/${testIdString}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(testInfo),
      mode: 'cors'
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      throw new Error(`Failed to update test: ${testResponse.statusText} - ${errorText}`);
    }

    const test = await testResponse.json();

    // Get the internal ID from the response
    const internalId = test.id;

    // Update steps - delete existing steps and add new ones
    // First, delete existing steps using internal ID
    const existingStepsResponse = await fetch(`${TEST_API}/test-steps/test-definition/${internalId}`, {
      headers: getAuthHeaders(),
      mode: 'cors'
    });

    if (existingStepsResponse.ok) {
      const existingSteps = await existingStepsResponse.json();

      // Delete each existing step
      for (const step of existingSteps) {
        await fetch(`${TEST_API}/test-steps/${step.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          mode: 'cors'
        });
      }
    }

    // Add new steps using internal ID
    for (const step of test_steps) {
      const stepResponse = await fetch(`${TEST_API}/test-steps/test-definition/${internalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          type: 'action',
          description: step.description,
          params: {},
          step_number: step.id
        }),
        mode: 'cors'
      });

      if (!stepResponse.ok) {
        throw new Error(`Failed to add step: ${stepResponse.statusText}`);
      }
    }

    return test;
  } catch (error) {
    console.error('Error updating test:', error);
    throw error;
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

export const getTestRunDetails = async (runId) => {
  try {
    const response = await fetch(`${DASHBOARD_API}/test-runs/${runId}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch test run details: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching test run details:', error);
    throw error;
  }
};

// Get test job status
export const getJobStatus = async (jobId) => {
  try {
    const response = await fetch(`${SCHEDULER_API}/jobs/${jobId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
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
    const response = await fetch(`${SCHEDULER_API}/jobs/`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
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