import { useState, useEffect } from 'react';
import api from '@services/api';
import './HistoryPage.css';

const HistoryPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [expenseType, setExpenseType] = useState('personal'); // 'personal' or 'space'
  const [selectedSpace, setSelectedSpace] = useState('');
  const [timeFilter, setTimeFilter] = useState('day'); // 'day', 'month', 'year'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'amount', 'category'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'

  const categories = ['Food', 'Transport', 'Bills', 'Grocery', 'Entertainment', 'Other'];

  useEffect(() => {
    fetchData();
  }, [expenseType, selectedSpace, timeFilter, dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (expenseType === 'personal') {
        const response = await api.get('/expenses', {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        });
        setExpenses(response.data.expenses || []);
      } else {
        // Fetch spaces first
        const spacesRes = await api.get('/spaces');
        setSpaces(spacesRes.data.spaces || []);
        
        if (selectedSpace) {
          const response = await api.get(`/spaces/${selectedSpace}/expenses`, {
            params: {
              startDate: dateRange.start,
              endDate: dateRange.end
            }
          });
          setExpenses(response.data.expenses || []);
        } else {
          setExpenses([]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredExpenses = () => {
    let filtered = [...expenses];

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(expense => expense.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(expense => 
        expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  const groupExpensesByTime = (expenses) => {
    const groups = {};
    
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      let key;
      
      switch (timeFilter) {
        case 'day':
          key = date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          break;
        case 'month':
          key = date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long'
          });
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
        default:
          key = date.toLocaleDateString('en-IN');
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(expense);
    });
    
    return groups;
  };

  const calculateGroupTotal = (groupExpenses) => {
    return groupExpenses.reduce((total, expense) => total + expense.amount, 0);
  };

  const filteredExpenses = getFilteredExpenses();
  const groupedExpenses = groupExpensesByTime(filteredExpenses);
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const getQuickDateRange = (period) => {
    const today = new Date();
    let start;
    
    switch (period) {
      case 'today':
        start = new Date(today);
        break;
      case 'week':
        start = new Date(today.setDate(today.getDate() - 7));
        break;
      case 'month':
        start = new Date(today.setMonth(today.getMonth() - 1));
        break;
      case '3months':
        start = new Date(today.setMonth(today.getMonth() - 3));
        break;
      case 'year':
        start = new Date(today.setFullYear(today.getFullYear() - 1));
        break;
      default:
        return;
    }
    
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    });
  };

  if (loading) {
    return (
      <div className="history-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>Transaction History</h1>
        <div className="total-summary">
          <span className="total-label">Total</span>
          <span className="total-amount">₹{totalAmount.toFixed(0)}</span>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        {/* Quick Date Filters */}
        <div className="quick-filters">
          <button 
            className={`quick-filter-btn ${dateRange.start === new Date().toISOString().split('T')[0] ? 'active' : ''}`}
            onClick={() => getQuickDateRange('today')}
          >
            Today
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => getQuickDateRange('week')}
          >
            7 Days
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => getQuickDateRange('month')}
          >
            30 Days
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => getQuickDateRange('3months')}
          >
            3 Months
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => getQuickDateRange('year')}
          >
            1 Year
          </button>
        </div>

        {/* Main Filters */}
        <div className="main-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>Type</label>
              <select 
                value={expenseType} 
                onChange={(e) => {
                  setExpenseType(e.target.value);
                  setSelectedSpace('');
                }}
              >
                <option value="personal">Personal Expenses</option>
                <option value="space">Shared Spaces</option>
              </select>
            </div>

            {expenseType === 'space' && (
              <div className="filter-group">
                <label>Space</label>
                <select 
                  value={selectedSpace} 
                  onChange={(e) => setSelectedSpace(e.target.value)}
                >
                  <option value="">Select Space</option>
                  {spaces.map(space => (
                    <option key={space._id} value={space._id}>{space.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="filter-group">
              <label>Group By</label>
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label>From</label>
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </div>

            <div className="filter-group">
              <label>To</label>
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>

            <div className="filter-group">
              <label>Search</label>
              <input 
                type="text" 
                placeholder="Search description or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Sort</label>
              <select value={`${sortBy}-${sortOrder}`} onChange={(e) => {
                const [sort, order] = e.target.value.split('-');
                setSortBy(sort);
                setSortOrder(order);
              }}>
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="amount-desc">Amount (High to Low)</option>
                <option value="amount-asc">Amount (Low to High)</option>
                <option value="category-asc">Category (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="history-results">
        {Object.keys(groupedExpenses).length === 0 ? (
          <div className="no-results">
            <p>No transactions found for the selected filters.</p>
            {expenseType === 'space' && !selectedSpace && (
              <p>Please select a space to view shared expenses.</p>
            )}
          </div>
        ) : (
          Object.entries(groupedExpenses).map(([period, periodExpenses]) => (
            <div key={period} className="period-group">
              <div className="period-header">
                <h3>{period}</h3>
                <div className="period-summary">
                  <span className="period-count">{periodExpenses.length} transactions</span>
                  <span className="period-total">₹{calculateGroupTotal(periodExpenses).toFixed(0)}</span>
                </div>
              </div>
              
              <div className="expenses-list">
                {periodExpenses.map(expense => (
                  <div key={expense._id} className="expense-card">
                    <div className="expense-main">
                      <div className="expense-icon">
                        {expense.category === 'Food' && '🍕'}
                        {expense.category === 'Transport' && '🚗'}
                        {expense.category === 'Bills' && '💡'}
                        {expense.category === 'Grocery' && '🛒'}
                        {expense.category === 'Entertainment' && '🎬'}
                        {expense.category === 'Other' && '📦'}
                      </div>
                      
                      <div className="expense-details">
                        <div className="expense-title">
                          {expense.description || expense.category}
                        </div>
                        <div className="expense-meta">
                          <span className="expense-category">{expense.category}</span>
                          {expenseType === 'space' && expense.paidBy && (
                            <span className="expense-payer">
                              by {expense.paidBy.name || 'Unknown'}
                            </span>
                          )}
                          <span className="expense-time">
                            {new Date(expense.date).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="expense-amount">
                      ₹{expense.amount.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPage;