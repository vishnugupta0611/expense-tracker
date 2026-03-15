import { useState, useEffect, useCallback } from 'react';
import api from '@services/api.js';
import QuickAddInput from '@components/expenses/QuickAddInput';
import BudgetProgress from '@components/expenses/BudgetProgress';
import './ExpensesPage.css';

const ExpensesPage = () => {
  const [categories, setCategories] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [, setMonthlyTotal] = useState(0);
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  // Stats states
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [, setCategoryStats] = useState({});
  const [, setExpenseStreak] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Set default categories as fallback
      const defaultCategories = ['Food', 'Transport', 'Bills', 'Grocery', 'Entertainment', 'Other'];
      
      const [categoriesRes, todayRes, monthlyRes, budgetRes, expensesRes, spacesRes] = await Promise.all([
        api.get('/categories').catch(() => ({ data: { categories: defaultCategories } })),
        api.get('/expenses/today'),
        api.get('/expenses/monthly'),
        api.get('/expenses/budget-status'),
        api.get('/expenses'),
        api.get('/spaces'),
      ]);

      // Handle categories response - it might be an array or object with categories property
      const categoriesData = categoriesRes.data.categories || categoriesRes.data || defaultCategories;
      setCategories(Array.isArray(categoriesData) ? categoriesData.map(cat => cat.name || cat) : defaultCategories);
      
      setTodayTotal(todayRes.data.total || 0);
      setMonthlyTotal(monthlyRes.data.total || 0);
      setBudgetStatus(budgetRes.data);
      setExpenses(expensesRes.data.expenses || []);
      
      // Calculate additional stats
      calculateStats(expensesRes.data.expenses || []);
      
      // Fetch spaces with balances
      const spacesData = spacesRes.data.spaces || spacesRes.data || [];
      const spacesWithBalances = await Promise.all(
        spacesData.map(async (space) => {
          try {
            const balanceRes = await api.get(`/spaces/${space._id}/balance`);
            return {
              ...space,
              userBalance: balanceRes.data
            };
          } catch (error) {
            console.error(`Failed to fetch balance for space ${space._id}:`, error);
            return {
              ...space,
              userBalance: { balance: 0, status: 'settled', amount: 0 }
            };
          }
        })
      );
      
      setSpaces(spacesWithBalances);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      // Set fallback data to prevent blank screen
      setCategories(['Food', 'Transport', 'Bills', 'Grocery', 'Entertainment', 'Other']);
      setTodayTotal(0);
      setMonthlyTotal(0);
      setExpenses([]);
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array to prevent recreation

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateStats = (expensesList) => {
    // Weekly total
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weeklyExpenses = expensesList.filter(exp => new Date(exp.date) >= weekStart);
    setWeeklyTotal(weeklyExpenses.reduce((sum, exp) => sum + exp.amount, 0));

    // Category stats
    const categoryBreakdown = {};
    expensesList.forEach(expense => {
      if (!categoryBreakdown[expense.category]) {
        categoryBreakdown[expense.category] = { total: 0, count: 0 };
      }
      categoryBreakdown[expense.category].total += expense.amount;
      categoryBreakdown[expense.category].count += 1;
    });
    setCategoryStats(categoryBreakdown);

    // Calculate expense streak (consecutive days with expenses)
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const hasExpenseOnDate = expensesList.some(exp => {
        const expDate = new Date(exp.date);
        return expDate.toDateString() === checkDate.toDateString();
      });
      if (hasExpenseOnDate) {
        streak++;
      } else {
        break;
      }
    }
    setExpenseStreak(streak);
  };

  const handleExpenseAdded = (newExpense) => {
    if (newExpense) {
      setExpenses(prev => [newExpense, ...prev]);
      setTodayTotal(prev => prev + newExpense.amount);
      setWeeklyTotal(prev => prev + newExpense.amount);
    } else {
      fetchData();
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      const expense = expenses.find(e => e._id === id);
      await api.delete(`/expenses/${id}`);
      setExpenses(prev => prev.filter(e => e._id !== id));
      if (expense) {
        const isToday = new Date(expense.date).toDateString() === new Date().toDateString();
        const isThisWeek = new Date(expense.date) >= new Date(new Date().setDate(new Date().getDate() - 7));
        if (isToday) setTodayTotal(prev => prev - expense.amount);
        if (isThisWeek) setWeeklyTotal(prev => prev - expense.amount);
      }
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  const handleClearHistory = async (saveHistory = false) => {
    try {
      if (saveHistory) {
        const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endDate = new Date();
        await api.post('/expenses/save-history', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          expenses: expenses
        });
      }
      
      await api.delete('/expenses/clear-all');
      setShowClearDialog(false);
      fetchData();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };



  const groupExpensesByDate = (expenses) => {
    const groups = {};
    expenses.forEach((expense) => {
      const date = new Date(expense.date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(expense);
    });
    return groups;
  };

  const groupedExpenses = groupExpensesByDate(expenses);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  if (loading) {
    return (
      <div className="expenses-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-page">
      <div className="expenses-header">
        <h1>Expenses</h1>
        <button className="mobile-analytics-btn" onClick={() => window.location.href = '/analytics'}>
          <span className="analytics-icon">📊</span>
          <span className="analytics-text">Analytics</span>
        </button>
      </div>

      <div className="expenses-layout">
        {/* Enhanced Left Column */}
        <div className="expenses-sidebar">
          {/* Enhanced Summary Cards */}
          <div className="spending-summary">
            <div className="summary-card">
              <span className="summary-label">Today</span>
              <span className="summary-amount">₹{todayTotal.toFixed(0)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">This Week</span>
              <span className="summary-amount">₹{weeklyTotal.toFixed(0)}</span>
            </div>
          </div>

          <BudgetProgress budgetStatus={budgetStatus} />
          
          {/* Space Sharing */}
          {spaces.length > 0 ? (
            spaces.map((space) => (
              <div key={space._id} className="space-sharing">
                <h4>Space Sharing</h4>
                <div className="sharing-status">
                  <div className="space-name-header">
                    <span className="space-icon">🏠</span>
                    <span className="space-name">{space.name}</span>
                  </div>
                  
                  {space.userBalance && space.userBalance.status !== 'settled' ? (
                    <div className={`sharing-alert ${space.userBalance.status === 'owed' ? 'positive' : 'negative'}`}>
                      <span className="sharing-icon">
                        {space.userBalance.status === 'owed' ? '💰' : '💸'}
                      </span>
                      <div className="sharing-text">
                        <span className="sharing-label">
                          {space.userBalance.status === 'owed' 
                            ? 'Others will pay you' 
                            : 'You need to pay others'
                          }
                        </span>
                        <span className="sharing-amount">₹{space.userBalance.amount.toFixed(0)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="sharing-alert settled">
                      <span className="sharing-icon">✅</span>
                      <div className="sharing-text">
                        <span className="sharing-label">All settled!</span>
                        <span className="sharing-amount">₹0</span>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    className="view-space-btn" 
                    onClick={() => window.location.href = `/spaces/${space._id}`}
                  >
                    View {space.name}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="space-sharing">
              <h4>Space Sharing</h4>
              <div className="sharing-status">
                <div className="no-spaces">
                  <span className="no-spaces-icon">🏠</span>
                  <span className="no-spaces-text">No shared spaces yet</span>
                  <button 
                    className="create-space-btn" 
                    onClick={() => window.location.href = '/spaces'}
                  >
                    Create Space
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Right Column */}
        <div className="expenses-main">
          <QuickAddInput categories={categories} onExpenseAdded={handleExpenseAdded} />

          <div className="expenses-timeline">
            <div className="timeline-header">
              <h3 className="timeline-title">Recent Expenses</h3>
              <div className="timeline-summary">
                <span className="expense-count">{expenses.length} expenses</span>
                <span className="expense-total">₹{totalExpenses.toFixed(0)}</span>
              </div>
            </div>
            
            {Object.keys(groupedExpenses).length === 0 ? (
              <div className="no-expenses">
                <p>No expenses yet. Add your first expense above!</p>
              </div>
            ) : (
              Object.entries(groupedExpenses).map(([date, dateExpenses]) => (
                <div key={date} className="expense-group">
                  <div className="expense-date-header">
                    <h4 className="expense-date">{date}</h4>
                    <span className="date-total">
                      ₹{dateExpenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(0)}
                    </span>
                  </div>
                  {dateExpenses.map((expense) => (
                    <div key={expense._id} className="expense-item">
                      <div className="expense-icon">
                        {expense.category === 'Food' && '🍕'}
                        {expense.category === 'Transport' && '🚗'}
                        {expense.category === 'Bills' && '💡'}
                        {expense.category === 'Grocery' && '🛒'}
                        {expense.category === 'Entertainment' && '🎬'}
                        {expense.category === 'Other' && '📦'}
                        {!['Food','Transport','Bills','Grocery','Entertainment','Other'].includes(expense.category) && '🏷️'}
                      </div>
                      <div className="expense-info">
                        <div className="expense-main-info">
                          <span className="expense-title expense-category ">
                            {expense.description || expense.category}
                          </span>
                          {/* <span className=" badge-primary">
                            {expense.category}
                          </span> */}
                        </div>
                        <div className="expense-meta">
                          <span className="expense-time">
                            {new Date(expense.date).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="expense-actions">
                        <span className="expense-amount">₹{expense.amount.toFixed(0)}</span>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteExpense(expense._id)}
                          title="Delete expense"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Clear History Dialog */}
      {showClearDialog && (
        <div className="dialog-overlay" onClick={() => setShowClearDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Clear Expense History</h3>
            <p>Do you want to save the history for this month before clearing?</p>
            <div className="dialog-date-range">
              <span>From: {new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString()}</span>
              <span>To: {new Date().toLocaleDateString()}</span>
            </div>
            <div className="dialog-actions">
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowClearDialog(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleClearHistory(true)}
              >
                Save & Clear
              </button>
              <button 
                className="btn btn-error" 
                onClick={() => handleClearHistory(false)}
              >
                Clear Without Saving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;