import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import './NoteEditorPage.css';

const DRAFT_KEY = (id) => `note_draft_${id}`;
const SYNC_EVERY = 300;

const FONT_STYLES = [
  { label: 'Default', value: '' },
  { label: 'Serif',   value: 'serif' },
  { label: 'Mono',    value: 'mono' },
  { label: 'Italic',  value: 'italic' },
  { label: 'Bold',    value: 'bold' },
];

// ── Serialise / deserialise ───────────────────────────────────────────────────

const blockAttrs = (b) => {
  let style = '';
  if (b.color) style += `color:${b.color};`;
  if (b.fontStyle === 'serif')  style += 'font-family:Georgia,serif;';
  if (b.fontStyle === 'mono')   style += "font-family:'Courier New',monospace;";
  if (b.fontStyle === 'italic') style += 'font-style:italic;';
  if (b.fontStyle === 'bold')   style += 'font-weight:700;';
  const styleAttr = style ? ` style="${style}"` : '';
  const colorAttr = b.color ? ` data-color="${b.color}"` : '';
  const fontAttr  = b.fontStyle ? ` data-font="${b.fontStyle}"` : '';
  return styleAttr + colorAttr + fontAttr;
};

const blocksToHtml = (blocks) => {
  if (!blocks?.length) return '<p><br></p>';
  return blocks.map(b => {
    const a = blockAttrs(b);
    if (b.type === 'image') return `<img src="${b.content}" class="note-img" data-saved="1" />`;
    if (b.type === 'code')  return `<pre class="note-code"${a}>${b.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || ''}</pre>`;
    if (b.type === 'divider') return `<hr class="note-divider" />`;
    if (b.type === 'h1')    return `<h1${a}>${b.content}</h1>`;
    if (b.type === 'h2')    return `<h2${a}>${b.content}</h2>`;
    return `<p${a}>${b.content || '<br>'}</p>`;
  }).join('');
};

const htmlToBlocks = (el) => {
  const blocks = [];
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent.trim();
      if (t) blocks.push({ type: 'text', content: t });
      return;
    }
    const tag = node.tagName?.toLowerCase();
    const color = node.getAttribute?.('data-color') || '';
    const fontStyle = node.getAttribute?.('data-font') || '';

    if (tag === 'img') {
      const src = node.getAttribute('src') || node.src;
      if (src && !src.startsWith('blob:') && !node.getAttribute('data-placeholder')) {
        blocks.push({ type: 'image', content: src });
      }
    } else if (tag === 'hr') {
      blocks.push({ type: 'divider', content: '' });
    } else if (tag === 'pre') {
      // innerText preserves \n line breaks; textContent does not on all browsers
      blocks.push({ type: 'code', content: node.innerText || node.textContent || '', color, fontStyle });
    } else if (tag === 'h1') {
      const c = node.innerHTML.trim();
      if (c) blocks.push({ type: 'h1', content: c, color, fontStyle });
    } else if (tag === 'h2') {
      const c = node.innerHTML.trim();
      if (c) blocks.push({ type: 'h2', content: c, color, fontStyle });
    } else {
      const c = node.innerHTML;
      if (c && c !== '<br>' || node.textContent.trim()) {
        blocks.push({ type: 'text', content: c || '', color, fontStyle });
      }
    }
  });
  return blocks;
};

const saveDraft = (id, title, el) => {
  try {
    localStorage.setItem(DRAFT_KEY(id), JSON.stringify({ title, blocks: htmlToBlocks(el), ts: Date.now() }));
  } catch { /* storage full */ }
};
const loadDraft = (id) => {
  try { const r = localStorage.getItem(DRAFT_KEY(id)); return r ? JSON.parse(r) : null; } catch { return null; }
};
const clearDraft = (id) => { try { localStorage.removeItem(DRAFT_KEY(id)); } catch { /* ignore */ } };

// ── Component ─────────────────────────────────────────────────────────────────

const NoteEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef   = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimer   = useRef(null);
  const toolbarRef  = useRef(null);
  const titleRef    = useRef('Untitled');
  const charsSinceSync = useRef(0);
  const isSyncing   = useRef(false);

  const [title, setTitle]           = useState('Untitled');
  const [loading, setLoading]       = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [toolbar, setToolbar]       = useState({ visible: false, x: 0, y: 0 });
  const [copied, setCopied]         = useState(false);
  const [colorPicker, setColorPicker] = useState(false);
  const [fontMenu, setFontMenu]     = useState(false);
  const { dark, toggle: toggleTheme } = useNotesTheme();

  // ── Load ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api.get(`/notes/${id}`)
      .then(r => {
        if (cancelled) return;
        const note = r.data.note;
        const draft = loadDraft(id);
        const serverTs = new Date(note.updatedAt).getTime();
        const useDraft = draft && draft.ts > serverTs && draft.blocks?.length;
        const t = useDraft ? draft.title : (note.title || 'Untitled');
        const html = blocksToHtml(useDraft ? draft.blocks : note.blocks);
        titleRef.current = t;
        setTitle(t);
        setLoading(false);
        requestAnimationFrame(() => {
          if (editorRef.current && !cancelled) editorRef.current.innerHTML = html;
        });
      })
      .catch(() => {
        if (cancelled) return;
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

  // ── Sync ──────────────────────────────────────────────────────────────────────
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
    } catch { setSaveStatus('unsaved'); }
    finally { isSyncing.current = false; }
  }, [id]);

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (editorRef.current) saveDraft(id, titleRef.current, editorRef.current);
    charsSinceSync.current += 1;
    clearTimeout(saveTimer.current);
    if (charsSinceSync.current >= SYNC_EVERY) syncToBackend();
    else saveTimer.current = setTimeout(syncToBackend, 2000);
  }, [id, syncToBackend]);

  useEffect(() => {
    const handleUnload = () => {
      if (editorRef.current) saveDraft(id, titleRef.current, editorRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearTimeout(saveTimer.current);
      const el = editorRef.current; // capture before cleanup
      if (el) api.put(`/notes/${id}`, { title: titleRef.current, blocks: htmlToBlocks(el) }).catch(() => {});
    };
  }, [id, syncToBackend]);

  // ── Floating toolbar ──────────────────────────────────────────────────────────
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setToolbar(t => ({ ...t, visible: false }));
      setColorPicker(false);
      setFontMenu(false);
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

  // Get the block-level node that contains the selection
  const getSelectedBlock = () => {
    const sel = window.getSelection();
    if (!sel) return null;
    let node = sel.anchorNode;
    while (node && node.parentNode !== editorRef.current) node = node.parentNode;
    return (node && node !== editorRef.current) ? node : null;
  };

  const applyFormat = (tag) => {
    const node = getSelectedBlock();
    if (!node) return;
    const color = node.getAttribute?.('data-color') || '';
    const font  = node.getAttribute?.('data-font') || '';
    const newEl = document.createElement(tag);
    newEl.innerHTML = node.innerHTML;
    if (color) { newEl.setAttribute('data-color', color); newEl.style.color = color; }
    if (font)  applyFontStyle(newEl, font);
    node.replaceWith(newEl);
    setToolbar(t => ({ ...t, visible: false }));
    window.getSelection()?.removeAllRanges();
    scheduleSave();
  };

  const applyFontStyle = (el, font) => {
    el.setAttribute('data-font', font);
    el.style.fontFamily = '';
    el.style.fontStyle  = '';
    el.style.fontWeight = '';
    if (font === 'serif')  el.style.fontFamily = 'Georgia, serif';
    if (font === 'mono')   el.style.fontFamily = "'Courier New', monospace";
    if (font === 'italic') el.style.fontStyle  = 'italic';
    if (font === 'bold')   el.style.fontWeight = '700';
  };

  const applyColor = (hex) => {
    const node = getSelectedBlock();
    if (!node) return;
    node.style.color = hex;
    node.setAttribute('data-color', hex);
    setColorPicker(false);
    scheduleSave();
  };

  const applyFont = (font) => {
    const node = getSelectedBlock();
    if (!node) return;
    applyFontStyle(node, font);
    setFontMenu(false);
    scheduleSave();
  };

  // ── Insert divider ────────────────────────────────────────────────────────────
  const insertDivider = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const hr = document.createElement('hr');
    hr.className = 'note-divider';
    const p = document.createElement('p');
    p.innerHTML = '<br>';

    let anchor = sel?.anchorNode;
    while (anchor && anchor.parentNode !== editorRef.current) anchor = anchor.parentNode;
    if (anchor && anchor !== editorRef.current) {
      anchor.after(hr, p);
    } else {
      editorRef.current?.appendChild(hr);
      editorRef.current?.appendChild(p);
    }

    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    setToolbar(t => ({ ...t, visible: false }));
    scheduleSave();
  };

  // ── Insert code block ─────────────────────────────────────────────────────────
  const insertCodeBlock = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const pre = document.createElement('pre');
    pre.className = 'note-code';
    pre.textContent = '';
    const p = document.createElement('p');
    p.innerHTML = '<br>';

    let anchor = sel?.anchorNode;
    while (anchor && anchor.parentNode !== editorRef.current) anchor = anchor.parentNode;
    if (anchor && anchor !== editorRef.current) {
      anchor.after(pre, p);
    } else {
      editorRef.current?.appendChild(pre);
      editorRef.current?.appendChild(p);
    }

    // Place cursor inside the pre
    const range = document.createRange();
    range.setStart(pre, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    setToolbar(t => ({ ...t, visible: false }));
    scheduleSave();
  };

  // ── Image upload ──────────────────────────────────────────────────────────────
  const triggerImageUpload = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const localUrl = URL.createObjectURL(file);
    const placeholderImg = insertImageAtCursor(localUrl, true);
    setSaveStatus('uploading');
    try {
      const sigRes = await api.get('/notes/upload-signature');
      const { timestamp, signature, apiKey, cloudName, folder } = sigRes.data;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
      const data = await uploadRes.json();
      if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
      if (placeholderImg && editorRef.current?.contains(placeholderImg)) {
        placeholderImg.src = data.secure_url;
        placeholderImg.style.opacity = '1';
        placeholderImg.removeAttribute('data-placeholder');
      }
      URL.revokeObjectURL(localUrl);
      scheduleSave();
    } catch (err) {
      if (placeholderImg && editorRef.current?.contains(placeholderImg)) placeholderImg.remove();
      URL.revokeObjectURL(localUrl);
      setSaveStatus('unsaved');
      alert(`Image upload failed: ${err.message}`);
    }
  };

  const insertImageAtCursor = (url, isPlaceholder = false) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const img = document.createElement('img');
    img.src = url;
    img.className = 'note-img';
    if (isPlaceholder) { img.setAttribute('data-placeholder', '1'); img.style.opacity = '0.5'; }
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    let anchor = sel?.anchorNode;
    while (anchor && anchor.parentNode !== editorRef.current) anchor = anchor.parentNode;
    if (anchor && anchor !== editorRef.current) { anchor.after(img, p); }
    else { editorRef.current?.appendChild(img); editorRef.current?.appendChild(p); }
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    return img;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      let node = sel?.anchorNode;
      while (node && node.parentNode !== editorRef.current) node = node.parentNode;

      if (node?.tagName?.toLowerCase() === 'pre') {
        // Inside code block — insert a real newline character
        e.preventDefault();
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode('\n');
        range.insertNode(textNode);
        // Move cursor after the \n
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        scheduleSave();
        return;
      }

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

  const closeToolbarMenus = () => { setColorPicker(false); setFontMenu(false); };

  const statusLabel = { saved: '✓', unsaved: '●', saving: '⏳', uploading: '⬆' }[saveStatus] || '✓';

  if (loading) return (
    <div className={`note-editor-page ${dark ? 'dark' : ''}`}>
      <div className="note-editor-loading"><div className="spinner" /></div>
    </div>
  );

  return (
    <div
      className={`note-editor-page ${dark ? 'dark' : ''}`}
      onClick={() => { setToolbar(t => ({ ...t, visible: false })); closeToolbarMenus(); }}
    >
      <header className="note-editor-header" onClick={e => e.stopPropagation()}>
        <button className="note-back-btn" onClick={() => navigate('/notes')}>← Notes</button>
        <div className="note-editor-actions">
          <button className="note-img-upload-btn" onClick={triggerImageUpload} title="Insert image">
            🖼 <span className="btn-label">Image</span>
          </button>
          <button className="note-code-btn" onClick={insertCodeBlock} title="Insert code block">
            {'<>'} <span className="btn-label">Code</span>
          </button>
          <button className="note-divider-btn" onClick={insertDivider} title="Insert divider">
            — <span className="btn-label">Divider</span>
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
          onChange={e => { titleRef.current = e.target.value; setTitle(e.target.value); scheduleSave(); }}
          placeholder="Untitled"
        />
        <div
          ref={editorRef}
          className="note-editor-content"
          contentEditable
          suppressContentEditableWarning
          onInput={() => scheduleSave()}
          onKeyDown={handleKeyDown}
          data-placeholder="Start writing…"
        />
      </div>

      {/* Floating toolbar */}
      {toolbar.visible && (
        <div
          ref={toolbarRef}
          className="note-float-toolbar"
          style={{ left: toolbar.x, top: toolbar.y - 8 }}
          onMouseDown={e => e.preventDefault()}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => applyFormat('h1')} title="Heading 1">H1</button>
          <button onClick={() => applyFormat('h2')} title="Heading 2">H2</button>
          <button onClick={() => applyFormat('p')}  title="Paragraph">¶</button>

          <div className="tb-divider" />

          {/* Font style picker */}
          <div className="tb-dropdown-wrap">
            <button className="tb-font-btn" onClick={() => { setFontMenu(v => !v); setColorPicker(false); }} title="Font style">
              Aa
            </button>
            {fontMenu && (
              <div className="tb-dropdown font-dropdown">
                {FONT_STYLES.map(f => (
                  <button key={f.value} onClick={() => applyFont(f.value)} className="tb-dropdown-item">
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="tb-divider" />

          {/* Color picker */}
          <div className="tb-dropdown-wrap">
            <button
              className="tb-color-btn"
              onClick={() => { setColorPicker(v => !v); setFontMenu(false); }}
              title="Text color"
            >
              <span className="tb-color-dot" />
              A
            </button>
            {colorPicker && (
              <div className="tb-dropdown color-dropdown" onClick={e => e.stopPropagation()}>
                <input
                  type="color"
                  className="tb-color-input"
                  defaultValue="#e74c3c"
                  onChange={e => applyColor(e.target.value)}
                />
                <div className="tb-color-presets">
                  {['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#1abc9c','#e91e63'].map(c => (
                    <button
                      key={c}
                      className="tb-preset"
                      style={{ background: c }}
                      onClick={() => applyColor(c)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
};

export default NoteEditorPage;
