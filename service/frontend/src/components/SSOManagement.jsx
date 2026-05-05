/**
 * SSOManagement
 *
 * Comprehensive SSO management page with configuration and user management.
 */

import { useState } from 'react';
import SSOConfigList from './SSOConfigList';
import SSOConfigForm from './SSOConfigForm';
import SSOUserList from './SSOUserList';
import Modal from './Modal';

const SSOManagement = () => {
  const [activeTab, setActiveTab] = useState('config');
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [configRefreshKey, setConfigRefreshKey] = useState(0);
  const [userRefreshKey, setUserRefreshKey] = useState(0);

  const handleConfigCreated = () => {
    setConfigRefreshKey(prev => prev + 1);
    setShowConfigForm(false);
    setEditingConfig(null);
  };

  const handleEditConfig = (config) => {
    setEditingConfig(config);
    setShowConfigForm(true);
  };

  const tabStyle = (isActive) => ({
    padding: '12px 24px',
    background: isActive ? '#0f62fe' : 'transparent',
    color: isActive ? '#fff' : '#0f62fe',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    marginRight: '8px'
  });

  return (
    <div style={{padding: '24px', background: 'var(--cds-background)', minHeight: '100vh'}}>
      <div style={{marginBottom: '24px'}}>
        <h1 style={{
          margin: '0 0 16px 0',
          fontSize: '32px',
          fontWeight: '300',
          color: 'var(--cds-text-primary)'
        }}>
          SSO 配置管理
        </h1>

        <div style={{display: 'flex', alignItems: 'center', marginBottom: '16px'}}>
          <button
            onClick={() => setActiveTab('config')}
            style={tabStyle(activeTab === 'config')}
          >
            配置管理
          </button>
          <button
            onClick={() => setActiveTab('users')}
            style={tabStyle(activeTab === 'users')}
          >
            SSO 用户
          </button>
        </div>
      </div>

      {activeTab === 'config' ? (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            padding: '16px',
            background: '#fff',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div>
              <h2 style={{margin: 0, fontSize: '20px', fontWeight: '400'}}>
                SSO 提供商配置
              </h2>
              <p style={{margin: '4px 0 0 0', fontSize: '14px', color: '#666'}}>
                管理您的单点登录（SSO）提供商配置
              </p>
            </div>
            <button
              onClick={() => {
                setEditingConfig(null);
                setShowConfigForm(true);
              }}
              style={{
                padding: '10px 20px',
                background: '#0f62fe',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '400'
              }}
            >
              + 添加配置
            </button>
          </div>

          <div style={{
            background: '#fff',
            borderRadius: '4px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <SSOConfigList refreshKey={configRefreshKey} />
          </div>
        </div>
      ) : (
        <div>
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            background: '#fff',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{margin: 0, fontSize: '20px', fontWeight: '400'}}>
              通过 SSO 登录的用户
            </h2>
            <p style={{margin: '4px 0 0 0', fontSize: '14px', color: '#666'}}>
              管理使用单点登录的用户账户
            </p>
          </div>

          <div style={{
            background: '#fff',
            borderRadius: '4px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <SSOUserList refreshKey={userRefreshKey} />
          </div>
        </div>
      )}

      {/* SSO Configuration Form Modal */}
      <Modal
        isOpen={showConfigForm}
        onClose={() => {
          setEditingConfig(null);
          setShowConfigForm(false);
        }}
        title={editingConfig ? `编辑 SSO 配置` : '添加 SSO 配置'}
      >
        <SSOConfigForm
          config={editingConfig}
          onSuccess={handleConfigCreated}
          onCancel={() => {
            setEditingConfig(null);
            setShowConfigForm(false);
          }}
        />
      </Modal>
    </div>
  );
};

export default SSOManagement;
