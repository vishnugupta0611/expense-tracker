import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
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
  const [formData, setFormData] = useState({
    name: '',
    memberEmails: '',
    monthly: 0
  });
  const [quickAddData, setQuickAddData] = useState({
    amount: '',
    description: '',
    category: 'Other'
  });

  useEffect(() => {
    fetchSpaces();
  }, []);

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

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    try {
      const emails = formData.memberEmails.split(',').map(e => e.trim()).filter(e => e);
      await api.post('/spaces', {
        name: formData.name,
        memberEmails: emails,
        budgets: { monthly: Number(formData.monthly) }
      });
      setShowCreateModal(false);
      setFormData({ name: '', memberEmails: '', monthly: 0 });
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
      const emails = formData.memberEmails.split(',').map(e => e.trim()).filter(e => e);
      await api.post(`/spaces/${selectedSpace._id}/members`, { emails });
      setShowAddMemberModal(false);
      setSelectedSpace(null);
      setFormData({ ...formData, memberEmails: '' });
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

  const openEditModal = (space, e) => {
    e.stopPropagation();
    setSelectedSpace(space);
    setFormData({ ...formData, name: space.name });
    setShowEditModal(true);
  };

  const openAddMemberModal = (space, e) => {
    e.stopPropagation();
    setSelectedSpace(space);
    setShowAddMemberModal(true);
  };

  const viewAnalytics = (space, e) => {
    e.stopPropagation();
    navigate(`/spaces/${space._id}/analytics`);
  };

  if (loading) {
    return (
      <div className="spaces-page">
        <div className="loading-spinner">Loading...</div>
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
                    <button 
                      className="quick-add-btn" 
                      onClick={(e) => openQuickAddModal(space, e)}
                      title="Quick Add Expense"
                    >+</button>
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
                          {member.name[0]}
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
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
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
                <label>Add Members (Emails)</label>
                <textarea
                  value={formData.memberEmails}
                  onChange={(e) => setFormData({ ...formData, memberEmails: e.target.value })}
                  placeholder="email1@example.com, email2@example.com"
                  rows={3}
                />
                <small>Comma-separated. Only registered users can be added.</small>
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
        <div className="modal-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Members to {selectedSpace.name}</h2>
            <form onSubmit={handleAddMembers}>
              <div className="form-group">
                <label>Member Emails</label>
                <textarea
                  value={formData.memberEmails}
                  onChange={(e) => setFormData({ ...formData, memberEmails: e.target.value })}
                  placeholder="email1@example.com, email2@example.com"
                  rows={3}
                  required
                />
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
    </div>
  );
};

export default SpacesPage;
