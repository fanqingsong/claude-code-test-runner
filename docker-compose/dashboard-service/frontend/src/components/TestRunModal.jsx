import React from 'react';
import { useTestJobStatus } from '../hooks/useTestJobStatus';

function TestRunModal({ jobId, testInfo, onClose }) {
  const { status, loading, error, isRunning, isCompleted } = useTestJobStatus(jobId);

  const getProgressPercentage = () => {
    if (!status) return 0;
    return status.progress ? Math.round(status.progress * 100) : 0;
  };

  const getStatusColor = () => {
    if (!status) return '#1976d2';
    switch (status.status) {
      case 'completed': return '#4caf50';
      case 'failed': return '#f44336';
      case 'running': return '#ff9800';
      case 'pending': return '#2196f3';
      default: return '#666';
    }
  };

  const getStatusText = () => {
    if (!status) return '初始化中...';
    switch (status.status) {
      case 'completed': return '✅ 测试完成';
      case 'failed': return '❌ 测试失败';
      case 'running': return '🔄 运行中';
      case 'pending': return '⏳ 等待中';
      default: return status.status;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('zh-CN');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            测试运行详情
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0 8px'
            }}
          >
            ×
          </button>
        </div>

        {/* Test Info */}
        <div style={{
          background: '#f5f5f5',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
            测试名称
          </div>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#333' }}>
            {testInfo?.name || '未知测试'}
          </div>
          {testInfo?.description && (
            <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              {testInfo.description}
            </div>
          )}
        </div>

        {/* Status Card */}
        <div style={{
          border: '2px solid',
          borderColor: getStatusColor(),
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          background: `${getStatusColor()}10`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '32px',
              marginRight: '12px'
            }}>
              {getStatusText().split(' ')[0]}
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                {getStatusText().split(' ').slice(1).join(' ')}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {status?.message || '正在执行测试...'}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {isRunning && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '14px'
              }}>
                <span>执行进度</span>
                <span style={{ fontWeight: 'bold' }}>{getProgressPercentage()}%</span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${getProgressPercentage()}%`,
                  height: '100%',
                  background: getStatusColor(),
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: '#666'
            }}>
              <div style={{
                display: 'inline-block',
                width: '20px',
                height: '20px',
                border: '3px solid #f3f3f3',
                borderTop: '3px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '8px'
              }} />
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <div>正在获取最新状态...</div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '12px',
              borderRadius: '4px',
              marginTop: '12px'
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Time Information */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: '#f9f9f9',
            padding: '12px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              开始时间
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
              {formatTime(status?.started_at)}
            </div>
          </div>
          <div style={{
            background: '#f9f9f9',
            padding: '12px',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
              完成时间
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
              {formatTime(status?.completed_at)}
            </div>
          </div>
        </div>

        {/* Results (if completed) */}
        {isCompleted && status?.results && (
          <div style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
              测试结果
            </div>
            <pre style={{
              fontSize: '14px',
              color: '#333',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0
            }}>
              {JSON.stringify(status.results, null, 2)}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          {isCompleted && (
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              查看完整结果
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: '#f5f5f5',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {isCompleted ? '关闭' : '在后台运行'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestRunModal;