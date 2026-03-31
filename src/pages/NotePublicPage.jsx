import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import './NotePublicPage.css';

const blocksToHtml = (blocks) => blocks.map(b => {
  if (b.type === 'image') return `<img src="${b.content}" class="note-img" />`;
  if (b.type === 'h1') return `<h1>${b.content}</h1>`;
  if (b.type === 'h2') return `<h2>${b.content}</h2>`;
  return `<p>${b.content || ''}</p>`;
}).join('');

const NotePublicPage = () => {
  const { id } = useParams();
  const contentRef = useRef(null);
  const { dark, toggle } = useNotesTheme();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/notes/public/${id}`)
      .then(r => {
        setNote(r.data.note);
        if (contentRef.current) {
          contentRef.current.innerHTML = r.data.note.blocks?.length
            ? blocksToHtml(r.data.note.blocks)
            : '<p>This note is empty.</p>';
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Set content after note loads (ref may not be ready on first render)
  useEffect(() => {
    if (note && contentRef.current) {
      contentRef.current.innerHTML = note.blocks?.length
        ? blocksToHtml(note.blocks)
        : '<p>This note is empty.</p>';
    }
  }, [note]);

  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  if (loading) return (
    <div className={`npub-page ${dark ? 'dark' : ''}`}>
      <div className="npub-loading"><div className="spinner" /></div>
    </div>
  );

  if (notFound) return (
    <div className={`npub-page ${dark ? 'dark' : ''}`}>
      <div className="npub-not-found">
        <span>📄</span>
        <h2>Note not found</h2>
        <p>This note may have been deleted or the link is invalid.</p>
      </div>
    </div>
  );

  return (
    <div className={`npub-page ${dark ? 'dark' : ''}`}>
      <header className="npub-header">
        <span className="npub-badge">📖 Read only</span>
        <button className="npub-theme-btn" onClick={toggle} title="Toggle theme">
          {dark ? '☀️' : '🌙'}
        </button>
      </header>
      <div className="npub-body">
        <h1 className="npub-title">{note.title || 'Untitled'}</h1>
        <p className="npub-meta">Last updated {fmt(note.updatedAt)}</p>
        <div ref={contentRef} className="npub-content" />
      </div>
    </div>
  );
};

export default NotePublicPage;
