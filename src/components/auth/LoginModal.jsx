import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@context/AuthContext';
import api from '@services/api.js';
import './LoginModal.css';

const LoginModal = ({ onClose }) => {
  const { login } = useAuth();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.post('/auth/google', {
        token: credentialResponse.credential,
      });
      login(response.data.token, response.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await api.post('/auth/email/send-otp', { email });
      setOtpSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const response = await api.post('/auth/email/verify-otp', {
        email,
        otp,
        name,
      });
      login(response.data.token, response.data.user);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <div className="login-modal-overlay">
      <div className="login-modal">
        
        
        <h2>Welcome to Expense Tracker</h2>
        <p className="login-subtitle">Track your expenses effortlessly</p>

        {error && <div className="error-message">{error}</div>}

        {!showEmailLogin ? (
          <div className="login-options">
            {GOOGLE_CLIENT_ID && (
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <div className="google-login-wrapper">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google login failed')}
                    theme="outline"
                    size="large"
                    text="continue_with"
                  />
                </div>
              </GoogleOAuthProvider>
            )}

            <div className="divider">
              <span>or</span>
            </div>

            <button
              className="btn btn-secondary email-login-btn"
              onClick={() => setShowEmailLogin(true)}
            >
              Continue with Email
            </button>
          </div>
        ) : (
          <div className="email-login-form">
            {!otpSent ? (
              <form onSubmit={handleSendOTP}>
                <input
                  type="email"
                  className="input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEmailLogin(false)}
                >
                  Back
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP}>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  className="input"
                  placeholder="Enter OTP (any code works in dev mode)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                  }}
                >
                  Resend OTP
                </button>
              </form>
            )}
          </div>
        )}

        <p className="dev-note">
          <small>DEV MODE: Any OTP will work for email login</small>
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
