import React, { useState } from 'react';
import authService from '../services/authService';

function TestCard({ test, onRun, onViewDetails, onViewRunHistory, onEdit }) {
  const [isRunning, setIsRunning] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [steps, setSteps] = useState([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  const getStatusColor = (test) => {
    // This would come from test_runs data, simplified for now
    return '#e8f5e9';
  };

  const getStatusText = (test) => {
    return 'Never run';
  };

  const handleRun = () => {
    setIsRunning(true);
    onRun(test.id);
    // Reset running state after a delay (in real implementation, this would be tied to actual job completion)
    setTimeout(() => setIsRunning(false), 3000);
  };

  const handleToggleSteps = async () => {
    if (!showSteps && steps.length === 0) {
      setLoadingSteps(true);
      try {
        const response = await fetch(`/api/v1/test-steps/test-definition/${test.id}`);
,
        headers: authService.getAuthHeaders()
        if (response.ok) {
          const stepsData = await response.json();
          setSteps(stepsData);
        }
      } catch (err) {
        console.error('Failed to load steps:', err);
      } finally {
        setLoadingSteps(false);
      }
    }
    setShowSteps(!showSteps);
  };

  const getStepTypeLabel = (stepType) => {
    const labels = {
      'navigate': '🌐 导航',
      'click': '🖱️ 点击',
      'fill': '✏️ 填写',
      'wait': '⏰ 等待',
      'screenshot': '📸 截图',
      'assert': '✅ 断言'
    };
    return labels[stepType] || stepType;
  };

  const getStepDescription = (step) => {
    // If step has a description field, use it
    if (step.description) {
      return step.description;
    }
    // Otherwise, construct from technical fields (for backward compatibility)
    if (step.step_type) {
      const typeLabel = getStepTypeLabel(step.step_type);
      const details = [step.selector, step.value].filter(Boolean).join(' ');
      return details ? `${typeLabel}: ${details}` : typeLabel;
    }
    return 'No description';
  };

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '12px',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Running indicator */}
      {isRunning && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #4caf50, #8bc34a, #4caf50)',
          backgroundSize: '200% 100%',
          animation: 'progress 1.5s ease-in-out infinite'
        }}>
          <style>{`
            @keyframes progress {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </div>
      )}

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

          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <button
              onClick={handleToggleSteps}
              style={{
                padding: '4px 8px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#666'
              }}
            >
              {showSteps ? '▼ 隐藏步骤' : '▶ 查看步骤'} {steps.length > 0 && `(${steps.length})`}
            </button>

            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              background: getStatusColor(test),
              fontSize: '12px',
              color: '#666'
            }}>
              {getStatusText(test)}
            </span>
          </div>
        </div>

        <div style={{display: 'flex', gap: '8px'}}>
          <button
            onClick={() => onViewRunHistory(test)}
            style={{
              padding: '8px 12px',
              background: '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            📊 记录
          </button>
          <button
            onClick={() => onViewDetails(test)}
            style={{
              padding: '8px 12px',
              background: '#ff9800',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            👁️ 详情
          </button>
          <button
            onClick={() => onEdit(test)}
            style={{
              padding: '8px 12px',
              background: '#9c27b0',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ✏️ 编辑
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              padding: '8px 16px',
              background: isRunning ? '#9e9e9e' : '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              opacity: isRunning ? 0.7 : 1
            }}
          >
            {isRunning ? '⏳ 运行中...' : '▶ Run'}
          </button>
        </div>
      </div>

      {/* Test Steps */}
      {showSteps && (
        <div style={{marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee'}}>
          {loadingSteps ? (
            <div style={{textAlign: 'center', color: '#666', padding: '20px'}}>
              加载步骤中...
            </div>
          ) : steps.length > 0 ? (
            <div style={{background: '#f9f9f9', borderRadius: '6px', padding: '12px'}}>
              {steps.map((step, index) => (
                <div
                  key={step.id || index}
                  style={{
                    background: 'white',
                    padding: '8px',
                    marginBottom: '6px',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0',
                    fontSize: '13px'
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'flex-start'}}>
                    <span style={{
                      background: '#1976d2',
                      color: 'white',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      marginRight: '8px',
                      flexShrink: 0
                    }}>
                      {step.id || step.step_number || index + 1}
                    </span>
                    <span style={{flex: 1, color: '#333'}}>{getStepDescription(step)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
              padding: '12px',
              textAlign: 'center',
              color: '#856404',
              fontSize: '13px'
            }}>
              ⚠️ 此测试用例没有定义任何步骤
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TestCard;
