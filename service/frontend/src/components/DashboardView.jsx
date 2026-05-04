import React, { useState, useEffect } from 'react';
import { getDashboardData, getTestRuns } from '../api';
import { useAuth } from '../contexts/AuthContext';
import StatsCards from './StatsCards';
// import ChartsSection from './ChartsSection';  // Temporarily disabled due to loading issues
import RecentTests from './RecentTests';

function DashboardView() {
  const { user, isAdmin } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    summary: {},
    byDay: [],
    totalDefinitions: 0
  });
  const [testRuns, setTestRuns] = useState([]);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardResponse, runsResponse] = await Promise.all([
        getDashboardData(parseInt(timeRange)).catch(err => {
          console.error('Dashboard API error:', err);
          return null;
        }),
        getTestRuns(20).catch(err => {
          console.error('Test runs API error:', err);
          return null;
        })
      ]);

      // Use real API data if available, otherwise show empty state
      // Don't use mock data - show actual data or empty state
      if (dashboardResponse) {
        setDashboardData(dashboardResponse);
      } else {
        // Set default empty structure
        setDashboardData({
          summary: {
            total_runs: 0,
            total_passed: 0,
            total_failed: 0,
            avg_duration: 0,
            total_tests: 0,
            successful_runs: 0,
            failed_runs: 0
          },
          byDay: [],
          totalDefinitions: 0,
          days: parseInt(timeRange)
        });
      }

      // Handle test runs response (direct array, not wrapped in object)
      if (Array.isArray(runsResponse)) {
        setTestRuns(runsResponse);
      } else if (runsResponse?.items && Array.isArray(runsResponse.items)) {
        setTestRuns(runsResponse.items);
      } else {
        setTestRuns([]);
      }
    } catch (err) {
      // Show error state instead of mock data
      console.error('Dashboard loading error:', err);
      setError('加载仪表盘数据失败: ' + err.message);
      setDashboardData({
        summary: {
          total_runs: 0,
          total_passed: 0,
          total_failed: 0,
          avg_duration: 0,
          total_tests: 0,
          successful_runs: 0,
          failed_runs: 0
        },
        byDay: [],
        totalDefinitions: 0,
        days: parseInt(timeRange)
      });
      setTestRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only load data if user is authenticated
    if (user) {
      loadDashboardData();
    }

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      if (user) {
        loadDashboardData();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [timeRange, user]);

  const handleTimeRangeChange = (newRange) => {
    setTimeRange(newRange);
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        fontSize: '16px',
        color: '#666'
      }}>
        加载仪表板数据中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        fontSize: '16px',
        color: '#f44336'
      }}>
        {error}
        <button
          onClick={loadDashboardData}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginLeft: '16px'
          }}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '8px',
        color: '#333'
      }}>
        测试仪表板
      </h1>

      {/* Role-based messaging */}
      <div style={{
        fontSize: '14px',
        color: '#666',
        marginBottom: '24px',
        padding: '12px 16px',
        background: isAdmin ? '#e3f2fd' : '#f5f5f5',
        borderRadius: '4px',
        borderLeft: `4px solid ${isAdmin ? '#2196f3' : '#9e9e9e'}`
      }}>
        {isAdmin ? '👑 管理员视图 - 查看所有用户的测试数据' : '👤 个人视图 - 仅显示您创建的测试数据'}
      </div>

      {/* 统计卡片 */}
      <StatsCards stats={dashboardData.summary || {}} totalDefinitions={dashboardData.totalDefinitions || 0} />

      {/* 图表区域 - 暂时禁用 */}
      {/*
      <ChartsSection
        dashboardData={dashboardData}
        timeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
      />
      */}

      {/* 最近测试运行 */}
      <div style={{ marginTop: '24px' }}>
        <RecentTests testRuns={testRuns} />
      </div>
    </div>
  );
}

export default DashboardView;