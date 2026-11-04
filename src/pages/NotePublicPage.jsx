import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import './NotePublicPage.css';
import { useEditor, EditorContent } from '@tiptap/react';
import { notesExtensions } from '@utils/notes/tiptapExtensions';
import { legacyBlocksToTiptapDocument } from '@utils/notes/legacyBlocksToTiptap';

const blockAttrs = (b) => {
  let style = '';
  if (b.color) style += `color:${b.color};`;
  if (b.fontStyle === 'serif')  style += 'font-family:Georgia,serif;';
  if (b.fontStyle === 'mono')   style += "font-family:'Courier New',monospace;";
  if (b.fontStyle === 'italic') style += 'font-style:italic;';
  if (b.fontStyle === 'bold')   style += 'font-weight:700;';
  return style ? ` style="${style}"` : '';
};

const formatTableHtml = (content) => {
  if (!content) return '<tbody><tr><td>&nbsp;</td></tr></tbody>';
  const trimmed = content.trim();
  if (trimmed.includes('<tr') || trimmed.includes('<td') || trimmed.includes('<th')) {
    return trimmed.startsWith('<table')
      ? trimmed.replace(/^<table[^>]*>/, '').replace(/<\/table>$/, '')
      : trimmed;
  }
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '<tbody><tr><td>&nbsp;</td></tr></tbody>';

  const dataLines = lines.filter(l => !/^[|\s:-]+$/.test(l));
  if (!dataLines.length) return '<tbody><tr><td>&nbsp;</td></tr></tbody>';

  const rows = dataLines.map(l => {
    const raw = l.replace(/^\|/, '').replace(/\|$/, '');
    return raw.split('|').map(c => c.trim());
  });

  const header = rows[0];
  const bodyRows = rows.slice(1);

  let out = '<thead><tr>';
  header.forEach(h => {
    out += `<th>${h || '&nbsp;'}</th>`;
  });
  out += '</tr></thead>';

  if (bodyRows.length > 0) {
    out += '<tbody>';
    bodyRows.forEach(row => {
      out += '<tr>';
      for (let i = 0; i < header.length; i++) {
        out += `<td>${row[i] !== undefined ? row[i] : '&nbsp;'}</td>`;
      }
      out += '</tr>';
    });
    out += '</tbody>';
  }
  return out;
};

const blocksToHtml = (blocks) => {
  if (!blocks?.length) return '<p><br></p>';
  return blocks.map(b => {
    const a = blockAttrs(b);
    if (b.type === 'image') {
      const posClass = b.position ? ` note-img-${b.position}` : ' note-img-center';
      const sizeClass = b.size ? ` note-img-${b.size}` : ' note-img-medium';
      const altAttr = b.alt ? ` alt="${b.alt}"` : '';
      let imgTag = `<img src="${b.content}" class="note-img${posClass}${sizeClass}"${altAttr} loading="lazy" />`;
      if (b.caption) {
        imgTag = `<figure class="note-img-figure${posClass}${sizeClass}">${imgTag}<figcaption class="note-img-caption">${b.caption}</figcaption></figure>`;
      }
      return imgTag;
    }
    if (b.type === 'code') {
      const escaped = (b.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return `<pre class="note-code" data-lang="code"${a}><span class="note-code-header">code ● ● ●</span><code class="note-code-body">${escaped}</code></pre>`;
    }
    if (b.type === 'divider') return `<hr class="note-divider" />`;
    if (b.type === 'ul') return `<ul${a} class="note-list-ul">${b.content}</ul>`;
    if (b.type === 'ol') return `<ol${a} class="note-list-ol">${b.content}</ol>`;
    if (b.type === 'fact') {
      return `<div class="note-fact-card"${a}><span class="note-fact-emoji">💡</span><div class="note-fact-content">${b.content}</div></div>`;
    }
    if (b.type === 'table') {
      return `<table class="note-table"${a}>${formatTableHtml(b.content)}</table>`;
    }
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(b.type)) {
      return `<${b.type}${a}>${b.content || '<br>'}</${b.type}>`;
    }
    let text = b.content || '';
    if (!text.includes('<br') && !text.includes('<p') && text.includes('\n')) {
      text = text.split('\n').join('<br>');
    }
    return `<p${a}>${text || '<br>'}</p>`;
  }).join('');
};

const highlightCodeBlocks = (el) => {
  if (!el) return;
  el.querySelectorAll('pre.note-code code.note-code-body').forEach(code => {
    if (code.dataset.highlighted === 'yes') return;
    hljs.highlightElement(code);
  });
};

const PublicChapterContent = ({ chapter }) => {
  const document = chapter.document?.type === 'doc'
    ? chapter.document
    : legacyBlocksToTiptapDocument(chapter.legacyBlocks || []);

  const editor = useEditor({
    extensions: notesExtensions,
    content: document,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'npub-tiptap-content',
        'aria-label': `Chapter: ${chapter.title || 'Untitled chapter'}`,
      },
    },
  });

  return (
    <section className="npub-chapter">
      <h2 className="npub-chapter-title">{chapter.title || 'Untitled chapter'}</h2>
      {chapter.description ? (
        <p className="npub-chapter-description">{chapter.description}</p>
      ) : null}
      <EditorContent editor={editor} />
    </section>
  );
};

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
        const fetchedNote = r.data.note;
        setNote(fetchedNote);
        if (!fetchedNote.chapters?.length && contentRef.current) {
          contentRef.current.innerHTML = fetchedNote.blocks?.length
            ? blocksToHtml(fetchedNote.blocks)
            : '<p>This note is empty.</p>';
          highlightCodeBlocks(contentRef.current);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (note && !note.chapters?.length && contentRef.current) {
      contentRef.current.innerHTML = note.blocks?.length
        ? blocksToHtml(note.blocks)
        : '<p>This note is empty.</p>';
      highlightCodeBlocks(contentRef.current);
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
        <h1 className="npub-title">{note?.title || 'Untitled'}</h1>
        <p className="npub-meta">Last updated {fmt(note?.updatedAt)}</p>
        {note?.chapters?.length ? (
          <div className="npub-chapters">
            {note.chapters.map((chapter) => (
              <PublicChapterContent key={chapter._id} chapter={chapter} />
            ))}
          </div>
        ) : (
          <div ref={contentRef} className="npub-content" />
        )}
      </div>
    </div>
  );
};

export default NotePublicPage;
