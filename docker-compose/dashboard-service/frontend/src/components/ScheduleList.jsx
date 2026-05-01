import { useState, useEffect } from 'react';
import authService from '../services/authService';
import './ScheduleList.css';

export default function ScheduleList({ refreshKey, onEditSchedule, onTriggerSchedule, onToggleSchedule }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/schedules/', {
        headers: authService.getAuthHeaders()
      });
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
  }, [refreshKey]);

  // 稳定排序：按创建时间排序，避免顺序跳动
  const sortedSchedules = [...schedules].sort((a, b) => {
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个调度吗？')) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/v1/schedules/${id}`, {
        method: 'DELETE',
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete schedule');
      loadSchedules();
    } catch (err) {
      alert('删除失败: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const getCronDisplay = (cronExpression) => {
    if (!cronExpression) return '未设置';
    return cronExpression;
  };

  const getStatusBadge = (schedule) => {
    const isActive = schedule.is_active;
    return (
      <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
        {isActive ? '启用' : '禁用'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <span className="error-icon">⚠️</span>
        <span>错误: {error}</span>
      </div>
    );
  }

  return (
    <div className="schedule-list">
      <h2 className="list-title">调度列表</h2>
      {schedules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <p className="empty-title">还没有调度任务</p>
          <p className="empty-subtitle">点击"创建调度"来创建定时任务</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>Cron</th>
                <th>时区</th>
                <th>下次运行</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedSchedules.map((schedule, index) => (
                <tr key={schedule.id} className="schedule-row">
                  <td className="name-cell">
                    <div className="schedule-name">{schedule.name}</div>
                  </td>
                  <td className="status-cell">
                    {getStatusBadge(schedule)}
                  </td>
                  <td className="cron-cell">
                    <code className="cron-code">{getCronDisplay(schedule.cron_expression)}</code>
                  </td>
                  <td className="timezone-cell">
                    {schedule.timezone || 'UTC'}
                  </td>
                  <td className="next-run-cell">
                    {schedule.next_run_time ? new Date(schedule.next_run_time).toLocaleString('zh-CN') : '未设置'}
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <button
                        onClick={() => onTriggerSchedule(schedule.id)}
                        className="action-btn trigger-btn"
                        title="立即触发"
                        aria-label="立即触发调度"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => onToggleSchedule(schedule.id, !schedule.is_active)}
                        className={`action-btn toggle-btn ${schedule.is_active ? 'disable' : 'enable'}`}
                        title={schedule.is_active ? '禁用' : '启用'}
                        aria-label={schedule.is_active ? '禁用调度' : '启用调度'}
                      >
                        {schedule.is_active ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => onEditSchedule(schedule)}
                        className="action-btn edit-btn"
                        title="编辑"
                        aria-label="编辑调度"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="action-btn delete-btn"
                        title="删除"
                        aria-label="删除调度"
                        disabled={deletingId === schedule.id}
                      >
                        {deletingId === schedule.id ? (
                          <div className="btn-spinner"></div>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
