import { useState } from 'react';
import TestCard from './TestCard';
import TestRunModal from './TestRunModal';
import TestDetailModal from './TestDetailModal';
import RunHistoryModal from './RunHistoryModal';

function TestList({ tests, onRunTest, onEditTest }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [runningJob, setRunningJob] = useState(null);
  const [detailTest, setDetailTest] = useState(null);
  const [historyTest, setHistoryTest] = useState(null);

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (test.description && test.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = !selectedTag || (test.tags && test.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const allTags = [...new Set(tests.flatMap(t => t.tags || []))];

  const handleTestRun = async (testId) => {
    try {
      console.log('Starting test with ID:', testId);

      if (!testId) {
        alert('测试ID无效，无法启动测试');
        return null;
      }

      const numericTestId = parseInt(testId);
      if (isNaN(numericTestId)) {
        alert('测试ID格式无效');
        return null;
      }

      const requestData = { test_definition_ids: [numericTestId] };

      const response = await fetch('http://localhost:8012/api/v1/jobs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const job = await response.json();
        const test = tests.find(t => t.id === testId);

        // 显示运行状态模态框
        setRunningJob({
          jobId: job.job_id,
          testInfo: { name: test?.name || 'Unknown', id: testId }
        });

        return job;
      } else {
        const errorText = await response.text();
        alert(`启动测试失败: ${response.status} ${response.statusText}\n详情: ${errorText}`);
        return null;
      }
    } catch (err) {
      alert('启动测试时出错: ' + err.message);
      return null;
    }
  };

  const handleCloseModal = () => {
    setRunningJob(null);
  };

  const handleViewDetails = (test) => {
    setDetailTest(test);
  };

  const handleViewRunHistory = (test) => {
    setHistoryTest(test);
  };

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
        filteredTests.map(test => {
          if (!test.id) {
            console.warn('Test missing id:', test);
            return null;
          }
          return (
            <TestCard
              key={test.id}
              test={test}
              onRun={handleTestRun}
              onViewDetails={handleViewDetails}
              onViewRunHistory={handleViewRunHistory}
              onEdit={onEditTest}
            />
          );
        })
      )}

      {/* Test Run Status Modal */}
      {runningJob && (
        <TestRunModal
          jobId={runningJob.jobId}
          testInfo={runningJob.testInfo}
          onClose={handleCloseModal}
        />
      )}

      {/* Test Detail Modal */}
      {detailTest && (
        <TestDetailModal
          test={detailTest}
          onClose={() => setDetailTest(null)}
          onViewRunHistory={handleViewRunHistory}
        />
      )}

      {/* Run History Modal */}
      {historyTest && (
        <RunHistoryModal
          test={historyTest}
          onClose={() => setHistoryTest(null)}
        />
      )}
    </div>
  );
}

export default TestList;
