import { useState } from 'react';
import api from '@services/api.js';
import SuccessNotification from '@components/shared/SuccessNotification';
import './QuickAddInput.css';

const CATEGORY_EMOJI = {
  Food: '🍕', Transport: '🚗', Bills: '💡',
  Grocery: '🛒', Entertainment: '🎬', Other: '📦',
};

const QuickAddInput = ({ categories, onExpenseAdded }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Other');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFloatingForm, setShowFloatingForm] = useState(false);

  // If note has text → use it as the category label (custom tag)
  // Otherwise → use selected chip
  const getCategory = () => note.trim() || selectedCategory;

  const reset = () => {
    setAmount('');
    setNote('');
    setSelectedCategory('Other');
    setShowFloatingForm(false);
  };

  const submit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    const optimisticExpense = {
      _id: `optimistic-${Date.now()}`,
      _optimistic: true,
      amount: parseFloat(amount),
      category: getCategory(),
      description: note.trim() || undefined,
      date: new Date().toISOString(),
    };

    // Show instantly in UI
    onExpenseAdded(optimisticExpense);
    setShowSuccess(true);
    reset();
    setTimeout(() => setShowSuccess(false), 900);

    try {
      setLoading(true);
      const res = await api.post('/expenses', {
        amount: optimisticExpense.amount,
        category: optimisticExpense.category,
        description: optimisticExpense.description,
      });
      // Replace optimistic entry with real one from server
      onExpenseAdded({ ...res.data.expense, _replaceOptimistic: optimisticExpense._id });
    } catch (error) {
      console.error('Failed to add expense:', error);
      // Remove optimistic entry on failure
      onExpenseAdded({ _removeOptimistic: optimisticExpense._id });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); submit(); };

  const ChipRow = () => (
    <div className="category-chips">
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`category-chip ${selectedCategory === cat && !note.trim() ? 'active' : ''}`}
          onClick={() => { setSelectedCategory(cat); setNote(''); }}
        >
          {CATEGORY_EMOJI[cat] || '🏷️'} {cat}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Floating button */}
      {!window.location.pathname.includes('/spaces/') && (
        <button
          className="floating-add-btn"
          onClick={() => setShowFloatingForm(!showFloatingForm)}
          title="Quick Add Expense"
        >
          {showFloatingForm ? '×' : '+'}
        </button>
      )}

      {/* Floating modal — bottom sheet on mobile, centered on desktop */}
      {showFloatingForm && (
        <div className="floating-overlay" onClick={() => setShowFloatingForm(false)}>
          <div className="floating-modal" onClick={(e) => e.stopPropagation()}>
            <div className="floating-modal-header">
              <span>Add Expense</span>
              <button type="button" className="modal-close-btn" onClick={() => setShowFloatingForm(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-amount-row">
                <span className="modal-currency">₹</span>
                <input
                  type="number"
                  step="0.01"
                  className="modal-amount-input"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="modal-note-wrap">
                <input
                  type="text"
                  className="modal-note-input"
                  placeholder="Note — type to use as custom tag"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={loading}
                />
                {note.trim() && (
                  <span className="note-tag-preview">
                    🏷️ {note.trim()}
                  </span>
                )}
              </div>

              {!note.trim() && <ChipRow />}

              <button
                type="submit"
                className="modal-submit-btn"
                disabled={loading || !amount || parseFloat(amount) <= 0}
              >
                {loading ? 'Adding...' : `Add  ₹${amount || '0'} · ${getCategory()}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Inline form */}
      <div className="quick-add-container">
        <form onSubmit={handleSubmit}>
          <div className="quick-add-row">
            <div className="amount-wrap">
              <span className="amount-prefix">₹</span>
              <input
                type="number"
                step="0.01"
                className="quick-add-input"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="note-wrap">
              <input
                type="text"
                className="quick-note-input"
                placeholder="Note (acts as custom tag)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={loading}
              />
              {note.trim() && (
                <span className="inline-note-tag">🏷️ {note.trim()}</span>
              )}
            </div>
            <button
              type="submit"
              className="quick-add-btn"
              disabled={loading || !amount || parseFloat(amount) <= 0}
            >
              {loading ? '…' : '+'}
            </button>
          </div>

          {/* Only show chips when note is empty */}
          {!note.trim() && <ChipRow />}
        </form>
      </div>

      <SuccessNotification
        message="Expense added!"
        isVisible={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
};

export default QuickAddInput;
