/**
 * LoginPage
 *
 * Login page with three authentication methods:
 * 1. Local username/password
 * 2. Casdoor username/password
 * 3. Casdoor OIDC/SSO
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

function LoginPage() {
  const { login, loginOidc } = useAuth();

  const [activeTab, setActiveTab] = useState('local');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login('local', formData.username, formData.password);

    if (result.success) {
      // Redirect to dashboard using hash routing
      window.location.hash = 'dashboard';
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleCasdoorLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login('casdoor', formData.username, formData.password);

    if (result.success) {
      // Redirect to dashboard using hash routing
      window.location.hash = 'dashboard';
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleOidcLogin = async () => {
    setLoading(true);
    setError('');

    const result = await loginOidc();

    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
    // If successful, redirect happens automatically
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Claude Code Test Runner</h1>
          <p>Sign in to your account</p>
        </div>

        {/* Auth Method Tabs */}
        <div className="auth-tabs">
          <button
            className={`tab-button ${activeTab === 'local' ? 'active' : ''}`}
            onClick={() => setActiveTab('local')}
          >
            Local Account
          </button>
          <button
            className={`tab-button ${activeTab === 'casdoor' ? 'active' : ''}`}
            onClick={() => setActiveTab('casdoor')}
          >
            Casdoor Password
          </button>
          <button
            className={`tab-button ${activeTab === 'sso' ? 'active' : ''}`}
            onClick={() => setActiveTab('sso')}
          >
            SSO Login
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Local Login Form */}
        {activeTab === 'local' && (
          <form className="login-form" onSubmit={handleLocalLogin}>
            <div className="form-group">
              <label htmlFor="local-username">Username</label>
              <input
                id="local-username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="local-password">Password</label>
              <input
                id="local-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Casdoor Password Login Form */}
        {activeTab === 'casdoor' && (
          <form className="login-form" onSubmit={handleCasdoorLogin}>
            <div className="form-group">
              <label htmlFor="casdoor-username">Casdoor Username</label>
              <input
                id="casdoor-username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                placeholder="Enter your Casdoor username"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="casdoor-password">Password</label>
              <input
                id="casdoor-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                placeholder="Enter your Casdoor password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In with Casdoor'}
            </button>
          </form>
        )}

        {/* OIDC/SSO Login */}
        {activeTab === 'sso' && (
          <div className="sso-login">
            <div className="sso-description">
              Sign in using your organization's single sign-on (SSO) provider.
            </div>

            <button
              onClick={handleOidcLogin}
              className="sso-button"
              disabled={loading}
            >
              {loading ? 'Redirecting...' : 'Sign In with SSO (Casdoor)'}
            </button>

            <div className="sso-note">
              You will be redirected to Casdoor to complete the sign-in process.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p>
            Admin users can view all data. Regular users can only view their own data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
