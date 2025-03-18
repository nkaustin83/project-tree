// src/components/auth/Login.tsx
import React from 'react';
import AuthService from '@/services/AuthService';
import './Login.css';

const Login: React.FC = () => {
  const handleLogin = () => {
    // Get the OAuth URL from AuthService
    const loginUrl = AuthService.getLoginUrl();
    
    // Redirect to Procore OAuth page
    window.location.href = loginUrl;
  };

  return (
    <button className="login-button" onClick={handleLogin}>
      <img src="/src/assets/logo.svg" alt="AECent Logo" className="login-logo" />
    </button>
  );
};

export default Login;