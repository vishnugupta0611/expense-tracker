import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  ArrowLeft, BookOpen, ChevronDown, ChevronLeft, ChevronRight,
  Code2, ImagePlus, List, ListOrdered, Plus, Quote, Save,
  Share2, Table2, Trash2, Type, X, Heading1, Heading2, Heading3,
  Bold, Italic, Underline, Highlighter, PanelLeft, GripVertical,
} from 'lucide-react';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import { notesExtensions } from '@/utils/notes/tiptapExtensions';
import { legacyBlocksToTiptapDocument } from '@/utils/notes/legacyBlocksToTiptap';
import './NoteChaptersPage.css';

const EMPTY_DOCUMENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const getChapterDocument = (data) => {
  if (data?.document?.type === 'doc') return data.document;
  return legacyBlocksToTiptapDocument(data?.legacyBlocks || []);
};

const extractNodeText = (node) => {
  if (!node || typeof node !== 'object') return '';
  let text = typeof node.text === 'string' ? node.text : '';
  if (Array.isArray(node.content)) {
    text += node.content.map(extractNodeText).join('');
  }
  return text;
};

const buildChunkEntries = (chunks, editor) => {
  let position = 1;

  return (Array.isArray(chunks) ? chunks : []).map((chunk, index) => {
    let nodes = Array.isArray(chunk.nodes) ? chunk.nodes : [];
    if (!nodes.length && Array.isArray(chunk.legacyBlocks) && chunk.legacyBlocks.length) {
      nodes = legacyBlocksToTiptapDocument(chunk.legacyBlocks).content;
    }

    const startPosition = position;
    let text = '';

    nodes.forEach((jsonNode) => {
      text += extractNodeText(jsonNode);
      if (editor) {
        try {
          position += editor.schema.nodeFromJSON(jsonNode).nodeSize;
        } catch (error) {
          console.warn('Unable to calculate a chunk position:', error);
        }
      }
    });

    return {
      id: chunk._id || String(index),
      index,
      seq: chunk.seq,
      nodes,
      startPosition,
      charCount: chunk.charCount || text.length,
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 88),
    };
  });
};

const NoteChaptersPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnCategory = searchParams.get('category');
  const { dark, toggle: toggleTheme } = useNotesTheme();

  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [chapters, setChapters] = useState([]);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [chapterTitle, setChapterTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewMode, setViewMode] = useState('chapters');
  const [chunkEntries, setChunkEntries] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [errorMessage, setErrorMessage] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textColor, setTextColor] = useState('#4f46e5');

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const chapterIdRef = useRef(null);
  const revisionRef = useRef(0);
  const readyRef = useRef(false);
  const dirtyRef = useRef(false);
  const generationRef = useRef(0);
  const saveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);
  const savePromiseRef = useRef(null);
  const saveNowRef = useRef(null);

  const editor = useEditor({
    extensions: notesExtensions,
    content: EMPTY_DOCUMENT,
    onUpdate: () => {
      if (!readyRef.current) return;
      dirtyRef.current = true;
      generationRef.current += 1;
      setSaveStatus('unsaved');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveNowRef.current?.().catch((error) => {
          console.error('Chapter autosave failed:', error);
        });
      }, 1000);
    },
    editorProps: {
      attributes: {
        class: 'notes-tiptap-editor',
        'aria-label': 'Note chapter editor',
      },
    },
  });

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter._id === activeChapterId) || null,
    [chapters, activeChapterId]
  );

  const refreshChunkEntries = useCallback(async () => {
    if (!activeChapterId || !editor) return;
    try {
      const response = await api.get(
        '/notes/' + id + '/chapters/' + activeChapterId + '/content?view=chunks'
      );
      setChunkEntries(buildChunkEntries(response.data.chunks, editor));
    } catch (error) {
      console.warn('Could not refresh chunk navigation:', error);
    }
  }, [activeChapterId, editor, id]);

  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (savePromiseRef.current) return savePromiseRef.current;

    if (
      !editor ||
      !activeChapterId ||
      !readyRef.current ||
      !dirtyRef.current ||
      chapterIdRef.current !== activeChapterId
    ) {
      return;
    }

    const savingChapterId = activeChapterId;
    const saveLoop = (async () => {
      while (
        dirtyRef.current &&
        readyRef.current &&
        chapterIdRef.current === savingChapterId
      ) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        const savingGeneration = generationRef.current;
        const document = editor.getJSON();
        setSaveStatus('saving');

        try {
          const response = await api.put(
            '/notes/' + id + '/chapters/' + savingChapterId + '/content',
            {
              document,
              revision: revisionRef.current,
            }
          );

          if (chapterIdRef.current !== savingChapterId) return;
          revisionRef.current = response.data.revision;
          dirtyRef.current = generationRef.current !== savingGeneration;
          setSaveStatus(dirtyRef.current ? 'unsaved' : 'saved');
          await refreshChunkEntries();
        } catch (error) {
          if (chapterIdRef.current === savingChapterId) {
            const recoveryRequired = error.response?.data?.recoveryRequired === true;
            const conflict = error.response?.status === 409 || recoveryRequired;
            setSaveStatus(conflict ? 'conflict' : 'unsaved');
            if (recoveryRequired) {
              setErrorMessage('The save failed and the server could not fully restore the previous chunks. Copy your local content before reloading.');
            } else if (error.response?.status === 409) {
              setErrorMessage('This chapter changed elsewhere. Reload it before saving more edits.');
            } else {
              setErrorMessage(error.response?.data?.error || 'Could not save this chapter. Your edits are still on this screen.');
            }
          }
          throw error;
        }
      }
    })();

    savePromiseRef.current = saveLoop;
    try {
      await saveLoop;
    } finally {
      if (savePromiseRef.current === saveLoop) {
        savePromiseRef.current = null;
      }
    }
  }, [activeChapterId, editor, id, refreshChunkEntries]);

  saveNowRef.current = saveNow;

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get('/notes/' + id + '/meta'),
      api.get('/notes/' + id + '/chapters'),
    ])
      .then(([noteResponse, chapterResponse]) => {
        if (cancelled) return;
        const loadedNote = noteResponse.data.note;
        const loadedChapters = chapterResponse.data.chapters || [];
        setNote(loadedNote);
        setTitle(loadedNote.title || '');
        setChapters(loadedChapters);
        setActiveChapterId(loadedChapters[0]?._id || null);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error.response?.data?.error || 'Could not load this note.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!selectedChapter) {
      setChapterTitle('');
      return;
    }
    setChapterTitle(selectedChapter.title || '');
  }, [selectedChapter]);

  useEffect(() => {
    if (!editor || !activeChapterId) return undefined;

    let cancelled = false;
    readyRef.current = false;
    dirtyRef.current = false;
    chapterIdRef.current = activeChapterId;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setChapterLoading(true);
    setErrorMessage('');

    api.get('/notes/' + id + '/chapters/' + activeChapterId + '/content?view=chunks')
      .then((response) => {
        if (cancelled) return;
        const data = response.data;
        const document = getChapterDocument(data);

        revisionRef.current = data.chapter?.revision || 0;
        editor.commands.setContent(document, { emitUpdate: false });
        setChunkEntries(buildChunkEntries(data.chunks, editor));
        readyRef.current = true;
        setSaveStatus('saved');
      })
      .catch((error) => {
        if (!cancelled) {
          readyRef.current = false;
          setErrorMessage(error.response?.data?.error || 'Could not load this chapter.');
        }
      })
      .finally(() => {
        if (!cancelled) setChapterLoading(false);
      });

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [activeChapterId, editor, id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (dirtyRef.current && readyRef.current) {
        saveNowRef.current?.().catch((error) => {
          console.error('Final chapter save failed:', error);
        });
      }
    };
  }, []);

  const selectChapter = async (chapterId) => {
    if (chapterId === activeChapterId) {
      setMobileNavOpen(false);
      return;
    }

    try {
      await saveNow();
      setActiveChapterId(chapterId);
      setMobileNavOpen(false);
    } catch {
      // Keep the current chapter open when the save fails.
    }
  };

  const createChapter = async () => {
    const name = window.prompt('Chapter name');
    if (!name?.trim()) return;

    try {
      await saveNow();
      const response = await api.post('/notes/' + id + '/chapters', {
        title: name.trim(),
      });
      const chapter = response.data.chapter;
      setChapters((current) => [...current, chapter].sort((a, b) => a.order - b.order));
      setActiveChapterId(chapter._id);
      setViewMode('chapters');
      setMobileNavOpen(false);
    } catch (error) {
      window.alert(error.response?.data?.error || 'Could not create chapter.');
    }
  };

  const renameChapter = async () => {
    if (!selectedChapter || !chapterTitle.trim()) return;
    if (chapterTitle.trim() === selectedChapter.title) return;

    try {
      const response = await api.patch(
        '/notes/' + id + '/chapters/' + activeChapterId,
        { title: chapterTitle.trim() }
      );
      setChapters((current) => current.map((chapter) => (
        chapter._id === activeChapterId ? response.data.chapter : chapter
      )));
    } catch (error) {
      window.alert(error.response?.data?.error || 'Could not rename chapter.');
      setChapterTitle(selectedChapter.title || '');
    }
  };

  const deleteChapter = async (chapter) => {
    if (chapters.length <= 1) {
      window.alert('A note must keep at least one chapter.');
      return;
    }
    if (!window.confirm('Delete "' + chapter.title + '" and all its content?')) return;

    try {
      await saveNow();
      await api.delete('/notes/' + id + '/chapters/' + chapter._id);
      const remaining = chapters.filter((item) => item._id !== chapter._id);
      setChapters(remaining);
      if (chapter._id === activeChapterId) {
        setActiveChapterId(remaining[0]?._id || null);
      }
    } catch (error) {
      window.alert(error.response?.data?.error || 'Could not delete chapter.');
    }
  };

  const moveChapter = async (chapter, direction) => {
    const index = chapters.findIndex((item) => item._id === chapter._id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= chapters.length) return;

    const reordered = [...chapters];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setChapters(reordered);

    try {
      await api.patch('/notes/' + id + '/chapters/reorder', {
        chapterIds: reordered.map((item) => item._id),
      });
    } catch (error) {
      setChapters(chapters);
      window.alert(error.response?.data?.error || 'Could not reorder chapters.');
    }
  };

  const saveNoteTitle = async () => {
    if (!note || title === note.title) return;
    try {
      await api.patch('/notes/' + id, { title: title.trim() || 'Untitled' });
      setNote((current) => ({ ...current, title: title.trim() || 'Untitled' }));
    } catch (error) {
      window.alert(error.response?.data?.error || 'Could not save note title.');
    }
  };

  const scheduleTitleSave = (value) => {
    setTitle(value);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      api.patch('/notes/' + id, { title: value.trim() || 'Untitled' })
        .then(() => setNote((current) => current ? { ...current, title: value.trim() || 'Untitled' } : current))
        .catch((error) => {
          console.error('Could not save note title:', error);
        });
    }, 700);
  };

  const insertImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) return;

    setImageUploading(true);
    try {
      const signatureResponse = await api.get('/notes/upload-signature');
      const { timestamp, signature, apiKey, cloudName, folder } = signatureResponse.data;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);

      const uploadResponse = await fetch(
        'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload',
        { method: 'POST', body: formData }
      );
      const data = await uploadResponse.json();
      if (!uploadResponse.ok || !data.secure_url) {
        throw new Error(data.error?.message || 'Image upload failed');
      }

      editor.chain().focus().setImage({
        src: data.secure_url,
        alt: file.name,
        position: 'center',
        size: 'medium',
        caption: '',
      }).run();
    } catch (error) {
      window.alert(error.message || 'Could not upload image.');
    } finally {
      setImageUploading(false);
    }
  };

  const shareNote = async () => {
    const url = window.location.origin + '/p/notes/' + id;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const selectChunk = (chunk) => {
    if (!editor || !chunk.nodes?.length) return;
    const position = Math.max(1, Math.min(chunk.startPosition, editor.state.doc.content.size));
    editor.chain().focus().setTextSelection(position).scrollIntoView().run();
  };

  const copyLocalChapterJson = async () => {
    if (!editor) return;
    const content = JSON.stringify(editor.getJSON(), null, 2);
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy your local chapter JSON:', content);
    }
  };

  const insertFactCard = () => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'factCard',
      attrs: { emoji: '💡', color: null, fontStyle: null },
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Write an important takeaway…' }],
      }],
    }).run();
  };

  const statusText = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    conflict: 'Conflict',
  }[saveStatus] || 'Saved';

  if (loading) {
    return (
      <div className={'note-chapters-page ' + (dark ? 'dark' : '')}>
        <div className="note-chapters-loading"><span className="note-chapters-spinner" /></div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className={'note-chapters-page ' + (dark ? 'dark' : '')}>
        <div className="note-chapters-error">
          <p>{errorMessage || 'Note not found.'}</p>
          <button type="button" onClick={() => navigate('/notes')}>Back to notes</button>
        </div>
      </div>
    );
  }

  return (
    <div className={'note-chapters-page ' + (dark ? 'dark' : '')}>
      {mobileNavOpen ? (
        <button
          type="button"
          className="note-chapters-drawer-scrim"
          aria-label="Close chapter navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <header className="note-chapters-header">
        <div className="note-chapters-header-left">
          <button
            type="button"
            className="note-chapters-icon-btn"
            onClick={() => navigate(returnCategory ? '/notes?category=' + encodeURIComponent(returnCategory) : '/notes')}
            title="Back to notes"
            aria-label="Back to notes"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            className="note-chapters-mobile-menu"
            onClick={() => setMobileNavOpen(true)}
            title="Open chapters"
            aria-label="Open chapters"
          >
            <PanelLeft size={18} />
          </button>
          <input
            className="note-chapters-note-title"
            value={title}
            onChange={(event) => scheduleTitleSave(event.target.value)}
            onBlur={saveNoteTitle}
            aria-label="Note title"
            placeholder="Untitled note"
          />
        </div>

        <div className="note-chapters-header-actions">
          <span className={'note-chapters-save-status ' + saveStatus}>
            <span className="note-chapters-save-dot" />
            {statusText}
          </span>
          <button type="button" className="note-chapters-icon-btn" onClick={shareNote} title="Copy public link" aria-label="Copy public link">
            <Share2 size={17} />
            <span className="note-chapters-share-label">{copied ? 'Copied' : 'Share'}</span>
          </button>
          <button type="button" className="note-chapters-icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {dark ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            className="note-chapters-save-btn"
            onClick={() => saveNow().catch(() => {})}
            disabled={!dirtyRef.current || saveStatus === 'saving' || saveStatus === 'conflict' || chapterLoading}
          >
            <Save size={15} />
            Save
          </button>
        </div>
      </header>

      <div className="note-chapters-layout">
        <aside className={'note-chapters-sidebar ' + (mobileNavOpen ? 'open' : '')}>
          <div className="note-chapters-sidebar-top">
            <div>
              <div className="note-chapters-sidebar-kicker">NOTE STRUCTURE</div>
              <div className="note-chapters-sidebar-heading"><BookOpen size={16} /> Chapters</div>
            </div>
            <button type="button" className="note-chapters-icon-btn mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">
              <X size={17} />
            </button>
          </div>

          <div className="note-chapters-view-switch">
            <button
              type="button"
              className={viewMode === 'chapters' ? 'active' : ''}
              onClick={() => setViewMode('chapters')}
            >
              Chapters
            </button>
            <button
              type="button"
              className={viewMode === 'chunks' ? 'active' : ''}
              onClick={() => setViewMode('chunks')}
            >
              Chunks
            </button>
          </div>

          {viewMode === 'chapters' ? (
            <>
              <div className="note-chapters-list">
                {chapters.map((chapter, index) => (
                  <div
                    className={'note-chapter-row ' + (chapter._id === activeChapterId ? 'active' : '')}
                    key={chapter._id}
                  >
                    <button
                      type="button"
                      className="note-chapter-select"
                      onClick={() => selectChapter(chapter._id)}
                    >
                      <span className="note-chapter-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="note-chapter-row-copy">
                        <strong>{chapter.title || 'Untitled chapter'}</strong>
                        <small>{chapter.chunkCount || 0} chunks</small>
                      </span>
                    </button>
                    <div className="note-chapter-row-actions">
                      <button type="button" title="Move chapter up" onClick={() => moveChapter(chapter, -1)} disabled={index === 0}>
                        <ChevronLeft size={13} />
                      </button>
                      <button type="button" title="Move chapter down" onClick={() => moveChapter(chapter, 1)} disabled={index === chapters.length - 1}>
                        <ChevronRight size={13} />
                      </button>
                      <button type="button" title="Delete chapter" onClick={() => deleteChapter(chapter)} disabled={chapters.length <= 1}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="note-chapters-add-btn" onClick={createChapter}>
                <Plus size={16} />
                Add chapter
              </button>
            </>
          ) : (
            <div className="note-chunks-list">
              {chunkEntries.length ? chunkEntries.map((chunk) => (
                <button
                  type="button"
                  className="note-chunk-row"
                  key={chunk.id}
                  onClick={() => {
                    selectChunk(chunk);
                    setMobileNavOpen(false);
                  }}
                >
                  <span className="note-chunk-index">{String(chunk.index + 1).padStart(2, '0')}</span>
                  <span className="note-chunk-copy">
                    <strong>Chunk {chunk.index + 1}</strong>
                    <small>{chunk.preview || (chunk.charCount + ' characters')}</small>
                  </span>
                  <span className="note-chunk-count">{chunk.charCount}</span>
                </button>
              )) : (
                <p className="note-chunks-empty">This chapter has no stored chunks yet.</p>
              )}
              <p className="note-chunks-help">Chunks are storage sections. Editing still happens in the same chapter editor.</p>
            </div>
          )}

          <div className="note-chapters-sidebar-footer">
            <span>{chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}</span>
            <span>One note · one editor</span>
          </div>
        </aside>

        <main className="note-chapters-main">
          <div className="note-chapters-workbar">
            <div className="note-chapters-current">
              <span className="note-chapters-current-label">CHAPTER</span>
              <input
                value={chapterTitle}
                onChange={(event) => setChapterTitle(event.target.value)}
                onBlur={renameChapter}
                placeholder="Untitled chapter"
                aria-label="Chapter title"
                disabled={!selectedChapter}
              />
            </div>
            <div className="note-chapters-workbar-actions">
              <button type="button" onClick={() => saveNow().catch(() => {})} disabled={!dirtyRef.current || saveStatus === 'saving' || saveStatus === 'conflict'}>
                <Save size={15} /> Save now
              </button>
            </div>
          </div>

          <div className="note-tiptap-toolbar">
            <div className="note-tiptap-toolbar-group">
              <button type="button" title="Bold" disabled={!editor} className={editor?.isActive('bold') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={16} /></button>
              <button type="button" title="Italic" disabled={!editor} className={editor?.isActive('italic') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={16} /></button>
              <button type="button" title="Underline" disabled={!editor} className={editor?.isActive('underline') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={16} /></button>
              <button type="button" title="Highlight" disabled={!editor} className={editor?.isActive('highlight') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fff2a8' }).run()}><Highlighter size={16} /></button>
            </div>
            <span className="note-tiptap-toolbar-divider" />
            <div className="note-tiptap-toolbar-group">
              <button type="button" title="Heading 1" disabled={!editor} className={editor?.isActive('heading', { level: 1 }) ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={17} /></button>
              <button type="button" title="Heading 2" disabled={!editor} className={editor?.isActive('heading', { level: 2 }) ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17} /></button>
              <button type="button" title="Heading 3" disabled={!editor} className={editor?.isActive('heading', { level: 3 }) ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={17} /></button>
              <button type="button" title="Text color" disabled={!editor} className="note-tiptap-color-control" onMouseDown={(event) => event.preventDefault()}>
                <Type size={16} />
                <input type="color" value={textColor} onChange={(event) => {
                  setTextColor(event.target.value);
                  editor?.chain().focus().setColor(event.target.value).run();
                }} aria-label="Text color" />
              </button>
            </div>
            <span className="note-tiptap-toolbar-divider" />
            <div className="note-tiptap-toolbar-group">
              <button type="button" title="Bullet list" disabled={!editor} className={editor?.isActive('bulletList') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17} /></button>
              <button type="button" title="Numbered list" disabled={!editor} className={editor?.isActive('orderedList') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={17} /></button>
              <button type="button" title="Blockquote" disabled={!editor} className={editor?.isActive('blockquote') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={16} /></button>
              <button type="button" title="Code block" disabled={!editor} className={editor?.isActive('codeBlock') ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 size={16} /></button>
            </div>
            <span className="note-tiptap-toolbar-divider" />
            <div className="note-tiptap-toolbar-group">
              <button type="button" title="Insert table" disabled={!editor} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={16} /></button>
              <button type="button" title="Insert image" disabled={!editor || imageUploading} onMouseDown={(event) => event.preventDefault()} onClick={() => fileInputRef.current?.click()}><ImagePlus size={16} /></button>
              <button type="button" title="Insert fact card" disabled={!editor} onMouseDown={(event) => event.preventDefault()} onClick={insertFactCard}>💡</button>
            </div>
          </div>

          {errorMessage ? (
            <div className={'note-chapters-message ' + (saveStatus === 'conflict' ? 'warning' : '')}>
              <span>{errorMessage}</span>
              {saveStatus === 'conflict' ? (
                <>
                  <button type="button" onClick={copyLocalChapterJson}>
                    {copied ? 'Copied local JSON' : 'Copy local JSON'}
                  </button>
                  <button type="button" onClick={() => window.location.reload()}>Reload chapter</button>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="note-chapters-editor-scroll">
            {chapterLoading ? (
              <div className="note-chapters-editor-loading"><span className="note-chapters-spinner" /></div>
            ) : (
              <div className="note-chapters-editor-paper">
                {editor ? <EditorContent editor={editor} /> : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={insertImage}
                />
              </div>
            )}
          </div>
          {imageUploading ? <div className="note-chapters-uploading">Uploading image…</div> : null}
        </main>
      </div>
    </div>
  );
};

export default NoteChaptersPage;
