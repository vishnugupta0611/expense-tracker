import { useState } from 'react';
import api from '@services/api';
import './SpaceExpenseModal.css';

const SpaceExpenseModal = ({ space, onClose, onExpenseAdded }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [splitBetween, setSplitBetween] = useState([]); // Default empty means 'all'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default categories - could be fetched from API or passed as props
  const categories = ['Food', 'Transport', 'Utilities', 'Rent', 'Entertainment', 'Other'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount) return;

    try {
      setLoading(true);
      setError('');
      
      await api.post(`/spaces/${space._id}/expenses`, {
        amount: Number(amount),
        description,
        category,
        splitBetween: splitBetween.length > 0 ? splitBetween : undefined 
      });

      onExpenseAdded();
      onClose();
    } catch (err) {
      setError('Failed to add expense. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId) => {
    setSplitBetween(prev => {
      const isSelected = prev.includes(memberId);
      if (isSelected) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Add Shared Expense</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Amount</label>
            <div className="input-with-prefix">
              <span className="prefix">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this for?"
              required
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Split Between <small>(Select none for everyone)</small></label>
            <div className="members-select">
              {space.members.map(member => (
                <div 
                  key={member._id} 
                  className={`member-chip ${splitBetween.includes(member._id) || splitBetween.length === 0 ? 'selected' : ''}`}
                  onClick={() => toggleMember(member._id)}
                >
                  {member.name}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpaceExpenseModal;
