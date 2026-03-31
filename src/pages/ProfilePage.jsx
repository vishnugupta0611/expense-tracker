import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import avatarGifs from '@data/avatarGifs';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, login, logout } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(user?.budgets?.monthly || 0);
  const [dailyBudget, setDailyBudget] = useState(user?.budgets?.daily || 0);
  const [defaultView, setDefaultView] = useState(user?.defaultView || 'expenses');

  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [stats, setStats] = useState(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [spacesRes, analyticsRes] = await Promise.all([
        api.get('/spaces').catch(() => ({ data: { spaces: [] } })),
        api.get('/analytics/personal').catch(() => ({ data: null })),
      ]);
      setSpaces(spacesRes.data?.spaces || spacesRes.data || []);
      setStats(analyticsRes.data);
    } catch (error) {
      console.error('Failed to fetch profile data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarSelect = (gifUrl) => {
    setSelectedAvatar(gifUrl);
    setShowAvatarPicker(false);
  };

  const getSelectedAvatarGif = () => avatarGifs.find(g => g.url === selectedAvatar);

  const handleLogout = () => {
    logout();
    setShowLogoutDialog(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await api.put('/users/profile', {
        name,
        defaultView,
        avatar: selectedAvatar,
        budgets: {
          monthly: Number(monthlyBudget),
          daily: Number(dailyBudget),
          categoryBudgets: user?.budgets?.categoryBudgets || {},
        },
      });
      const token = localStorage.getItem('token');
      login(token, response.data);
      setMessage({ type: 'success', text: 'Profile updated' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const displayUsername = user?.email
    ? user.email.replace('@spendly.app', '')
    : user?.email || '';

  if (loading) return <div className="profile-page"><div className="profile-loading">Loading...</div></div>;

  return (
    <div className="profile-page">

      {/* Top user card */}
      <div className="profile-hero">
        <div
          className="profile-avatar"
          onClick={() => setShowAvatarPicker(true)}
          title="Change avatar"
        >
          {selectedAvatar ? (
            <img src={selectedAvatar} alt={getSelectedAvatarGif()?.label || 'Avatar'} />
          ) : (
            <span className="avatar-placeholder">👤</span>
          )}
          <div className="avatar-edit-badge">✏️</div>
        </div>
        <div className="profile-hero-info">
          <h2>{user?.name}</h2>
          <span className="profile-username">@{displayUsername}</span>
        </div>
        {stats && (
          <div className="profile-hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">₹{stats.total?.toFixed(0) || 0}</span>
              <span className="hero-stat-label">This month</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.expenseCount || 0}</span>
              <span className="hero-stat-label">Expenses</span>
            </div>
          </div>
        )}
      </div>

      {/* Shortcuts */}
      <Link to="/schedule" className="profile-shortcut">
        <span className="shortcut-icon">📅</span>
        <span className="shortcut-label">My Schedule</span>
        <span className="shortcut-arrow">→</span>
      </Link>
      <Link to="/todo" className="profile-shortcut">
        <span className="shortcut-icon">✅</span>
        <span className="shortcut-label">My Todos</span>
        <span className="shortcut-arrow">→</span>
      </Link>
      <Link to="/notes" className="profile-shortcut">
        <span className="shortcut-icon">📝</span>
        <span className="shortcut-label">My Notes</span>
        <span className="shortcut-arrow">→</span>
      </Link>
      <Link to="/drive" className="profile-shortcut">
        <span className="shortcut-icon">📁</span>
        <span className="shortcut-label">My Drive</span>
        <span className="shortcut-arrow">→</span>
      </Link>
      <Link to="/history" className="profile-shortcut">
        <span className="shortcut-icon">📊</span>
        <span className="shortcut-label">History</span>
        <span className="shortcut-arrow">→</span>
      </Link>

      {message.text && (
        <div className={`profile-message ${message.type}`}>{message.text}</div>
      )}

      <form onSubmit={handleSubmit} className="profile-form">

        {/* Personal */}
        <div className="profile-section">
          <p className="section-label">Personal</p>
          <div className="field-row">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="field-row">
            <label>Username</label>
            <input type="text" value={displayUsername} disabled className="field-disabled" />
          </div>
        </div>

        {/* Preferences */}
        <div className="profile-section">
          <p className="section-label">Preferences</p>
          <div className="field-row">
            <label>Default view</label>
            <select value={defaultView} onChange={(e) => setDefaultView(e.target.value)}>
              <option value="expenses">Personal Expenses</option>
              <option value="spaces">All Spaces</option>
              {spaces.map(space => (
                <option key={space._id} value={space._id}>{space.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Budget */}
        <div className="profile-section">
          <p className="section-label">Budget</p>
          <div className="field-row">
            <label>Monthly</label>
            <div className="field-prefix-wrap">
              <span>₹</span>
              <input
                type="number"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
          </div>
          <div className="field-row">
            <label>Daily</label>
            <div className="field-prefix-wrap">
              <span>₹</span>
              <input
                type="number"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                min="0"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            className="btn-logout"
            onClick={() => setShowLogoutDialog(true)}
          >
            Logout
          </button>
        </div>
      </form>

      {/* Avatar Picker */}
      {showAvatarPicker && (
        <div className="modal-overlay" onClick={() => setShowAvatarPicker(false)}>
          <div className="avatar-picker" onClick={(e) => e.stopPropagation()}>
            <div className="avatar-picker-head">
              <span>Choose Avatar</span>
              <button onClick={() => setShowAvatarPicker(false)}>✕</button>
            </div>
            <div className="avatar-grid">
              {avatarGifs.map((gif) => (
                <div
                  key={gif.id}
                  className={`avatar-item ${selectedAvatar === gif.url ? 'selected' : ''}`}
                  onClick={() => handleAvatarSelect(gif.url)}
                >
                  <img src={gif.url} alt={gif.label} loading="lazy" />
                  <span>{gif.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm */}
      {showLogoutDialog && (
        <div className="modal-overlay" onClick={() => setShowLogoutDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Log out?</h3>
            <p>You'll need to sign in again to access your account.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowLogoutDialog(false)}>Cancel</button>
              <button className="btn-confirm-logout" onClick={handleLogout}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
