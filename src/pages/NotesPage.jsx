import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import './NotesPage.css';

const NotesPage = () => {
  const navigate = useNavigate();
  const { dark, toggle: toggleTheme } = useNotesTheme();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/notes')
      .then(r => setNotes(r.data.notes || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const createNote = async () => {
    setCreating(true);
    try {
      const r = await api.post('/notes');
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

      {loading ? (
        <div className="notes-loading"><div className="spinner" /></div>
      ) : notes.length === 0 ? (
        <div className="notes-empty">
          <div className="notes-empty-icon">📝</div>
          <h3>No notes yet</h3>
          <p>Create your first note to start writing.</p>
          <button className="notes-new-btn" onClick={createNote}>+ New Note</button>
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div key={note._id} className="note-card" onClick={() => navigate(`/notes/${note._id}`)}>
              <div className="note-card-top">
                <h3 className="note-card-title">{note.title || 'Untitled'}</h3>
                <button className="note-card-delete" onClick={(e) => deleteNote(e, note._id)} title="Delete">🗑</button>
              </div>
              <span className="note-card-date">{fmt(note.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesPage;
