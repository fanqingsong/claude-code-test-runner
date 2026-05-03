/**
 * OidcCallback
 *
 * Handles OIDC authentication callback from Casdoor.
 * Extracts authorization code and state from URL parameters.
 */

import { useEffect, useState } from 'react';
import authService from '../services/authService';

function OidcCallback() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract code and state from URL query parameters
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (!code) {
          throw new Error('No authorization code received');
        }

        if (!state) {
          throw new Error('No state parameter received');
        }

        // Handle the callback
        await authService.handleOidcCallback(code, state);

        // Redirect to dashboard or previous location using hash routing
        const from = sessionStorage.getItem('redirect_after_login') || '#dashboard';
        sessionStorage.removeItem('redirect_after_login');
        window.location.hash = from;
      } catch (err) {
        console.error('OIDC callback error:', err);
        setError(err.message || 'OIDC authentication failed');
        setLoading(false);

        // Redirect to login page after 3 seconds
        setTimeout(() => {
          window.location.hash = 'login';
        }, 3000);
      }
    };

    handleCallback();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        <div>Completing sign-in...</div>
        <div style={{ fontSize: '14px', marginTop: '10px' }}>Please wait</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#c33'
      }}>
        <div>{error}</div>
        <div style={{ fontSize: '14px', marginTop: '10px', color: '#666' }}>
          Redirecting to login page...
        </div>
      </div>
    );
  }

  return null;
}

export default OidcCallback;
