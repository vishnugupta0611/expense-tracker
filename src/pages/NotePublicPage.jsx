import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import './NotePublicPage.css';

const blockAttrs = (b) => {
  let style = '';
  if (b.color) style += `color:${b.color};`;
  if (b.fontStyle === 'serif')  style += 'font-family:Georgia,serif;';
  if (b.fontStyle === 'mono')   style += "font-family:'Courier New',monospace;";
  if (b.fontStyle === 'italic') style += 'font-style:italic;';
  if (b.fontStyle === 'bold')   style += 'font-weight:700;';
  return style ? ` style="${style}"` : '';
};

const blocksToHtml = (blocks) => {
  if (!blocks?.length) return '<p><br></p>';
  return blocks.map(b => {
    const a = blockAttrs(b);
    if (b.type === 'image') return `<img src="${b.content}" class="note-img" />`;
    if (b.type === 'code') {
      const escaped = b.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || '';
      return `<pre class="note-code" data-lang="code"><span class="note-code-header">code ● ● ●</span><code class="note-code-body">${escaped}</code></pre>`;
    }
    if (b.type === 'divider') return `<hr class="note-divider" />`;
    if (b.type === 'ul') return `<ul${a} class="note-list-ul">${b.content}</ul>`;
    if (b.type === 'ol') return `<ol${a} class="note-list-ol">${b.content}</ol>`;
    if (b.type === 'fact') {
      return `<div class="note-fact-card"${a}><span class="note-fact-emoji">💡</span><div class="note-fact-content">${b.content}</div></div>`;
    }
    if (b.type === 'table') {
      return `<table class="note-table"${a}>${b.content}</table>`;
    }
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(b.type)) {
      return `<${b.type}${a}>${b.content}</${b.type}>`;
    }
    return `<p${a}>${b.content || '<br>'}</p>`;
  }).join('');
};

const highlightCodeBlocks = (el) => {
  if (!el) return;
  el.querySelectorAll('pre.note-code code.note-code-body').forEach(code => {
    if (code.dataset.highlighted === 'yes') return;
    hljs.highlightElement(code);
  });
};

const NotePublicPage = () => {
  const { id } = useParams();
  const contentRef = useRef(null);
  const { dark, toggle } = useNotesTheme();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Pagination states
  const [loadedSeq, setLoadedSeq] = useState(2);
  const [totalChunks, setTotalChunks] = useState(0);
  const [fetchingNext, setFetchingNext] = useState(false);

  useEffect(() => {
    api.get(`/notes/public/${id}`)
      .then(r => {
        const fetchedNote = r.data.note;
        setNote(fetchedNote);
        setTotalChunks(fetchedNote.totalChunks || 1);
        setLoadedSeq(fetchedNote.blocks?.length ? 1 : 0);
        
        if (contentRef.current) {
          contentRef.current.innerHTML = fetchedNote.blocks?.length
            ? blocksToHtml(fetchedNote.blocks)
            : '<p>This note is empty.</p>';
          highlightCodeBlocks(contentRef.current);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Set initial content and highlight
  useEffect(() => {
    if (note && contentRef.current) {
      contentRef.current.innerHTML = note.blocks?.length
        ? blocksToHtml(note.blocks)
        : '<p>This note is empty.</p>';
      highlightCodeBlocks(contentRef.current);
    }
  }, [note]);

  // Infinite Scroll Listener for Public Page Chunks
  useEffect(() => {
    if (loading || notFound || loadedSeq + 1 >= totalChunks) return;

    const handleScroll = () => {
      if (fetchingNext) return;

      const threshold = 350; // trigger fetch 350px before reaching bottom
      const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;

      if (scrolledToBottom) {
        setFetchingNext(true);
        const nextSeq = loadedSeq + 1;

        api.get(`/notes/public/${id}/chunks`, { params: { startSeq: nextSeq, limit: 2 } })
          .then(r => {
            const chunks = r.data.chunks || [];
            if (chunks.length > 0) {
              const newBlocks = chunks.flatMap(c => c.blocks);
              if (contentRef.current && newBlocks.length > 0) {
                const div = document.createElement('div');
                div.innerHTML = blocksToHtml(newBlocks);
                while (div.firstChild) {
                  contentRef.current.appendChild(div.firstChild);
                }
                highlightCodeBlocks(contentRef.current);
              }
              setLoadedSeq(prev => prev + chunks.length);
            }
          })
          .catch(err => console.error("Error loading chunks progressively:", err))
          .finally(() => setFetchingNext(false));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [id, loadedSeq, totalChunks, fetchingNext, loading, notFound]);

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
        {fetchingNext && (
          <div className="npub-scroll-loading">
            <div className="spinner-mini" /> Loading more...
          </div>
        )}
      </div>
    </div>
  );
};

export default NotePublicPage;
