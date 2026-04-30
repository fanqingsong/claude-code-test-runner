import React, { useState } from 'react';
import TestRunDetailModal from './TestRunDetailModal';
import './RecentTests.css';

function RecentTests({ testRuns = [], onRefresh }) {
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedRun, setSelectedRun] = useState(null);

  // 如果没有真实数据，使用模拟数据
  const displayData = testRuns.length > 0 ? testRuns : generateMockData();

  // 计算分页数据
  const totalPages = Math.ceil(displayData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageData = displayData.slice(startIndex, endIndex);

  const getStatusBadge = (status) => {
    const className = `status-badge ${status || 'running'}`;
    const label = {
      passed: '通过',
      failed: '失败',
      running: '运行中'
    };
    return (
      <span className={className}>
        {label[status] || label.running}
      </span>
    );
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

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleRowClick = (run) => {
    setSelectedRun(run);
  };

  const handleCloseDetail = () => {
    setSelectedRun(null);
  };

  return (
    <div className="recent-tests">
      <div className="recent-tests-header">
        <h3>最近测试运行</h3>
        <div className="pagination-info">
          显示 {currentPageData.length > 0 ? `${startIndex + 1}-${Math.min(endIndex, displayData.length)} / ${displayData.length} 条记录` : '0 条记录'}
        </div>
      </div>

      {displayData.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <p className="empty-title">暂无测试运行记录</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="tests-table">
              <thead>
                <tr>
                  <th>测试名称</th>
                  <th>状态</th>
                  <th>执行时长</th>
                  <th>执行时间</th>
                </tr>
              </thead>
              <tbody>
                {currentPageData.map((run, index) => (
                  <tr
                    key={run.id || `${startIndex + index}`}
                    onClick={() => handleRowClick(run)}
                    className="clickable-row"
                  >
                    <td className="test-name">
                      {run.test_name || run.name || `Test #${startIndex + index + 1}`}
                    </td>
                    <td className="status-cell">
                      {getStatusBadge(run.status || 'running')}
                    </td>
                    <td className="duration-cell">
                      {formatDuration(run.duration)}
                    </td>
                    <td className="time-cell">
                      {formatTime(run.timestamp || run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                第 {currentPage} / {totalPages} 页
              </div>

              <div className="pagination-buttons">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                  aria-label="第一页"
                >
                  首页
                </button>

                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                  aria-label="上一页"
                >
                  上一页
                </button>

                {/* 页码按钮 */}
                {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`pagination-btn page-number ${isActive ? 'active' : ''}`}
                      aria-label={`第 ${pageNum} 页`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                  aria-label="下一页"
                >
                  下一页
                </button>

                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                  aria-label="末页"
                >
                  末页
                </button>
              </div>

              <div className="page-size-selector">
                <label>每页显示：</label>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className="page-size-select"
                >
                  <option value={10}>10条</option>
                  <option value={20}>20条</option>
                  <option value={50}>50条</option>
                  <option value={100}>100条</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Test Run Detail Modal */}
      {selectedRun && (
        <TestRunDetailModal
          run={selectedRun}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}

// 生成模拟数据
function generateMockData() {
  const statuses = ['passed', 'passed', 'passed', 'failed', 'running'];
  const data = [];

  for (let i = 0; i < 50; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const timestamp = new Date(Date.now() - Math.random() * 86400000); // 过去24小时内的随机时间

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
