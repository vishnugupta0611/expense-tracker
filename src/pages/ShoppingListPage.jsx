import { useState, useEffect } from 'react';
import { useAuth } from '@context/AuthContext';
import api from '@services/api';
import './ShoppingListPage.css';

const ShoppingListPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [category, setCategory] = useState('groceries');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categories = [
    { value: 'groceries', label: '🛒 Groceries', color: '#10b981' },
    { value: 'household', label: '🏠 Household', color: '#3b82f6' },
    { value: 'personal', label: '👤 Personal Care', color: '#8b5cf6' },
    { value: 'electronics', label: '📱 Electronics', color: '#f59e0b' },
    { value: 'clothing', label: '👕 Clothing', color: '#ef4444' },
    { value: 'other', label: '📦 Other', color: '#6b7280' }
  ];

  useEffect(() => {
    loadShoppingList();
  }, []);

  const loadShoppingList = async () => {
    try {
      setLoading(true);
      const response = await api.get('/shopping-list');
      setItems(response.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load shopping list');
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    try {
      const response = await api.post('/shopping-list', {
        name: newItem.trim(),
        category,
        completed: false
      });
      setItems(prev => [response.data, ...prev]);
      setNewItem('');
      setError('');
    } catch (err) {
      setError('Failed to add item');
      console.error(err);
    }
  };

  const toggleItem = async (id, completed) => {
    try {
      await api.put(`/shopping-list/${id}`, { completed });
      setItems(prev => prev.map(item => 
        item._id === id ? { ...item, completed } : item
      ));
      setError('');
    } catch (err) {
      setError('Failed to update item');
      console.error(err);
    }
  };

  const deleteItem = async (id) => {
    try {
      await api.delete(`/shopping-list/${id}`);
      setItems(prev => prev.filter(item => item._id !== id));
      setError('');
    } catch (err) {
      setError('Failed to delete item');
      console.error(err);
    }
  };

  const clearCompleted = async () => {
    try {
      const completedIds = items.filter(item => item.completed).map(item => item._id);
      await Promise.all(completedIds.map(id => api.delete(`/shopping-list/${id}`)));
      setItems(prev => prev.filter(item => !item.completed));
      setError('');
    } catch (err) {
      setError('Failed to clear completed items');
      console.error(err);
    }
  };

  const getCategoryInfo = (categoryValue) => {
    return categories.find(cat => cat.value === categoryValue) || categories[categories.length - 1];
  };

  const groupedItems = items.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const completedCount = items.filter(item => item.completed).length;
  const totalCount = items.length;

  if (loading) {
    return (
      <div className="shopping-list-page">
        <div className="loading-spinner">Loading shopping list...</div>
      </div>
    );
  }

  return (
    <div className="shopping-list-page">
      <div className="shopping-header">
        <div className="header-content">
          <h1>🛍️ Shopping List</h1>
          <p className="header-subtitle">Keep track of what you need to buy</p>
          
          {totalCount > 0 && (
            <div className="progress-section">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                ></div>
              </div>
              <span className="progress-text">
                {completedCount} of {totalCount} items completed
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="shopping-content">
        <div className="add-item-section">
          <form onSubmit={addItem} className="add-item-form">
            <div className="form-row">
              <div className="input-group">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="What do you need to buy?"
                  className="item-input"
                />
              </div>
              <div className="category-group">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="category-select"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary add-btn">
                Add Item
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="items-section">
          {totalCount === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛒</div>
              <h3>Your shopping list is empty</h3>
              <p>Add items above to get started with your shopping list</p>
            </div>
          ) : (
            <>
              {completedCount > 0 && (
                <div className="actions-bar">
                  <button 
                    onClick={clearCompleted}
                    className="btn btn-secondary clear-btn"
                  >
                    Clear Completed ({completedCount})
                  </button>
                </div>
              )}

              <div className="items-grid">
                {Object.entries(groupedItems).map(([categoryKey, categoryItems]) => {
                  const catInfo = getCategoryInfo(categoryKey);
                  return (
                    <div key={categoryKey} className="category-section">
                      <div className="category-header">
                        <span 
                          className="category-badge"
                          style={{ backgroundColor: `${catInfo.color}15`, color: catInfo.color }}
                        >
                          {catInfo.label}
                        </span>
                        <span className="item-count">{categoryItems.length}</span>
                      </div>
                      
                      <div className="items-list">
                        {categoryItems.map(item => (
                          <div 
                            key={item._id} 
                            className={`item-card ${item.completed ? 'completed' : ''}`}
                          >
                            <div className="item-content">
                              <label className="checkbox-container">
                                <input
                                  type="checkbox"
                                  checked={item.completed}
                                  onChange={(e) => toggleItem(item._id, e.target.checked)}
                                />
                                <span className="checkmark"></span>
                              </label>
                              
                              <span className="item-name">
                                {item.name}
                              </span>
                            </div>
                            
                            <button
                              onClick={() => deleteItem(item._id)}
                              className="delete-btn"
                              title="Delete item"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingListPage;