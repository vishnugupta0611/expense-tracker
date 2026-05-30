import { useEffect } from 'react';
import { SignIn, useAuth as useClerkAuth } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import './AuthPage.css';

const AuthPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isSignedIn, isLoaded } = useClerkAuth();

  // Once our AuthContext has a user (token exchanged), go to expenses
  useEffect(() => {
    if (!loading && user) {
      navigate('/expenses', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show spinner while Clerk is loading, or while exchange is in progress
  if (!isLoaded || loading || isSignedIn) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary)',
      }}>
        <img src="/animation.gif" alt="Loading" style={{ width: 80, height: 80, objectFit: 'contain' }} />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-clerk-wrap">
        <div className="auth-logo" onClick={() => navigate('/')}>
          <img src="/animation.gif" alt="Spendly" className="auth-logo-img" />
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'clerk-root',
              card:    'clerk-card',
            },
          }}
        />
      </div>
    </div>
  );
};

export default AuthPage;
