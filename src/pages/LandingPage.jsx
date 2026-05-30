import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* navbar */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <img
            src="/logo.png"
            alt="Manage Sbkuchh"
            className="logo-img"
          />
        </div>

        <button
          className="nav-signin-btn"
          onClick={() => navigate("/auth")}
        >
          Sign In
        </button>
      </nav>

      <main className="landing-main">
        {/* hero */}
        <section className="landing-hero">

          <div className="hero-badge">
            Personal & Family Workspace
          </div>

          <h1 className="hero-title">
            Everything important,
            <br />
            <span className="hero-accent">
              one place.
            </span>
          </h1>

          <p className="hero-subtitle">
            Manage expenses, shopping lists, family spaces,
            notes, schedules, files and daily life from a
            single workspace.
          </p>

          <button
            className="get-started-btn"
            onClick={() => navigate("/auth")}
          >
            Get Started
            <span className="btn-arrow">→</span>
          </button>
        </section>

        {/* feature cards */}
        <section className="landing-features">

          <div className="feature-card">
            <span className="feature-icon">💰</span>

            <h3>Expenses</h3>

            <p>
              Track personal and shared expenses with ease.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">👨‍👩‍👧‍👦</span>

            <h3>Family Spaces</h3>

            <p>
              Collaborate with family members in private spaces.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🛒</span>

            <h3>Shopping Lists</h3>

            <p>
              Create and manage shopping lists together.
            </p>
          </div>

        </section>

        {/* showcase section */}

        <section className="showcase-section">

          <div className="showcase-left">

            <div className="showcase-label">
              WHY MANAGE SBKUCHH
            </div>

            <h2 className="showcase-title">
              More than an expense tracker.
            </h2>

            <p className="showcase-description">
              Built for families and individuals who want
              everything organized in one place instead of
              switching between multiple apps.
            </p>

            <div className="showcase-list">

              <div className="showcase-item">
                <div className="showcase-icon">
                  💰
                </div>

                <div>
                  <h4>Expense Tracking</h4>

                  <span>
                    Personal and shared expense management.
                  </span>
                </div>
              </div>

              <div className="showcase-item">
                <div className="showcase-icon">
                  💬
                </div>

                <div>
                  <h4>Family Communication</h4>

                  <span>
                    Private spaces and family discussions.
                  </span>
                </div>
              </div>

              <div className="showcase-item">
                <div className="showcase-icon">
                  📝
                </div>

                <div>
                  <h4>Notes & Schedule</h4>

                  <span>
                    Keep plans, tasks and reminders organized.
                  </span>
                </div>
              </div>

              <div className="showcase-item">
                <div className="showcase-icon">
                  📁
                </div>

                <div>
                  <h4>Drive & Storage</h4>

                  <span>
                    Store files, photos and important memories.
                  </span>
                </div>
              </div>

            </div>

          </div>

          <div className="showcase-right">
            <div className="gif-card">
              <img
                src="/animation.gif"
                alt="Manage Sbkuchh"
              />
            </div>
          </div>

        </section>

        {/* stats */}

        <section className="stats-section">

          <div className="stat-card">
            <h3>10+</h3>
            <p>Tools</p>
          </div>

          <div className="stat-card">
            <h3>All In One</h3>
            <p>Workspace</p>
          </div>

          <div className="stat-card">
            <h3>Family</h3>
            <p>Focused</p>
          </div>

        </section>

        {/* final cta */}

        <section className="cta-section">

          <h2>
            Start organizing everything
            in one place.
          </h2>

          <p>
            Expenses, schedules, notes, shopping,
            files and family collaboration.
          </p>

          <button
            className="cta-btn"
            onClick={() => navigate("/auth")}
          >
            Get Started
          </button>

        </section>

      </main>

      <footer className="landing-footer">
        <p>
          © 2026 Manage Sbkuchh · Your personal &
          family workspace.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;