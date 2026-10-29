import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import './NotesPage.css';

const CAT_ICONS = {
  'Project Knowledge': '🗂️',
  'Learnings':         '📚',
  'Ideas':             '💡',
  'AI Sharing':        '🤖',
  'Implementation':    '⚙️',
};
function getCatIcon(name) {
  return CAT_ICONS[name] || '📁';
}

const NotesPage = () => {
  const navigate = useNavigate();
  const { dark, toggle: toggleTheme } = useNotesTheme();

  const [notes, setNotes]                 = useState([]);
  const [categories, setCategories]       = useState([]);
  const [selectedCatId, setSelectedCatId] = useState(null); // null = All
  const [search, setSearch]               = useState('');
  const [loading, setLoading]             = useState(true);
  const [creating, setCreating]           = useState(false);

  // Category modal states
  const [catModalOpen, setCatModalOpen]   = useState(false);
  const [newCatName, setNewCatName]       = useState('');
  const [editingCatId, setEditingCatId]   = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [catError, setCatError]           = useState('');

  // Fetch categories (seeds defaults if not yet created)
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.categories || []);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  }, []);

  // Fetch notes with optional category and search filters
  const fetchNotes = useCallback(async (catId, query) => {
    try {
      const params = new URLSearchParams();
      if (catId) params.set('categoryId', catId);
      if (query && query.trim()) params.set('search', query.trim());
      const res = await api.get(`/notes?${params.toString()}`);
      setNotes(res.data.notes || []);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchNotes(selectedCatId, search);
  }, [selectedCatId, search, fetchNotes]);

  const createNote = async () => {
    setCreating(true);
    try {
      const body = {};
      if (selectedCatId) body.categoryId = selectedCatId;
      const r = await api.post('/notes', body);
      navigate(`/notes/${r.data.note._id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this note?')) return;
    await api.delete(`/notes/${id}`);
    setNotes(prev => prev.filter(n => n._id !== id));
  };

  // Category management handlers
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCatError('');
    try {
      const res = await api.post('/categories', { name: newCatName.trim() });
      setCategories(prev => [...prev, res.data.category]);
      setNewCatName('');
    } catch (err) {
      setCatError(err.response?.data?.error || 'Failed to add category');
    }
  };

  const handleRenameCategory = async (id) => {
    if (!editingCatName.trim()) return;
    setCatError('');
    try {
      const res = await api.patch(`/categories/${id}`, { name: editingCatName.trim() });
      setCategories(prev => prev.map(c => c._id === id ? res.data.category : c));
      setEditingCatId(null);
    } catch (err) {
      setCatError(err.response?.data?.error || 'Failed to rename category');
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"?\nAssociated notes will NOT be deleted (they will remain safe and uncategorized).`)) return;
    setCatError('');
    try {
      await api.delete(`/categories/${id}`);
      setCategories(prev => prev.filter(c => c._id !== id));
      if (selectedCatId === id) setSelectedCatId(null);
      // Refresh notes list to reflect unassigned categories
      fetchNotes(selectedCatId === id ? null : selectedCatId, search);
    } catch (err) {
      setCatError(err.response?.data?.error || 'Failed to delete category');
    }
  };

  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className={`notes-list-page ${dark ? 'dark' : ''}`}>
      <header className="notes-list-header">
        <div className="notes-list-header-left">
          <button className="notes-back-btn" onClick={() => navigate('/profile')}>← Back</button>
          <div>
            <h1>My Notes</h1>
            <span>{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="notes-header-right">
          <button className="note-theme-btn" onClick={toggleTheme} title="Toggle theme">
            {dark ? '☀️' : '🌙'}
          </button>
          <button className="notes-new-btn" onClick={createNote} disabled={creating}>
            {creating ? '…' : '+ New Note'}
          </button>
        </div>
      </header>

      {/* ── Search & Category Filter Bar ── */}
      <div className="notes-filter-section">
        <div className="notes-search-box">
          <span className="notes-search-icon">🔍</span>
          <input
            type="text"
            className="notes-search-input"
            placeholder="Search notes by title, summary, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="notes-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <div className="notes-categories-bar">
          <button
            className={`notes-cat-chip ${selectedCatId === null ? 'active' : ''}`}
            onClick={() => setSelectedCatId(null)}
          >
            All Notes
          </button>

          {categories.map(cat => (
            <button
              key={cat._id}
              className={`notes-cat-chip ${selectedCatId === cat._id ? 'active' : ''}`}
              onClick={() => setSelectedCatId(cat._id)}
            >
              <span>{getCatIcon(cat.name)}</span> {cat.name}
            </button>
          ))}

          <button
            className="notes-cat-settings-btn"
            title="Manage categories"
            onClick={() => setCatModalOpen(true)}
          >
            ⚙️ Categories
          </button>
        </div>
      </div>

      {loading ? (
        <div className="notes-loading">
          <img src="/animation.gif" alt="Loading" style={{ width: 70, height: 70, objectFit: 'contain' }} />
        </div>
      ) : notes.length === 0 ? (
        <div className="notes-empty">
          <div className="notes-empty-icon">📝</div>
          <h3>{search ? 'No matching notes' : 'No notes yet'}</h3>
          <p>{search ? 'Try a different search term or select another category.' : 'Create your first note to start writing.'}</p>
          {!search && (
            <button className="notes-new-btn" onClick={createNote}>+ New Note</button>
          )}
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => {
            const catName = note.categoryId?.name || (typeof note.categoryId === 'string' ? note.categoryId : null);
            return (
              <div key={note._id} className="note-card" onClick={() => navigate(`/notes/${note._id}`)}>
                <div className="note-card-top">
                  <div className="note-card-meta-line">
                    {catName && (
                      <span className="note-card-cat-badge">
                        {getCatIcon(catName)} {catName}
                      </span>
                    )}
                    {note.project && (
                      <span className="note-card-project-badge">
                        📂 {note.project}
                      </span>
                    )}
                  </div>
                  <button className="note-card-delete" onClick={(e) => deleteNote(e, note._id)} title="Delete">🗑</button>
                </div>

                <h3 className="note-card-title">{note.title || 'Untitled'}</h3>

                {note.summary && (
                  <p className="note-card-summary">{note.summary}</p>
                )}

                {note.tags && note.tags.length > 0 && (
                  <div className="note-card-tags">
                    {note.tags.slice(0, 3).map((t, idx) => (
                      <span key={idx} className="note-card-tag">#{t}</span>
                    ))}
                  </div>
                )}

                <span className="note-card-date">{fmt(note.updatedAt)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Category Management Modal ── */}
      {catModalOpen && (
        <div className="notes-modal-overlay" onClick={() => setCatModalOpen(false)}>
          <div className="notes-modal" onClick={e => e.stopPropagation()}>
            <div className="notes-modal-header">
              <h3>Manage Categories</h3>
              <button className="notes-modal-close" onClick={() => setCatModalOpen(false)}>✕</button>
            </div>

            {catError && <div className="notes-cat-error">{catError}</div>}

            <form className="notes-cat-add-form" onSubmit={handleAddCategory}>
              <input
                type="text"
                placeholder="New custom category name..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
              />
              <button type="submit" className="notes-btn-primary">+ Add</button>
            </form>

            <div className="notes-cat-list">
              {categories.map(cat => (
                <div key={cat._id} className="notes-cat-row">
                  {editingCatId === cat._id ? (
                    <div className="notes-cat-edit-row">
                      <input
                        type="text"
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        autoFocus
                      />
                      <button className="notes-cat-save-btn" onClick={() => handleRenameCategory(cat._id)}>✓</button>
                      <button className="notes-cat-cancel-btn" onClick={() => setEditingCatId(null)}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="notes-cat-info">
                        <span className="notes-cat-icon">{getCatIcon(cat.name)}</span>
                        <span className="notes-cat-name">{cat.name}</span>
                        {cat.isDefault && <span className="notes-cat-default-badge">default</span>}
                      </div>

                      {!cat.isDefault && (
                        <div className="notes-cat-actions">
                          <button
                            title="Rename"
                            onClick={() => {
                              setEditingCatId(cat._id);
                              setEditingCatName(cat.name);
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDeleteCategory(cat._id, cat.name)}
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="notes-modal-footer">
              <span className="notes-modal-hint">ℹ️ Deleting a category never deletes your notes.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesPage;
