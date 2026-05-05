/**
 * SSOConfigList
 *
 * Lists all SSO configurations with actions to view, edit, and delete.
 */

import { useState, useEffect } from 'react';
import { listSSOConfigs, deleteSSOConfig, updateSSOConfig } from '../api';

const SSOConfigList = ({ refreshKey }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSSOConfigs();
      setConfigs(data.items || []);
    } catch (err) {
      console.error('Error loading SSO configs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [refreshKey]);

  const handleDelete = async (configId) => {
    if (!confirm('确定要删除这个 SSO 配置吗？')) return;

    try {
      await deleteSSOConfig(configId);
      loadConfigs();
    } catch (err) {
      alert('删除失败: ' + err.message);
    }
  };

  const handleToggle = async (configId, isEnabled) => {
    try {
      await updateSSOConfig(configId, { is_enabled: !isEnabled });
      loadConfigs();
    } catch (err) {
      alert('更新失败: ' + err.message);
    }
  };

  if (loading) return <div>加载中...</div>;
  if (error) return <div style={{color: 'red'}}>错误: {error}</div>;

  return (
    <div>
      {configs.length === 0 ? (
        <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
          暂无 SSO 配置
        </div>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{borderBottom: '2px solid #ddd', textAlign: 'left'}}>
              <th style={{padding: '12px', background: '#f5f5f5'}}>提供商</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>端点</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>组织</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>状态</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>操作</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => (
              <tr key={config.id} style={{borderBottom: '1px solid #eee'}}>
                <td style={{padding: '12px'}}>{config.provider}</td>
                <td style={{padding: '12px', fontFamily: 'monospace', fontSize: '12px'}}>
                  {config.endpoint}
                </td>
                <td style={{padding: '12px'}}>{config.organization || '-'}</td>
                <td style={{padding: '12px'}}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: config.is_enabled ? '#d4edda' : '#f8d7da',
                    color: config.is_enabled ? '#155724' : '#721c24'
                  }}>
                    {config.is_enabled ? '已启用' : '已禁用'}
                  </span>
                </td>
                <td style={{padding: '12px'}}>
                  <button
                    onClick={() => handleToggle(config.id, config.is_enabled)}
                    style={{
                      padding: '6px 12px',
                      marginRight: '8px',
                      background: config.is_enabled ? '#ffc107' : '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {config.is_enabled ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    style={{
                      padding: '6px 12px',
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SSOConfigList;
