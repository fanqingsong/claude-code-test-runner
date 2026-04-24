import { useState, useEffect } from 'react';
import { getTests } from './api';
import TestList from './components/TestList';
import TestForm from './components/TestForm';
import DashboardView from './components/DashboardView';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
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

  const navStyle = {
    display: 'flex',
    background: '#1976d2',
    padding: '0 20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const navButtonStyle = (isActive) => ({
    padding: '16px 20px',
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    borderBottom: isActive ? '3px solid white' : '3px solid transparent',
    transition: 'all 0.2s'
  });

  return (
    <div style={{fontFamily: 'Arial, sans-serif', minHeight: '100vh'}}>
      {/* 导航栏 */}
      <nav style={navStyle}>
        <button
          onClick={() => setCurrentView('dashboard')}
          style={navButtonStyle(currentView === 'dashboard')}
        >
          📊 仪表板
        </button>
        <button
          onClick={() => setCurrentView('tests')}
          style={navButtonStyle(currentView === 'tests')}
        >
          🧪 测试管理
        </button>
      </nav>

      {/* 内容区域 */}
      <div>
        {currentView === 'dashboard' ? (
          <DashboardView />
        ) : (
          <div style={{display: 'flex', minHeight: 'calc(100vh - 57px)'}}>
            <div style={{flex: '3', padding: '20px', borderRight: '1px solid #ddd'}}>
              {loading ? (
                <div>Loading tests...</div>
              ) : error ? (
                <div style={{color: 'red'}}>{error}</div>
              ) : (
                <TestList tests={tests} onRunTest={handleTestRun} />
              )}
            </div>
            <div style={{flex: '2', padding: '20px', background: '#f5f5f5'}}>
              <TestForm onTestCreated={handleTestCreated} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
