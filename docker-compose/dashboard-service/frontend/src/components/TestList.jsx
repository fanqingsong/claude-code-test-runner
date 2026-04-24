import { useState } from 'react';
import TestCard from './TestCard';
import TestRunModal from './TestRunModal';

function TestList({ tests, onRunTest }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [runningJob, setRunningJob] = useState(null); // { jobId, testInfo }

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (test.description && test.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesTag = !selectedTag || (test.tags && test.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const allTags = [...new Set(tests.flatMap(t => t.tags || []))];

  const handleTestRun = async (testId, testName) => {
    try {
      // 验证testId
      console.log('Original testId:', testId, 'Type:', typeof testId);

      if (!testId) {
        console.error('testId is null or undefined');
        alert('测试ID无效，无法启动测试');
        return null;
      }

      const numericTestId = parseInt(testId);
      if (isNaN(numericTestId)) {
        console.error('testId is not a valid number:', testId);
        alert('测试ID格式无效');
        return null;
      }

      const requestData = { test_definition_ids: [numericTestId] };
      console.log('Starting test with data:', requestData);

      const response = await fetch('http://localhost:8012/api/v1/jobs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify(requestData)
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const job = await response.json();
        console.log('Job created successfully:', job);

        // 显示运行状态模态框
        setRunningJob({
          jobId: job.job_id,
          testInfo: { name: testName, id: testId }
        });

        return job;
      } else {
        const errorText = await response.text();
        console.error('Failed to start test. Status:', response.status);
        console.error('Error response:', errorText);
        alert(`启动测试失败: ${response.status} ${response.statusText}\n详情: ${errorText}`);
        return null;
      }
    } catch (err) {
      console.error('Error starting test:', err);
      alert('启动测试时出错: ' + err.message);
      return null;
    }
  };

  const handleCloseModal = () => {
    setRunningJob(null);
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
          // 确保test.id存在且有效
          if (!test.id) {
            console.warn('Test missing id:', test);
            return null;
          }
          return (
            <TestCard
              key={test.id}
              test={test}
              onRun={(testId) => handleTestRun(testId, test.name)}
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
    </div>
  );
}

export default TestList;
