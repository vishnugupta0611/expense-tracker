import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="logo-icon">💸</span>
          <span className="logo-text">Spendly</span>
        </div>
        <button className="nav-signin-btn" onClick={() => navigate('/auth')}>
          Sign in
        </button>
      </nav>

      <main className="landing-main">
        <div className="landing-hero">
          <div className="hero-badge">Personal Finance</div>
          <h1 className="hero-title">
            Track every rupee,<br />
            <span className="hero-accent">effortlessly.</span>
          </h1>
          <p className="hero-subtitle">
            Simple expense tracking, shared spaces, and smart analytics — all in one place.
          </p>
          <button className="get-started-btn" onClick={() => navigate('/auth')}>
            Get Started
            <span className="btn-arrow">→</span>
          </button>
        </div>

        <div className="landing-features">
          <div className="feature-card">
            <span className="feature-icon">📊</span>
            <h3>Smart Analytics</h3>
            <p>Visualize your spending patterns with clean charts and insights.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🏠</span>
            <h3>Shared Spaces</h3>
            <p>Split expenses with roommates or friends, settle up easily.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🛒</span>
            <h3>Shopping List</h3>
            <p>Keep track of what you need to buy, organized by category.</p>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p>© 2025 Spendly. Built for real life.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
