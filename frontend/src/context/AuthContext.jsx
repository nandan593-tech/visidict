import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
function getFirebaseErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/user-not-found':
      return 'No administrator account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials.';
    case 'auth/user-disabled':
      return 'This administrator account has been disabled.';
    case 'auth/too-many-requests':
      return 'Access temporarily locked due to multiple failed login attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection.';
    case 'auth/internal-error':
      return 'An internal authentication error occurred. Please try again.';
    default:
      return 'Authentication failed. Please verify your credentials and try again.';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Track Firebase Auth state automatically across page reloads
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Signs in using Firebase Authentication with email & password.
   * Returns { success: true, user } or { success: false, code, message, error }
   */
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      return {
        success: true,
        user: userCredential.user,
      };
    } catch (error) {
      return {
        success: false,
        code: error.code,
        message: getFirebaseErrorMessage(error.code),
        error,
      };
    }
  };

  /**
   * Signs out the current user via Firebase and cleans up session storage
   */
  const logout = async () => {
    sessionStorage.removeItem('visidict_dashboard_intro_done');
    await signOut(auth);
  };

  // Preserved context shape: isAuthenticated, login, logout
  // Additional helpful fields provided: user, currentUser, loading
  const contextValue = {
    user,
    currentUser: user, // Guessing shape: added currentUser alias for standard Firebase context pattern
    isAuthenticated: !!user,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
