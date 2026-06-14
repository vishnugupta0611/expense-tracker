import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import PageLoader from '@components/PageLoader';
import VoiceExpenseBtn from '@components/expenses/VoiceExpenseBtn';
import SuccessNotification from '@components/shared/SuccessNotification';
import '@components/expenses/QuickAddInput.css';
import './SpacesPage.css';

const SpacesPage = () => {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [deletingSpaceId, setDeletingSpaceId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    monthly: 0
  });
  const [selectedEmails, setSelectedEmails] = useState([]);   // chips for member emails
  const [memberQuery, setMemberQuery] = useState('');
  const [memberSuggestions, setMemberSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimer = useRef(null);
  const [quickAddData, setQuickAddData] = useState({
    amount: '',
    description: '',
    category: 'Other'
  });

  // Global Quick Add State
  const [showGlobalQuickAddModal, setShowGlobalQuickAddModal] = useState(false);
  const [globalQuickAddLoading, setGlobalQuickAddLoading] = useState(false);
  const [globalQuickAddData, setGlobalQuickAddData] = useState({
    amount: '',
    description: '',
    spaceId: '',
    category: 'Other'
  });
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Debounced user search
  const handleMemberQueryChange = (val) => {
    setMemberQuery(val);
    clearTimeout(suggestionTimer.current);
    if (!val.trim()) { setMemberSuggestions([]); setShowSuggestions(false); return; }
    suggestionTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?query=${encodeURIComponent(val)}`);
        setMemberSuggestions(res.data.usernames || []);
        setShowSuggestions(true);
      } catch { setMemberSuggestions([]); }
    }, 300);
  };

  const selectSuggestion = (suggestion) => {
    if (!selectedEmails.includes(suggestion.email)) {
      setSelectedEmails(prev => [...prev, suggestion.email]);
    }
    setMemberQuery('');
    setMemberSuggestions([]);
    setShowSuggestions(false);
  };

  const removeEmail = (email) => setSelectedEmails(prev => prev.filter(e => e !== email));

  const resetMemberState = () => {
    setSelectedEmails([]);
    setMemberQuery('');
    setMemberSuggestions([]);
    setShowSuggestions(false);
  };

  const fetchSpaces = async () => {
    try {
      const response = await api.get('/spaces');
      const spacesData = response.data.spaces || response.data;
      
      // Fetch balance and expenses for each space
      const spacesWithBalances = await Promise.all(
        spacesData.map(async (space) => {
          try {
            const [expensesRes, balanceRes] = await Promise.all([
              api.get(`/spaces/${space._id}/expenses`),
              api.get(`/spaces/${space._id}/balance`)
            ]);
            
            const expenses = expensesRes.data.expenses || expensesRes.data;
            const balance = balanceRes.data;
            
            // Calculate member balances
            const memberBalances = {};
            space.members.forEach(member => {
              memberBalances[member._id] = { spent: 0, owes: 0, balance: 0 };
            });
            
            // Calculate total spent by each member
            expenses.forEach(expense => {
              const paidById = expense.paidBy._id || expense.paidBy;
              const splitAmount = expense.amount / expense.splitBetween.length;
              
              // Add to paid amount
              if (memberBalances[paidById]) {
                memberBalances[paidById].spent += expense.amount;
              }
              
              // Subtract split amount from each member
              expense.splitBetween.forEach(memberId => {
                const id = memberId._id || memberId;
                if (memberBalances[id]) {
                  memberBalances[id].owes += splitAmount;
                }
              });
            });
            
            // Calculate final balances
            Object.keys(memberBalances).forEach(memberId => {
              const member = memberBalances[memberId];
              member.balance = member.spent - member.owes;
            });
            
            return {
              ...space,
              expenses,
              memberBalances,
              userBalance: balance
            };
          } catch (error) {
            console.error(`Failed to fetch data for space ${space._id}:`, error);
            return {
              ...space,
              expenses: [],
              memberBalances: {},
              userBalance: { balance: 0, status: 'settled' }
            };
          }
        })
      );
      
      setSpaces(spacesWithBalances);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch spaces:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    try {
      await api.post('/spaces', {
        name: formData.name,
        memberEmails: selectedEmails,
        budgets: { monthly: Number(formData.monthly) }
      });
      setShowCreateModal(false);
      setFormData({ name: '', monthly: 0 });
      resetMemberState();
      fetchSpaces();
    } catch (error) {
      console.error('Failed to create space:', error);
      alert(error.response?.data?.error || 'Failed to create space');
    }
  };

  const handleRenameSpace = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/spaces/${selectedSpace._id}`, { name: formData.name });
      setShowEditModal(false);
      setSelectedSpace(null);
      fetchSpaces();
    } catch (error) {
      console.error('Failed to rename space:', error);
    }
  };

  const handleAddMembers = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/spaces/${selectedSpace._id}/members`, { emails: selectedEmails });
      setShowAddMemberModal(false);
      setSelectedSpace(null);
      resetMemberState();
      fetchSpaces();
    } catch (error) {
      console.error('Failed to add members:', error);
      alert(error.response?.data?.error || 'Failed to add members');
    }
  };

  const openQuickAddModal = (space, e) => {
    e.stopPropagation();
    setSelectedSpace(space);
    setShowQuickAddModal(true);
  };

  const handleQuickAddExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/spaces/${selectedSpace._id}/expenses`, {
        amount: parseFloat(quickAddData.amount),
        description: quickAddData.description,
        category: quickAddData.category
      });
      setShowQuickAddModal(false);
      setSelectedSpace(null);
      setQuickAddData({ amount: '', description: '', category: 'Other' });
      fetchSpaces();
    } catch (error) {
      console.error('Failed to add expense:', error);
      alert('Failed to add expense');
    }
  };

  const openGlobalQuickAdd = () => {
    if (spaces.length === 0) {
      alert("Please create a space first!");
      return;
    }
    const savedSpaceId = localStorage.getItem('last_selected_space_id');
    const isValidSaved = spaces.some(s => s._id === savedSpaceId);
    const defaultSpaceId = isValidSaved ? savedSpaceId : (spaces[0]?._id || '');

    setGlobalQuickAddData({
      amount: '',
      description: '',
      spaceId: defaultSpaceId,
      category: 'Other'
    });
    setShowGlobalQuickAddModal(true);
  };

  const handleSpaceChange = (e) => {
    const val = e.target.value;
    setGlobalQuickAddData(prev => ({ ...prev, spaceId: val }));
    localStorage.setItem('last_selected_space_id', val);
  };

  const handleGlobalQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!globalQuickAddData.amount || parseFloat(globalQuickAddData.amount) <= 0 || !globalQuickAddData.spaceId) return;

    try {
      setGlobalQuickAddLoading(true);
      await api.post(`/spaces/${globalQuickAddData.spaceId}/expenses`, {
        amount: parseFloat(globalQuickAddData.amount),
        description: globalQuickAddData.description,
        category: globalQuickAddData.category || 'Other'
      });
      setShowGlobalQuickAddModal(false);
      setGlobalQuickAddData(prev => ({
        ...prev,
        amount: '',
        description: '',
        category: 'Other'
      }));
      setShowSuccessNotification(true);
      fetchSpaces();
    } catch (error) {
      console.error('Failed to add space expense:', error);
      alert(error.response?.data?.error || 'Failed to add space expense');
    } finally {
      setGlobalQuickAddLoading(false);
    }
  };

  const handleGlobalVoiceExpense = (expense) => {
    setShowSuccessNotification(true);
    setShowGlobalQuickAddModal(false);
    setGlobalQuickAddData(prev => ({
      ...prev,
      amount: '',
      description: '',
      category: 'Other'
    }));
    fetchSpaces();
  };

  const handleDeleteSpace = async (space, e) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      `Delete "${space.name}"? This will permanently delete this space and all related expenses.`
    );

    if (!confirmed || deletingSpaceId) return;

    const previousSpaces = spaces;
    setDeletingSpaceId(space._id);
    setSpaces((prev) => prev.filter((item) => item._id !== space._id));

    try {
      await api.delete(`/spaces/${space._id}`);
    } catch (error) {
      console.error('Failed to delete space:', error);
      setSpaces(previousSpaces);
      alert(error.response?.data?.error || 'Failed to delete space');
    } finally {
      setDeletingSpaceId(null);
    }
  };

  if (loading) {
    return (
      <div className="spaces-page">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="spaces-page">
      <header className="page-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="page-title">Shared Spaces</h1>
              <p className="page-subtitle">Manage expenses with friends, family & roommates</p>
            </div>
            <button className="btn-create" onClick={() => setShowCreateModal(true)}>
              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Create Space</span>
            </button>
          </div>
        </header>

      <div className="spaces-grid">
        {spaces.length === 0 ? (
          <div className="empty-state">
            <p>No spaces yet. Create your first shared space!</p>
          </div>
        ) : (
          spaces.map((space) => {
            const totalSpent = (space.expenses || []).reduce((s, e) => s + e.amount, 0);
            const monthlyBudget = space.budgets?.monthly || 0;
            const budgetPercent = monthlyBudget > 0 ? Math.min((totalSpent / monthlyBudget) * 100, 100) : 0;
            const isOverBudget = monthlyBudget > 0 && totalSpent > monthlyBudget;

            return (
              <div 
                key={space._id} 
                className="space-card"
                onClick={() => navigate(`/spaces/${space._id}`)}
              >
                <div className="card-accent"></div>
                <div className="card-body">
                  <div className="card-top-row">
                    <h3 className="card-title">{space.name}</h3>
                    <div className="space-card-actions">
                      <button
                        className="space-delete-btn"
                        onClick={(e) => handleDeleteSpace(space, e)}
                        title="Delete space"
                        disabled={deletingSpaceId === space._id}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="card-stats">
                    <div className="card-stat">
                      <span className="stat-value">₹{totalSpent.toLocaleString('en-IN')}</span>
                      <span className="stat-label">Total Spent</span>
                    </div>
                    <div className="card-stat">
                      <span className="stat-value">{space.expenses?.length || 0}</span>
                      <span className="stat-label">Expenses</span>
                    </div>
                    <div className="card-stat">
                      <span className="stat-value">{space.members.length}</span>
                      <span className="stat-label">Members</span>
                    </div>
                  </div>

                  {monthlyBudget > 0 && (
                    <div className="card-budget">
                      <div className="budget-label-row">
                        <span className="budget-text">Budget</span>
                        <span className={`budget-nums ${isOverBudget ? 'over' : ''}`}>
                          ₹{totalSpent.toLocaleString('en-IN')} / ₹{monthlyBudget.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="budget-bar">
                        <div 
                          className={`budget-fill ${isOverBudget ? 'over' : ''}`}
                          style={{ width: `${budgetPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="card-footer">
                    <div className="card-avatars">
                      {space.members.slice(0, 4).map((member) => (
                        <div key={member._id} className="card-avatar" title={member.name}>
                          {member.avatar
                            ? <img src={member.avatar} alt={member.name} style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}} />
                            : member.name[0]
                          }
                        </div>
                      ))}
                      {space.members.length > 4 && (
                        <div className="card-avatar more">+{space.members.length - 4}</div>
                      )}
                    </div>
                    <span className="card-arrow">→</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); resetMemberState(); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Create New Space</h2>
            <form onSubmit={handleCreateSpace}>
              <div className="form-group">
                <label>Space Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Roommates, Trip to Goa"
                  required
                />
              </div>
              <div className="form-group">
                <label>Add Members</label>
                <div className="member-search-wrap">
                  {selectedEmails.length > 0 && (
                    <div className="member-chips">
                      {selectedEmails.map(email => (
                        <span key={email} className="member-chip">
                          {email}
                          <button type="button" onClick={() => removeEmail(email)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={memberQuery}
                      onChange={e => handleMemberQueryChange(e.target.value)}
                      onFocus={() => memberQuery.trim() && setShowSuggestions(true)}
                      placeholder="Search by name..."
                      autoComplete="off"
                    />
                    {showSuggestions && memberSuggestions.length > 0 && (
                      <div className="member-suggestions">
                        {memberSuggestions.map((s, i) => (
                          <div key={i} className="member-suggestion-item" onMouseDown={() => selectSuggestion(s)}>
                            <span className="suggestion-name">{s.name}</span>
                            <span className="suggestion-email">{s.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <small>Search and select registered users to add.</small>
              </div>
              <div className="form-group">
                <label>Monthly Budget (Optional)</label>
                <div className="input-with-prefix">
                  <span className="prefix">₹</span>
                  <input
                    type="number"
                    value={formData.monthly}
                    onChange={(e) => setFormData({ ...formData, monthly: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedSpace && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Rename Space</h2>
            <form onSubmit={handleRenameSpace}>
              <div className="form-group">
                <label>New Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && selectedSpace && (
        <div className="modal-overlay" onClick={() => { setShowAddMemberModal(false); resetMemberState(); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Members to {selectedSpace.name}</h2>
            <form onSubmit={handleAddMembers}>
              <div className="form-group">
                <label>Search Members</label>
                <div className="member-search-wrap">
                  {selectedEmails.length > 0 && (
                    <div className="member-chips">
                      {selectedEmails.map(email => (
                        <span key={email} className="member-chip">
                          {email}
                          <button type="button" onClick={() => removeEmail(email)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={memberQuery}
                      onChange={e => handleMemberQueryChange(e.target.value)}
                      onFocus={() => memberQuery.trim() && setShowSuggestions(true)}
                      placeholder="Search by name..."
                      autoComplete="off"
                    />
                    {showSuggestions && memberSuggestions.length > 0 && (
                      <div className="member-suggestions">
                        {memberSuggestions.map((s, i) => (
                          <div key={i} className="member-suggestion-item" onMouseDown={() => selectSuggestion(s)}>
                            <span className="suggestion-name">{s.name}</span>
                            <span className="suggestion-email">{s.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <small>Only registered users can be added</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddMemberModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Members
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Expense Modal */}
      {showQuickAddModal && selectedSpace && (
        <div className="modal-overlay" onClick={() => setShowQuickAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Expense to {selectedSpace.name}</h2>
            <form onSubmit={handleQuickAddExpense}>
              <div className="form-group">
                <label>Amount</label>
                <div className="input-with-prefix">
                  <span className="prefix">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={quickAddData.amount}
                    onChange={(e) => setQuickAddData({ ...quickAddData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={quickAddData.description}
                  onChange={(e) => setQuickAddData({ ...quickAddData, description: e.target.value })}
                  placeholder="What was this expense for?"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={quickAddData.category}
                  onChange={(e) => setQuickAddData({ ...quickAddData, category: e.target.value })}
                >
                  <option value="Food">🍕 Food</option>
                  <option value="Transport">🚗 Transport</option>
                  <option value="Bills">💡 Bills</option>
                  <option value="Grocery">🛒 Grocery</option>
                  <option value="Entertainment">🎬 Entertainment</option>
                  <option value="Other">📦 Other</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowQuickAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Floating Plus Button */}
      <button
        className="floating-add-btn"
        onClick={openGlobalQuickAdd}
        title="Quick Add Space Expense"
        style={{ bottom: '90px', right: '18px' }}
      >
        +
      </button>

      {/* Global Quick Add Modal */}
      {showGlobalQuickAddModal && (
        <div className="floating-overlay" onClick={() => setShowGlobalQuickAddModal(false)}>
          <div className="floating-modal" onClick={(e) => e.stopPropagation()}>
            <div className="floating-modal-header">
              <span>Add Space Expense</span>
              <button type="button" className="modal-close-btn" onClick={() => setShowGlobalQuickAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleGlobalQuickAddSubmit}>
              {/* Space Selection Dropdown */}
              <div className="form-group" style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>Select Space</label>
                <select
                  value={globalQuickAddData.spaceId}
                  onChange={handleSpaceChange}
                  style={{ padding: '0.75rem', fontSize: '1rem', width: '100%' }}
                  required
                >
                  {spaces.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount Row */}
              <div className="modal-amount-row">
                <span className="modal-currency">₹</span>
                <input
                  type="number"
                  step="0.01"
                  className="modal-amount-input"
                  placeholder="0"
                  value={globalQuickAddData.amount}
                  onChange={(e) => setGlobalQuickAddData(prev => ({ ...prev, amount: e.target.value }))}
                  disabled={globalQuickAddLoading}
                  autoFocus
                  required
                />
              </div>

              {/* Description Input + Mic Row */}
              <div className="modal-note-wrap">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="modal-note-input"
                    placeholder="Note / Description"
                    value={globalQuickAddData.description}
                    onChange={(e) => setGlobalQuickAddData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={globalQuickAddLoading}
                    style={{ flex: 1, margin: 0 }}
                  />
                  <VoiceExpenseBtn 
                    inline 
                    spaceId={globalQuickAddData.spaceId} 
                    onExpenseAdded={handleGlobalVoiceExpense} 
                  />
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>Category</label>
                <select
                  value={globalQuickAddData.category}
                  onChange={(e) => setGlobalQuickAddData(prev => ({ ...prev, category: e.target.value }))}
                  style={{ padding: '0.75rem', fontSize: '1rem', width: '100%' }}
                >
                  <option value="Food">🍕 Food</option>
                  <option value="Transport">🚗 Transport</option>
                  <option value="Bills">💡 Bills</option>
                  <option value="Grocery">🛒 Grocery</option>
                  <option value="Entertainment">🎬 Entertainment</option>
                  <option value="Other">📦 Other</option>
                </select>
              </div>

              <button
                type="submit"
                className="modal-submit-btn"
                disabled={globalQuickAddLoading || !globalQuickAddData.amount || parseFloat(globalQuickAddData.amount) <= 0}
              >
                {globalQuickAddLoading ? 'Adding...' : `Add ₹${globalQuickAddData.amount || '0'} to Space`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success Notification */}
      <SuccessNotification
        message="Space expense added!"
        isVisible={showSuccessNotification}
        onClose={() => setShowSuccessNotification(false)}
      />
    </div>
  );
};

export default SpacesPage;
