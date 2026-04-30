import React from 'react';
import './StatsCards.css';

function StatsCards({ stats, totalDefinitions }) {
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '0%';
    return `${Math.round(value)}%`;
  };

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined || ms === 0) return '-';
    const seconds = ms / 1000;
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  const getPassRate = () => {
    const totalPassed = parseInt(stats.total_passed) || 0;
    const totalFailed = parseInt(stats.total_failed) || 0;
    const total = totalPassed + totalFailed;
    if (total === 0) return 0;
    return (totalPassed / total) * 100;
  }

  return (
    <div className="stats-cards-container">
      {/* 总运行数 */}
      <div className="stats-card">
        <div className="stats-title">总运行数</div>
        <div className="stats-value total">
          {stats.total_runs || stats.successful_runs || 0}
        </div>
        <div className="stats-subtitle">
          成功: {stats.successful_runs || 0} | 失败: {stats.failed_runs || 0}
        </div>
      </div>

      {/* 通过率 */}
      <div className="stats-card">
        <div className="stats-title">通过率</div>
        <div className="stats-value passRate">
          {formatPercentage(getPassRate())}
        </div>
        <div className="stats-subtitle">
          {stats.total_passed || 0} 通过 / {stats.total_failed || 0} 失败
        </div>
      </div>

      {/* 平均时长 */}
      <div className="stats-card">
        <div className="stats-title">平均执行时长</div>
        <div className="stats-value duration">
          {formatDuration(stats.avg_duration)}
        </div>
        <div className="stats-subtitle">
          基于所有完成的测试运行
        </div>
      </div>

      {/* 测试总数 */}
      <div className="stats-card">
        <div className="stats-title">测试用例总数</div>
        <div className="stats-value tests">
          {totalDefinitions || 0}
        </div>
        <div className="stats-subtitle">
          活跃的测试定义
        </div>
      </div>
    </div>
  );
}

export default StatsCards;