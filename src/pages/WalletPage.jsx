import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import './WalletPage.css';

const WalletPage = () => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit balance
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');

  // Add lend/borrow
  const [lendForm, setLendForm] = useState({ name: '', amount: '', note: '' });
  const [borrowForm, setBorrowForm] = useState({ name: '', amount: '', note: '' });
  const [showLendForm, setShowLendForm] = useState(false);
  const [showBorrowForm, setShowBorrowForm] = useState(false);

  useEffect(() => { fetchWallet(); }, []);

  const fetchWallet = async () => {
    try {
      const res = await api.get('/wallet');
      setWallet(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveBalance = async () => {
    const val = parseFloat(balanceInput);
    if (isNaN(val)) return;
    const res = await api.put('/wallet/balance', { balance: val });
    setWallet(res.data);
    setEditingBalance(false);
  };

  const addLent = async (e) => {
    e.preventDefault();
    if (!lendForm.name || !lendForm.amount) return;
    const res = await api.post('/wallet/lent', lendForm);
    setWallet(res.data);
    setLendForm({ name: '', amount: '', note: '' });
    setShowLendForm(false);
  };

  const addBorrowed = async (e) => {
    e.preventDefault();
    if (!borrowForm.name || !borrowForm.amount) return;
    const res = await api.post('/wallet/borrowed', borrowForm);
    setWallet(res.data);
    setBorrowForm({ name: '', amount: '', note: '' });
    setShowBorrowForm(false);
  };

  const deleteLent = async (id) => {
    const res = await api.delete(`/wallet/lent/${id}`);
    setWallet(res.data);
  };

  const deleteBorrowed = async (id) => {
    const res = await api.delete(`/wallet/borrowed/${id}`);
    setWallet(res.data);
  };

  const totalLent = wallet?.lent?.reduce((s, e) => s + e.amount, 0) || 0;
  const totalBorrowed = wallet?.borrowed?.reduce((s, e) => s + e.amount, 0) || 0;

  if (loading) return (
    <div className="wallet-page">
      <div className="wallet-skeleton">
        <div className="sk-bar" /><div className="sk-bar wide" /><div className="sk-bar" />
      </div>
    </div>
  );

  return (
    <div className="wallet-page">
      <header className="wallet-header">
        <button className="wback-btn" onClick={() => navigate('/expenses')}>←</button>
        <h1>Wallet</h1>
        <div style={{ width: 36 }} />
      </header>

      {/* Balance card */}
      <div className="balance-card">
        <span className="balance-label">Total Balance</span>
        {editingBalance ? (
          <div className="balance-edit-row">
            <span className="balance-prefix">₹</span>
            <input
              className="balance-input"
              type="number"
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveBalance()}
            />
            <button className="balance-save-btn" onClick={saveBalance}>Save</button>
            <button className="balance-cancel-btn" onClick={() => setEditingBalance(false)}>✕</button>
          </div>
        ) : (
          <div className="balance-display-row">
            <span className="balance-amount">₹{(wallet?.balance || 0).toLocaleString('en-IN')}</span>
            <button className="balance-edit-btn" onClick={() => { setBalanceInput(wallet?.balance || ''); setEditingBalance(true); }}>
              ✏️
            </button>
          </div>
        )}
        <div className="balance-meta">
          <span className="meta-lent">↑ Lent ₹{totalLent.toLocaleString('en-IN')}</span>
          <span className="meta-borrowed">↓ Borrowed ₹{totalBorrowed.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Lend section */}
      <div className="wallet-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-icon lent-icon">💸</span>
            <span>Lent Money</span>
            {wallet?.lent?.length > 0 && <span className="section-badge">{wallet.lent.length}</span>}
          </div>
          <button className="section-add-btn" onClick={() => { setShowLendForm(v => !v); setShowBorrowForm(false); }}>
            {showLendForm ? '✕' : '+ Add'}
          </button>
        </div>

        {showLendForm && (
          <form className="entry-form" onSubmit={addLent}>
            <input className="ef-input" placeholder="Person's name" value={lendForm.name}
              onChange={e => setLendForm(f => ({ ...f, name: e.target.value }))} />
            <div className="ef-amount-wrap">
              <span className="ef-prefix">₹</span>
              <input className="ef-input ef-amount" type="number" placeholder="Amount" value={lendForm.amount}
                onChange={e => setLendForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <input className="ef-input" placeholder="Note (optional)" value={lendForm.note}
              onChange={e => setLendForm(f => ({ ...f, note: e.target.value }))} />
            <button type="submit" className="ef-submit lent-submit">Add Lent Entry</button>
          </form>
        )}

        <div className="entry-list">
          {wallet?.lent?.length === 0 && <p className="empty-entries">No lent entries yet</p>}
          {wallet?.lent?.map(entry => (
            <div key={entry._id} className="entry-row">
              <div className="entry-avatar lent-avatar">{entry.name[0].toUpperCase()}</div>
              <div className="entry-info">
                <span className="entry-name">{entry.name}</span>
                {entry.note && <span className="entry-note">{entry.note}</span>}
              </div>
              <span className="entry-amount lent-amount">₹{entry.amount.toLocaleString('en-IN')}</span>
              <button className="entry-delete" onClick={() => deleteLent(entry._id)}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Borrow section */}
      <div className="wallet-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-icon borrowed-icon">🤝</span>
            <span>Borrowed Money</span>
            {wallet?.borrowed?.length > 0 && <span className="section-badge">{wallet.borrowed.length}</span>}
          </div>
          <button className="section-add-btn" onClick={() => { setShowBorrowForm(v => !v); setShowLendForm(false); }}>
            {showBorrowForm ? '✕' : '+ Add'}
          </button>
        </div>

        {showBorrowForm && (
          <form className="entry-form" onSubmit={addBorrowed}>
            <input className="ef-input" placeholder="Person's name" value={borrowForm.name}
              onChange={e => setBorrowForm(f => ({ ...f, name: e.target.value }))} />
            <div className="ef-amount-wrap">
              <span className="ef-prefix">₹</span>
              <input className="ef-input ef-amount" type="number" placeholder="Amount" value={borrowForm.amount}
                onChange={e => setBorrowForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <input className="ef-input" placeholder="Note (optional)" value={borrowForm.note}
              onChange={e => setBorrowForm(f => ({ ...f, note: e.target.value }))} />
            <button type="submit" className="ef-submit borrowed-submit">Add Borrowed Entry</button>
          </form>
        )}

        <div className="entry-list">
          {wallet?.borrowed?.length === 0 && <p className="empty-entries">No borrowed entries yet</p>}
          {wallet?.borrowed?.map(entry => (
            <div key={entry._id} className="entry-row">
              <div className="entry-avatar borrowed-avatar">{entry.name[0].toUpperCase()}</div>
              <div className="entry-info">
                <span className="entry-name">{entry.name}</span>
                {entry.note && <span className="entry-note">{entry.note}</span>}
              </div>
              <span className="entry-amount borrowed-amount">₹{entry.amount.toLocaleString('en-IN')}</span>
              <button className="entry-delete" onClick={() => deleteBorrowed(entry._id)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
