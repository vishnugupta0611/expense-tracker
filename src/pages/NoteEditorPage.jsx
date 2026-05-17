import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import './NoteEditorPage.css';

const DRAFT_KEY = (id) => `note_draft_${id}`;
const DEBOUNCE_MS = 3000;
const CHUNK_SIZE  = 4000;

// Split flat blocks into chunks of ~CHUNK_SIZE chars
function splitIntoChunks(blocks) {
  const chunks = [];
  let current = [], count = 0;
  for (const block of blocks) {
    const len = (block.content || '').length;
    if (current.length > 0 && count + len > CHUNK_SIZE) {
      chunks.push(current);
      current = []; count = 0;
    }
    current.push(block);
    count += len;
  }
  if (current.length > 0) chunks.push(current);
  if (chunks.length === 0) chunks.push([]);
  return chunks;
}

// Cheap fingerprint — JSON stringify is fast enough for diff
function chunkHash(blocks) {
  return JSON.stringify(blocks);
}

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
    if (b.type === 'code') {
      const escaped = b.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || '';
      return `<pre class="note-code" data-lang="code" contenteditable="false"${a}><span class="note-code-header" contenteditable="false">code ● ● ●</span><code class="note-code-body" contenteditable="true">${escaped}</code></pre>`;
    }
    if (b.type === 'divider') return `<hr class="note-divider" />`;
    if (b.type === 'ul') return `<ul${a} class="note-list-ul">${b.content}</ul>`;
    if (b.type === 'ol') return `<ol${a} class="note-list-ol">${b.content}</ol>`;
    if (b.type === 'fact') {
      return `<div class="note-fact-card"${a} contenteditable="false"><span class="note-fact-emoji">💡</span><div class="note-fact-content" contenteditable="true">${b.content}</div></div>`;
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

const htmlToBlocks = (el) => {
  const blocks = [];
  if (!el) return blocks;
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
      const bodyEl = node.querySelector('.note-code-body');
      const content = bodyEl
        ? (bodyEl.innerText || bodyEl.textContent || '')
        : (node.innerText || node.textContent || '');
      blocks.push({ type: 'code', content, color, fontStyle });
    } else if (tag === 'ul') {
      blocks.push({ type: 'ul', content: node.innerHTML, color, fontStyle });
    } else if (tag === 'ol') {
      blocks.push({ type: 'ol', content: node.innerHTML, color, fontStyle });
    } else if (tag === 'div' && node.classList?.contains('note-fact-card')) {
      const contentEl = node.querySelector('.note-fact-content');
      const content = contentEl ? contentEl.innerHTML : '';
      blocks.push({ type: 'fact', content, color, fontStyle });
    } else if (tag === 'table') {
      blocks.push({ type: 'table', content: node.innerHTML, color, fontStyle });
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      const c = node.innerHTML.trim();
      blocks.push({ type: tag, content: c, color, fontStyle });
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

// ── Local Storage Version History Helpers ─────────────────────────────────────
const HISTORY_KEY = (noteId) => `note_history_${noteId}`;

const getLocalHistory = (noteId) => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(noteId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveLocalHistory = (noteId, history) => {
  try {
    localStorage.setItem(HISTORY_KEY(noteId), JSON.stringify(history.slice(0, 3)));
  } catch {}
};

// ── Syntax highlight all pre.note-code blocks ─────────────────────────────────
const highlightEditor = (el) => {
  if (!el) return;
  el.querySelectorAll('pre.note-code').forEach(pre => {
    const body = pre.querySelector('.note-code-body');
    if (!body || !body.textContent.trim()) return;
    if (body.dataset.highlighted === 'yes') return;
    hljs.highlightElement(body);
  });
};

// ── Component ─────────────────────────────────────────────────────────────────

const NoteEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const editorRef   = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimer   = useRef(null);
  const toolbarRef  = useRef(null);
  const titleRef    = useRef('Untitled');
  const isSyncing   = useRef(false);
  const lastChunksRef = useRef([]);

  const [title, setTitle]           = useState('Untitled');
  const [loading, setLoading]       = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [copied, setCopied]         = useState(false);
  const [urlModal, setUrlModal]     = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const { dark, toggle: toggleTheme } = useNotesTheme();

  // Progressive Chunk Loading States
  const [loadedSeq, setLoadedSeq] = useState(2);
  const [totalChunks, setTotalChunks] = useState(0);
  const [fetchingNext, setFetchingNext] = useState(false);

  // Floating PencilFAB menu states
  const [pencilOpen, setPencilOpen] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState(null); // 'style', 'color', 'insert', 'ai'
  const [customHex, setCustomHex] = useState('#e74c3c');
  const [tableModal, setTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHeader, setTableHeader] = useState(true);

  // AI Assistant states
  const [aiText, setAiText] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Local History states
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    if (id) {
      setHistoryList(getLocalHistory(id));
    }
  }, [id]);

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
        titleRef._lastSaved = t;

        // Initialize progressive chunk/scroll pagination states
        setTotalChunks(note.totalChunks || 1);
        setLoadedSeq(note.blocks?.length ? 1 : 0);

        requestAnimationFrame(() => {
          if (editorRef.current && !cancelled) {
            editorRef.current.innerHTML = html;
            highlightEditor(editorRef.current);
            // seed last-saved state so first autosave only sends real changes
            const blocks = useDraft ? draft.blocks : note.blocks;
            lastChunksRef.current = splitIntoChunks(blocks || []).map(chunkHash);
          }
        });
      })
      .catch(() => {
        if (cancelled) return;
        const draft = loadDraft(id);
        if (draft) {
          titleRef.current = draft.title;
          setTitle(draft.title);
          titleRef._lastSaved = draft.title;
          requestAnimationFrame(() => {
            if (editorRef.current) {
              editorRef.current.innerHTML = blocksToHtml(draft.blocks);
              highlightEditor(editorRef.current);
              lastChunksRef.current = splitIntoChunks(draft.blocks || []).map(chunkHash);
            }
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
      const blocks  = htmlToBlocks(editorRef.current);
      const chunks  = splitIntoChunks(blocks);
      const hashes  = chunks.map(chunkHash);
      const prev    = lastChunksRef.current;

      const dirty = [];
      for (let i = 0; i < chunks.length; i++) {
        if (hashes[i] !== prev[i]) dirty.push({ seq: i, blocks: chunks[i] });
      }

      const titleChanged = titleRef.current !== (titleRef._lastSaved || '');
      if (dirty.length === 0 && !titleChanged) {
        setSaveStatus('saved');
        isSyncing.current = false;
        return;
      }

      const deleteFrom = chunks.length < prev.length ? chunks.length : undefined;

      await api.patch(`/notes/${id}/chunks`, {
        title: titleRef.current,
        dirty,
        ...(deleteFrom !== undefined && { deleteFrom }),
      });

      lastChunksRef.current = hashes;
      titleRef._lastSaved   = titleRef.current;
      clearDraft(id);
      if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
      setSaveStatus('saved');
    } catch { setSaveStatus('unsaved'); }
    finally { isSyncing.current = false; }
  }, [id]);

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (editorRef.current) saveDraft(id, titleRef.current, editorRef.current);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(syncToBackend, DEBOUNCE_MS);
  }, [id, syncToBackend]);

  useEffect(() => {
    const handleUnload = () => {
      if (editorRef.current) saveDraft(id, titleRef.current, editorRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      clearTimeout(saveTimer.current);
      const el = editorRef.current;
      if (el) {
        const blocks  = htmlToBlocks(el);
        const chunks  = splitIntoChunks(blocks);
        const prev    = lastChunksRef.current;
        const dirty   = chunks.map((c, i) => ({ seq: i, blocks: c }))
          .filter((_, i) => chunkHash(chunks[i]) !== prev[i]);
        const deleteFrom = chunks.length < prev.length ? chunks.length : undefined;
        if (dirty.length > 0 || deleteFrom !== undefined) {
          api.patch(`/notes/${id}/chunks`, { title: titleRef.current, dirty, ...(deleteFrom !== undefined && { deleteFrom }) }).catch(() => {});
        }
      }
    };
  }, [id, syncToBackend]);

  // Infinite Scroll for Editor Chunks
  useEffect(() => {
    if (loading || loadedSeq + 1 >= totalChunks) return;

    const handleScroll = () => {
      if (fetchingNext) return;
      
      const threshold = 350; // trigger fetch 350px before bottom
      const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;

      if (scrolledToBottom) {
        setFetchingNext(true);
        const nextSeq = loadedSeq + 1;
        
        api.get(`/notes/${id}/chunks`, { params: { startSeq: nextSeq, limit: 2 } })
          .then(r => {
            const chunks = r.data.chunks || [];
            if (chunks.length > 0) {
              const newBlocks = chunks.flatMap(c => c.blocks);
              if (editorRef.current && newBlocks.length > 0) {
                // Append new elements to end of contenteditable without resetting innerHTML to preserve cursor
                const div = document.createElement('div');
                div.innerHTML = blocksToHtml(newBlocks);
                while (div.firstChild) {
                  editorRef.current.appendChild(div.firstChild);
                }
                highlightEditor(editorRef.current);
                
                // Update hashes cache so autosave diff remains aligned
                const newHashes = splitIntoChunks(newBlocks).map(chunkHash);
                lastChunksRef.current = [...lastChunksRef.current, ...newHashes];
              }
              setLoadedSeq(prev => prev + chunks.length);
            }
          })
          .catch(err => console.error("Error loading note chunks progressively:", err))
          .finally(() => setFetchingNext(false));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [id, loadedSeq, totalChunks, fetchingNext, loading]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onFocusOut = (e) => {
      const node = e.target;
      if (node?.classList?.contains('note-code-body')) {
        if (node.textContent.trim()) {
          delete node.dataset.highlighted;
          hljs.highlightElement(node);
        }
      }
    };
    el.addEventListener('focusout', onFocusOut);
    return () => el.removeEventListener('focusout', onFocusOut);
  }, []);

  const getSelectedBlock = () => {
    const sel = window.getSelection();
    if (!sel) return null;
    let node = sel.anchorNode;
    while (node && node.parentNode !== editorRef.current) node = node.parentNode;
    return (node && node !== editorRef.current) ? node : null;
  };

  const applyFormat = (tag) => {
    editorRef.current?.focus();
    const node = getSelectedBlock();
    if (!node) return;
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    const color = node.getAttribute?.('data-color') || '';
    const font  = node.getAttribute?.('data-font') || '';
    const newEl = document.createElement(tag);
    newEl.innerHTML = node.innerHTML;
    if (color) { newEl.setAttribute('data-color', color); newEl.style.color = color; }
    if (font)  applyFontStyle(newEl, font);
    node.replaceWith(newEl);
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
    editorRef.current?.focus();
    const node = getSelectedBlock();
    if (!node) return;
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    node.style.color = hex;
    node.setAttribute('data-color', hex);
    scheduleSave();
  };

  const applyFont = (font) => {
    editorRef.current?.focus();
    const node = getSelectedBlock();
    if (!node) return;
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    applyFontStyle(node, font);
    scheduleSave();
  };

  const applyList = (type) => {
    editorRef.current?.focus();
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    if (type === 'ul') {
      document.execCommand('insertUnorderedList');
    } else {
      document.execCommand('insertOrderedList');
    }
    scheduleSave();
  };

  const clearFormatting = () => {
    editorRef.current?.focus();
    const node = getSelectedBlock();
    if (!node) return;
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    node.style.color = '';
    node.removeAttribute('data-color');
    node.style.fontFamily = '';
    node.style.fontStyle  = '';
    node.style.fontWeight = '';
    node.removeAttribute('data-font');
    if (['h1','h2','h3','h4','h5','h6'].includes(node.tagName?.toLowerCase())) {
      const newEl = document.createElement('p');
      newEl.innerHTML = node.innerHTML;
      node.replaceWith(newEl);
    }
    scheduleSave();
  };

  // ── Insert divider ────────────────────────────────────────────────────────────
  const insertDivider = () => {
    editorRef.current?.focus();
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
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
    pre.setAttribute('data-lang', 'code');
    pre.contentEditable = 'false';

    const header = document.createElement('span');
    header.className = 'note-code-header';
    header.textContent = 'code ● ● ●';
    header.contentEditable = 'false';

    const body = document.createElement('code');
    body.className = 'note-code-body';
    body.contentEditable = 'true';
    body.setAttribute('data-placeholder', 'Enter code here…');

    pre.appendChild(header);
    pre.appendChild(body);

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

    const range = document.createRange();
    range.setStart(body, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    setToolbar(t => ({ ...t, visible: false }));
    scheduleSave();
  };

  // ── Insert custom fact card ───────────────────────────────────────────────────
  const insertFactCard = () => {
    editorRef.current?.focus();
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    const sel = window.getSelection();

    const factDiv = document.createElement('div');
    factDiv.className = 'note-fact-card';
    factDiv.contentEditable = 'false';

    const emoji = document.createElement('span');
    emoji.className = 'note-fact-emoji';
    emoji.textContent = '💡';

    const content = document.createElement('div');
    content.className = 'note-fact-content';
    content.contentEditable = 'true';
    content.setAttribute('data-placeholder', 'Enter fact content...');
    content.innerHTML = 'Enter key insight, highlight, tip, or definition here...'; // premium default text!

    factDiv.appendChild(emoji);
    factDiv.appendChild(content);

    const p = document.createElement('p');
    p.innerHTML = '<br>';

    let anchor = sel?.anchorNode;
    while (anchor && anchor.parentNode !== editorRef.current) anchor = anchor.parentNode;
    if (anchor && anchor !== editorRef.current) {
      anchor.after(factDiv, p);
    } else {
      editorRef.current?.appendChild(factDiv);
      editorRef.current?.appendChild(p);
    }

    const range = document.createRange();
    range.setStart(content, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    scheduleSave();
  };

  // ── Insert customizable table ─────────────────────────────────────────────────
  const insertTable = () => {
    editorRef.current?.focus();
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    const sel = window.getSelection();
    
    const table = document.createElement('table');
    table.className = 'note-table';
    table.contentEditable = 'true';

    let tableHtml = '';
    if (tableHeader) {
      tableHtml += '<thead><tr>';
      for (let c = 0; c < tableCols; c++) {
        tableHtml += '<th>Header</th>';
      }
      tableHtml += '</tr></thead>';
    }
    tableHtml += '<tbody>';
    for (let r = 0; r < tableRows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < tableCols; c++) {
        tableHtml += '<td>Cell</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody>';

    table.innerHTML = tableHtml;

    const p = document.createElement('p');
    p.innerHTML = '<br>';

    let anchor = sel?.anchorNode;
    while (anchor && anchor.parentNode !== editorRef.current) anchor = anchor.parentNode;
    if (anchor && anchor !== editorRef.current) {
      anchor.after(table, p);
    } else {
      editorRef.current?.appendChild(table);
      editorRef.current?.appendChild(p);
    }

    setTableModal(false);
    scheduleSave();
  };

  // ── Image upload ──────────────────────────────────────────────────────────────
  const triggerImageUpload = () => fileInputRef.current?.click();

  const insertImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    insertImageAtCursor(url, false);
    setImageUrlInput('');
    setUrlModal(false);
    scheduleSave();
  };

  // ── AI Assistant processing ──────────────────────────────────────────────────
  const handleAiSubmit = (mode) => {
    const textToProcess = aiText.trim();
    if (!textToProcess) {
      alert('Please enter or select some text context first!');
      return;
    }
    if (editorRef.current) pushHistoryVersion(editorRef.current.innerHTML);
    const command = mode === 'format' ? 'format' : aiPrompt.trim();
    if (!command) {
      alert('Please write an AI prompt/command!');
      return;
    }

    setAiLoading(true);
    api.post('/notes/ai', { command, text: textToProcess })
      .then(r => {
        const html = r.data.html;
        if (html) {
          insertHtmlAtSelection(html);
          setAiPrompt('');
        }
      })
      .catch(err => {
        alert(`AI request failed: ${err.response?.data?.error || err.message}`);
      })
      .finally(() => {
        setAiLoading(false);
      });
  };

  const insertHtmlAtSelection = (html) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      const div = document.createElement('div');
      div.innerHTML = html;
      while (div.firstChild) {
        editorRef.current?.appendChild(div.firstChild);
      }
      highlightEditor(editorRef.current);
      scheduleSave();
      return;
    }
    
    const range = sel.getRangeAt(0);
    if (sel.toString().trim()) {
      range.deleteContents();
    }
    
    const div = document.createElement('div');
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    while ((node = div.firstChild)) {
      frag.appendChild(node);
    }
    range.insertNode(frag);
    
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    highlightEditor(editorRef.current);
    scheduleSave();
  };

  // ── Version History actions ───────────────────────────────────────────────────
  const pushHistoryVersion = (html) => {
    if (!html || html === '<p><br></p>') return;
    const currentHist = getLocalHistory(id);
    if (currentHist.length > 0 && currentHist[0].html === html) return;
    const newVer = { ts: Date.now(), html };
    const updated = [newVer, ...currentHist].slice(0, 3);
    saveLocalHistory(id, updated);
    setHistoryList(updated);
  };

  const restoreHistoryVersion = (html) => {
    if (!editorRef.current) return;
    // Push the current editor state first so they can undo the restore!
    pushHistoryVersion(editorRef.current.innerHTML);
    editorRef.current.innerHTML = html;
    highlightEditor(editorRef.current);
    scheduleSave();
  };

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
      let check = node;
      while (check && check !== editorRef.current) {
        if (check?.classList?.contains('note-code-body')) {
          e.preventDefault();
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode('\n');
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          scheduleSave();
          return;
        }
        check = check.parentNode;
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

  const closeToolbarMenus = useCallback(() => { setColorPicker(false); setFontMenu(false); }, []);

  const statusLabel = { saved: '✓', unsaved: '●', saving: '⏳', uploading: '⬆' }[saveStatus] || '✓';

  if (loading) return (
    <div className={`note-editor-page ${dark ? 'dark' : ''}`}>
      <div className="note-editor-loading"><div className="spinner" /></div>
    </div>
  );

  return (
    <div
      className={`note-editor-page ${dark ? 'dark' : ''}`}
      onClick={() => {
        if (toolbarRef2.current.visible) {
          toolbarRef2.current = { visible: false, x: 0, y: 0 };
          setToolbar({ visible: false, x: 0, y: 0 });
        }
        closeToolbarMenus();
      }}
    >
      <header className="note-editor-header" onClick={e => e.stopPropagation()}>
        <button className="note-back-btn" onClick={() => navigate('/notes')}>← Notes</button>
        <div className="note-editor-actions">
          {/* Prevent blur using onMouseDown */}
          <button className="note-img-upload-btn" onMouseDown={e => e.preventDefault()} onClick={triggerImageUpload} title="Insert image from file">
            🖼 <span className="btn-label">Image</span>
          </button>
          <button className="note-img-upload-btn" onMouseDown={e => e.preventDefault()} onClick={() => setUrlModal(v => !v)} title="Insert image from URL">
            🔗 <span className="btn-label">URL</span>
          </button>
          <button className="note-code-btn" onMouseDown={e => e.preventDefault()} onClick={insertCodeBlock} title="Insert code block">
            {'<>'} <span className="btn-label">Code</span>
          </button>
          <button className="note-divider-btn" onMouseDown={e => e.preventDefault()} onClick={insertDivider} title="Insert divider">
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
        {fetchingNext && (
          <div className="npub-scroll-loading">
            <div className="spinner-mini" /> Loading more blocks...
          </div>
        )}
      </div>



      {/* Bottom-right Pencil FAB */}
      <button
        className={`note-pencil-fab ${pencilOpen ? 'active' : ''}`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          if (!pencilOpen) {
            setPencilOpen(true);
            setActiveSubMenu('ai'); // Default to AI first for supreme wow factor!
            const selText = window.getSelection()?.toString()?.trim() || '';
            if (selText) setAiText(selText);
          } else {
            setPencilOpen(false);
            setActiveSubMenu(null);
          }
        }}
        title="Advanced Formatting Menu"
      >
        {pencilOpen ? '×' : '✏️'}
      </button>

      {/* Stacked Sub-FAB Bubbles above the main FAB */}
      {pencilOpen && (
        <div className="note-sub-fabs-container" onMouseDown={e => e.preventDefault()}>
          {/* Sub-FAB 5: AI Formatting & Redefining */}
          <button
            className={`note-sub-fab ai-fab ${activeSubMenu === 'ai' ? 'active' : ''}`}
            onClick={() => {
              setActiveSubMenu(activeSubMenu === 'ai' ? null : 'ai');
              const selText = window.getSelection()?.toString()?.trim() || '';
              if (selText) setAiText(selText);
            }}
            title="AI Formatting Assistant"
          >
            🤖
          </button>

          {/* Sub-FAB 4: Headings / Text Styles */}
          <button
            className={`note-sub-fab style-fab ${activeSubMenu === 'style' ? 'active' : ''}`}
            onClick={() => setActiveSubMenu(activeSubMenu === 'style' ? null : 'style')}
            title="Headings & Paragraphs"
          >
            H
          </button>

          {/* Sub-FAB 3: Text Colors */}
          <button
            className={`note-sub-fab color-fab ${activeSubMenu === 'color' ? 'active' : ''}`}
            onClick={() => setActiveSubMenu(activeSubMenu === 'color' ? null : 'color')}
            title="Text Colors"
          >
            🎨
          </button>

          {/* Sub-FAB 2: Lists / Advanced Blocks */}
          <button
            className={`note-sub-fab insert-fab ${activeSubMenu === 'insert' ? 'active' : ''}`}
            onClick={() => setActiveSubMenu(activeSubMenu === 'insert' ? null : 'insert')}
            title="Insert Lists & Tables"
          >
            ➕
          </button>

          {/* Sub-FAB 1: Local Version History */}
          <button
            className={`note-sub-fab history-fab ${activeSubMenu === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSubMenu(activeSubMenu === 'history' ? null : 'history')}
            title="Version History"
          >
            ⏳
          </button>
        </div>
      )}

      {/* Floating Options Panel positioned to the left of the FAB area */}
      {pencilOpen && activeSubMenu && (
        <div 
          className="pencil-options-card" 
          onMouseDown={e => {
            // Bypass preventDefault on text fields to allow clicking, focusing, and writing!
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
              return;
            }
            e.preventDefault();
          }} 
          onClick={e => e.stopPropagation()}
        >
          {activeSubMenu === 'ai' && (
            <div className="pencil-options-section">
              <div className="pencil-options-heading">🤖 AI Rich Formatting Assistant</div>
              
              <textarea
                className="pencil-ai-input"
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                placeholder="Select text in editor to autofill here, or type raw text..."
              />
              
              <input
                type="text"
                className="pencil-ai-prompt"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Ask AI: translate, make summary, rewrite..."
                onKeyDown={e => { if (e.key === 'Enter') handleAiSubmit('custom'); }}
              />

              <div className="pencil-flex ai-actions" style={{ gap: '4px' }}>
                <button 
                  className="pencil-btn ai-format-btn" 
                  onClick={() => handleAiSubmit('format')}
                  disabled={aiLoading}
                  style={{ flex: 1.3, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none' }}
                >
                  {aiLoading ? '🤖 Working...' : '🪄 Auto Format'}
                </button>
                <button 
                  className="pencil-btn ai-custom-btn" 
                  onClick={() => handleAiSubmit('custom')}
                  disabled={aiLoading || !aiPrompt.trim()}
                  style={{ flex: 1 }}
                >
                  Apply Prompt
                </button>
              </div>
            </div>
          )}

          {activeSubMenu === 'history' && (
            <div className="pencil-options-section">
              <div className="pencil-options-heading">⏳ Local Version History</div>
              {historyList.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '0.4rem 0', textAlign: 'center' }}>
                  No local versions saved yet.
                </div>
              ) : (
                <div className="pencil-history-list" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {historyList.map((ver, idx) => {
                    const timeStr = new Date(ver.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    return (
                      <button
                        key={ver.ts}
                        className="pencil-btn"
                        onClick={() => restoreHistoryVersion(ver.html)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.72rem',
                          padding: '0.4rem 0.5rem',
                          textAlign: 'left',
                          width: '100%',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span style={{ fontWeight: '600' }}>Version {idx + 1}</span>
                        <span style={{ fontSize: '0.64rem', opacity: 0.7 }}>{timeStr}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeSubMenu === 'style' && (
            <div className="pencil-options-section">
              <div className="pencil-options-heading">Headings & Paragraphs</div>
              <div className="pencil-grid headings-grid">
                <button className="pencil-btn" onClick={() => applyFormat('h1')}>H1</button>
                <button className="pencil-btn" onClick={() => applyFormat('h2')}>H2</button>
                <button className="pencil-btn" onClick={() => applyFormat('h3')}>H3</button>
                <button className="pencil-btn" onClick={() => applyFormat('h4')}>H4</button>
                <button className="pencil-btn" onClick={() => applyFormat('h5')}>H5</button>
                <button className="pencil-btn" onClick={() => applyFormat('h6')}>H6</button>
                <button className="pencil-btn p-btn" onClick={() => applyFormat('p')} title="Paragraph">Normal</button>
              </div>

              <div className="pencil-options-heading" style={{ marginTop: '0.6rem' }}>Font Style & Family</div>
              <div className="pencil-grid headings-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                {FONT_STYLES.map(f => (
                  <button 
                    key={f.value} 
                    className="pencil-btn" 
                    onClick={() => applyFont(f.value)}
                    style={{ fontSize: '0.66rem', padding: '4px 2px', minWidth: '0' }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSubMenu === 'color' && (
            <div className="pencil-options-section">
              <div className="pencil-options-heading">Text Color Customizer</div>
              <div className="pencil-color-swatches">
                {['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#000000'].map(c => (
                  <button
                    key={c}
                    className="pencil-color-swatch"
                    style={{ background: c }}
                    onClick={() => applyColor(c)}
                  />
                ))}
              </div>
              
              <div className="pencil-hex-picker-row">
                <div className="pencil-color-preview-wrap">
                  <span className="pencil-color-preview" style={{ background: customHex }} />
                  <input
                    type="color"
                    className="pencil-hex-color-picker"
                    value={customHex}
                    onChange={e => setCustomHex(e.target.value)}
                  />
                </div>
                <input
                  type="text"
                  className="pencil-hex-input"
                  value={customHex}
                  placeholder="#e74c3c"
                  onChange={e => setCustomHex(e.target.value)}
                />
                <button className="pencil-apply-btn" onClick={() => applyColor(customHex)}>Apply</button>
              </div>

              <button className="pencil-reset-all-btn" onClick={clearFormatting}>
                ✨ Reset Block Styles (Clear Color/Tags)
              </button>
            </div>
          )}

          {activeSubMenu === 'insert' && (
            <div className="pencil-options-section">
              <div className="pencil-options-heading">Lists & Advanced Blocks</div>
              <div className="pencil-flex list-buttons" style={{ marginBottom: '8px' }}>
                <button className="pencil-btn bullet-btn" onClick={() => applyList('ul')}>• Bullet List</button>
                <button className="pencil-btn number-btn" onClick={() => applyList('ol')}>1. Numbered List</button>
              </div>
              <div className="pencil-flex custom-blocks">
                <button className="pencil-btn fact-btn" onClick={insertFactCard} title="Insert Fact Card">💡 Fact Card</button>
                <button className="pencil-btn table-btn" onClick={() => setTableModal(true)} title="Insert Custom Table">📊 Table</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Interactive Table Modal */}
      {tableModal && (
        <div className="img-url-modal-overlay" onClick={() => setTableModal(false)}>
          <div className="img-url-modal" onClick={e => e.stopPropagation()}>
            <p className="img-url-modal-title">📊 Insert Custom Table</p>
            
            <div className="pencil-table-form-row">
              <label className="pencil-checkbox-label">
                <input
                  type="checkbox"
                  checked={tableHeader}
                  onChange={e => setTableHeader(e.target.checked)}
                />
                Include a styled Header Row
              </label>
            </div>

            <div className="pencil-table-form-row">
              <label className="pencil-form-label">Number of Rows:</label>
              <input
                type="number"
                className="img-url-input"
                min="1"
                max="20"
                value={tableRows}
                onChange={e => setTableRows(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="pencil-table-form-row">
              <label className="pencil-form-label">Number of Columns:</label>
              <input
                type="number"
                className="img-url-input"
                min="1"
                max="20"
                value={tableCols}
                onChange={e => setTableCols(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="img-url-modal-actions">
              <button className="img-url-cancel" onClick={() => setTableModal(false)}>Cancel</button>
              <button className="img-url-insert" onClick={insertTable}>Insert Table</button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Image URL modal */}
      {urlModal && (
        <div className="img-url-modal-overlay" onClick={() => setUrlModal(false)}>
          <div className="img-url-modal" onClick={e => e.stopPropagation()}>
            <p className="img-url-modal-title">Insert image from URL</p>
            <input
              className="img-url-input"
              type="url"
              placeholder="https://example.com/image.png"
              value={imageUrlInput}
              onChange={e => setImageUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') insertImageUrl(); if (e.key === 'Escape') setUrlModal(false); }}
              autoFocus
            />
            <div className="img-url-modal-actions">
              <button className="img-url-cancel" onClick={() => setUrlModal(false)}>Cancel</button>
              <button className="img-url-insert" onClick={insertImageUrl} disabled={!imageUrlInput.trim()}>Insert</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteEditorPage;
