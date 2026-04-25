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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTest, setEditingTest] = useState(null);

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

  // 从hash初始化视图
  useEffect(() => {
    const hash = window.location.hash.slice(1); // 去掉#号
    if (hash === 'tests' || hash === 'dashboard') {
      setCurrentView(hash);
    }
  }, []);

  // 监听hash变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'tests' || hash === 'dashboard') {
        setCurrentView(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    loadTests();
  }, []);

  const handleTestCreated = () => {
    loadTests();
    setShowCreateForm(false);
    setEditingTest(null);
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

  const handleEditTest = (test) => {
    setEditingTest(test);
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setEditingTest(null);
    setShowCreateForm(false);
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
          onClick={() => window.location.hash = 'dashboard'}
          style={navButtonStyle(currentView === 'dashboard')}
        >
          📊 仪表板
        </button>
        <button
          onClick={() => window.location.hash = 'tests'}
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
            <div style={{flex: '3', padding: '20px', borderRight: '1px solid #ddd', position: 'relative'}}>
              {/* 创建测试按钮 */}
              <button
                onClick={() => {
                  setEditingTest(null);
                  setShowCreateForm(!showCreateForm);
                }}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  padding: '8px 16px',
                  background: showCreateForm ? '#f44336' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  zIndex: 10,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                {showCreateForm ? '✕ 取消' : (editingTest ? '✏️ 编辑中' : '+ 创建测试')}
              </button>

              {loading ? (
                <div>Loading tests...</div>
              ) : error ? (
                <div style={{color: 'red'}}>{error}</div>
              ) : (
                <TestList
                  tests={tests}
                  onRunTest={handleTestRun}
                  onEditTest={handleEditTest}
                />
              )}
            </div>

            {/* 创建/编辑测试表单 - 可收缩 */}
            {showCreateForm && (
              <div style={{
                flex: '2',
                padding: '20px',
                background: '#f5f5f5',
                borderLeft: editingTest ? '3px solid #ff9800' : '3px solid #4caf50',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 57px)'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                  <h2 style={{margin: 0, color: editingTest ? '#ff9800' : '#4caf50'}}>
                    {editingTest ? `✏️ 编辑测试: ${editingTest.name}` : '创建新测试'}
                  </h2>
                  <button
                    onClick={handleCancelEdit}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer',
                      color: '#666'
                    }}
                  >
                    ×
                  </button>
                </div>
                <TestForm
                  onTestCreated={handleTestCreated}
                  editingTest={editingTest}
                  onCancel={handleCancelEdit}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
