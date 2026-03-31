import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import './WordLibraryPage.css';

const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const WordLibraryPage = () => {
  const navigate = useNavigate();
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);   // word._id
  const [aiData, setAiData] = useState({});          // { [id]: { hindi, sentences } | 'loading' | 'error' }
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ word: '', definition: '' });
  const [adding, setAdding] = useState(false);
  const [defLoading, setDefLoading] = useState(false);
  const wordInputRef = useRef(null);

  useEffect(() => {
    api.get('/words')
      .then(r => setWords(r.data.words || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Add word ─────────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.word.trim() || !form.definition.trim()) return;
    setAdding(true);
    // Optimistic — add instantly
    const temp = { _id: `temp_${Date.now()}`, word: form.word.trim(), definition: form.definition.trim(), createdAt: new Date().toISOString() };
    setWords(prev => [temp, ...prev]);
    setForm({ word: '', definition: '' });
    setShowAdd(false);
    try {
      const r = await api.post('/words', { word: temp.word, definition: temp.definition });
      setWords(prev => prev.map(w => w._id === temp._id ? r.data.word : w));
    } catch {
      setWords(prev => prev.filter(w => w._id !== temp._id));
      alert('Failed to save word');
    } finally {
      setAdding(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setWords(prev => prev.filter(w => w._id !== id));
    if (expanded === id) setExpanded(null);
    try { await api.delete(`/words/${id}`); } catch { /* already removed from UI */ }
  };

  // ── Toggle expand ─────────────────────────────────────────────────────────────
  const toggleExpand = (id) => {
    setExpanded(prev => prev === id ? null : id);
  };

  // ── AI ───────────────────────────────────────────────────────────────────────
  const fetchAI = async (e, id) => {
    e.stopPropagation();
    if (aiData[id] && aiData[id] !== 'error') return; // already loaded
    setAiData(prev => ({ ...prev, [id]: 'loading' }));
    if (expanded !== id) setExpanded(id);
    try {
      const r = await api.post(`/words/${id}/ai`);
      setAiData(prev => ({ ...prev, [id]: r.data }));
    } catch {
      setAiData(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const openAdd = () => {
    setShowAdd(true);
    setTimeout(() => wordInputRef.current?.focus(), 50);
  };

  const fetchDefinition = async () => {
    if (!form.word.trim()) return;
    setDefLoading(true);
    try {
      const r = await api.post('/words/define', { word: form.word.trim() });
      setForm(f => ({ ...f, definition: r.data.definition }));
    } catch {
      alert('Could not fetch definition. Try again.');
    } finally {
      setDefLoading(false);
    }
  };

  return (
    <div className="wl-page">
      {/* Header */}
      <header className="wl-header">
        <button className="wl-back" onClick={() => navigate('/profile')}>← Back</button>
        <h1 className="wl-title">Word Library</h1>
        <button className="wl-add-btn" onClick={openAdd}>+ Add</button>
      </header>

      {/* Add form — inline slide-down */}
      <div className={`wl-add-form-wrap ${showAdd ? 'open' : ''}`}>
        <form className="wl-add-form" onSubmit={handleAdd}>
          <input
            ref={wordInputRef}
            className="wl-input"
            placeholder="Word"
            value={form.word}
            onChange={e => setForm(f => ({ ...f, word: e.target.value }))}
            required
          />
          <div className="wl-def-row">
            <input
              className="wl-input wl-def-input"
              placeholder="Definition / meaning"
              value={form.definition}
              onChange={e => setForm(f => ({ ...f, definition: e.target.value }))}
              required
            />
            <button
              type="button"
              className={`wl-def-ai-btn ${defLoading ? 'loading' : ''}`}
              onClick={fetchDefinition}
              disabled={defLoading || !form.word.trim()}
              title="Auto-fill definition with AI"
            >
              {defLoading ? '…' : '✦'}
            </button>
          </div>
          <div className="wl-add-actions">
            <button type="button" className="wl-cancel-btn" onClick={() => setShowAdd(false)}>Cancel</button>
            <button type="submit" className="wl-save-btn" disabled={adding}>
              {adding ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="wl-loading"><div className="spinner" /></div>
      ) : words.length === 0 ? (
        <div className="wl-empty">
          <span>📖</span>
          <p>No words yet. Add your first word!</p>
        </div>
      ) : (
        <div className="wl-grid">
          {words.map(w => {
            const isExpanded = expanded === w._id;
            const ai = aiData[w._id];
            return (
              <div
                key={w._id}
                className={`wl-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(w._id)}
              >
                {/* Card top */}
                <div className="wl-card-head">
                  <span className="wl-word">{w.word}</span>
                  <button
                    className="wl-delete-btn"
                    onClick={(e) => handleDelete(e, w._id)}
                    title="Delete"
                  >✕</button>
                </div>

                <p className="wl-definition">{w.definition}</p>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="wl-expanded-body" onClick={e => e.stopPropagation()}>
                    {/* AI button */}
                    <button
                      className={`wl-ai-btn ${ai && ai !== 'loading' && ai !== 'error' ? 'done' : ''}`}
                      onClick={(e) => fetchAI(e, w._id)}
                      disabled={ai === 'loading'}
                    >
                      {ai === 'loading' ? '✦ Thinking…' : ai === 'error' ? '✦ Retry AI' : ai ? '✦ AI' : '✦ Ask AI'}
                    </button>

                    {/* AI result */}
                    {ai && ai !== 'loading' && ai !== 'error' && (
                      <div className="wl-ai-result">
                        <div className="wl-hindi">
                          <span className="wl-hindi-label">Hindi</span>
                          <span className="wl-hindi-text">{ai.hindi}</span>
                        </div>
                        <div className="wl-sentences">
                          {ai.sentences?.map((s, i) => (
                            <div key={i} className={`wl-sentence wl-sentence-${s.level}`}>
                              <span className="wl-sentence-level">{LEVEL_LABEL[s.level]}</span>
                              <span className="wl-sentence-text">{s.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ai === 'error' && (
                      <p className="wl-ai-error">AI request failed. Check your Gemini API key.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WordLibraryPage;
