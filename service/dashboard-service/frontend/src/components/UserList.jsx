/**
 * UserList Component
 *
 * Displays a list of users with actions for management.
 * Follows IBM Carbon Design System principles.
 */

import { useState, useEffect } from 'react';
import './UserList.css';

const UserList = ({ refreshKey }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [refreshKey]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="user-list-loading">Loading users...</div>;
  }

  if (error) {
    return <div className="user-list-error">Error: {error}</div>;
  }

  return (
    <div className="user-list">
      <h2 className="user-list-title">Users</h2>

      {users.length === 0 ? (
        <div className="user-list-empty">No users found</div>
      ) : (
        <table className="user-list-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="user-username">{user.username}</td>
                <td className="user-email">{user.email}</td>
                <td className="user-roles">
                  {user.roles && user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <span key={role.id} className="role-badge">
                        {role.name}
                      </span>
                    ))
                  ) : (
                    <span className="no-roles">No roles</span>
                  )}
                </td>
                <td className="user-status">
                  <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="user-created">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="user-actions">
                  <button
                    className="action-button"
                    onClick={() => handleToggleActive(user.id, user.is_active)}
                    title={user.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="action-button delete-button"
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    title="Delete user"
                  >
                    Delete
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

export default UserList;
