import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import './NoteEditorPage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DRAFT_KEY = (id) => `note_draft_${id}`;
const SYNC_EVERY = 300; // sync to backend every 300 chars typed since last sync

// blocks → HTML for the editor div
const blocksToHtml = (blocks) => {
  if (!blocks?.length) return '<p><br></p>';
  return blocks.map(b => {
    if (b.type === 'image') return `<img src="${b.content}" class="note-img" data-saved="1" />`;
    if (b.type === 'h1') return `<h1>${b.content}</h1>`;
    if (b.type === 'h2') return `<h2>${b.content}</h2>`;
    return `<p>${b.content || '<br>'}</p>`;
  }).join('');
};

// editor div → blocks array (clean, no browser junk)
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
      const src = node.getAttribute('src') || node.src;
      // Skip blob: URLs (upload still in progress) and placeholder images
      if (src && !src.startsWith('blob:') && !node.getAttribute('data-placeholder')) {
        blocks.push({ type: 'image', content: src });
      }
    } else if (tag === 'h1') {
      const c = node.innerHTML.trim();
      if (c) blocks.push({ type: 'h1', content: c });
    } else if (tag === 'h2') {
      const c = node.innerHTML.trim();
      if (c) blocks.push({ type: 'h2', content: c });
    } else {
      const c = node.innerHTML;
      // keep non-empty paragraphs (even just <br>)
      if (c && c !== '<br>' || node.textContent.trim()) {
        blocks.push({ type: 'text', content: c || '' });
      }
    }
  });
  return blocks;
};

const saveDraft = (id, title, el) => {
  try {
    const blocks = htmlToBlocks(el);
    localStorage.setItem(DRAFT_KEY(id), JSON.stringify({ title, blocks, ts: Date.now() }));
  } catch { /* storage full */ }
};

const loadDraft = (id) => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const clearDraft = (id) => {
  try { localStorage.removeItem(DRAFT_KEY(id)); } catch { /* ignore */ }
};

// ── Component ─────────────────────────────────────────────────────────────────

const NoteEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const toolbarRef = useRef(null);
  const titleRef = useRef('Untitled');
  const charsSinceSync = useRef(0);
  const isSyncing = useRef(false);

  const [title, setTitle] = useState('Untitled');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // saved | unsaved | saving | uploading
  const [toolbar, setToolbar] = useState({ visible: false, x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const { dark, toggle: toggleTheme } = useNotesTheme();

  // ── Load: backend first, fall back to draft ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api.get(`/notes/${id}`)
      .then(r => {
        if (cancelled) return;
        const note = r.data.note;
        const draft = loadDraft(id);

        // Use draft if it's newer than the server version
        const serverTs = new Date(note.updatedAt).getTime();
        const useDraft = draft && draft.ts > serverTs && draft.blocks?.length;

        const t = useDraft ? draft.title : (note.title || 'Untitled');
        const html = blocksToHtml(useDraft ? draft.blocks : note.blocks);

        titleRef.current = t;
        setTitle(t);
        setLoading(false);

        // Set editor content after render (requestAnimationFrame ensures DOM is ready)
        requestAnimationFrame(() => {
          if (editorRef.current && !cancelled) {
            editorRef.current.innerHTML = html;
          }
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Load failed', err);
        // Try draft as fallback
        const draft = loadDraft(id);
        if (draft) {
          titleRef.current = draft.title;
          setTitle(draft.title);
          requestAnimationFrame(() => {
            if (editorRef.current) editorRef.current.innerHTML = blocksToHtml(draft.blocks);
          });
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  // ── Sync to backend ──────────────────────────────────────────────────────────
  const syncToBackend = useCallback(async () => {
    if (!editorRef.current || isSyncing.current) return;
    isSyncing.current = true;
    setSaveStatus('saving');
    try {
      const blocks = htmlToBlocks(editorRef.current);
      await api.put(`/notes/${id}`, { title: titleRef.current, blocks });
      charsSinceSync.current = 0;
      clearDraft(id);
      setSaveStatus('saved');
    } catch (e) {
      console.error('Sync failed', e);
      setSaveStatus('unsaved');
    } finally {
      isSyncing.current = false;
    }
  }, [id]);

  // ── Schedule save: localStorage immediately, backend debounced ───────────────
  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    // Always save to localStorage immediately
    if (editorRef.current) saveDraft(id, titleRef.current, editorRef.current);

    charsSinceSync.current += 1;

    // Sync to backend: either after SYNC_EVERY chars or after 2s idle
    clearTimeout(saveTimer.current);
    if (charsSinceSync.current >= SYNC_EVERY) {
      syncToBackend();
    } else {
      saveTimer.current = setTimeout(syncToBackend, 2000);
    }
  }, [id, syncToBackend]);

  // ── Save on page unload ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleUnload = () => {
      if (editorRef.current) saveDraft(id, titleRef.current, editorRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearTimeout(saveTimer.current);
      // Final sync on unmount — capture ref value now
      const el = editorRef.current;
      if (el) {
        api.put(`/notes/${id}`, {
          title: titleRef.current,
          blocks: htmlToBlocks(el),
        }).catch(() => {});
      }
    };
  }, [id, syncToBackend]);

  const handleEditorInput = () => scheduleSave();

  const handleTitleChange = (e) => {
    titleRef.current = e.target.value;
    setTitle(e.target.value);
    scheduleSave();
  };

  // ── Floating format toolbar ───────────────────────────────────────────────────
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

  // ── Image upload — show placeholder instantly, upload in background ───────────
  const triggerImageUpload = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // 1. Show local blob preview instantly — user sees image immediately
    const localUrl = URL.createObjectURL(file);
    const placeholderImg = insertImageAtCursor(localUrl, true);
    setSaveStatus('uploading');

    try {
      // 2. Get upload signature from backend (tiny request, ~50ms)
      const sigRes = await api.get('/notes/upload-signature');
      const { timestamp, signature, apiKey, cloudName, folder } = sigRes.data;

      // 3. Upload directly from browser to Cloudinary (no backend relay)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );
      const data = await uploadRes.json();

      if (!data.secure_url) {
        throw new Error(data.error?.message || 'Upload failed');
      }

      // 4. Swap placeholder with real Cloudinary URL
      if (placeholderImg && editorRef.current?.contains(placeholderImg)) {
        placeholderImg.src = data.secure_url;
        placeholderImg.style.opacity = '1';
        placeholderImg.removeAttribute('data-placeholder');
      }
      URL.revokeObjectURL(localUrl);
      scheduleSave();
    } catch (err) {
      console.error('Upload failed', err);
      if (placeholderImg && editorRef.current?.contains(placeholderImg)) {
        placeholderImg.remove();
      }
      URL.revokeObjectURL(localUrl);
      setSaveStatus('unsaved');
      alert(`Image upload failed: ${err.message}`);
    }
  };

  // Returns the inserted img element so we can update its src later
  const insertImageAtCursor = (url, isPlaceholder = false) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const img = document.createElement('img');
    img.src = url;
    img.className = 'note-img';
    if (isPlaceholder) {
      img.setAttribute('data-placeholder', '1');
      img.style.opacity = '0.5';
    }
    const p = document.createElement('p');
    p.innerHTML = '<br>';

    let anchorNode = sel?.anchorNode;
    while (anchorNode && anchorNode.parentNode !== editorRef.current) {
      anchorNode = anchorNode.parentNode;
    }
    if (anchorNode && anchorNode !== editorRef.current) {
      anchorNode.after(img, p);
    } else {
      editorRef.current?.appendChild(img);
      editorRef.current?.appendChild(p);
    }

    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    return img;
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

  const statusLabel = {
    saved: '✓',
    unsaved: '●',
    saving: '⏳',
    uploading: '⬆',
  }[saveStatus] || '✓';

  if (loading) return (
    <div className={`note-editor-page ${dark ? 'dark' : ''}`}>
      <div className="note-editor-loading"><div className="spinner" /></div>
    </div>
  );

  return (
    <div className={`note-editor-page ${dark ? 'dark' : ''}`} onClick={() => setToolbar(t => ({ ...t, visible: false }))}>
      <header className="note-editor-header" onClick={e => e.stopPropagation()}>
        <button className="note-back-btn" onClick={() => navigate('/notes')}>← Notes</button>
        <div className="note-editor-actions">
          <button className="note-img-upload-btn" onClick={triggerImageUpload} title="Insert image">
            🖼 <span className="btn-label">Image</span>
          </button>
          <button className="note-share-btn" onClick={copyShareLink} title="Copy public link">
            {copied ? '✓' : '🔗'} <span className="btn-label">{copied ? 'Copied!' : 'Share'}</span>
          </button>
          <button className="note-theme-btn" onClick={toggleTheme} title="Toggle theme">
            {dark ? '☀️' : '🌙'}
          </button>
          <span className="note-save-status" title={saveStatus}>{statusLabel}</span>
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
          <button onClick={() => applyFormat('p')}>¶</button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
};

export default NoteEditorPage;
