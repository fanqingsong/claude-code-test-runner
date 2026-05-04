import { useState, useEffect } from 'react';
import authService from '../services/authService';
import './ScheduleList.css';

export default function ScheduleList({ refreshKey, onEditSchedule, onTriggerSchedule, onToggleSchedule }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const buildHttpErrorMessage = async (response, fallback) => {
    const status = response?.status;
    const statusText = response?.statusText || '';

    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch {
      bodyText = '';
    }

    let detail = '';
    if (bodyText) {
      try {
        const json = JSON.parse(bodyText);
        detail =
          json?.detail ||
          json?.error ||
          json?.message ||
          (typeof json === 'string' ? json : '') ||
          bodyText;
      } catch {
        detail = bodyText;
      }
    }

    const normalized = (detail || '').toString().trim();
    const base = fallback || '请求失败';
    const suffixParts = [
      typeof status === 'number' ? `HTTP ${status}` : null,
      statusText ? statusText : null,
      normalized ? normalized : null,
    ].filter(Boolean);

    return suffixParts.length ? `${base}（${suffixParts.join(' - ')}）` : base;
  };

  const getSafeAuthHeaders = () => {
    // Be defensive: in some dev setups the loaded authService bundle can be stale.
    // Always try to attach the raw token if it exists.
    const token = typeof authService?.getAccessToken === 'function' ? authService.getAccessToken() : null;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return typeof authService?.getAuthHeaders === 'function' ? authService.getAuthHeaders() : {};
  };

  const ensureAuthOrRedirect = async () => {
    if (!authService?.isAuthenticated?.()) {
      window.location.hash = 'login';
      throw new Error('未登录或登录已过期，请重新登录');
    }
    try {
      await authService.ensureValidToken();
    } catch {
      window.location.hash = 'login';
      throw new Error('登录已过期，请重新登录');
    }
  };

  const loadSchedules = async () => {
    setLoading(true);
    try {
      await ensureAuthOrRedirect();
      const response = await fetch(`${window.location.origin}/api/v1/schedules/`, {
        headers: getSafeAuthHeaders()
      });
      if (response.status === 401) {
        window.location.hash = 'login';
        throw new Error('登录已过期，请重新登录');
      }
      if (!response.ok) {
        const msg = await buildHttpErrorMessage(response, '加载调度列表失败');
        if (response.status === 403) {
          throw new Error(`${msg}\n（通常表示请求没带上 Authorization，或 token 验证失败/格式不正确）`);
        }
        throw new Error(msg);
      }
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
      await ensureAuthOrRedirect();
      const response = await fetch(`${window.location.origin}/api/v1/schedules/${id}`, {
        method: 'DELETE',
        headers: getSafeAuthHeaders()
      });
      if (response.status === 401) {
        window.location.hash = 'login';
        throw new Error('登录已过期，请重新登录');
      }
      if (response.status === 403) {
        throw new Error('无权限删除该调度（403）。');
      }
      if (!response.ok) {
        throw new Error(await buildHttpErrorMessage(response, '删除调度失败'));
      }
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
