import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@services/api';
import './SpaceDetailsPage.css';
import BudgetProgress from '@components/expenses/BudgetProgress';
import SpaceExpenseModal from '@components/spaces/SpaceExpenseModal';

const SpaceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [space, setSpace] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ monthly: 0 });
  const [commentText, setCommentText] = useState('');
  const [newName, setNewName] = useState('');
  const [memberEmails, setMemberEmails] = useState('');
  const [settingsTab, setSettingsTab] = useState('info');

  // Filter states
  const [showFilter, setShowFilter] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMember, setFilterMember] = useState('');

  // Comment popup states
  const [commentPopup, setCommentPopup] = useState({ show: false, expenseId: null });
  const [viewCommentsPopup, setViewCommentsPopup] = useState({ show: false, expense: null });

  useEffect(() => {
    fetchSpaceData();
  }, [id]);

  const fetchSpaceData = async () => {
    try {
      const [spaceRes, analyticsRes, expensesRes] = await Promise.all([
        api.get(`/spaces/${id}`),
        api.get(`/analytics/space/${id}`), 
        api.get(`/spaces/${id}/expenses`)
      ]);
      setSpace(spaceRes.data.space || spaceRes.data);
      setAnalytics(analyticsRes.data);
      setExpenses(expensesRes.data.expenses || expensesRes.data);
      setLoading(false);
      const spaceData = spaceRes.data.space || spaceRes.data;
      setBudgetForm({ monthly: spaceData.budgets?.monthly || 0 });
      setNewName(spaceData.name);
    } catch (error) {
      console.error('Error fetching space details:', error);
      setLoading(false);
    }
  };

  const handleUpdateBudget = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/spaces/${id}/budget`, {
        monthly: Number(budgetForm.monthly)
      });
      setShowSettings(false);
      fetchSpaceData();
    } catch (error) {
      console.error('Failed to update budget', error);
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/spaces/${id}`, { name: newName });
      setShowSettings(false);
      fetchSpaceData();
    } catch (error) {
      console.error('Failed to rename space', error);
    }
  };

  const handleAddMembers = async (e) => {
    e.preventDefault();
    try {
      const emails = memberEmails.split(',').map(e => e.trim()).filter(e => e);
      await api.post(`/spaces/${id}/members`, { emails });
      setShowSettings(false);
      setMemberEmails('');
      fetchSpaceData();
    } catch (error) {
      console.error('Failed to add members', error);
      alert(error.response?.data?.error || 'Failed to add members');
    }
  };

  const handleAddComment = async (expenseId) => {
    if (!commentText.trim()) return;
    try {
      await api.post(`/spaces/expenses/${expenseId}/comments`, { text: commentText });
      setCommentText('');
      setCommentPopup({ show: false, expenseId: null });
      const expensesRes = await api.get(`/spaces/${id}/expenses`);
      setExpenses(expensesRes.data.expenses || expensesRes.data);
    } catch (error) {
      console.error('Failed to add comment', error);
    }
  };

  const handleExpenseDoubleClick = (expenseId) => {
    setCommentText('');
    setCommentPopup({ show: true, expenseId });
  };

  const handleViewComments = (e, expense) => {
    e.stopPropagation();
    setViewCommentsPopup({ show: true, expense });
  };

  // Get filtered expenses
  const getFilteredExpenses = () => {
    let filtered = [...expenses];
    if (filterDate) {
      filtered = filtered.filter(exp => {
        const expDate = new Date(exp.date).toISOString().split('T')[0];
        return expDate === filterDate;
      });
    }
    if (filterCategory) {
      filtered = filtered.filter(exp => exp.category === filterCategory);
    }
    if (filterMember) {
      filtered = filtered.filter(exp => (exp.paidBy?._id || exp.paidBy) === filterMember);
    }
    return filtered;
  };

  // Get unique categories from expenses
  const getUniqueCategories = () => {
    const cats = new Set();
    expenses.forEach(exp => cats.add(exp.category));
    return Array.from(cats);
  };

  // Get filtered total
  const getFilteredTotal = () => {
    return getFilteredExpenses().reduce((sum, exp) => sum + exp.amount, 0);
  };

  // Group expenses by date
  const groupExpensesByDate = () => {
    const filtered = getFilteredExpenses();
    const groups = {};
    filtered.forEach(expense => {
      const dateKey = new Date(expense.date).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(expense);
    });
    // Sort dates newest first
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      return new Date(b) - new Date(a);
    });
    return sortedKeys.map(key => ({ date: key, expenses: groups[key] }));
  };

  // Category emoji map
  const getCategoryEmoji = (category) => {
    const map = {
      'food': '🍕', 'Food': '🍕',
      'transport': '🚗', 'Transport': '🚗',
      'shopping': '🛍️', 'Shopping': '🛍️',
      'entertainment': '🎬', 'Entertainment': '🎬',
      'bills': '📄', 'Bills': '📄',
      'health': '💊', 'Health': '💊',
      'education': '📚', 'Education': '📚',
      'rent': '🏠', 'Rent': '🏠',
      'groceries': '🛒', 'Groceries': '🛒',
      'utilities': '💡', 'Utilities': '💡',
    };
    return map[category] || '💰';
  };

  // Compute per-member settlements from expenses
  const handleSettle = async () => {
    if (!window.confirm('Are you sure? This will mark all current settlements as settled. History will remain.')) return;
    try {
      await api.put(`/spaces/${id}/settle`);
      fetchSpaceData();
    } catch (error) {
      console.error('Failed to settle', error);
    }
  };

  const computeSettlements = () => {
    if (!space || !expenses.length) return [];

    // Only consider expenses after settledAt
    const relevantExpenses = space.settledAt 
      ? expenses.filter(exp => new Date(exp.date) > new Date(space.settledAt))
      : expenses;

    if (!relevantExpenses.length) return [];

    // Build a map: userId -> { name, netBalance }
    // Positive = others owe them, Negative = they owe others
    const memberMap = {};
    space.members.forEach(m => {
      memberMap[m._id] = { name: m.name, net: 0 };
    });

    relevantExpenses.forEach(expense => {
      const payerId = expense.paidBy?._id || expense.paidBy;
      const splitMembers = expense.splitBetween || space.members;
      const splitCount = splitMembers.length;
      const perPerson = expense.amount / splitCount;

      // Payer gets credit for paying
      if (memberMap[payerId]) {
        memberMap[payerId].net += expense.amount;
      }

      // Each person in split owes their share
      splitMembers.forEach(m => {
        const mId = m._id || m;
        if (memberMap[mId]) {
          memberMap[mId].net -= perPerson;
        }
      });
    });

    // Now compute who owes whom from the logged-in user's perspective
    // We find the current user by checking which member's ID matches the token user
    // Since we don't have userId directly, we use the approach:
    // For each OTHER member, if their net is positive (they are owed money) and current user's net is negative, user pays them
    // Simplified: compute pairwise from expenses
    const pairwise = {}; // { "payerId" -> { "owerId" -> amount } }

    relevantExpenses.forEach(expense => {
      const payerId = (expense.paidBy?._id || expense.paidBy).toString();
      const splitMembers = expense.splitBetween || space.members;
      const splitCount = splitMembers.length;
      const perPerson = expense.amount / splitCount;

      splitMembers.forEach(m => {
        const mId = (m._id || m).toString();
        if (mId !== payerId) {
          // mId owes payerId perPerson amount
          if (!pairwise[mId]) pairwise[mId] = {};
          if (!pairwise[mId][payerId]) pairwise[mId][payerId] = 0;
          pairwise[mId][payerId] += perPerson;
        }
      });
    });

    // Simplify: net out between each pair
    const settlements = [];
    const processed = new Set();
    const memberIds = space.members.map(m => m._id.toString());

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const a = memberIds[i];
        const b = memberIds[j];
        const key = `${a}-${b}`;
        if (processed.has(key)) continue;
        processed.add(key);

        const aOwesB = (pairwise[a]?.[b] || 0);
        const bOwesA = (pairwise[b]?.[a] || 0);
        const net = aOwesB - bOwesA;

        if (Math.abs(net) > 0.5) {
          const nameA = space.members.find(m => m._id.toString() === a)?.name || 'Unknown';
          const nameB = space.members.find(m => m._id.toString() === b)?.name || 'Unknown';

          if (net > 0) {
            // A owes B
            settlements.push({ from: nameA, to: nameB, amount: Math.round(net) });
          } else {
            // B owes A
            settlements.push({ from: nameB, to: nameA, amount: Math.round(Math.abs(net)) });
          }
        }
      }
    }

    return settlements;
  };

  if (loading) return <div className="loading-spinner">Loading...</div>;
  if (!space) return <div>Space not found</div>;

  const budgetData = analytics ? {
    monthly: {
      spent: analytics.total || 0,
      budget: space.budgets?.monthly || 0,
      exceeded: space.budgets?.monthly > 0 && analytics.total > space.budgets.monthly
    },
    daily: { spent: 0, budget: 0, exceeded: false },
    categories: analytics.budgetStatus || {}
  } : null;

  const groupedExpenses = groupExpensesByDate();

  return (
    <div className="space-details-page">
      <header className="space-header">
        <div className="header-left">
            <button className="back-btn" onClick={() => navigate('/spaces')}>
            ← Back
            </button>
            <h1>{space.name}</h1>
        </div>
        <div className="header-actions">
            <button className="filter-btn-main" onClick={() => setShowFilter(!showFilter)}>
              🔍 Filter
            </button>
            <button className="settings-btn-main" onClick={() => setShowSettings(true)}>
              ⚙️ Settings
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddExpense(true)}>
              + Add Expense
            </button>
        </div>
      </header>

      {/* Unified Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3>⚙️ Space Settings</h3>
              <button className="close-modal-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-tabs">
              <button 
                className={`settings-tab ${settingsTab === 'info' ? 'active' : ''}`}
                onClick={() => setSettingsTab('info')}
              >📊 Info</button>
              <button 
                className={`settings-tab ${settingsTab === 'rename' ? 'active' : ''}`}
                onClick={() => setSettingsTab('rename')}
              >✏️ Rename</button>
              <button 
                className={`settings-tab ${settingsTab === 'members' ? 'active' : ''}`}
                onClick={() => setSettingsTab('members')}
              >👥 Members</button>
              <button 
                className={`settings-tab ${settingsTab === 'budget' ? 'active' : ''}`}
                onClick={() => setSettingsTab('budget')}
              >💰 Budget</button>
            </div>
            <div className="settings-body">
              {settingsTab === 'info' && (
                <div className="info-tab">
                  <h4 className="info-title">💸 Settlements</h4>
                  {(() => {
                    const settlements = computeSettlements();
                    if (settlements.length === 0) {
                      return <p className="info-empty">🎉 All settled up! No pending payments.</p>;
                    }
                    return (
                      <div className="settlement-list">
                        {settlements.map((s, idx) => (
                          <div key={idx} className="settlement-item">
                            <div className="settlement-icon">💸</div>
                            <div className="settlement-text">
                              <strong>{s.from}</strong> has to pay <span className="settlement-amount">₹{s.amount}</span> to <strong>{s.to}</strong>
                            </div>
                          </div>
                        ))}
                        <button className="settle-btn" onClick={handleSettle}>
                          ✅ Mark All as Settled
                        </button>
                      </div>
                    );
                  })()}
                  <div className="info-members-section">
                    <h4 className="info-title">👥 Members ({space.members.length})</h4>
                    <div className="info-members-list">
                      {space.members.map(m => (
                        <div key={m._id} className="info-member">
                          <div className="info-member-avatar">{m.name[0]}</div>
                          <div className="info-member-details">
                            <span className="info-member-name">{m.name}</span>
                            <span className="info-member-email">{m.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {settingsTab === 'rename' && (
                <form onSubmit={handleRename} className="settings-form">
                  <label>Space Name</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New space name"
                    required
                  />
                  <button type="submit" className="btn btn-primary">Save Name</button>
                </form>
              )}
              {settingsTab === 'members' && (
                <form onSubmit={handleAddMembers} className="settings-form">
                  <label>Add Members by Email</label>
                  <textarea
                    value={memberEmails}
                    onChange={(e) => setMemberEmails(e.target.value)}
                    placeholder="Enter emails (comma-separated)"
                    rows={3}
                    required
                  />
                  <small className="settings-hint">Only registered users can be added</small>
                  <button type="submit" className="btn btn-primary">Add Members</button>
                </form>
              )}
              {settingsTab === 'budget' && (
                <form onSubmit={handleUpdateBudget} className="settings-form">
                  <label>Monthly Budget</label>
                  <div className="input-with-prefix">
                    <span className="prefix">₹</span>
                    <input 
                      type="number" 
                      value={budgetForm.monthly}
                      onChange={(e) => setBudgetForm({...budgetForm, monthly: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">Save Budget</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard: Budget + Members compact */}
      <div className="space-dashboard-compact">
         {budgetData && (
             <BudgetProgress 
                budget={budgetData} 
                loading={false} 
             />
         )}
         
         <div className="members-compact">
            <span className="members-label">👥 Members</span>
            <div className="members-avatars-compact">
                {space.members.map(member => (
                    <div key={member._id} className="member-avatar-sm" title={member.name}>
                        {member.name[0]}
                    </div>
                ))}
            </div>
         </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-field">
              <label>📅 Date</label>
              <input 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <label>🏷️ Category</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All</option>
                {getUniqueCategories().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="filter-summary">
            <span className="filter-total">Total: <strong>₹{getFilteredTotal()}</strong></span>
            {(filterDate || filterCategory) && (
              <button className="filter-clear" onClick={() => { setFilterDate(''); setFilterCategory(''); setFilterMember(''); }}>
                ✕ Clear filters
              </button>
            )}
          </div>
          <div className="filter-member-row">
            <select 
              className="filter-member-select" 
              value={filterMember} 
              onChange={(e) => setFilterMember(e.target.value)}
            >
              <option value="">Select to see separate total</option>
              {space.members.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
            {filterMember && (() => {
              const member = space.members.find(m => m._id === filterMember);
              const memberTotal = getFilteredExpenses()
                .filter(exp => (exp.paidBy?._id || exp.paidBy) === filterMember)
                .reduce((sum, exp) => sum + exp.amount, 0);
              return (
                <div className="filter-member-total">
                  <span className="filter-member-name">{member?.name}</span> spent <strong>₹{memberTotal}</strong>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Date-wise Bento Expenses */}
      <div className="expenses-section">
        <h3 className="section-title">Shared Expenses</h3>
        {getFilteredExpenses().length === 0 ? (
          <p className="empty-state">No shared expenses yet.</p>
        ) : (
          <div className="date-groups">
            {groupedExpenses.map(group => (
              <div key={group.date} className="date-group">
                <div className="date-header">
                  <span className="date-dot"></span>
                  <span className="date-label">{group.date}</span>
                </div>
                <div className="bento-grid">
                  {group.expenses.map(expense => (
                    <div 
                      key={expense._id} 
                      className="bento-card"
                      onDoubleClick={() => handleExpenseDoubleClick(expense._id)}
                      title="Double-click to add comment"
                    >
                      <div className="bento-card-top">
                        <span className="bento-emoji">{getCategoryEmoji(expense.category)}</span>
                        <span className="bento-amount">₹{expense.amount}</span>
                      </div>
                      <p className="bento-desc">{expense.description}</p>
                      <div className="bento-card-footer">
                        <span className="bento-payer">{expense.paidBy?.name}</span>
                        {expense.comments && expense.comments.length > 0 && (
                          <button 
                            className="comment-icon-btn"
                            onClick={(e) => handleViewComments(e, expense)}
                            title="View comments"
                          >
                            💬 <span className="comment-count">{expense.comments.length}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Double-click Comment Popup */}
      {commentPopup.show && (
        <div className="modal-overlay" onClick={() => setCommentPopup({ show: false, expenseId: null })}>
          <div className="comment-popup" onClick={e => e.stopPropagation()}>
            <h4>💬 Add a Comment</h4>
            <p className="comment-popup-hint">Want to add a comment on this expense?</p>
            <input
              type="text"
              className="comment-input"
              placeholder="Type your comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddComment(commentPopup.expenseId);
              }}
              autoFocus
            />
            <div className="comment-popup-actions">
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setCommentPopup({ show: false, expenseId: null })}
              >Cancel</button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleAddComment(commentPopup.expenseId)}
              >Add Comment</button>
            </div>
          </div>
        </div>
      )}

      {/* View Comments Popup */}
      {viewCommentsPopup.show && viewCommentsPopup.expense && (
        <div className="modal-overlay" onClick={() => setViewCommentsPopup({ show: false, expense: null })}>
          <div className="comment-popup view-comments-popup" onClick={e => e.stopPropagation()}>
            <div className="view-comments-header">
              <h4>💬 Comments</h4>
              <span className="view-comments-expense">
                {viewCommentsPopup.expense.description} — ₹{viewCommentsPopup.expense.amount}
              </span>
            </div>
            <div className="comments-list">
              {viewCommentsPopup.expense.comments.map((comment, idx) => (
                <div key={idx} className="comment-bubble">
                  <strong>{comment.userId?.name || 'User'}:</strong>
                  <span>{comment.text}</span>
                </div>
              ))}
            </div>
            <button 
              className="btn btn-secondary btn-sm close-comments-btn" 
              onClick={() => setViewCommentsPopup({ show: false, expense: null })}
            >Close</button>
          </div>
        </div>
      )}

      {showAddExpense && (
          <SpaceExpenseModal 
            space={space}
            onClose={() => setShowAddExpense(false)}
            onExpenseAdded={() => {
                fetchSpaceData();
            }}
          />
      )}
    </div>
  );
};

export default SpaceDetailsPage;
