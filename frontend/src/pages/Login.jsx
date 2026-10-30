import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { Activity, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const { isAuthenticated, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Prevent flash while Firebase is checking initial auth state
  if (authLoading) {
    return (
      <div className="login-page">
        <div
          className="spinner"
          style={{
            borderColor: 'rgba(31, 41, 55, 0.2)',
            borderTopColor: 'var(--color-primary)',
            width: 32,
            height: 32,
          }}
        />
      </div>
    );
  }

  // If already authenticated, redirect to dashboard or intended destination
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        sessionStorage.removeItem('visidict_dashboard_intro_done');
        const origin = location.state?.from?.pathname || '/dashboard';
        navigate(origin, { replace: true, state: { playIntro: true } });
      } else {
        setErrorMessage(result.message || 'Authentication failed.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred during login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-glow-1" />
      <div className="login-bg-glow-2" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-brand-icon">
            <Activity size={30} color="var(--color-primary)" />
          </div>
          <h1 className="login-brand-title">
            <span className="brand-visi">VISI</span>
            <span className="brand-dict">DICT</span>
          </h1>
          <p className="login-subtitle">
            Presence Intelligence & Access Control Portal
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {errorMessage && (
            <div className="login-error-box" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <Mail size={18} />
              </span>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div className="input-wrapper">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input has-toggle"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer-links">
          <Link to="/home" className="login-back-link">
            <ArrowLeft size={15} />
            <span>Back to Home</span>
          </Link>
        </div>

        <div className="login-footer-hint">
          Protected System • Authorized Personnel Only
        </div>
      </div>
    </div>
  );
}
