import { useState } from 'react';
import api from '@services/api.js';
import SuccessNotification from '@components/shared/SuccessNotification';
import './QuickAddInput.css';

const QuickAddInput = ({ categories, onExpenseAdded }) => {
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Other');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [showFloatingForm, setShowFloatingForm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    const categoryToUse = showCustomInput && customCategory.trim() 
      ? customCategory.trim() 
      : selectedCategory;

    try {
      setLoading(true);
      await api.post('/expenses', {
        amount: parseFloat(amount),
        category: categoryToUse,
      });
      
      // Show success animation
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setAmount('');
        setSelectedCategory('Other');
        setCustomCategory('');
        setShowCustomInput(false);
        setShowFloatingForm(false);
        onExpenseAdded();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to add expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomCategorySubmit = () => {
    if (customCategory.trim()) {
      setSelectedCategory(customCategory.trim());
      setShowCustomInput(false);
    }
  };

  return (
    <>
      {/* Floating Add Button - Only show on personal expenses */}
      {!window.location.pathname.includes('/spaces/') && (
        <button 
          className="floating-add-btn"
          onClick={() => setShowFloatingForm(!showFloatingForm)}
          title="Quick Add Expense"
        >
          {showFloatingForm ? '×' : '+'}
        </button>
      )}

      {/* Floating Form */}
      {showFloatingForm && (
        <div className="floating-form-overlay" onClick={() => setShowFloatingForm(false)}>
          <div className="floating-form" onClick={(e) => e.stopPropagation()}>
            <h3>Quick Add Expense</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="number"
                step="0.01"
                placeholder="Enter amount..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <div className="floating-categories">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`category-chip ${selectedCategory === category ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(category);
                      setShowCustomInput(false);
                    }}
                  >
                    {category}
                  </button>
                ))}
                <button
                  type="button"
                  className="category-chip add-custom"
                  onClick={() => setShowCustomInput(true)}
                >
                  + Custom
                </button>
              </div>
              {showCustomInput && (
                <div className="custom-category-input">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category..."
                    className="custom-input"
                  />
                  <button type="button" onClick={handleCustomCategorySubmit}>✓</button>
                  <button type="button" onClick={() => setShowCustomInput(false)}>×</button>
                </div>
              )}
              <button
                type="submit"
                className="floating-submit-btn"
                disabled={loading || !amount}
              >
                {loading ? 'Adding...' : 'Add Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="quick-add-container">
        <form onSubmit={handleSubmit} className="quick-add-form">
          <input
            type="number"
            step="0.01"
            className="quick-add-input"
            placeholder="Enter amount..."
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className={`quick-add-btn ${loading ? 'loading' : ''}`}
            disabled={loading || !amount}
          >
            {loading ? '...' : '+'}
          </button>
        </form>
        
        <div className="category-chips">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`category-chip ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(category);
                setShowCustomInput(false);
              }}
            >
              {category}
            </button>
          ))}
          
          {/* Custom Category Input */}
          {showCustomInput ? (
            <div className="custom-category-input">
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter category..."
                className="custom-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomCategorySubmit();
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={handleCustomCategorySubmit}
                className="custom-submit-btn"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomCategory('');
                }}
                className="custom-cancel-btn"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="category-chip add-custom"
              onClick={() => setShowCustomInput(true)}
            >
              + Custom
            </button>
          )}
        </div>
      </div>

      <SuccessNotification
        message="Expense added successfully!"
        isVisible={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
};

export default QuickAddInput;