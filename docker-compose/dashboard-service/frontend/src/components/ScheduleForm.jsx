import { useState, useEffect } from 'react';

export default function ScheduleForm({ onScheduleCreated, editingSchedule, onCancel }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schedule_type: 'single',
    test_definition_ids: [],
    cron_expression: '',
    timezone: 'UTC',
    retry_config: {
      max_retries: 3,
      retry_delay_seconds: 60
    }
  });

  useEffect(() => {
    loadTests();
    if (editingSchedule) {
      setFormData({
        name: editingSchedule.name || '',
        description: editingSchedule.description || '',
        schedule_type: editingSchedule.schedule_type || 'single',
        test_definition_ids: editingSchedule.test_definition_ids || [],
        cron_expression: editingSchedule.cron_expression || '',
        timezone: editingSchedule.timezone || 'UTC',
        retry_config: editingSchedule.retry_config || { max_retries: 3, retry_delay_seconds: 60 }
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

      onScheduleCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestToggle = (testId) => {
    setFormData(prev => ({
      ...prev,
      test_definition_ids: prev.test_definition_ids.includes(testId)
        ? prev.test_definition_ids.filter(id => id !== testId)
        : [...prev.test_definition_ids, testId]
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
    <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
      <h3 style={{margin: 0}}>
        {editingSchedule ? '✏️ 编辑调度' : '📅 创建新调度'}
      </h3>

      {error && (
        <div style={{
          padding: '12px',
          background: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          color: '#c62828'
        }}>
          {error}
        </div>
      )}

      <div>
        <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px'}}>
          调度名称 *
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
          placeholder="例如：每日回归测试"
        />
      </div>

      <div>
        <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px'}}>
          描述
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            minHeight: '60px'
          }}
          placeholder="描述这个调度的用途..."
        />
      </div>

      <div>
        <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px'}}>
          调度类型
        </label>
        <select
          value={formData.schedule_type}
          onChange={(e) => setFormData({...formData, schedule_type: e.target.value})}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="single">单个测试</option>
          <option value="suite">测试套件</option>
          <option value="tag_filter">标签筛选</option>
        </select>
      </div>

      <div>
        <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px'}}>
          Cron 表达式 *
        </label>
        <select
          value={formData.cron_expression}
          onChange={(e) => setFormData({...formData, cron_expression: e.target.value})}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            marginBottom: '8px'
          }}
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
          value={formData.cron_expression}
          onChange={(e) => setFormData({...formData, cron_expression: e.target.value})}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
          placeholder="* * * * * (分 时 日 月 周)"
        />
        <small style={{color: '#666', fontSize: '12px'}}>
          格式：分 时 日 月 周 (例如：0 2 * * * = 每天凌晨2点)
        </small>
      </div>

      <div>
        <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px'}}>
          时区
        </label>
        <select
          value={formData.timezone}
          onChange={(e) => setFormData({...formData, timezone: e.target.value})}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="UTC">UTC</option>
          <option value="Asia/Shanghai">Asia/Shanghai (中国标准时间)</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Europe/London">Europe/London</option>
        </select>
      </div>

      <div>
        <label style={{display: 'block', fontWeight: 'bold', marginBottom: '8px'}}>
          选择测试用例
        </label>
        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '8px'
        }}>
          {tests.length === 0 ? (
            <div style={{padding: '16px', textAlign: 'center', color: '#666'}}>
              暂无测试用例
            </div>
          ) : (
            tests.map(test => (
              <label key={test.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={formData.test_definition_ids.includes(test.id)}
                  onChange={() => handleTestToggle(test.id)}
                  style={{marginRight: '8px'}}
                />
                <span style={{fontSize: '14px'}}>
                  {test.name}
                </span>
              </label>
            ))
          )}
        </div>
        <small style={{color: '#666', fontSize: '12px'}}>
          已选择 {formData.test_definition_ids.length} 个测试用例
        </small>
      </div>

      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '16px'
      }}>
        <button
          type="submit"
          disabled={loading || formData.test_definition_ids.length === 0}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: loading || formData.test_definition_ids.length === 0 ? '#ccc' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || formData.test_definition_ids.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {loading ? '保存中...' : (editingSchedule ? '💾 更新调度' : '✨ 创建调度')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 16px',
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ✕ 取消
        </button>
      </div>
    </form>
  );
}
