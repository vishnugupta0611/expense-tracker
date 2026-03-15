import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import scheduleService from '@services/scheduleService';
import './SchedulePage.css';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORIES = [
  { key: 'work', icon: '💼', label: 'Work' },
  { key: 'health', icon: '💪', label: 'Health' },
  { key: 'shopping', icon: '🛒', label: 'Shopping' },
  { key: 'study', icon: '📚', label: 'Study' },
  { key: 'personal', icon: '🏠', label: 'Personal' },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const FILTERS = ['Today', 'Week', 'Routines'];

// Helper: format "HH:mm" → "hh:mm AM/PM"
const fmt12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Helper: get current day name
const todayName = () => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
};

// Helper: build day pills for the current week
const getWeekDays = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return DAYS.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      name,
      number: d.getDate(),
      isToday: d.toDateString() === today.toDateString(),
      fullDate: d,
    };
  });
};

const emptyForm = {
  title: '',
  startTime: '09:00',
  endTime: '10:00',
  category: 'personal',
  days: [],
  specialDate: '',
  notes: '',
  reminder: false,
};

const SchedulePage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Today');
  const [selectedDay, setSelectedDay] = useState(todayName());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [isSpecialDate, setIsSpecialDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const weekDays = useMemo(() => getWeekDays(), []);

  // Fetch events
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await scheduleService.getAll();
      setEvents(res.data || []);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayDay = todayName();

    if (filter === 'Routines') return []; // handled separately

    let result = [];

    if (filter === 'Today') {
      // Special‐date events that match today override normal recurring events
      const specialToday = events.filter(
        (e) => e.specialDate && e.specialDate.split('T')[0] === todayStr
      );
      if (specialToday.length > 0) {
        result = specialToday;
      } else {
        result = events.filter(
          (e) => !e.specialDate && e.days.includes(todayDay)
        );
      }
    } else if (filter === 'Week') {
      // Events for selected day
      const selectedDayPill = weekDays.find((d) => d.name === selectedDay);
      const selDateStr = selectedDayPill
        ? selectedDayPill.fullDate.toISOString().split('T')[0]
        : '';

      const specialOnDay = events.filter(
        (e) => e.specialDate && e.specialDate.split('T')[0] === selDateStr
      );
      if (specialOnDay.length > 0) {
        result = specialOnDay;
      } else {
        result = events.filter(
          (e) => !e.specialDate && e.days.includes(selectedDay)
        );
      }
    }

    // Sort by startTime
    return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, filter, selectedDay, weekDays]);

  // Routine templates: group recurring events by day pattern
  const routineGroups = useMemo(() => {
    if (filter !== 'Routines') return [];
    const recurring = events.filter((e) => !e.specialDate && e.days.length > 0);
    const specialEvents = events.filter((e) => e.specialDate);

    // Group by day combo key
    const map = {};
    recurring.forEach((ev) => {
      const key = [...ev.days].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)).join(',');
      if (!map[key]) map[key] = { days: ev.days, events: [] };
      map[key].events.push(ev);
    });

    const groups = Object.values(map).map((g) => ({
      label: g.days.length === 7
        ? 'Everyday'
        : g.days.length === 5 && !g.days.includes('Sat') && !g.days.includes('Sun')
        ? 'Weekdays (Mon – Fri)'
        : g.days.length === 2 && g.days.includes('Sat') && g.days.includes('Sun')
        ? 'Weekends (Sat – Sun)'
        : g.days.join(', '),
      days: g.days,
      events: g.events.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));

    // Add special‐date events as individual groups
    specialEvents.forEach((ev) => {
      const d = new Date(ev.specialDate);
      groups.push({
        label: `Special: ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        days: [],
        events: [ev],
        isSpecial: true,
      });
    });

    return groups;
  }, [events, filter]);

  // Open modal for add / edit
  const openAdd = () => {
    setEditingEvent(null);
    setForm({ ...emptyForm });
    setIsSpecialDate(false);
    setShowModal(true);
  };

  const openEdit = (ev) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      startTime: ev.startTime,
      endTime: ev.endTime || '',
      category: ev.category,
      days: ev.days || [],
      specialDate: ev.specialDate ? ev.specialDate.split('T')[0] : '',
      notes: ev.notes || '',
      reminder: ev.reminder || false,
    });
    setIsSpecialDate(!!ev.specialDate);
    setShowModal(true);
  };

  // Save (create / update)
  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        specialDate: isSpecialDate && form.specialDate ? form.specialDate : null,
        days: isSpecialDate ? [] : form.days,
      };

      if (editingEvent) {
        await scheduleService.update(editingEvent._id, payload);
      } else {
        await scheduleService.create(payload);
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await scheduleService.remove(deleteTarget._id);
      setDeleteTarget(null);
      fetchEvents();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Toggle day in form
  const toggleDay = (d) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter((x) => x !== d) : [...prev.days, d],
    }));
  };

  // Today's date display
  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="schedule-page">
      {/* Header */}
      <header className="schedule-header">
        <button className="schedule-back-btn" onClick={() => navigate('/profile')}>
          ←
        </button>
        <h1>My Schedule</h1>
        <span className="schedule-header-date">{todayDisplay}</span>
      </header>

      {/* Filter Tabs */}
      <div className="schedule-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'Today' ? '📅 Today' : f === 'Week' ? '🗓 Week' : '🔁 Routines'}
          </button>
        ))}
      </div>

      {/* Day selector (Week filter) */}
      {filter === 'Week' && (
        <div className="day-selector">
          {weekDays.map((d) => (
            <button
              key={d.name}
              className={`day-pill ${selectedDay === d.name ? 'active' : ''} ${d.isToday ? 'today' : ''}`}
              onClick={() => setSelectedDay(d.name)}
            >
              <span className="day-name">{d.name}</span>
              <span className="day-number">{d.number}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="schedule-loading">
          <div className="spinner"></div>
          <p>Loading schedule…</p>
        </div>
      ) : filter === 'Routines' ? (
        <div className="routine-section">
          <div className="schedule-section-label">Your Routines</div>
          {routineGroups.length === 0 ? (
            <div className="schedule-empty">
              <div className="schedule-empty-icon">🔁</div>
              <h3>No routines yet</h3>
              <p>Create recurring events to see your routine templates here.</p>
            </div>
          ) : (
            routineGroups.map((group, gi) => (
              <div key={gi} className="routine-card">
                <div className="routine-card-header">
                  <h3>{group.isSpecial ? '⭐' : '📋'} {group.label}</h3>
                  <span>{group.events.length} event{group.events.length !== 1 ? 's' : ''}</span>
                </div>
                {group.events.map((ev) => (
                  <div key={ev._id} className="routine-event-row" onClick={() => openEdit(ev)} style={{ cursor: 'pointer' }}>
                    <span className="routine-event-time">{fmt12(ev.startTime)}</span>
                    <span className={`routine-event-dot cat-${ev.category}`}></span>
                    <span>{ev.title}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="schedule-content">
          <div className="schedule-section-label">
            {filter === 'Today' ? "Today's Schedule" : `${selectedDay}'s Schedule`}
          </div>
          {filteredEvents.length === 0 ? (
            <div className="schedule-empty">
              <div className="schedule-empty-icon">📭</div>
              <h3>No events scheduled</h3>
              <p>Tap the + button to add activities to your day.</p>
            </div>
          ) : (
            <div className="schedule-timeline">
              {filteredEvents.map((ev) => (
                <div
                  key={ev._id}
                  className={`schedule-event-card cat-${ev.category}`}
                  onClick={() => openEdit(ev)}
                >
                  <span className="event-time-label">{fmt12(ev.startTime)}</span>
                  <span className="event-timeline-dot"></span>

                  <div className="event-card-top">
                    <div className={`event-category-icon cat-${ev.category}`}>
                      {CATEGORY_MAP[ev.category]?.icon || '📌'}
                    </div>
                    <div className="event-card-info">
                      <div className="event-card-title">{ev.title}</div>
                      <div className="event-card-time">
                        🕐 {fmt12(ev.startTime)}{ev.endTime ? ` – ${fmt12(ev.endTime)}` : ''}
                      </div>
                      <div className="event-card-meta">
                        <span className={`event-category-badge cat-${ev.category}`}>
                          {CATEGORY_MAP[ev.category]?.icon} {ev.category}
                        </span>
                        {ev.specialDate && (
                          <span className="event-special-badge">⭐ Special Day</span>
                        )}
                        {ev.days.length > 0 && (
                          <span className="event-days-badge">{ev.days.join(', ')}</span>
                        )}
                      </div>
                      {ev.notes && <div className="event-notes-preview">📝 {ev.notes}</div>}
                    </div>
                    <div className="event-card-actions">
                      <button
                        className="event-action-btn"
                        onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="event-action-btn delete"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(ev); }}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button className="schedule-fab" onClick={openAdd} title="Add Event">
        +
      </button>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="schedule-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="schedule-modal" onClick={(e) => e.stopPropagation()}>
            <div className="schedule-modal-handle" />
            <div className="schedule-modal-header">
              <h2>{editingEvent ? 'Edit Event' : 'New Event'}</h2>
              <button className="schedule-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="schedule-modal-body">
              {/* Title */}
              <div className="sched-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Morning Gym"
                  autoFocus
                />
              </div>

              {/* Time row */}
              <div className="sched-form-row">
                <div className="sched-form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>
                <div className="sched-form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>
              </div>

              {/* Category */}
              <div className="sched-form-group">
                <label>Category</label>
                <div className="sched-category-grid">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`sched-category-option cat-${c.key} ${form.category === c.key ? 'selected' : ''}`}
                      onClick={() => setForm({ ...form, category: c.key })}
                    >
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Special Date toggle */}
              <div className="sched-toggle-row">
                <span className="sched-toggle-label">⭐ Special Date</span>
                <button
                  type="button"
                  className={`sched-toggle ${isSpecialDate ? 'on' : ''}`}
                  onClick={() => setIsSpecialDate(!isSpecialDate)}
                />
              </div>

              {isSpecialDate ? (
                <div className="sched-form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={form.specialDate}
                    onChange={(e) => setForm({ ...form, specialDate: e.target.value })}
                  />
                </div>
              ) : (
                <div className="sched-form-group">
                  <label>Repeat on</label>
                  <div className="sched-days-grid">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`sched-day-check ${form.days.includes(d) ? 'selected' : ''}`}
                        onClick={() => toggleDay(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="sched-form-group">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes…"
                />
              </div>

              {/* Reminder toggle */}
              <div className="sched-toggle-row">
                <span className="sched-toggle-label">🔔 Reminder</span>
                <button
                  type="button"
                  className={`sched-toggle ${form.reminder ? 'on' : ''}`}
                  onClick={() => setForm({ ...form, reminder: !form.reminder })}
                />
              </div>

              {/* Actions */}
              <div className="schedule-modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title.trim()}>
                  {saving ? '⏳ Saving…' : editingEvent ? '💾 Update' : '✓ Add Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="schedule-delete-confirm" onClick={() => setDeleteTarget(null)}>
          <div className="schedule-delete-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Event?</h3>
            <p>Are you sure you want to delete "<strong>{deleteTarget.title}</strong>"? This action cannot be undone.</p>
            <div className="schedule-delete-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-error" onClick={confirmDelete}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulePage;
