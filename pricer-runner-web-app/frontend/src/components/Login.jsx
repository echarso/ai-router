import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

function Login() {
  const { login, loading, error } = useAuth();
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Don't clear URL params here - let AuthContext handle it after processing

  const handleLogin = (e) => {
    e?.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    
    // Call login() - it will redirect to Keycloak immediately
    // We don't await it because it redirects the browser
    login().catch((err) => {
      console.error('Login attempt failed:', err);
      setLoginError(err.message || 'Login failed. Please try again.');
      setIsLoggingIn(false);
    });
    
    // Note: login() will redirect to Keycloak, so we won't reach here normally
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Smart Inference Scheduling</h1>
        <p className="login-subtitle">Sign in to access the platform</p>

        {error && (
          <div className="error-message">
            ⚠️ {error.message || 'Authentication error occurred'}
          </div>
        )}

        {loginError && (
          <div className="error-message">
            ⚠️ {loginError}
          </div>
        )}

        {loading && !isLoggingIn && (
          <div className="loading-message">
            🔄 Initializing authentication...
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading || isLoggingIn}
          className="login-button"
        >
          {isLoggingIn ? '🔄 Signing in...' : '🔐 Sign in with SSO'}
        </button>

        <div className="login-info">
          <p>Default credentials:</p>
          <ul>
            <li><strong>System Owner:</strong> system-owner / SO</li>
            <li><strong>Organization Admin:</strong> org-admin / OA</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Login;
