import React from 'react';

function RecentTests({ testRuns = [] }) {
  // 如果没有真实数据，使用模拟数据
  const displayData = testRuns.length > 0 ? testRuns : generateMockData();

  const getStatusBadge = (status) => {
    const styles = {
      passed: {
        background: '#e8f5e9',
        color: '#2e7d32',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500'
      },
      failed: {
        background: '#ffebee',
        color: '#c62828',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500'
      },
      running: {
        background: '#e3f2fd',
        color: '#1565c0',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500'
      }
    };
    return styles[status] || styles.running;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333'
      }}>
        最近测试运行
      </h3>

      {displayData.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#888'
        }}>
          暂无测试运行记录
        </div>
      ) : (
        <div style={{
          overflowX: 'auto'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{
                borderBottom: '2px solid #e0e0e0',
                textAlign: 'left'
              }}>
                <th style={{
                  padding: '12px 8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}>
                  测试名称
                </th>
                <th style={{
                  padding: '12px 8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}>
                  状态
                </th>
                <th style={{
                  padding: '12px 8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}>
                  执行时长
                </th>
                <th style={{
                  padding: '12px 8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#666'
                }}>
                  执行时间
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((run, index) => (
                <tr
                  key={run.id || index}
                  style={{
                    borderBottom: '1px solid #f0f0f0',
                    hover: {
                      background: '#f5f5f5'
                    }
                  }}
                >
                  <td style={{
                    padding: '12px 8px',
                    fontSize: '14px',
                    color: '#333'
                  }}>
                    {run.test_name || run.name || `Test #${index + 1}`}
                  </td>
                  <td style={{
                    padding: '12px 8px'
                  }}>
                    <span style={getStatusBadge(run.status || 'running')}>
                      {run.status === 'passed' ? '通过' :
                       run.status === 'failed' ? '失败' : '运行中'}
                    </span>
                  </td>
                  <td style={{
                    padding: '12px 8px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    {formatDuration(run.duration)}
                  </td>
                  <td style={{
                    padding: '12px 8px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    {formatTime(run.timestamp || run.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 生成模拟数据
function generateMockData() {
  const statuses = ['passed', 'passed', 'passed', 'failed', 'running'];
  const data = [];

  for (let i = 0; i < 10; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const timestamp = new Date(Date.now() - Math.random() * 3600000);

    data.push({
      id: `run-${i}`,
      test_name: `测试用例 ${i + 1}`,
      status,
      duration: status === 'running' ? null : Math.random() * 120 + 20,
      timestamp: timestamp.toISOString()
    });
  }

  return data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export default RecentTests;