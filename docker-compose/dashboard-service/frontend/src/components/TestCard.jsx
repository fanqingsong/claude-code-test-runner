import React, { useState } from 'react';

function TestCard({ test, onRun }) {
  const [isRunning, setIsRunning] = useState(false);

  const getStatusColor = (test) => {
    // This would come from test_runs data, simplified for now
    return '#e8f5e9';
  };

  const getStatusText = (test) => {
    return 'Never run';
  };

  const handleRun = () => {
    setIsRunning(true);
    onRun();
    // Reset running state after a delay (in real implementation, this would be tied to actual job completion)
    setTimeout(() => setIsRunning(false), 3000);
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
  );
}

export default TestCard;
