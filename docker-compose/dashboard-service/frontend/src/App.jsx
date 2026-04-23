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
      const response = await fetch('http://localhost:8012/api/v1/jobs/', {
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
