import { useState, useEffect } from 'react';

export default function ScheduleList({ onEditSchedule, onTriggerSchedule, onToggleSchedule }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8012/api/v1/schedules/');
      if (!response.ok) throw new Error('Failed to load schedules');
      const data = await response.json();
      setSchedules(data.items || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个调度吗？')) return;

    try {
      const response = await fetch(`http://localhost:8012/api/v1/schedules/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete schedule');
      loadSchedules();
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
  };

  const getCronDisplay = (cronExpression) => {
    if (!cronExpression) return '未设置';
    return cronExpression;
  };

  const getStatusBadge = (schedule) => {
    const isActive = schedule.is_active;
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        background: isActive ? '#4caf50' : '#9e9e9e',
        color: 'white'
      }}>
        {isActive ? '✓ 启用' : '✗ 禁用'}
      </span>
    );
  };

  if (loading) return <div>加载中...</div>;
  if (error) return <div style={{color: 'red'}}>错误: {error}</div>;

  return (
    <div>
      <h2 style={{marginTop: 0}}>调度列表</h2>
      {schedules.length === 0 ? (
        <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
          <div style={{fontSize: '48px', marginBottom: '16px'}}>📅</div>
          <p>还没有调度任务</p>
          <p style={{fontSize: '14px'}}>点击"创建调度"来创建定时任务</p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {schedules.map(schedule => (
            <div key={schedule.id} style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              background: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                <div style={{flex: 1}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                    <h3 style={{margin: 0, fontSize: '18px'}}>{schedule.name}</h3>
                    {getStatusBadge(schedule)}
                  </div>
                  <p style={{margin: '4px 0', color: '#666', fontSize: '14px'}}>
                    {schedule.description || '无描述'}
                  </p>
                  <div style={{marginTop: '8px', fontSize: '13px', color: '#888'}}>
                    <div>📅 Cron: {getCronDisplay(schedule.cron_expression)}</div>
                    <div>🕐 时区: {schedule.timezone || 'UTC'}</div>
                    <div>🔄 下次运行: {schedule.next_run_time ? new Date(schedule.next_run_time).toLocaleString('zh-CN') : '未设置'}</div>
                  </div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button
                    onClick={() => onTriggerSchedule(schedule.id)}
                    title="立即触发"
                    style={{
                      padding: '6px 12px',
                      background: '#2196f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ▶️ 触发
                  </button>
                  <button
                    onClick={() => onToggleSchedule(schedule.id, !schedule.is_active)}
                    title={schedule.is_active ? '禁用' : '启用'}
                    style={{
                      padding: '6px 12px',
                      background: schedule.is_active ? '#ff9800' : '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {schedule.is_active ? '⏸️ 禁用' : '▶️ 启用'}
                  </button>
                  <button
                    onClick={() => onEditSchedule(schedule)}
                    title="编辑"
                    style={{
                      padding: '6px 12px',
                      background: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ✏️ 编辑
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    title="删除"
                    style={{
                      padding: '6px 12px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ 删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
