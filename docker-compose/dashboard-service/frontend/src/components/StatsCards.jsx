import React from 'react';

function StatsCards({ stats }) {
  const cardStyle = {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0'
  };

  const titleStyle = {
    fontSize: '14px',
    color: '#666',
    marginBottom: '8px',
    fontWeight: '500'
  };

  const valueStyle = {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '4px'
  };

  const subtitleStyle = {
    fontSize: '12px',
    color: '#888'
  };

  const getCardColor = (type) => {
    const colors = {
      total: '#1976d2',      // 蓝色
      passRate: '#4caf50',   // 绿色
      duration: '#ff9800',   // 橙色
      tests: '#9c27b0'       // 紫色
    };
    return colors[type] || '#666';
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '0%';
    return `${Math.round(value)}%`;
  };

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  };

  const getPassRate = () => {
    if (!stats.total_passed || !stats.total_failed) return 0;
    const total = parseInt(stats.total_passed) + parseInt(stats.total_failed);
    if (total === 0) return 0;
    return (parseInt(stats.total_passed) / total) * 100;
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px',
      marginBottom: '24px'
    }}>
      {/* 总运行数 */}
      <div style={cardStyle}>
        <div style={titleStyle}>总运行数</div>
        <div style={{...valueStyle, color: getCardColor('total')}}>
          {stats.total_runs || stats.successful_runs || 0}
        </div>
        <div style={subtitleStyle}>
          成功: {stats.successful_runs || 0} | 失败: {stats.failed_runs || 0}
        </div>
      </div>

      {/* 通过率 */}
      <div style={cardStyle}>
        <div style={titleStyle}>通过率</div>
        <div style={{...valueStyle, color: getCardColor('passRate')}}>
          {formatPercentage(getPassRate())}
        </div>
        <div style={subtitleStyle}>
          {stats.total_passed || 0} 通过 / {stats.total_failed || 0} 失败
        </div>
      </div>

      {/* 平均时长 */}
      <div style={cardStyle}>
        <div style={titleStyle}>平均执行时长</div>
        <div style={{...valueStyle, color: getCardColor('duration')}}>
          {formatDuration(stats.avg_duration)}
        </div>
        <div style={subtitleStyle}>
          基于所有完成的测试运行
        </div>
      </div>

      {/* 测试总数 */}
      <div style={cardStyle}>
        <div style={titleStyle}>测试用例总数</div>
        <div style={{...valueStyle, color: getCardColor('tests')}}>
          {stats.total_tests || 0}
        </div>
        <div style={subtitleStyle}>
          活跃的测试定义
        </div>
      </div>
    </div>
  );
}

export default StatsCards;