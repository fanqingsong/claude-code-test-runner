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
      const token = localStorage.getItem('token');
      const url = user
        ? `http://localhost:8013/api/users/${user.id}`
        : 'http://localhost:8013/api/users';
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
      <h3 className="user-form-title">
        {isEdit ? 'Edit User' : 'Create New User'}
      </h3>

      {error && <div className="user-form-error">{error}</div>}

      <form onSubmit={handleSubmit} className="user-form-form">
        <div className="form-field">
          <label htmlFor="username" className="form-label">
            Username *
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
          />
        </div>

        <div className="form-field">
          <label htmlFor="email" className="form-label">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>

        {!isEdit && (
          <div className="form-field">
            <label htmlFor="password" className="form-label">
              Password *
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
            />
          </div>
        )}

        <div className="form-field">
          <label className="form-label checkbox-label">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="form-checkbox"
            />
            <span>Active</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="cancel-button">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UserForm;
