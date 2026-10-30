import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Show loading indicator while Firebase initializes auth state on refresh
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          backgroundColor: 'var(--bg-primary, #F3F4F6)',
          color: 'var(--text-secondary, rgba(31, 41, 55, 0.7))',
          fontFamily: 'inherit',
        }}
      >
        <div
          className="spinner"
          style={{
            width: 32,
            height: 32,
            borderColor: 'rgba(31, 41, 55, 0.2)',
            borderTopColor: 'var(--color-primary, #4F46E5)',
            borderWidth: '3px',
          }}
        />
        <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>
          Verifying session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
