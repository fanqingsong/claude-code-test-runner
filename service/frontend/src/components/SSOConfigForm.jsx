/**
 * SSOConfigForm
 *
 * Form for creating and editing SSO configurations.
 */

import { useState, useEffect } from 'react';
import { createSSOConfig, updateSSOConfig } from '../api';

const SSOConfigForm = ({ config, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    provider: 'casdoor',
    endpoint: '',
    client_id: '',
    client_secret: '',
    organization: '',
    is_enabled: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (config) {
      setFormData({
        provider: config.provider,
        endpoint: config.endpoint,
        client_id: config.client_id,
        client_secret: config.client_secret,
        organization: config.organization || '',
        is_enabled: config.is_enabled
      });
    }
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (config) {
        await updateSSOConfig(config.id, formData);
      } else {
        await createSSOConfig(formData);
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving SSO config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} style={{minWidth: '400px'}}>
      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      <div style={{marginBottom: '16px'}}>
        <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>
          SSO 提供商 *
        </label>
        <select
          name="provider"
          value={formData.provider}
          onChange={handleChange}
          required
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="casdoor">Casdoor</option>
          <option value="auth0">Auth0</option>
          <option value="okta">Okta</option>
        </select>
      </div>

      <div style={{marginBottom: '16px'}}>
        <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>
          端点 URL *
        </label>
        <input
          type="url"
          name="endpoint"
          value={formData.endpoint}
          onChange={handleChange}
          placeholder="https://casdoor.example.com"
          required
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{marginBottom: '16px'}}>
        <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>
          客户端 ID *
        </label>
        <input
          type="text"
          name="client_id"
          value={formData.client_id}
          onChange={handleChange}
          placeholder="your-client-id"
          required
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{marginBottom: '16px'}}>
        <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>
          客户端密钥 *
        </label>
        <input
          type="password"
          name="client_secret"
          value={formData.client_secret}
          onChange={handleChange}
          placeholder="your-client-secret"
          required
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{marginBottom: '16px'}}>
        <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>
          组织
        </label>
        <input
          type="text"
          name="organization"
          value={formData.organization}
          onChange={handleChange}
          placeholder="your-organization"
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{marginBottom: '24px'}}>
        <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
          <input
            type="checkbox"
            name="is_enabled"
            checked={formData.is_enabled}
            onChange={handleChange}
            style={{marginRight: '8px'}}
          />
          <span>启用此 SSO 配置</span>
        </label>
      </div>

      <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#0f62fe',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? '保存中...' : (config ? '更新' : '创建')}
        </button>
      </div>
    </form>
  );
};

export default SSOConfigForm;
