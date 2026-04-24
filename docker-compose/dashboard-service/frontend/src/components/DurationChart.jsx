import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function DurationChart({ data = [], timeRange = '30d' }) {
  // 如果没有真实数据，生成模拟数据用于展示
  const chartData = data.length > 0 ? data : generateMockData();

  // 根据时间范围决定显示多少数据点
  const daysToShow = timeRange === '7d' ? 7 : timeRange === '30d' ? 14 : 30;
  const displayData = chartData.slice(-daysToShow);

  const labels = displayData.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  });

  const durations = displayData.map(item => Math.round(item.duration || 0));

  const chartDataConfig = {
    labels,
    datasets: [{
      label: '平均执行时长 (秒)',
      data: durations,
      backgroundColor: 'rgba(33, 150, 243, 0.6)',
      borderColor: '#2196f3',
      borderWidth: 2,
      borderRadius: 4,
      hoverBackgroundColor: 'rgba(33, 150, 243, 0.8)'
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: '平均执行时长趋势',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            return `平均时长: ${value}秒`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value + 's';
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0',
      height: '400px'
    }}>
      <Bar data={chartDataConfig} options={options} />
    </div>
  );
}

// 生成模拟数据用于展示
function generateMockData() {
  const data = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // 生成一些随机的时长数据（20-120秒之间）
    const duration = Math.floor(Math.random() * 100) + 20;

    data.push({
      date: date.toISOString(),
      duration
    });
  }

  return data;
}

export default DurationChart;