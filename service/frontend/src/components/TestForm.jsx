import { useState, useEffect } from 'react';
import authService from '../services/authService';
// TEMPORARY: Directly define API functions here to bypass module caching
import StepEditor from './StepEditor';

const BASE_URL = 'http://localhost:8080';
const TEST_API = `${BASE_URL}/api/v1`;

const createTest = async (testData) => {
  try {
    // Generate test_id if not provided
    if (!testData.test_id || testData.test_id.trim() === '') {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      testData.test_id = `test-${timestamp}-${random}`;
    }

    // Prepare test steps with proper format
    const formattedSteps = testData.test_steps.map((step, index) => ({
      step_number: index + 1,
      description: step.description.trim() || `Step ${index + 1}`,
      type: 'action',
      params: {},
      expected_result: null
    }));

    // Include test_steps in the creation payload
    const createPayload = {
      ...testData,
      test_steps: formattedSteps
    };

    console.log('=== Creating Test ===');
    console.log('Payload:', createPayload);
    console.log('====================');

    const testResponse = await fetch(`${TEST_API}/test-definitions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authService.getAccessToken()}`
      },
      body: JSON.stringify(createPayload),
      mode: 'cors'
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('Failed to create test. Status:', testResponse.status);
      console.error('Error response:', errorText);
      throw new Error(`Failed to create test: ${testResponse.statusText} - ${errorText}`);
    }

    const test = await testResponse.json();
    console.log('Test created successfully:', test);
    return test;
  } catch (error) {
    console.error('Error creating test:', error);
    throw error;
  }
};

const updateTest = async (testId, testData) => {
  try {
    // Use test_id instead of numeric ID for PUT request
    const testIdString = testData.test_id || testId.toString();

    // Update test basic info (excluding test_steps for now)
    const { test_steps, ...testInfo } = testData;

    console.log('=== Updating Test ===');
    console.log('Test ID:', testIdString);
    console.log('Test info:', testInfo);
    console.log('====================');

    const testResponse = await fetch(`${TEST_API}/test-definitions/${testIdString}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authService.getAccessToken()}`
      },
      body: JSON.stringify(testInfo),
      mode: 'cors'
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('Failed to update test. Status:', testResponse.status);
      console.error('Error response:', errorText);
      throw new Error(`Failed to update test: ${testResponse.statusText} - ${errorText}`);
    }

    const test = await testResponse.json();

    // Get the internal ID from the response
    const internalId = test.id;

    // Update steps - delete existing steps and add new ones
    // First, delete existing steps using internal ID
    const existingStepsResponse = await fetch(`${TEST_API}/test-steps/test-definition/${internalId}`, {
      headers: {
        'Authorization': `Bearer ${authService.getAccessToken()}`
      },
      mode: 'cors'
    });

    if (existingStepsResponse.ok) {
      const existingSteps = await existingStepsResponse.json();

      // Delete each existing step
      for (const step of existingSteps) {
        await fetch(`${TEST_API}/test-steps/${step.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authService.getAccessToken()}`
          },
          mode: 'cors'
        });
      }
    }

    // Add new steps using internal ID
    for (const step of test_steps) {
      const stepData = {
        type: 'action',
        description: step.description.trim() || `Step ${step.id}`,
        params: {},
        step_number: step.id,
        expected_result: null
      };

      console.log('=== Creating Step ===');
      console.log('Step data:', stepData);
      console.log('=====================');

      const stepResponse = await fetch(`${TEST_API}/test-steps/test-definition/${internalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getAccessToken()}`
        },
        body: JSON.stringify(stepData),
        mode: 'cors'
      });

      if (!stepResponse.ok) {
        const errorText = await stepResponse.text();
        console.error('Failed to add step. Status:', stepResponse.status);
        console.error('Error response:', errorText);
        throw new Error(`Failed to add step: ${stepResponse.statusText} - ${errorText}`);
      }
    }

    return test;
  } catch (error) {
    console.error('Error updating test:', error);
    throw error;
  }
};

function TestForm(props) {
  const { onTestCreated, editingTest, onCancel } = props;

  const getAuthHeadersSafe = () => {
    const token = typeof authService?.getAccessToken === 'function' ? authService.getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    test_id: '',
    url: '',
    environment: {},
    tags: [],
    test_steps: [{ id: 1, description: '' }]
  });

  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load test data when editing
  useEffect(() => {
    if (editingTest) {
      const loadTestData = async () => {
        try {
          const stepsResponse = await fetch(`/api/v1/test-steps/test-definition/${editingTest.id}`, {
            headers: getAuthHeadersSafe()
          });
          if (stepsResponse.ok) {
            const steps = await stepsResponse.json();
            const formattedSteps = steps.map(step => ({
              id: step.step_number,
              description: step.description || `${step.type} ${step.params?.selector || ''} ${step.params?.value || ''}`.trim()
            }));

            setFormData({
              name: editingTest.name || '',
              description: editingTest.description || '',
              test_id: editingTest.test_id || '',
              url: editingTest.url || '',
              environment: editingTest.environment || {},
              tags: editingTest.tags || [],
              test_steps: formattedSteps.length > 0 ? formattedSteps : [{ id: 1, description: '' }]
            });
          }
        } catch (error) {
          console.error('Failed to load test data:', error);
        }
      };

      loadTestData();
    }
  }, [editingTest]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      alert('Test name is required');
      return;
    }
    if (!formData.url.trim()) {
      alert('URL is required');
      return;
    }
    if (formData.test_steps.length === 0) {
      alert('At least one test step is required');
      return;
    }

    // Validate that all steps have non-empty descriptions
    const emptyStepIndex = formData.test_steps.findIndex(step => !step.description || step.description.trim() === '');
    if (emptyStepIndex !== -1) {
      alert(`Step ${emptyStepIndex + 1} cannot be empty. Please provide a description for each step.`);
      return;
    }

    setSubmitting(true);
    try {
      // Debug: Check current origin before API call
      console.log('=== TestForm Submit Debug ===');
      console.log('window.location.origin:', window.location.origin);
      console.log('About to call createTest with:', formData);
      console.log('============================');

      if (editingTest) {
        await updateTest(editingTest.id, formData);
        alert('Test updated successfully!');
      } else {
        await createTest(formData);
        alert('Test created successfully!');
      }

      // Reset form if creating new test
      if (!editingTest) {
        setFormData({
          name: '',
          description: '',
          test_id: '',
          url: '',
          environment: {},
          tags: [],
          test_steps: [{ id: 1, description: '' }]
        });
      }

      onTestCreated();
    } catch (error) {
      alert(`Failed to ${editingTest ? 'update' : 'create'} test: ` + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const addEnvironmentVar = () => {
    if (!envKey.trim()) {
      alert('Key is required');
      return;
    }
    setFormData({
      ...formData,
      environment: { ...formData.environment, [envKey]: envValue }
    });
    setEnvKey('');
    setEnvValue('');
  };

  const removeEnvironmentVar = (keyToRemove) => {
    const newEnv = { ...formData.environment };
    delete newEnv[keyToRemove];
    setFormData({
      ...formData,
      environment: newEnv
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (!formData.tags.includes(tagInput)) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput]
      });
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tagToRemove)
    });
  };

  return (
    <div style={{background: 'var(--cds-background)', borderRadius: 'var(--cds-border-radius)', padding: 'var(--cds-spacing-xl)'}}>
      <h2 style={{marginTop: 0, marginBottom: 'var(--cds-spacing-lg)', color: editingTest ? 'var(--cds-support-warning)' : 'var(--cds-support-success)', fontSize: 'var(--cds-heading-04)', fontWeight: 'var(--cds-font-weight-regular)'}}>
        {editingTest ? '✏️ Edit Test' : 'Create New Test'}
      </h2>

      <form onSubmit={handleSubmit}>
        <div style={{marginBottom: 'var(--cds-spacing-lg)'}}>
          <label style={{display: 'block', fontWeight: 'var(--cds-font-weight-regular)', marginBottom: 'var(--cds-spacing-xs)', fontSize: 'var(--cds-caption-01)', letterSpacing: 'var(--cds-letter-spacing-caption)'}}>
            Test Name <span style={{color: 'var(--cds-support-error)'}}>*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., User Registration Test"
            required
            style={{
              width: '100%',
              padding: '0 16px',
              border: 'none',
              borderBottom: '2px solid transparent',
              borderRadius: 'var(--cds-border-radius)',
              background: 'var(--cds-input-background)',
              height: 'var(--cds-input-height)',
              boxSizing: 'border-box',
              fontSize: 'var(--cds-body-short-01)',
              fontFamily: 'var(--cds-font-family)'
            }}
          />
        </div>

        <div style={{marginBottom: 'var(--cds-spacing-lg)'}}>
          <label style={{display: 'block', fontWeight: 'var(--cds-font-weight-regular)', marginBottom: 'var(--cds-spacing-xs)', fontSize: 'var(--cds-caption-01)', letterSpacing: 'var(--cds-letter-spacing-caption)'}}>
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="What does this test do?"
            rows={3}
            style={{
              width: '100%',
              padding: 'var(--cds-spacing-sm) 16px',
              border: 'none',
              borderBottom: '2px solid transparent',
              borderRadius: 'var(--cds-border-radius)',
              background: 'var(--cds-input-background)',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontSize: 'var(--cds-body-short-01)',
              fontFamily: 'var(--cds-font-family)'
            }}
          />
        </div>

        <div style={{marginBottom: 'var(--cds-spacing-lg)'}}>
          <label style={{display: 'block', fontWeight: 'var(--cds-font-weight-regular)', marginBottom: 'var(--cds-spacing-xs)', fontSize: 'var(--cds-caption-01)', letterSpacing: 'var(--cds-letter-spacing-caption)'}}>
            Test ID
          </label>
          <input
            type="text"
            value={formData.test_id}
            onChange={(e) => setFormData({...formData, test_id: e.target.value})}
            placeholder="e.g., login-001"
            style={{
              width: '100%',
              padding: '0 16px',
              border: 'none',
              borderBottom: '2px solid transparent',
              borderRadius: 'var(--cds-border-radius)',
              background: 'var(--cds-input-background)',
              height: 'var(--cds-input-height)',
              boxSizing: 'border-box',
              fontSize: 'var(--cds-body-short-01)',
              fontFamily: 'var(--cds-font-family)'
            }}
          />
        </div>

        <div style={{marginBottom: 'var(--cds-spacing-lg)'}}>
          <label style={{display: 'block', fontWeight: 'var(--cds-font-weight-regular)', marginBottom: 'var(--cds-spacing-xs)', fontSize: 'var(--cds-caption-01)', letterSpacing: 'var(--cds-letter-spacing-caption)'}}>
            Test URL <span style={{color: 'var(--cds-support-error)'}}>*</span>
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({...formData, url: e.target.value})}
            placeholder="https://example.com/login"
            required
            style={{
              width: '100%',
              padding: '0 16px',
              border: 'none',
              borderBottom: '2px solid transparent',
              borderRadius: 'var(--cds-border-radius)',
              background: 'var(--cds-input-background)',
              height: 'var(--cds-input-height)',
              boxSizing: 'border-box',
              fontSize: 'var(--cds-body-short-01)',
              fontFamily: 'var(--cds-font-family)'
            }}
          />
        </div>

        <div style={{marginBottom: 'var(--cds-spacing-lg)'}}>
          <label style={{display: 'block', fontWeight: 'var(--cds-font-weight-regular)', marginBottom: 'var(--cds-spacing-xs)', fontSize: 'var(--cds-caption-01)', letterSpacing: 'var(--cds-letter-spacing-caption)'}}>
            Environment Variables
          </label>
          <div style={{display: 'flex', gap: 'var(--cds-spacing-sm)', marginBottom: 'var(--cds-spacing-sm)'}}>
            <input
              type="text"
              value={envKey}
              onChange={(e) => setEnvKey(e.target.value)}
              placeholder="KEY"
              style={{
                flex: 1,
                padding: '0 16px',
                border: 'none',
                borderBottom: '2px solid transparent',
                borderRadius: 'var(--cds-border-radius)',
                background: 'var(--cds-input-background)',
                height: 'var(--cds-input-height)',
                fontSize: 'var(--cds-body-short-01)',
                fontFamily: 'var(--cds-font-family)'
              }}
            />
            <input
              type="text"
              value={envValue}
              onChange={(e) => setEnvValue(e.target.value)}
              placeholder="value"
              style={{
                flex: 1,
                padding: '0 16px',
                border: 'none',
                borderBottom: '2px solid transparent',
                borderRadius: 'var(--cds-border-radius)',
                background: 'var(--cds-input-background)',
                height: 'var(--cds-input-height)',
                fontSize: 'var(--cds-body-short-01)',
                fontFamily: 'var(--cds-font-family)'
              }}
            />
            <button
              type="button"
              onClick={addEnvironmentVar}
              style={{
                padding: 'var(--cds-spacing-sm) var(--cds-spacing-md)',
                background: 'var(--cds-button-secondary)',
                color: 'var(--cds-text-on-color)',
                border: 'none',
                borderRadius: 'var(--cds-border-radius)',
                cursor: 'pointer',
                height: 'var(--cds-input-height)',
                fontSize: 'var(--cds-body-short-01)',
                fontFamily: 'var(--cds-font-family)'
              }}
            >
              +
            </button>
          </div>
          {Object.entries(formData.environment).map(([key, value]) => (
            <div key={key} style={{
              fontSize: 'var(--cds-caption-01)',
              color: 'var(--cds-text-secondary)',
              marginBottom: 'var(--cds-spacing-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--cds-spacing-xs)'
            }}>
              <span>{key} = {value}</span>
              <button
                type="button"
                onClick={() => removeEnvironmentVar(key)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cds-support-error)',
                  cursor: 'pointer',
                  fontSize: 'var(--cds-body-short-01)'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{marginBottom: 'var(--cds-spacing-lg)'}}>
          <label style={{display: 'block', fontWeight: 'var(--cds-font-weight-regular)', marginBottom: 'var(--cds-spacing-xs)', fontSize: 'var(--cds-caption-01)', letterSpacing: 'var(--cds-letter-spacing-caption)'}}>
            Tags
          </label>
          <div style={{display: 'flex', gap: 'var(--cds-spacing-sm)', marginBottom: 'var(--cds-spacing-sm)'}}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              style={{
                flex: 1,
                padding: '0 16px',
                border: 'none',
                borderBottom: '2px solid transparent',
                borderRadius: 'var(--cds-border-radius)',
                background: 'var(--cds-input-background)',
                height: 'var(--cds-input-height)',
                fontSize: 'var(--cds-body-short-01)',
                fontFamily: 'var(--cds-font-family)'
              }}
            />
          </div>
          <div>
            {formData.tags.map(tag => (
              <span
                key={tag}
                style={{
                  display: 'inline-block',
                  fontSize: 'var(--cds-caption-01)',
                  background: 'var(--cds-tag-blue)',
                  color: 'var(--cds-tag-blue-text)',
                  padding: 'var(--cds-spacing-xs) var(--cds-spacing-sm)',
                  borderRadius: 'var(--cds-border-radius-tag)',
                  marginRight: 'var(--cds-spacing-xs)',
                  marginBottom: 'var(--cds-spacing-xs)'
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cds-support-error)',
                    cursor: 'pointer',
                    marginLeft: 'var(--cds-spacing-xs)',
                    fontSize: 'var(--cds-body-short-01)'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <StepEditor steps={formData.test_steps} onChange={(steps) => setFormData({...formData, test_steps: steps})} />

        <div style={{display: 'flex', gap: 'var(--cds-spacing-sm)', marginTop: 'var(--cds-spacing-lg)'}}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              padding: 'var(--cds-button-padding-sm)',
              background: submitting ? 'var(--cds-interactive-02)' : (editingTest ? 'var(--cds-support-warning)' : 'var(--cds-support-success)'),
              color: 'var(--cds-text-on-color)',
              border: 'none',
              borderRadius: 'var(--cds-border-radius)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 'var(--cds-font-weight-regular)',
              height: 'var(--cds-button-height)',
              fontSize: 'var(--cds-body-short-01)',
              fontFamily: 'var(--cds-font-family)'
            }}
          >
            {submitting ? (editingTest ? 'Updating...' : 'Creating...') : (editingTest ? 'Update Test' : 'Create Test')}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              flex: 1,
              padding: 'var(--cds-button-padding-sm)',
              background: 'var(--cds-button-secondary)',
              color: 'var(--cds-text-on-color)',
              border: 'none',
              borderRadius: 'var(--cds-border-radius)',
              cursor: 'pointer',
              height: 'var(--cds-button-height)',
              fontSize: 'var(--cds-body-short-01)',
              fontFamily: 'var(--cds-font-family)'
            }}
          >
            {editingTest ? 'Cancel' : 'Clear'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TestForm;