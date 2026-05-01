import { useState, useEffect } from 'react';
import { getTests } from './api';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './components/LoginPage';
import OidcCallback from './components/OidcCallback';
import TestList from './components/TestList';
import TestForm from './components/TestForm';
import DashboardView from './components/DashboardView';
import ScheduleList from './components/ScheduleList';
import ScheduleForm from './components/ScheduleForm';
import Modal from './components/Modal';
import authService from './services/authService';

function AppContent() {
  const { user, logout, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTest, setEditingTest] = useState(null);

  // Schedule states
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  const loadTests = async () => {
    // 只在用户已认证时才加载测试
    if (!isAuthenticated) {
      console.log('loadTests - User not authenticated, skipping');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getTests();
      setTests(data.items || data);
    } catch (err) {
      console.error('loadTests error:', err);
      setError('Failed to load tests: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 从hash初始化视图
  useEffect(() => {
    const hash = window.location.hash.slice(1); // 去掉#号
    if (hash === 'tests' || hash === 'dashboard' || hash === 'schedules') {
      setCurrentView(hash);
    }
  }, []);

  // 监听hash变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'tests' || hash === 'dashboard' || hash === 'schedules') {
        setCurrentView(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTests();
    }
  }, [isAuthenticated]);

  const handleTestCreated = () => {
    loadTests();
    setShowCreateForm(false);
    setEditingTest(null);
  };

  const handleTestRun = async (testId) => {
    try {
      const response = await fetch('/api/v1/jobs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
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

  // Schedule handlers
  const handleScheduleCreated = () => {
    // 触发列表刷新
    setScheduleRefreshKey(prev => prev + 1);
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setShowScheduleForm(true);
  };

  const handleTriggerSchedule = async (scheduleId) => {
    try {
      const response = await fetch(`/api/v1/schedules/${scheduleId}/trigger`, {
        method: 'POST',
        headers: {
          ...authService.getAuthHeaders()
        }
      });
      if (response.ok) {
        alert('调度已触发！');
      } else {
        alert('触发失败');
      }
    } catch (err) {
      alert('错误: ' + err.message);
    }
  };

  const handleToggleSchedule = async (scheduleId, isActive) => {
    try {
      const response = await fetch(`/api/v1/schedules/${scheduleId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders()
        },
        body: JSON.stringify({ is_active: isActive })
      });
      if (response.ok) {
        handleScheduleCreated();
      } else {
        throw new Error('Failed to toggle schedule');
      }
    } catch (err) {
      alert('错误: ' + err.message);
    }
  };

  const navStyle = {
    display: 'flex',
    background: 'var(--cds-background-inverse)',
    padding: 'var(--cds-nav-padding)',
    height: 'var(--cds-nav-height)',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const navButtonStyle = (isActive) => ({
    padding: '16px 20px',
    background: 'none',
    border: 'none',
    color: isActive ? 'var(--cds-background)' : 'var(--cds-border-subtle)',
    cursor: 'pointer',
    fontSize: 'var(--cds-body-short-01)',
    fontWeight: 'var(--cds-font-weight-regular)',
    borderBottom: isActive ? '2px solid var(--cds-background)' : '2px solid transparent',
    transition: 'all var(--cds-transition-normal)',
    height: '100%',
    display: 'flex',
    alignItems: 'center'
  });

  // Check if user is on login page or OIDC callback
  const isAuthPage = window.location.hash === '#login' || window.location.hash.startsWith('#/oidc/callback');

  if (!isAuthenticated && !isAuthPage) {
    // Redirect to login
    window.location.hash = 'login';
    return null;
  }

  if (isAuthPage) {
    if (window.location.hash.startsWith('#/oidc/callback')) {
      return <OidcCallback />;
    }
    return <LoginPage />;
  }

  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
      {/* 导航栏 */}
      <nav style={navStyle}>
        <div style={{display: 'flex'}}>
          <button
            onClick={() => window.location.hash = 'dashboard'}
            style={navButtonStyle(currentView === 'dashboard')}
          >
            仪表板
          </button>
          <button
            onClick={() => window.location.hash = 'tests'}
            style={navButtonStyle(currentView === 'tests')}
          >
            测试管理
          </button>
          <button
            onClick={() => window.location.hash = 'schedules'}
            style={navButtonStyle(currentView === 'schedules')}
          >
            调度配置
          </button>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <span style={{color: 'var(--cds-text-on-color)', fontSize: '14px'}}>
            {user?.username || user?.email}
          </span>
          <button
            onClick={logout}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--cds-text-on-color)',
              border: '1px solid var(--cds-border-subtle)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            退出登录
          </button>
        </div>
      </nav>

      {/* 内容区域 */}
      <div>
        {currentView === 'dashboard' ? (
          <DashboardView />
        ) : currentView === 'schedules' ? (
          <div style={{padding: 'var(--cds-layout-sm)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--cds-layout-md)'}}>
              <h2 style={{
                margin: 0,
                fontSize: 'var(--cds-heading-01)',
                fontWeight: 'var(--cds-font-weight-light)',
                lineHeight: 'var(--cds-display-line-height)'
              }}>调度配置</h2>
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setShowScheduleForm(true);
                }}
                style={{
                  padding: 'var(--cds-button-padding-sm)',
                  background: 'var(--cds-button-primary)',
                  color: 'var(--cds-text-on-color)',
                  border: 'none',
                  borderRadius: 'var(--cds-border-radius)',
                  cursor: 'pointer',
                  fontWeight: 'var(--cds-font-weight-regular)',
                  fontSize: 'var(--cds-body-short-01)',
                  height: 'var(--cds-button-height-compact)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--cds-spacing-sm)'
                }}
              >
                <span>+</span>
                <span>创建调度</span>
              </button>
            </div>

            <ScheduleList
              refreshKey={scheduleRefreshKey}
              onEditSchedule={handleEditSchedule}
              onTriggerSchedule={handleTriggerSchedule}
              onToggleSchedule={handleToggleSchedule}
            />

            {/* 创建/编辑调度 Modal */}
            <Modal
              isOpen={showScheduleForm}
              onClose={() => {
                setEditingSchedule(null);
                setShowScheduleForm(false);
              }}
              title={editingSchedule ? `✏️ 编辑调度: ${editingSchedule.name}` : '✨ 创建新调度'}
            >
              <ScheduleForm
                onScheduleCreated={() => {
                  handleScheduleCreated();
                  setShowScheduleForm(false);
                }}
                editingSchedule={editingSchedule}
                onCancel={() => {
                  setEditingSchedule(null);
                  setShowScheduleForm(false);
                }}
              />
            </Modal>
          </div>
        ) : (
          <div style={{padding: 'var(--cds-layout-sm)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--cds-layout-md)'}}>
              <h2 style={{
                margin: 0,
                fontSize: 'var(--cds-heading-01)',
                fontWeight: 'var(--cds-font-weight-light)',
                lineHeight: 'var(--cds-display-line-height)'
              }}>测试管理</h2>
              <button
                onClick={() => {
                  setEditingTest(null);
                  setShowCreateForm(true);
                }}
                style={{
                  padding: 'var(--cds-button-padding-sm)',
                  background: 'var(--cds-button-primary)',
                  color: 'var(--cds-text-on-color)',
                  border: 'none',
                  borderRadius: 'var(--cds-border-radius)',
                  cursor: 'pointer',
                  fontWeight: 'var(--cds-font-weight-regular)',
                  fontSize: 'var(--cds-body-short-01)',
                  height: 'var(--cds-button-height-compact)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--cds-spacing-sm)'
                }}
              >
                <span>+</span>
                <span>创建测试</span>
              </button>
            </div>

            {loading ? (
              <div>加载中...</div>
            ) : error ? (
              <div style={{color: 'red'}}>{error}</div>
            ) : (
              <TestList
                tests={tests}
                onRunTest={handleTestRun}
                onEditTest={handleEditTest}
              />
            )}

            {/* 创建/编辑测试 Modal */}
            <Modal
              isOpen={showCreateForm}
              onClose={() => {
                setEditingTest(null);
                setShowCreateForm(false);
              }}
              title={editingTest ? `✏️ 编辑测试: ${editingTest.name}` : '✨ 创建新测试'}
            >
              <TestForm
                onTestCreated={() => {
                  handleTestCreated();
                  setShowCreateForm(false);
                }}
                editingTest={editingTest}
                onCancel={() => {
                  setEditingTest(null);
                  setShowCreateForm(false);
                }}
              />
            </Modal>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap app with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
