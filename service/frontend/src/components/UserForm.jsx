/**
 * UserForm Component
 *
 * Form for creating and editing users.
 * Follows IBM Carbon Design System principles.
 */

import { useState } from 'react';
import './UserForm.css';

const UserForm = ({ user = null, onSuccess, onCancel }) => {
  const isEdit = Boolean(user);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    is_active: user?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      const url = user
        ? `/api/v1/users/${user.id}`
        : '/api/v1/users';
      const method = user ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save user');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-form">
      {error && (
        <div className="form-alert error">
          <span className="form-alert-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username" className="form-label required">
            用户名
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            minLength={3}
            maxLength={100}
            className="form-input"
            disabled={isEdit}
            placeholder="请输入用户名（至少3个字符）"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label required">
            邮箱
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="请输入邮箱地址"
          />
        </div>

        {!isEdit && (
          <div className="form-group">
            <label htmlFor="password" className="form-label required">
              密码
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              maxLength={100}
              className="form-input"
              placeholder="请输入密码（至少8个字符）"
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label form-label-checkbox">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="form-checkbox"
            />
            <span>活跃状态</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? '保存中...' : isEdit ? '更新' : '创建'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="cancel-button">
              取消
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UserForm;
