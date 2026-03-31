import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import './NoteEditorPage.css';

// Pure helpers — outside component
const blocksToHtml = (blocks) => blocks.map(b => {
  if (b.type === 'image') return `<img src="${b.content}" class="note-img" />`;
  if (b.type === 'h1') return `<h1>${b.content}</h1>`;
  if (b.type === 'h2') return `<h2>${b.content}</h2>`;
  return `<p>${b.content || '<br>'}</p>`;
}).join('');

const htmlToBlocks = (el) => {
  const blocks = [];
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (t) blocks.push({ type: 'text', content: t });
      return;
    }
    const tag = node.tagName?.toLowerCase();
    if (tag === 'img') {
      blocks.push({ type: 'image', content: node.src });
    } else if (tag === 'h1') {
      blocks.push({ type: 'h1', content: node.innerHTML });
    } else if (tag === 'h2') {
      blocks.push({ type: 'h2', content: node.innerHTML });
    } else {
      blocks.push({ type: 'text', content: node.innerHTML || '' });
    }
  });
  return blocks;
};

const NoteEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const toolbarRef = useRef(null);

  const [title, setTitle] = useState('Untitled');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [toolbar, setToolbar] = useState({ visible: false, x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const { dark, toggle: toggleTheme } = useNotesTheme();

  const titleRef = useRef(title);

  // Load note
  useEffect(() => {
    api.get(`/notes/${id}`)
      .then(r => {
        const note = r.data.note;
        const t = note.title || 'Untitled';
        setTitle(t);
        titleRef.current = t;
        if (editorRef.current) {
          editorRef.current.innerHTML = note.blocks?.length
            ? blocksToHtml(note.blocks)
            : '<p><br></p>';
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-save — always reads from refs so no stale closure
  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!editorRef.current) return;
      setSaveStatus('saving');
      try {
        await api.put(`/notes/${id}`, {
          title: titleRef.current,
          blocks: htmlToBlocks(editorRef.current),
        });
        setSaveStatus('saved');
      } catch (e) {
        console.error('Save failed', e);
        setSaveStatus('unsaved');
      }
    }, 1000);
  }, [id]);

  const handleEditorInput = () => scheduleSave();

  const handleTitleChange = (e) => {
    titleRef.current = e.target.value;
    setTitle(e.target.value);
    scheduleSave();
  };

  // Floating toolbar on selection
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setToolbar(t => ({ ...t, visible: false }));
      return;
    }
    if (!editorRef.current?.contains(sel.anchorNode)) {
      setToolbar(t => ({ ...t, visible: false }));
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setToolbar({ visible: true, x: rect.left + rect.width / 2, y: rect.top - 8 });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // Apply H1 / H2 / P to the block containing the selection
  const applyFormat = (tag) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    let node = sel.anchorNode;
    while (node && node.parentNode !== editorRef.current) node = node.parentNode;
    if (!node || node === editorRef.current) return;
    const newEl = document.createElement(tag);
    newEl.innerHTML = node.innerHTML;
    node.replaceWith(newEl);
    setToolbar(t => ({ ...t, visible: false }));
    sel.removeAllRanges();
    scheduleSave();
  };

  // Image upload
  const triggerImageUpload = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const r = await api.post('/notes/upload-image', { base64, mimeType: file.type });
      insertImageAtCursor(r.data.url);
    } catch (err) {
      console.error('Upload failed', err);
      alert('Image upload failed. Check Cloudinary config in backend .env');
    }
  };

  const insertImageAtCursor = (url) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const img = document.createElement('img');
    img.src = url;
    img.className = 'note-img';
    const p = document.createElement('p');
    p.innerHTML = '<br>';

    // Find the block-level node at cursor
    let anchorNode = sel?.anchorNode;
    while (anchorNode && anchorNode.parentNode !== editorRef.current) {
      anchorNode = anchorNode.parentNode;
    }

    if (anchorNode && anchorNode !== editorRef.current) {
      anchorNode.after(img, p);
    } else {
      editorRef.current.appendChild(img);
      editorRef.current.appendChild(p);
    }

    // Move cursor to new paragraph
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    scheduleSave();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertParagraph');
    }
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/p/notes/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div className={`note-editor-page ${dark ? 'dark' : ''}`}><div className="note-editor-loading"><div className="spinner" /></div></div>;

  return (
    <div className={`note-editor-page ${dark ? 'dark' : ''}`} onClick={() => setToolbar(t => ({ ...t, visible: false }))}>
      <header className="note-editor-header" onClick={e => e.stopPropagation()}>
        <button className="note-back-btn" onClick={() => navigate('/notes')}>← Notes</button>
        <div className="note-editor-actions">
          <button className="note-img-upload-btn" onClick={triggerImageUpload} title="Insert image at cursor">
            🖼 <span className="btn-label">Image</span>
          </button>
          <button className="note-share-btn" onClick={copyShareLink} title="Copy public link">
            {copied ? '✓' : '🔗'} <span className="btn-label">{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <button className="note-theme-btn" onClick={toggleTheme} title="Toggle theme">
            {dark ? '☀️' : '🌙'}
          </button>
          <span className="note-save-status">
            {saveStatus === 'saving' ? '⏳' : saveStatus === 'unsaved' ? '●' : '✓'}
          </span>
        </div>
      </header>

      <div className="note-editor-body" onClick={e => e.stopPropagation()}>
        <input
          className="note-title-input"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
        />
        <div
          ref={editorRef}
          className="note-editor-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onKeyDown={handleKeyDown}
          data-placeholder="Start writing…"
        />
      </div>

      {toolbar.visible && (
        <div
          ref={toolbarRef}
          className="note-float-toolbar"
          style={{ left: toolbar.x, top: toolbar.y - 8 }}
          onMouseDown={e => e.preventDefault()}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => applyFormat('h1')}>H1</button>
          <button onClick={() => applyFormat('h2')}>H2</button>
          <button onClick={() => applyFormat('p')}>¶ Para</button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
};

export default NoteEditorPage;
