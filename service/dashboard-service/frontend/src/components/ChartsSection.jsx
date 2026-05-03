import React, { useState } from 'react';
import TrendChart from './TrendChart';
import PassRateChart from './PassRateChart';
import DurationChart from './DurationChart';

function ChartsSection({ dashboardData, timeRange, onTimeRangeChange }) {
  const handleTimeRangeChange = (range) => {
    onTimeRangeChange(range);
  };

  const buttonStyle = (isActive) => ({
    padding: '8px 16px',
    background: isActive ? '#1976d2' : '#fff',
    color: isActive ? '#fff' : '#1976d2',
    border: '1px solid #1976d2',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s'
  });

  return (
    <div>
      {/* 时间范围选择器 */}
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
          测试趋势分析
        </h2>
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={() => handleTimeRangeChange('7d')}
            style={buttonStyle(timeRange === '7d')}
          >
            最近7天
          </button>
          <button
            onClick={() => handleTimeRangeChange('30d')}
            style={buttonStyle(timeRange === '30d')}
          >
            最近30天
          </button>
          <button
            onClick={() => handleTimeRangeChange('90d')}
            style={buttonStyle(timeRange === '90d')}
          >
            最近90天
          </button>
        </div>
      </div>

      {/* 图表网格 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* 趋势图 */}
        <div style={{
          gridColumn: timeRange === '7d' ? 'span 1' : 'span 2'
        }}>
          <TrendChart
            data={dashboardData.byDay || []}
            timeRange={timeRange}
          />
        </div>

        {/* 通过率饼图 */}
        <div>
          <PassRateChart stats={dashboardData.summary || {}} />
        </div>
      </div>

      {/* 时长图表 */}
      <div>
        <DurationChart
          data={dashboardData.byDay || []}
          timeRange={timeRange}
        />
      </div>
    </div>
  );
}

export default ChartsSection;