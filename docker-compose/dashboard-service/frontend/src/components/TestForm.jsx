import { useState } from 'react';
import { createTest } from '../api';
import StepEditor from './StepEditor';

function TestForm({ onTestCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    test_id: '',
    url: '',
    environment: {},
    tags: [],
    test_steps: [{ step_type: 'navigate', selector: '', value: '', order: 1 }]
  });

  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      await createTest(formData);
      alert('Test created successfully!');
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        test_id: '',
        url: '',
        environment: {},
        tags: [],
        test_steps: [{ step_type: 'navigate', selector: '', value: '', order: 1 }]
      });
      
      onTestCreated();
    } catch (error) {
      alert('Failed to create test: ' + error.message);
    } finally {
      setSubmitting(false);
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
    <div style={{background: '#fff', borderRadius: '6px', padding: '16px'}}>
      <h2 style={{marginTop: 0, marginBottom: '16px', color: '#1976d2'}}>Create New Test</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{marginBottom: '16px'}}>
          <label style={{display: 'block', fontWeight: 'bold', marginBottom: '4px'}}>
            Test Name <span style={{color: 'red'}}>*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., User Registration Test"
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{marginBottom: '16px'}}>
          <label style={{display: 'block', fontWeight: 'bold', marginBottom: '4px'}}>
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="What does this test do?"
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{marginBottom: '16px'}}>
          <label style={{display: 'block', fontWeight: 'bold', marginBottom: '4px'}}>
            Test ID
          </label>
          <input
            type="text"
            value={formData.test_id}
            onChange={(e) => setFormData({...formData, test_id: e.target.value})}
            placeholder="e.g., login-001"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'borderBox'
            }}
          />
        </div>

        <div style={{marginBottom: '16px'}}>
          <label style={{display: 'block', fontWeight: 'bold', marginBottom: '4px'}}>
            Test URL <span style={{color: 'red'}}>*</span>
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({...formData, url: e.target.value})}
            placeholder="https://example.com/login"
            required
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{marginBottom: '16px'}}>
          <label style={{display: 'block', fontWeight: 'bold', marginBottom: '4px'}}>
            Environment Variables
          </label>
          <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
            <input
              type="text"
              value={envKey}
              onChange={(e) => setEnvKey(e.target.value)}
              placeholder="KEY"
              style={{
                flex: 1,
                padding: '6px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <input
              type="text"
              value={envValue}
              onChange={(e) => setEnvValue(e.target.value)}
              placeholder="value"
              style={{
                flex: 1,
                padding: '6px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <button
              type="button"
              onClick={addEnvironmentVar}
              style={{
                padding: '6px 12px',
                background: '#757575',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              +
            </button>
          </div>
          {Object.entries(formData.environment).map(([key, value]) => (
            <div key={key} style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>
              {key} = {value}
            </div>
          ))}
        </div>

        <div style={{marginBottom: '16px'}}>
          <label style={{display: 'block', fontWeight: 'bold', marginBottom: '4px'}}>
            Tags
          </label>
          <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              style={{
                flex: 1,
                padding: '6px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          <div>
            {formData.tags.map(tag => (
              <span
                key={tag}
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  background: '#e3f2fd',
                  color: '#1976d2',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginRight: '4px',
                  marginBottom: '4px'
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f44336',
                    cursor: 'pointer',
                    marginLeft: '4px',
                    fontSize: '14px'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <StepEditor steps={formData.test_steps} onChange={(steps) => setFormData({...formData, test_steps: steps})} />

        <div style={{display: 'flex', gap: '8px', marginTop: '16px'}}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              padding: '10px',
              background: submitting ? '#9e9e9e' : '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {submitting ? 'Creating...' : 'Create Test'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData({
                name: '',
                description: '',
                test_id: '',
                url: '',
                environment: {},
                tags: [],
                test_steps: [{ step_type: 'navigate', selector: '', value: '', order: 1 }]
              });
            }}
            style={{
              flex: 1,
              padding: '10px',
              background: '#757575',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

export default TestForm;
