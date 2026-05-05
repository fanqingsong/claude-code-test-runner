/**
 * SSOUserList
 *
 * Lists and manages users who logged in via SSO.
 */

import { useState, useEffect } from 'react';
import { getUsers, updateUser } from '../api';

const SSOUserList = ({ refreshKey }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      // Filter users that have SSO provider (check if they have specific SSO attributes)
      const ssoUsers = (data.items || data).filter(user =>
        user.email && user.email.includes('casdoor') || user.username?.includes('sso')
      );
      setUsers(ssoUsers);
    } catch (err) {
      console.error('Error loading SSO users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [refreshKey]);

  const handleToggleActive = async (userId, isActive) => {
    try {
      await updateUser(userId, { is_active: !isActive });
      loadUsers();
    } catch (err) {
      alert('更新失败: ' + err.message);
    }
  };

  const handleToggleAdmin = async (userId, isAdmin) => {
    try {
      await updateUser(userId, { is_admin: !isAdmin });
      loadUsers();
    } catch (err) {
      alert('更新失败: ' + err.message);
    }
  };

  if (loading) return <div>加载中...</div>;
  if (error) return <div style={{color: 'red'}}>错误: {error}</div>;

  return (
    <div>
      <h3 style={{marginBottom: '16px'}}>SSO 用户管理</h3>
      {users.length === 0 ? (
        <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
          暂无 SSO 用户
        </div>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{borderBottom: '2px solid #ddd', textAlign: 'left'}}>
              <th style={{padding: '12px', background: '#f5f5f5'}}>用户名</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>邮箱</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>状态</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>角色</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>创建时间</th>
              <th style={{padding: '12px', background: '#f5f5f5'}}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} style={{borderBottom: '1px solid #eee'}}>
                <td style={{padding: '12px'}}>{user.username}</td>
                <td style={{padding: '12px'}}>{user.email}</td>
                <td style={{padding: '12px'}}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: user.is_active ? '#d4edda' : '#f8d7da',
                    color: user.is_active ? '#155724' : '#721c24'
                  }}>
                    {user.is_active ? '活跃' : '已禁用'}
                  </span>
                </td>
                <td style={{padding: '12px'}}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: user.is_admin ? '#cce5ff' : '#e2e3e5',
                    color: user.is_admin ? '#004085' : '#383d41'
                  }}>
                    {user.is_admin ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td style={{padding: '12px', fontSize: '12px'}}>
                  {new Date(user.created_at).toLocaleString('zh-CN')}
                </td>
                <td style={{padding: '12px'}}>
                  <button
                    onClick={() => handleToggleActive(user.id, user.is_active)}
                    style={{
                      padding: '6px 12px',
                      marginRight: '8px',
                      background: user.is_active ? '#ffc107' : '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {user.is_active ? '禁用' : '启用'}
                  </button>
                  <button
                    onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                    style={{
                      padding: '6px 12px',
                      background: user.is_admin ? '#6c757d' : '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {user.is_admin ? '取消管理员' : '设为管理员'}
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

export default SSOUserList;
