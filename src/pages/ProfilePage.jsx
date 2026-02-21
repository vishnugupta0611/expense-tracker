import { useState, useEffect, useRef } from 'react';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, login, logout } = useAuth();
  const fileInputRef = useRef(null);
  
  const [name, setName] = useState(user?.name || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [monthlyBudget, setMonthlyBudget] = useState(user?.budgets?.monthly || 0);
  const [dailyBudget, setDailyBudget] = useState(user?.budgets?.daily || 0);
  const [categoryBudgets, setCategoryBudgets] = useState(user?.budgets?.categoryBudgets || {});
  const [defaultView, setDefaultView] = useState(user?.defaultView || 'expenses');
  
  const [spaces, setSpaces] = useState([]);
  const [categories, setCategories] = useState([]);
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
      const [categoriesRes, spacesRes, analyticsRes] = await Promise.all([
        api.get('/categories').catch(err => ({ data: [] })), 
        api.get('/spaces').catch(err => ({ data: { spaces: [] } })),
        api.get('/analytics/personal').catch(() => ({ data: null }))
      ]);
      
      setCategories(categoriesRes.data || []);
      setSpaces(spacesRes.data?.spaces || spacesRes.data || []);
      setStats(analyticsRes.data);
    } catch (error) {
      console.error('Failed to fetch profile data', error);
      setMessage({ type: 'error', text: 'Failed to load some data. Please refresh.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryBudgetChange = (categoryName, value) => {
    setCategoryBudgets(prev => ({
      ...prev,
      [categoryName]: Number(value)
    }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select a valid image file' });
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('profileImage', file);

      const response = await api.post('/users/upload-profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfileImage(response.data.profileImage);
      setMessage({ type: 'success', text: '✓ Profile image updated!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Failed to upload image:', error);
      setMessage({ type: 'error', text: '✗ Failed to upload image' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    setShowLogoutDialog(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const updatedUser = {
        name,
        defaultView,
        budgets: {
          monthly: Number(monthlyBudget),
          daily: Number(dailyBudget),
          categoryBudgets
        }
      };

      const response = await api.put('/users/profile', updatedUser);
      
      const token = localStorage.getItem('token');
      login(token, response.data);

      setMessage({ type: 'success', text: '✓ Profile updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: '✗ Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="profile-page"><div className="loading-spinner">Loading...</div></div>;

  const totalCategoryBudget = Object.values(categoryBudgets).reduce((sum, val) => sum + Number(val), 0);
  const budgetWarning = totalCategoryBudget > monthlyBudget && monthlyBudget > 0;

  return (
    <div className="profile-page">
      <header className="page-header">
        <h1>Profile & Settings</h1>
      </header>

      {stats && (
        <div className="profile-stats">
          <div className="stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-info">
              <span className="stat-label">This Month</span>
              <span className="stat-value">₹{stats.total?.toFixed(0) || 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📊</span>
            <div className="stat-info">
              <span className="stat-label">Expenses</span>
              <span className="stat-value">{stats.expenseCount || 0}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎯</span>
            <div className="stat-info">
              <span className="stat-label">Budget Used</span>
              <span className="stat-value">
                {monthlyBudget > 0 ? `${((stats.total / monthlyBudget) * 100).toFixed(0)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="profile-content">
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="profile-form">
          <section className="form-section">
            <h2>👤 Personal Info</h2>
            
            {/* Profile Image Section */}
            <div className="form-group profile-image-section">
              <label>Profile Picture</label>
              <div className="profile-image-container">
                <div className="profile-image-wrapper">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt="Profile" 
                      className="profile-image"
                    />
                  ) : (
                    <div className="profile-image-placeholder">
                      <span className="placeholder-icon">👤</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="change-image-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    📷
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <small className="help-text">Click camera icon to change picture (Max 5MB)</small>
              </div>
            </div>

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="disabled-input"
              />
              <small>Email cannot be changed</small>
            </div>
          </section>

          <section className="form-section">
            <h2>🏠 Default View</h2>
            <div className="form-group">
              <label>Landing Page After Login</label>
              <select
                value={defaultView}
                onChange={(e) => setDefaultView(e.target.value)}
              >
                <option value="expenses">📝 Personal Expenses</option>
                <option value="spaces">🏠 All Spaces</option>
                <optgroup label="Specific Space">
                  {spaces.map(space => (
                    <option key={space._id} value={space._id}>
                      🏠 {space.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </section>

          <section className="form-section">
            <h2>💵 Budget Settings</h2>
            <div className="budget-grid">
              <div className="form-group">
                <label>Monthly Budget</label>
                <div className="input-with-prefix">
                  <span className="prefix">₹</span>
                  <input
                    type="number"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Daily Budget</label>
                <div className="input-with-prefix">
                  <span className="prefix">₹</span>
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

            {budgetWarning && (
              <div className="budget-warning">
                ⚠️ Category budgets (₹{totalCategoryBudget}) exceed monthly budget (₹{monthlyBudget})
              </div>
            )}

            <div className="category-budgets-section">
              <h3>Category-wise Budgets</h3>
              <div className="category-budgets-grid">
                {categories.length > 0 ? categories.map(cat => (
                  <div key={cat._id} className="category-budget-item">
                    <label>{cat.name}</label>
                    <div className="input-with-prefix">
                      <span className="prefix">₹</span>
                      <input
                        type="number"
                        value={categoryBudgets[cat.name] || ''}
                        onChange={(e) => handleCategoryBudgetChange(cat.name, e.target.value)}
                        placeholder="No limit"
                        min="0"
                      />
                    </div>
                  </div>
                )) : <p className="empty-state">No categories found.</p>}
              </div>
              <small className="help-text">Leave empty for no category limit</small>
            </div>
          </section>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-lg logout-btn" 
              onClick={() => setShowLogoutDialog(true)}
            >
              🚪 Logout
            </button>
          </div>
        </form>
      </div>

      {/* Logout Confirmation Dialog */}
      {showLogoutDialog && (
        <div className="dialog-overlay" onClick={() => setShowLogoutDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout? You'll need to login again to access your account.</p>
            <div className="dialog-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowLogoutDialog(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-error" 
                onClick={handleLogout}
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
