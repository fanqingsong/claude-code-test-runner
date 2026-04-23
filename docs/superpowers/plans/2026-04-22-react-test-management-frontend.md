# React Test Management Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal React frontend for internal team to create, view, and run tests

**Architecture:** React SPA served by Express dashboard service, integrates with existing FastAPI backends (Test Case Service on port 8011, Scheduler Service on port 8012)

**Tech Stack:** React 18, Vite, Axios, Express.js

---

## File Structure

**New files to create:**
```
dashboard-service/frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── TestList.jsx
│   │   ├── TestCard.jsx
│   │   ├── TestForm.jsx
│   │   └── StepEditor.jsx
│   ├── api.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── .gitignore
```

**Files to modify:**
```
dashboard-service/src/server.js (serve React build)
dashboard-service/package.json (add frontend scripts)
dashboard-service/Dockerfile (build frontend during Docker build)
```

---

### Task 1: Initialize React + Vite Project

**Files:**
- Create: `dashboard-service/frontend/package.json`
- Create: `dashboard-service/frontend/vite.config.js`
- Create: `dashboard-service/frontend/index.html`

- [ ] **Step 1: Create package.json with dependencies**

```json
{
  "name": "test-management-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8003',
        changeOrigin: true
      }
    }
  }
});
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test Management</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create .gitignore**

```
# Dependencies
node_modules/

# Build output
dist/

# Logs
*.log

# Editor
.vscode/
.idea/
```

- [ ] **Step 5: Commit**

```bash
cd dashboard-service/frontend
git add package.json vite.config.js index.html .gitignore
git commit -m "feat: initialize React + Vite project"
```

---

### Task 2: Create Entry Points and Root Component

**Files:**
- Create: `dashboard-service/frontend/src/main.jsx`
- Create: `dashboard-service/frontend/src/App.jsx`
- Create: `dashboard-service/frontend/src/index.css`

- [ ] **Step 1: Create main.jsx entry point**

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Create App.jsx root component**

```javascript
import { useState, useEffect } from 'react';
import { getTests } from './api';
import TestList from './components/TestList';
import TestForm from './components/TestForm';

function App() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTests();
      setTests(data.items || data);
    } catch (err) {
      setError('Failed to load tests: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTests();
  }, []);

  const handleTestCreated = () => {
    loadTests();
  };

  const handleTestRun = async (testId) => {
    try {
      const response = await fetch('http://localhost:8012/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_definition_ids: [testId] })
      });
      if (response.ok) {
        const job = await response.json();
        alert(`Test started! Job ID: ${job.job_id}`);
      } else {
        alert('Failed to start test');
      }
    } catch (err) {
      alert('Error starting test: ' + err.message);
    }
  };

  if (loading) return <div style={{padding: '20px'}}>Loading tests...</div>;
  if (error) return <div style={{padding: '20px', color: 'red'}}>{error}</div>;

  return (
    <div style={{display: 'flex', minHeight: '100vh', fontFamily: 'Arial, sans-serif'}}>
      <div style={{flex: '3', padding: '20px', borderRight: '1px solid #ddd'}}>
        <TestList tests={tests} onRunTest={handleTestRun} />
      </div>
      <div style={{flex: '2', padding: '20px', background: '#f5f5f5'}}>
        <TestForm onTestCreated={handleTestCreated} />
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Create index.css with basic styles**

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
}

input, select, textarea, button {
  font-family: inherit;
  font-size: 14px;
}

button {
  cursor: pointer;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx src/App.jsx src/index.css
git commit -m "feat: add React entry points and root App component"
```

---

### Task 3: Create API Client

**Files:**
- Create: `dashboard-service/frontend/src/api.js`

- [ ] **Step 1: Write API client functions**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/api.js
git commit -m "feat: add API client for test operations"
```

---

### Task 4: Create TestList Component

**Files:**
- Create: `dashboard-service/frontend/src/components/TestList.jsx`

- [ ] **Step 1: Write TestList component**

```javascript
import { useState } from 'react';
import TestCard from './TestCard';

function TestList({ tests, onRunTest }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (test.description && test.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = !selectedTag || (test.tags && test.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const allTags = [...new Set(tests.flatMap(t => t.tags || []))];

  return (
    <div>
      <h2 style={{marginTop: 0, marginBottom: '16px'}}>Test Cases ({tests.length})</h2>
      
      <input
        type="text"
        placeholder="Search tests..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px'
        }}
      />
      
      {allTags.length > 0 && (
        <div style={{marginBottom: '16px'}}>
          <button
            onClick={() => setSelectedTag(null)}
            style={{
              padding: '4px 8px',
              marginRight: '4px',
              marginBottom: '4px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: !selectedTag ? '#1976d2' : '#fff',
              color: !selectedTag ? '#fff' : '#000'
            }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '4px 8px',
                marginRight: '4px',
                marginBottom: '4px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: selectedTag === tag ? '#1976d2' : '#fff',
                color: selectedTag === tag ? '#fff' : '#000'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      
      {filteredTests.length === 0 ? (
        <p style={{color: '#666'}}>No tests found</p>
      ) : (
        filteredTests.map(test => (
          <TestCard key={test.id} test={test} onRun={() => onRunTest(test.id)} />
        ))
      )}
    </div>
  );
}

export default TestList;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TestList.jsx
git commit -m "feat: add TestList component with search and filter"
```

---

### Task 5: Create TestCard Component

**Files:**
- Create: `dashboard-service/frontend/src/components/TestCard.jsx`

- [ ] **Step 1: Write TestCard component**

```javascript
function TestCard({ test, onRun }) {
  const getStatusColor = (test) => {
    // This would come from test_runs data, simplified for now
    return '#e8f5e9';
  };

  const getStatusText = (test) => {
    return 'Never run';
  };

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '12px',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div style={{flex: 1}}>
          <h3 style={{margin: '0 0 4px 0', color: '#1976d2', fontSize: '16px'}}>
            {test.name}
          </h3>
          
          {test.test_id && (
            <div style={{fontSize: '12px', color: '#666', marginBottom: '4px'}}>
              Test ID: {test.test_id}
            </div>
          )}
          
          {test.description && (
            <div style={{fontSize: '13px', color: '#333', marginBottom: '8px'}}>
              {test.description}
            </div>
          )}
          
          {test.tags && test.tags.length > 0 && (
            <div style={{marginBottom: '8px'}}>
              {test.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    fontSize: '11px',
                    background: '#e3f2fd',
                    color: '#1976d2',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginRight: '4px'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <div style={{fontSize: '12px', color: '#666'}}>
            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              background: getStatusColor(test)
            }}>
              {getStatusText(test)}
            </span>
          </div>
        </div>
        
        <button
          onClick={onRun}
          style={{
            padding: '8px 16px',
            background: '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          ▶ Run
        </button>
      </div>
    </div>
  );
}

export default TestCard;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TestCard.jsx
git commit -m "feat: add TestCard component with run button"
```

---

### Task 6: Create StepEditor Component

**Files:**
- Create: `dashboard-service/frontend/src/components/StepEditor.jsx`

- [ ] **Step 1: Write StepEditor component**

```javascript
function StepEditor({ steps, onChange }) {
  const stepTypes = ['navigate', 'click', 'fill', 'wait'];

  const addStep = () => {
    const newStep = {
      step_type: 'navigate',
      selector: '',
      value: '',
      order: steps.length + 1
    };
    onChange([...steps, newStep]);
  };

  const updateStep = (index, field, value) => {
    const updatedSteps = [...steps];
    updatedSteps[index][field] = value;
    onChange(updatedSteps);
  };

  const removeStep = (index) => {
    const updatedSteps = steps.filter((_, i) => i !== index);
    // Update order numbers
    updatedSteps.forEach((step, i) => step.order = i + 1);
    onChange(updatedSteps);
  };

  return (
    <div>
      <div style={{marginBottom: '12px', fontWeight: 'bold'}}>
        Test Steps ({steps.length})
      </div>
      
      {steps.map((step, index) => (
        <div
          key={index}
          style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '8px',
            background: '#fafafa'
          }}
        >
          <div style={{marginBottom: '8px', fontSize: '12px', color: '#666'}}>
            Step {step.order}
          </div>
          
          <select
            value={step.step_type}
            onChange={(e) => updateStep(index, 'step_type', e.target.value)}
            style={{
              width: '100%',
              padding: '6px',
              marginBottom: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            {stepTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Selector (optional for navigate, wait)"
            value={step.selector}
            onChange={(e) => updateStep(index, 'selector', e.target.value)}
            style={{
              width: '100%',
              padding: '6px',
              marginBottom: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          
          <input
            type="text"
            placeholder="Value"
            value={step.value}
            onChange={(e) => updateStep(index, 'value', e.target.value)}
            style={{
              width: '100%',
              padding: '6px',
              marginBottom: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          
          <button
            onClick={() => removeStep(index)}
            style={{
              padding: '4px 8px',
              background: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Remove
          </button>
        </div>
      ))}
      
      <button
        onClick={addStep}
        style={{
          width: '100%',
          padding: '8px',
          background: '#2196f3',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        + Add Step
      </button>
    </div>
  );
}

export default StepEditor;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StepEditor.jsx
git commit -m "feat: add StepEditor component with add/remove functionality"
```

---

### Task 7: Create TestForm Component

**Files:**
- Create: `dashboard-service/frontend/src/components/TestForm.jsx`

- [ ] **Step 1: Write TestForm component**

```javascript
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
              boxSizing: 'border-box'
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TestForm.jsx
git commit -m "feat: add TestForm component with validation"
```

---

### Task 8: Update Express Server to Serve React App

**Files:**
- Modify: `dashboard-service/src/server.js`

- [ ] **Step 1: Read current server.js to understand structure**

Run: `head -50 dashboard-service/src/server.js`

Expected: See current Express setup with API routes

- [ ] **Step 2: Add static file serving for React build**

Add after line 20 (after middleware setup, before routes):

```javascript
// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(process.cwd(), 'frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(join(process.cwd(), 'frontend/dist/index.html'));
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/server.js
git commit -m "feat: serve React frontend in production"
```

---

### Task 9: Update Root package.json Scripts

**Files:**
- Modify: `dashboard-service/package.json`

- [ ] **Step 1: Read current package.json**

Run: `cat dashboard-service/package.json`

Expected: See current scripts and dependencies

- [ ] **Step 2: Add frontend development and build scripts**

Add to "scripts" section:

```json
"frontend:dev": "cd frontend && npm run dev",
"frontend:build": "cd frontend && npm run build",
"dev:full": "concurrently \"npm run dev\" \"npm run frontend:dev\""
```

Add to "devDependencies" (create if doesn't exist):

```json
"concurrently": "^8.2.0"
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add frontend build and dev scripts"
```

---

### Task 10: Update Dockerfile to Build Frontend

**Files:**
- Modify: `dashboard-service/Dockerfile`

- [ ] **Step 1: Read current Dockerfile**

Run: `cat dashboard-service/Dockerfile`

Expected: See Node.js build steps

- [ ] **Step 2: Add frontend build step before copying app code**

After "RUN npm install --production" (around line 9), add:

```dockerfile
# Build frontend
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install
RUN npm run build

WORKDIR /app
```

- [ ] **Step 3: Commit**

```bash
git add dashboard-service/Dockerfile
git commit -m "feat: build React frontend during Docker build"
```

---

### Task 11: Create Public Assets

**Files:**
- Create: `dashboard-service/frontend/public/vite.svg`

- [ ] **Step 1: Create placeholder vite.svg**

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="#3b82f6"/>
  <text x="50" y="55" font-size="24" text-anchor="middle" fill="white">TM</text>
</svg>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/public/vite.svg
git commit -m "feat: add vite logo placeholder"
```

---

### Task 12: Manual Testing and Verification

**Files:**
- Test: All components and integration

- [ ] **Step 1: Install frontend dependencies**

Run: 
```bash
cd dashboard-service/frontend
npm install
```

Expected: Dependencies installed successfully

- [ ] **Step 2: Start development server**

Run:
```bash
cd dashboard-service/frontend
npm run dev
```

Expected: Vite server starts on http://localhost:5173

- [ ] **Step 3: Open browser to test**

Run: Open http://localhost:5173 in browser

Expected: React app loads with test list and form

- [ ] **Step 4: Test creating a test**

In browser:
1. Fill in test name: "Test 1"
2. Fill in URL: "https://example.com"
3. Add a navigate step with value "https://example.com"
4. Click "Create Test"

Expected: Success alert, test appears in list

- [ ] **Step 5: Test running a test**

In browser:
1. Click "▶ Run" button on a test card
2. Check for success alert with job ID

Expected: Alert shows job ID

- [ ] **Step 6: Test search functionality**

In browser:
1. Type in search box
2. Verify list filters

Expected: Only matching tests shown

- [ ] **Step 7: Test tag filtering**

In browser:
1. Click a tag button
2. Verify only tests with that tag shown
3. Click "All" to reset

Expected: Tag filter works correctly

- [ ] **Step 8: Build production version**

Run:
```bash
cd dashboard-service/frontend
npm run build
```

Expected: Build completes, dist/ directory created

- [ ] **Step 9: Verify production build**

Run:
```bash
ls -la frontend/dist/
```

Expected: index.html and assets present

- [ ] **Step 10: Commit any fixes discovered during testing**

If any issues found and fixed:
```bash
git add .
git commit -m "fix: address issues found during manual testing"
```

---

### Task 13: Update Documentation

**Files:**
- Modify: `dashboard-service/README.md` (or create if doesn't exist)

- [ ] **Step 1: Check if README exists**

Run: `ls dashboard-service/README.md 2>/dev/null || echo "Does not exist"`

- [ ] **Step 2: Create or update README with frontend instructions**

If exists, append to it. If not, create new file:

```markdown
# Dashboard Service

Provides test analytics dashboard and test management UI.

## Development

### Backend Development
```bash
npm start
```
Server runs on port 8003.

### Frontend Development
```bash
cd frontend
npm run dev
```
React dev server runs on port 5173.

### Full Stack Development
```bash
npm run dev:full
```
Runs both backend and frontend concurrently.

## Building

### Production Build
```bash
# Build frontend only
cd frontend
npm run build

# Build Docker image (includes frontend build)
docker-compose build dashboard-service
```

## Features

- **Test List View:** View all tests with search and tag filtering
- **Test Creation:** Create new tests with steps via web UI
- **Test Execution:** Trigger test runs directly from the UI
- **Analytics Dashboard:** View test metrics and trends

## API Endpoints

- `GET /health` - Health check
- `GET /api/dashboard` - Dashboard summary
- `GET /api/test-runs` - Recent test runs
- And more analytics endpoints...

See [API Documentation](../../README.md#api-endpoints) for full API reference.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add frontend development and build instructions"
```

---

### Task 14: Final Integration Test

**Files:**
- Test: Complete Docker workflow

- [ ] **Step 1: Stop any running services**

Run:
```bash
docker compose down
```

Expected: All services stopped

- [ ] **Step 2: Rebuild with frontend changes**

Run:
```bash
docker compose build dashboard-service
```

Expected: Docker build completes with frontend included

- [ ] **Step 3: Start all services**

Run:
```bash
docker compose up -d
```

Expected: All services start, including dashboard

- [ ] **Step 4: Verify frontend is accessible**

Run:
```bash
curl -I http://localhost:8013
```

Expected: 200 OK response

- [ ] **Step 5: Test creating test via frontend**

In browser at http://localhost:8013:
1. Create a new test with steps
2. Verify it appears in the list
3. Run the test
4. Verify job is created

Expected: Full workflow works end-to-end

- [ ] **Step 6: Verify backend APIs still work**

Run:
```bash
curl http://localhost:8011/api/v1/test-definitions
```

Expected: Returns list of tests

- [ ] **Step 7: Commit final documentation if needed**

If any issues found:
```bash
git add .
git commit -m "fix: final integration test fixes"
```

---

## Completion Checklist

After implementing all tasks, verify:

- [ ] React dev server runs on port 5173
- [ ] Can create tests via web UI
- [ ] Can view test list with search/filter
- [ ] Can trigger test runs
- [ ] Production build creates dist/ directory
- [ ] Docker image includes built frontend
- [ ] Express serves React app in production
- [ ] All documentation updated

**Ready for deployment!** The React frontend is complete and integrated with your existing microservices.
