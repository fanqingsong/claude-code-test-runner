import { useState } from 'react';
import TestCard from './TestCard';

function TestList({ tests, onRunTest }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (test.description && test.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = !selectedTag || (test.tags && test.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const allTags = [...new Set(tests.flatMap(t => t.tags || []))];

  return (
    <div>
      <h2 style={{marginTop: 0, marginBottom: '16px'}}>Test Cases ({tests.length})</h2>
      
      <input
        type="text"
        placeholder="Search tests..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px'
        }}
      />
      
      {allTags.length > 0 && (
        <div style={{marginBottom: '16px'}}>
          <button
            onClick={() => setSelectedTag(null)}
            style={{
              padding: '4px 8px',
              marginRight: '4px',
              marginBottom: '4px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: !selectedTag ? '#1976d2' : '#fff',
              color: !selectedTag ? '#fff' : '#000'
            }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              style={{
                padding: '4px 8px',
                marginRight: '4px',
                marginBottom: '4px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: selectedTag === tag ? '#1976d2' : '#fff',
                color: selectedTag === tag ? '#fff' : '#000'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      
      {filteredTests.length === 0 ? (
        <p style={{color: '#666'}}>No tests found</p>
      ) : (
        filteredTests.map(test => (
          <TestCard key={test.id} test={test} onRun={() => onRunTest(test.id)} />
        ))
      )}
    </div>
  );
}

export default TestList;
