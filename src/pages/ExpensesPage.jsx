import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@services/api.js';
import QuickAddInput from '@components/expenses/QuickAddInput';
import BudgetProgress from '@components/expenses/BudgetProgress';
import './ExpensesPage.css';

const CATEGORY_EMOJI = {
  Food: '🍕', Transport: '🚗', Bills: '💡',
  Grocery: '🛒', Entertainment: '🎬', Other: '📦',
};

const ExpensesPage = () => {
  const [categories, setCategories] = useState([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [spaces, setSpaces] = useState([]);

  // Pagination state
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false); // ref guard to avoid stale closure issues

  // Initial load state — only block UI on very first load
  const [initialLoading, setInitialLoading] = useState(true);

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  // ── Sidebar data (non-blocking) ──────────────────────────────────────────
  const fetchSidebarData = useCallback(async () => {
    const defaultCategories = ['Food', 'Transport', 'Bills', 'Grocery', 'Entertainment', 'Other'];
    try {
      const [categoriesRes, todayRes, budgetRes, spacesRes] = await Promise.all([
        api.get('/categories').catch(() => ({ data: { categories: defaultCategories } })),
        api.get('/expenses/today').catch(() => ({ data: { total: 0 } })),
        api.get('/expenses/budget-status').catch(() => ({ data: null })),
        api.get('/spaces').catch(() => ({ data: { spaces: [] } })),
      ]);

      const categoriesData = categoriesRes.data.categories || categoriesRes.data || defaultCategories;
      setCategories(Array.isArray(categoriesData) ? categoriesData.map(c => c.name || c) : defaultCategories);
      setTodayTotal(todayRes.data.total || 0);
      setBudgetStatus(budgetRes.data);

      // Set spaces immediately, then enrich with balances in background
      const spacesData = spacesRes.data.spaces || spacesRes.data || [];
      setSpaces(spacesData.map(s => ({ ...s, userBalance: { balance: 0, status: 'settled', amount: 0 } })));

      // Enrich balances without blocking
      spacesData.forEach(async (space) => {
        try {
          const r = await api.get(`/spaces/${space._id}/balance`);
          setSpaces(prev => prev.map(s => s._id === space._id ? { ...s, userBalance: r.data } : s));
        } catch { /* keep default */ }
      });
    } catch (e) {
      console.error('Sidebar fetch error:', e);
      setCategories(defaultCategories);
    }
  }, []);

  // ── Paginated expense loader ─────────────────────────────────────────────
  const loadExpenses = useCallback(async (cursor = null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const params = cursor ? { before: cursor } : {};
      const res = await api.get('/expenses', { params });
      const { expenses: newExpenses, hasMore: more, nextCursor: nc } = res.data;

      setExpenses(prev => {
        const ids = new Set(prev.map(e => e._id));
        return [...prev, ...newExpenses.filter(e => !ids.has(e._id))];
      });

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      setWeeklyTotal(prev => {
        const newWeekly = newExpenses
          .filter(e => new Date(e.date) >= weekStart)
          .reduce((s, e) => s + e.amount, 0);
        return cursor ? prev + newWeekly : newWeekly;
      });

      setHasMore(more);
      setNextCursor(nc);
    } catch (e) {
      console.error('Load expenses error:', e);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, []); // stable — uses ref for guard

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // Load expenses + sidebar in parallel — don't wait for sidebar
      fetchSidebarData();
      await loadExpenses(null);
      setInitialLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Intersection Observer ────────────────────────────────────────────────
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadExpenses(nextCursor);
        }
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, nextCursor, loadExpenses]);

  // ── Optimistic add ───────────────────────────────────────────────────────
  const handleExpenseAdded = useCallback((newExpense) => {
    if (!newExpense) return;

    // Replace optimistic entry with real server entry
    if (newExpense._replaceOptimistic) {
      setExpenses(prev =>
        prev.map(e => e._id === newExpense._replaceOptimistic ? { ...newExpense, _optimistic: false } : e)
      );
      return;
    }

    // Remove failed optimistic entry
    if (newExpense._removeOptimistic) {
      setExpenses(prev => prev.filter(e => e._id !== newExpense._removeOptimistic));
      const removed = expenses.find(e => e._id === newExpense._removeOptimistic);
      if (removed) {
        const isToday = new Date(removed.date).toDateString() === new Date().toDateString();
        const isThisWeek = new Date(removed.date) >= new Date(new Date().setDate(new Date().getDate() - 7));
        if (isToday) setTodayTotal(prev => prev - removed.amount);
        if (isThisWeek) setWeeklyTotal(prev => prev - removed.amount);
      }
      return;
    }

    // Add new (optimistic or real)
    setExpenses(prev => [newExpense, ...prev]);
    const isToday = new Date(newExpense.date).toDateString() === new Date().toDateString();
    const isThisWeek = new Date(newExpense.date) >= new Date(new Date().setDate(new Date().getDate() - 7));
    if (isToday) setTodayTotal(prev => prev + newExpense.amount);
    if (isThisWeek) setWeeklyTotal(prev => prev + newExpense.amount);
  }, [expenses]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDeleteExpense = useCallback(async (id) => {
    const expense = expenses.find(e => e._id === id);
    // Optimistic remove
    setExpenses(prev => prev.filter(e => e._id !== id));
    if (expense) {
      const isToday = new Date(expense.date).toDateString() === new Date().toDateString();
      const isThisWeek = new Date(expense.date) >= new Date(new Date().setDate(new Date().getDate() - 7));
      if (isToday) setTodayTotal(prev => prev - expense.amount);
      if (isThisWeek) setWeeklyTotal(prev => prev - expense.amount);
    }
    try {
      await api.delete(`/expenses/${id}`);
    } catch (e) {
      console.error('Delete failed, restoring:', e);
      if (expense) setExpenses(prev => [expense, ...prev]);
    }
  }, [expenses]);

  // ── Group by date ────────────────────────────────────────────────────────
  const groupExpensesByDate = (list) => {
    const groups = {};
    list.forEach((expense) => {
      const date = new Date(expense.date).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(expense);
    });
    return groups;
  };

  const groupedExpenses = groupExpensesByDate(expenses);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (initialLoading) {
    return (
      <div className="expenses-page">
        <div className="expenses-skeleton">
          <div className="skeleton-header" />
          <div className="expenses-layout">
            <div className="expenses-sidebar">
              <div className="skeleton-card" />
              <div className="skeleton-card tall" />
            </div>
            <div className="expenses-main">
              <div className="skeleton-card" />
              <div className="skeleton-card tall" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="expenses-page">
      <div className="expenses-header">
        <h1>Expenses</h1>
        <div className="header-actions">
          <button className="mobile-analytics-btn" onClick={() => window.location.href = '/wallet'}>
            <span className="analytics-icon">💰</span>
            <span className="analytics-text">Wallet</span>
          </button>
          <button className="mobile-analytics-btn" onClick={() => window.location.href = '/analytics'}>
            <span className="analytics-icon">📊</span>
            <span className="analytics-text">Analytics</span>
          </button>
        </div>
      </div>

      <div className="expenses-layout">
        {/* Left Sidebar */}
        <div className="expenses-sidebar">
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
                      <span className="sharing-icon">{space.userBalance.status === 'owed' ? '💰' : '💸'}</span>
                      <div className="sharing-text">
                        <span className="sharing-label">
                          {space.userBalance.status === 'owed' ? 'Others will pay you' : 'You need to pay others'}
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
                  <button className="view-space-btn" onClick={() => window.location.href = `/spaces/${space._id}`}>
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
                  <button className="create-space-btn" onClick={() => window.location.href = '/spaces'}>
                    Create Space
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Main */}
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
                      ₹{dateExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(0)}
                    </span>
                  </div>
                  {dateExpenses.map((expense) => (
                    <div
                      key={expense._id}
                      className={`expense-item${expense._optimistic ? ' optimistic' : ''}`}
                    >
                      <div className="expense-icon">
                        {CATEGORY_EMOJI[expense.category] || '🏷️'}
                      </div>
                      <div className="expense-info">
                        <span className="expense-title">
                          {expense.description || expense.category}
                        </span>
                        <span className="expense-time">
                          {new Date(expense.date).toLocaleTimeString('en-IN', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="expense-actions">
                        <span className="expense-amount">₹{expense.amount.toFixed(0)}</span>
                        {!expense._optimistic && (
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteExpense(expense._id)}
                            title="Delete expense"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}

            {/* Intersection sentinel */}
            <div ref={sentinelRef} className="scroll-sentinel" />

            {loadingMore && (
              <div className="load-more-indicator">
                <span className="load-dot" /><span className="load-dot" /><span className="load-dot" />
              </div>
            )}

            {!hasMore && expenses.length > 0 && (
              <p className="all-loaded">All expenses loaded</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpensesPage;
