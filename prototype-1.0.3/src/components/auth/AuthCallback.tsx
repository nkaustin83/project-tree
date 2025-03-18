// src/components/auth/AuthCallback.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthService from '@services/AuthService';
import AuthDebugger from '@utils/AuthDebugger'; // Assuming this exists
import './AuthCallback.css';

const AuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    AuthDebugger.runDiagnostics(); // Keep your diagnostics

    const handleCallback = async () => {
      const code = searchParams.get('code');
      console.log(`Received authorization code: ${code ? code.substring(0, 5) + '...' : 'MISSING'}`);

      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received from Procore');
        console.error('Missing code in callback URL');
        return;
      }

      try {
        console.log('Authenticating with Procore...');
        await AuthService.authenticate(code);
        const tokens = AuthService.getTokens();
        if (!tokens?.access_token) {
          throw new Error('Failed to save authentication tokens');
        }
        console.log('Authentication successful, tokens saved');
        console.log(`Access token: ${tokens.access_token.substring(0, 5)}...`);
        setStatus('success');
        navigate('/', { replace: true }); // Immediate redirect
      } catch (error) {
        console.error('Authentication failed:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="auth-callback-container">
      {status === 'error' ? (
        <div className="auth-error">
          <span className="error-icon">!</span>
          <h2>Authentication Failed</h2>
          <p className="error-message">{errorMessage}</p>
          <button className="retry-button" onClick={() => navigate('/login')}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="auth-loading">
          <div className="loading-spinner" />
          <p>Authenticating with Procore...</p>
        </div>
      )}
    </div>
  );
};

export default AuthCallback;