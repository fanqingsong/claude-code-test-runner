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
