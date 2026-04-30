import { useState, useEffect } from 'react';
import './ScheduleForm.css';

export default function ScheduleForm({ onScheduleCreated, editingSchedule, onCancel }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    schedule_type: 'single',
    test_definition_id: null,
    test_suite_id: null,
    tag_filter: null,
    cron_expression: '0 * * * *',
    timezone: 'Asia/Shanghai',
    environment_overrides: {},
    is_active: true,
    allow_concurrent: false,
    max_retries: 3,
    retry_interval_seconds: 60
  });
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadTests();
    if (editingSchedule) {
      setFormData({
        name: editingSchedule.name || '',
        schedule_type: editingSchedule.schedule_type || 'single',
        test_definition_id: editingSchedule.test_definition_id || null,
        test_suite_id: editingSchedule.test_suite_id || null,
        tag_filter: editingSchedule.tag_filter || null,
        cron_expression: editingSchedule.cron_expression || '0 * * * *',
        timezone: editingSchedule.timezone || 'Asia/Shanghai',
        environment_overrides: editingSchedule.environment_overrides || {},
        is_active: editingSchedule.is_active !== undefined ? editingSchedule.is_active : true,
        allow_concurrent: editingSchedule.allow_concurrent || false,
        max_retries: editingSchedule.max_retries || 3,
        retry_interval_seconds: editingSchedule.retry_interval_seconds || 60
      });
    }
  }, [editingSchedule]);

  const loadTests = async () => {
    try {
      const response = await fetch('http://localhost:8011/api/v1/test-definitions/');
      if (!response.ok) throw new Error('Failed to load tests');
      const data = await response.json();
      setTests(data.items || data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const url = editingSchedule
        ? `http://localhost:8012/api/v1/schedules/${editingSchedule.id}`
        : 'http://localhost:8012/api/v1/schedules/';

      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save schedule');
      }

      // 通知父组件刷新列表并关闭modal
      onScheduleCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestToggle = (testId) => {
    // For single schedule type, only one test can be selected
    setFormData(prev => ({
      ...prev,
      test_definition_id: prev.test_definition_id === testId ? null : testId
    }));
  };

  const cronPresets = [
    { label: '每分钟', value: '* * * * *' },
    { label: '每小时', value: '0 * * * *' },
    { label: '每天凌晨2点', value: '0 2 * * *' },
    { label: '每周一上午9点', value: '0 9 * * 1' },
    { label: '每月1号凌晨3点', value: '0 3 1 * *' },
    { label: '工作日上午9点', value: '0 9 * * 1-5' }
  ];

  return (
    <form onSubmit={handleSubmit} className="schedule-form">
      {error && (
        <div className="form-alert error">
          <span className="form-alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="form-alert success">
          <span className="form-alert-icon">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      <div className="form-group">
        <label className="form-label required">调度名称</label>
        <input
          type="text"
          required
          className="form-input"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          placeholder="例如：每日回归测试"
        />
      </div>

      <div className="form-group">
        <label className="form-label">调度类型</label>
        <select
          className="form-select"
          value={formData.schedule_type}
          onChange={(e) => {
            const newType = e.target.value;
            setFormData(prev => ({
              ...prev,
              schedule_type: newType,
              test_definition_id: newType === 'single' ? prev.test_definition_id : null,
              test_suite_id: newType === 'suite' ? prev.test_suite_id : null,
              tag_filter: newType === 'tag_filter' ? prev.tag_filter : null
            }));
          }}
        >
          <option value="single">单个测试</option>
          <option value="suite">测试套件</option>
          <option value="tag_filter">标签筛选</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label required">Cron 表达式</label>
        <select
          className="form-select"
          value={formData.cron_expression}
          onChange={(e) => setFormData({...formData, cron_expression: e.target.value})}
        >
          <option value="">选择预设...</option>
          {cronPresets.map(preset => (
            <option key={preset.value} value={preset.value}>
              {preset.label} ({preset.value})
            </option>
          ))}
        </select>
        <input
          type="text"
          required
          className="form-input"
          value={formData.cron_expression}
          onChange={(e) => setFormData({...formData, cron_expression: e.target.value})}
          placeholder="* * * * * (分 时 日 月 周)"
        />
        <div className="form-helper">
          <span>格式：分 时 日 月 周 (例如：0 2 * * * = 每天凌晨2点)</span>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">时区</label>
        <select
          className="form-select"
          value={formData.timezone}
          onChange={(e) => setFormData({...formData, timezone: e.target.value})}
        >
          <option value="UTC">UTC</option>
          <option value="Asia/Shanghai">Asia/Shanghai (中国标准时间)</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Europe/London">Europe/London</option>
        </select>
      </div>

      {formData.schedule_type === 'single' && (
        <div className="form-group">
          <label className="form-label required">选择测试用例</label>
          <div className="test-selection-list">
            {tests.length === 0 ? (
              <div className="test-empty">暂无测试用例</div>
            ) : (
              tests.map(test => (
                <label
                  key={test.id}
                  className={`test-selection-item ${formData.test_definition_id === test.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="test_selection"
                    className="test-selection-radio"
                    checked={formData.test_definition_id === test.id}
                    onChange={() => handleTestToggle(test.id)}
                  />
                  <span className="test-selection-name">{test.name}</span>
                </label>
              ))
            )}
          </div>
          <div className="form-helper">
            {formData.test_definition_id ? '✓ 已选择1个测试用例' : '请选择1个测试用例'}
          </div>
        </div>
      )}

      {formData.schedule_type === 'suite' && (
        <div className="form-group">
          <label className="form-label required">测试套件ID</label>
          <input
            type="number"
            required
            className="form-input"
            value={formData.test_suite_id || ''}
            onChange={(e) => setFormData({...formData, test_suite_id: parseInt(e.target.value) || null})}
            placeholder="输入测试套件ID"
          />
          <div className="form-helper">
            <span className="form-helper-icon">💡</span>
            <span>提示：测试套件功能开发中，请先使用"单个测试"类型</span>
          </div>
        </div>
      )}

      {formData.schedule_type === 'tag_filter' && (
        <div className="form-group">
          <label className="form-label required">标签过滤条件</label>
          <input
            type="text"
            required
            className="form-input"
            value={formData.tag_filter || ''}
            onChange={(e) => setFormData({...formData, tag_filter: e.target.value})}
            placeholder="例如：smoke,regression"
          />
          <div className="form-helper">
            <span className="form-helper-icon">💡</span>
            <span>提示：输入标签，用逗号分隔（例如：smoke,regression）。标签过滤功能开发中。</span>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="form-btn form-btn-primary"
          disabled={loading || !isFormValid()}
        >
          {loading ? (
            <>
              <div className="btn-spinner"></div>
              <span>保存中...</span>
            </>
          ) : (
            <span>{editingSchedule ? '💾 更新调度' : '✨ 创建调度'}</span>
          )}
        </button>
        <button
          type="button"
          className="form-btn form-btn-secondary"
          onClick={onCancel}
        >
          <span>✕ 完成</span>
        </button>
      </div>
    </form>
  );

  // 验证表单是否有效
  function isFormValid() {
    switch (formData.schedule_type) {
      case 'single':
        return formData.test_definition_id !== null;
      case 'suite':
        return formData.test_suite_id !== null;
      case 'tag_filter':
        return formData.tag_filter && formData.tag_filter.trim() !== '';
      default:
        return false;
    }
  }
}
