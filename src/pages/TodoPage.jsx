import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTodos, getCardColor } from '@context/TodoContext';
import './TodoPage.css';

// ── Pure helpers (outside component, no stale closure risk) ──────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

const formatDate = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const toMins = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const inWindow = (nowMins, start, end) => {
  if (end > start) return nowMins >= start && nowMins < end;
  if (end === start) return false;
  // midnight-crossing: e.g. 23:00–01:00
  return nowMins >= start || nowMins < end;
};

const getWindow = (startTime, endTime) => {
  const start = toMins(startTime);
  if (start === null) return null;
  const end = endTime ? toMins(endTime) : (start + 60) % 1440;
  return { start, end };
};

const checkCurrent = (todo, viewDate, nowMins) => {
  if (viewDate !== todayStr()) return false;
  if (!todo.startTime) return false;
  const w = getWindow(todo.startTime, todo.endTime);
  if (!w) return false;
  return inWindow(nowMins, w.start, w.end);
};

const windowsOverlap = (s1, e1, s2, e2) => {
  const r1 = e1 > s1 ? [[s1, e1]] : [[s1, 1440], [0, e1]];
  const r2 = e2 > s2 ? [[s2, e2]] : [[s2, 1440], [0, e2]];
  return r1.some(([a, b]) => r2.some(([c, d]) => a < d && c < b));
};

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM = { title: '', date: todayStr(), startTime: '', endTime: '' };
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

// ── TimePicker ───────────────────────────────────────────────────────────────

const TimePicker = ({ value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const parse = (v) => {
    if (!v) return { h: '', m: '00', ampm: 'AM' };
    const [hh, mm] = v.split(':').map(Number);
    return {
      h: String(hh % 12 || 12).padStart(2, '0'),
      m: String(mm).padStart(2, '0'),
      ampm: hh >= 12 ? 'PM' : 'AM',
    };
  };

  const { h, m, ampm } = parse(value);

  const emit = (nh, nm, na) => {
    let hour = parseInt(nh, 10);
    if (na === 'PM' && hour !== 12) hour += 12;
    if (na === 'AM' && hour === 12) hour = 0;
    onChange(`${String(hour).padStart(2, '0')}:${nm}`);
  };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="time-picker-wrap" ref={ref}>
      <button
        type="button"
        className={`time-picker-trigger ${value ? 'has-value' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="time-picker-icon">🕐</span>
        <span>{value ? `${h}:${m} ${ampm}` : placeholder}</span>
        {value && (
          <span className="time-picker-clear" onClick={(e) => { e.stopPropagation(); onChange(''); }}>✕</span>
        )}
      </button>
      {open && (
        <div className="time-picker-dropdown">
          <div className="time-picker-cols">
            <div className="time-picker-col">
              <div className="time-col-label">Hour</div>
              {HOURS.map(hv => (
                <button key={hv} type="button"
                  className={`time-option ${h === hv ? 'active' : ''}`}
                  onClick={() => emit(hv, m, ampm)}
                >{hv}</button>
              ))}
            </div>
            <div className="time-picker-col">
              <div className="time-col-label">Min</div>
              {MINUTES.map(mv => (
                <button key={mv} type="button"
                  className={`time-option ${m === mv ? 'active' : ''}`}
                  onClick={() => emit(h || '12', mv, ampm)}
                >{mv}</button>
              ))}
            </div>
            <div className="time-picker-col">
              <div className="time-col-label">AM/PM</div>
              {['AM', 'PM'].map(ap => (
                <button key={ap} type="button"
                  className={`time-option ${ampm === ap ? 'active' : ''}`}
                  onClick={() => { emit(h || '12', m, ap); setOpen(false); }}
                >{ap}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── TodoPage ─────────────────────────────────────────────────────────────────

const TodoPage = () => {
  const navigate = useNavigate();
  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos();

  const [tab, setTab] = useState('active');
  const [viewDate, setViewDate] = useState(todayStr());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [conflict, setConflict] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuRef = useRef(null);

  // Live clock — ticks every 30s so "current" badge stays accurate
  const [nowMins, setNowMins] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const dateTodos = useMemo(() =>
    todos.filter(t => t.date === viewDate),
    [todos, viewDate]
  );

  // sorted depends on nowMins so it re-runs when the clock ticks
  const sorted = useMemo(() => {
    const list = dateTodos.filter(t => t.status === tab);
    return [...list].sort((a, b) => {
      const aCur = checkCurrent(a, viewDate, nowMins);
      const bCur = checkCurrent(b, viewDate, nowMins);
      if (aCur && !bCur) return -1;
      if (!aCur && bCur) return 1;
      const aM = toMins(a.startTime);
      const bM = toMins(b.startTime);
      if (aM === null && bM === null) return 0;
      if (aM === null) return 1;
      if (bM === null) return -1;
      return aM - bM;
    });
  }, [dateTodos, tab, viewDate, nowMins]);

  const todoDateGroups = useMemo(() => {
    const map = {};
    todos.forEach(t => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [todos]);

  const findConflict = (date, startTime, endTime, excludeId = null) => {
    const nw = getWindow(startTime, endTime);
    if (!nw) return null;
    return todos.find(t => {
      if (t.id === excludeId || t.date !== date || !t.startTime) return false;
      const ew = getWindow(t.startTime, t.endTime);
      if (!ew) return false;
      return windowsOverlap(nw.start, nw.end, ew.start, ew.end);
    }) || null;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.startTime) {
      const clash = findConflict(form.date, form.startTime, form.endTime);
      if (clash) { setConflict(clash); return; }
    }
    setConflict(null);
    await addTodo({ ...form });
    setShowModal(false);
    setViewDate(form.date);
    setForm({ ...EMPTY_FORM });
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, date: viewDate });
    setConflict(null);
    setShowModal(true);
  };

  return (
    <div className="todo-page">
      {/* Sidebar */}
      <aside className={`todo-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">✅ Todos</span>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${viewDate === todayStr() ? 'active' : ''}`}
            onClick={() => { setViewDate(todayStr()); setSidebarOpen(false); }}
          >
            <span>📅</span> Today
          </button>
        </nav>
        <div className="sidebar-section-label">By Date</div>
        <div className="sidebar-todo-list">
          {todoDateGroups.length === 0 && <p className="sidebar-empty">No todos yet</p>}
          {todoDateGroups.map(([date, items]) => (
            <button
              key={date}
              className={`sidebar-date-group ${viewDate === date ? 'active' : ''}`}
              onClick={() => { setViewDate(date); setSidebarOpen(false); }}
            >
              <span className="sdg-date">{formatDate(date)}</span>
              <span className="sdg-count">{items.filter(t => t.status === 'active').length} active</span>
            </button>
          ))}
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="todo-main">
        <header className="todo-header">
          <div className="todo-header-left">
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
            <button className="todo-back-btn" onClick={() => navigate('/profile')}>← Back</button>
            <div className="todo-header-date">
              <h1>My Todos</h1>
              <span>{todayDisplay}</span>
            </div>
          </div>
          <div className="todo-header-right">
            <button className="todo-add-btn" onClick={openAdd}>+ Add New</button>
          </div>
        </header>

        <div className="todo-date-row">
          <label className="date-row-label">Viewing:</label>
          <input
            type="date"
            value={viewDate}
            onChange={e => setViewDate(e.target.value)}
            className="todo-date-input"
          />
          {viewDate !== todayStr() && (
            <button className="date-today-btn" onClick={() => setViewDate(todayStr())}>Today</button>
          )}
          <span className="date-row-display">{formatDate(viewDate)}</span>
        </div>

        <div className="todo-tabs">
          <button className={`todo-tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            Active Tasks
            <span className="tab-count">{dateTodos.filter(t => t.status === 'active').length}</span>
          </button>
          <button className={`todo-tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')}>
            Completed
            <span className="tab-count">{dateTodos.filter(t => t.status === 'completed').length}</span>
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="todo-empty">
            <div className="todo-empty-icon">{tab === 'active' ? '📋' : '🎉'}</div>
            <h3>{tab === 'active' ? 'No active tasks' : 'Nothing completed yet'}</h3>
            <p>{tab === 'active' ? 'Add a new task to get started.' : 'Complete some tasks to see them here.'}</p>
            {tab === 'active' && <button className="todo-add-btn" onClick={openAdd}>+ Add Task</button>}
          </div>
        ) : (
          <div className="todo-grid">
            {sorted.map(todo => {
              const color = getCardColor(todo.id);
              const current = checkCurrent(todo, viewDate, nowMins);
              return (
                <div
                  key={todo.id}
                  className={`todo-card ${todo.status === 'completed' ? 'done' : ''} ${current ? 'current' : ''}`}
                  style={{ background: color.bg, borderColor: current ? 'var(--primary)' : color.border }}
                >
                  <div className="todo-card-top">
                    <div className="todo-card-top-left">
                      <button
                        className="todo-check"
                        onClick={() => toggleTodo(todo.id)}
                        style={{ borderColor: color.border, color: color.text }}
                      >
                        {todo.status === 'completed' ? '✓' : ''}
                      </button>
                      {current && <span className="todo-now-badge">● Now</span>}
                    </div>
                    <div className="todo-card-menu-wrap" ref={menuOpen === todo.id ? menuRef : null}>
                      <button
                        className="todo-card-menu-btn"
                        onClick={() => setMenuOpen(menuOpen === todo.id ? null : todo.id)}
                        style={{ color: color.text }}
                      >⋯</button>
                      {menuOpen === todo.id && (
                        <div className="todo-card-menu">
                          <button onClick={() => { toggleTodo(todo.id); setMenuOpen(null); }}>
                            {todo.status === 'active' ? '✓ Complete' : '↩ Reopen'}
                          </button>
                          <button className="menu-delete" onClick={() => { deleteTodo(todo.id); setMenuOpen(null); }}>
                            🗑 Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="todo-card-title" style={{ color: color.text }}>{todo.title}</h3>
                  {todo.description && <p className="todo-card-desc">{todo.description}</p>}
                  {(todo.startTime || todo.endTime) && (
                    <div className="todo-card-time" style={{ color: color.text }}>
                      🕐 {fmt12(todo.startTime)}{todo.endTime ? ` – ${fmt12(todo.endTime)}` : ''}
                    </div>
                  )}
                  <div className="todo-card-date">{formatDate(todo.date)}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <div className="todo-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="todo-modal" onClick={e => e.stopPropagation()}>
            <div className="todo-modal-header">
              <h2>New Task</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd} className="todo-form">
              <div className="todo-form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="What needs to be done?"
                  autoFocus
                  required
                />
              </div>
              <div className="todo-form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="todo-form-row">
                <div className="todo-form-group">
                  <label>Start Time</label>
                  <TimePicker
                    value={form.startTime}
                    onChange={v => { setForm(f => ({ ...f, startTime: v })); setConflict(null); }}
                    placeholder="Start time"
                  />
                </div>
                <div className="todo-form-group">
                  <label>End Time</label>
                  <TimePicker
                    value={form.endTime}
                    onChange={v => { setForm(f => ({ ...f, endTime: v })); setConflict(null); }}
                    placeholder="End time"
                  />
                </div>
              </div>
              {conflict && (
                <div className="todo-conflict-warning">
                  <span className="conflict-icon">⚠️</span>
                  <div className="conflict-text">
                    <strong>Time conflict!</strong>
                    <span>"{conflict.title}" is already at {fmt12(conflict.startTime)}{conflict.endTime ? `–${fmt12(conflict.endTime)}` : ''}.</span>
                  </div>
                </div>
              )}
              <div className="todo-form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!form.title.trim()}>Add Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodoPage;
