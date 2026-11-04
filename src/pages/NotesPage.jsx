import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@services/api';
import { useNotesTheme } from '@hooks/useNotesTheme';
import './NotesPage.css';

const UNCATEGORIZED_ID = 'uncategorized';

const getNoteCategoryId = (note) => {
  const value = note?.categoryId;
  return value?._id || value || null;
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const NotesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dark, toggle: toggleTheme } = useNotesTheme();

  const selectedCategoryId = searchParams.get('category');
  const [categories, setCategories] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.get('/categories'), api.get('/notes')])
      .then(([categoryResponse, noteResponse]) => {
        if (cancelled) return;
        setCategories(categoryResponse.data.categories || []);
        setNotes(noteResponse.data.notes || []);
      })
      .catch((error) => {
        if (!cancelled) console.error('Failed to load notes workspace:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    notes.forEach((note) => {
      const categoryId = getNoteCategoryId(note) || UNCATEGORIZED_ID;
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    });
    return counts;
  }, [notes]);

  const selectedCategory = categories.find(
    (category) => category._id === selectedCategoryId
  );

  const isUncategorized = selectedCategoryId === UNCATEGORIZED_ID;

  const visibleNotes = useMemo(() => {
    if (!selectedCategoryId) return [];

    const query = search.trim().toLowerCase();
    return notes
      .filter((note) => {
        const noteCategoryId = getNoteCategoryId(note);
        const matchesCategory = isUncategorized
          ? !noteCategoryId
          : noteCategoryId === selectedCategoryId;
        if (!matchesCategory) return false;
        if (!query) return true;

        return [note.title, note.summary, ...(note.tags || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }, [notes, search, selectedCategoryId, isUncategorized]);

  const openCategory = (categoryId) => {
    setSearch('');
    setSearchParams({ category: categoryId });
  };

  const backToCategories = () => {
    setSearch('');
    setSearchParams({});
  };

  const createCategory = async () => {
    const name = window.prompt('Category name');
    if (!name?.trim()) return;

    try {
      const response = await api.post('/categories', { name: name.trim() });
      const category = response.data.category;
      setCategories((current) =>
        [...current, category].sort((a, b) => a.name.localeCompare(b.name))
      );
      openCategory(category._id);
    } catch (error) {
      window.alert(error.response?.data?.error || 'Could not create category.');
    }
  };

  const renameCategory = async (event, category) => {
    event.stopPropagation();
    const name = window.prompt('Rename category', category.name);
    if (!name?.trim() || name.trim() === category.name) return;

    try {
      const response = await api.patch(`/categories/${category._id}`, {
        name: name.trim(),
      });
      setCategories((current) =>
        current.map((item) =>
          item._id === category._id ? response.data.category : item
        )
      );
    } catch (error) {
      window.alert(error.response?.data?.error || 'Could not rename category.');
    }
  };

  const deleteCategory = async (event, category) => {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${category.name}"? Its notes will remain in Uncategorized.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/categories/${category._id}`);
      setCategories((current) =>
        current.filter((item) => item._id !== category._id)
      );
      setNotes((current) =>
        current.map((note) =>
          getNoteCategoryId(note) === category._id
            ? { ...note, categoryId: null }
            : note
        )
      );
      if (selectedCategoryId === category._id) backToCategories();
    } catch (error) {
      window.alert(error.response?.data?.error || 'Could not delete category.');
    }
  };

  const createNote = async () => {
    if (!selectedCategoryId) return;
    setCreating(true);

    try {
      const categoryId = isUncategorized ? null : selectedCategoryId;
      const response = await api.post('/notes', { categoryId });
      const note = response.data.note;
      navigate(
        `/notes/${note._id}?category=${encodeURIComponent(selectedCategoryId)}`
      );
    } catch (error) {
      console.error('Failed to create note:', error);
      window.alert(error.response?.data?.error || 'Could not create note.');
      setCreating(false);
    }
  };

  const openNote = (note) => {
    navigate(
      `/notes/${note._id}?category=${encodeURIComponent(selectedCategoryId)}`
    );
  };

  const fmtCount = (count) => `${count} ${count === 1 ? 'note' : 'notes'}`;

  return (
    <div className={`notes-list-page ${dark ? 'dark' : ''}`}>
      <header className="notes-list-header">
        <div className="notes-list-header-left">
          {selectedCategoryId ? (
            <button className="notes-back-btn" onClick={backToCategories}>
              ← Categories
            </button>
          ) : (
            <button className="notes-back-btn" onClick={() => navigate('/profile')}>
              ← Back
            </button>
          )}
          <div className="notes-heading-copy">
            <h1>{selectedCategoryId ? (isUncategorized ? 'Uncategorized' : selectedCategory?.name || 'Category') : 'My Notes'}</h1>
            <span>
              {selectedCategoryId
                ? fmtCount(visibleNotes.length)
                : `${categories.length + 1} categories · ${fmtCount(notes.length)}`}
            </span>
          </div>
        </div>

        <div className="notes-header-right">
          <button
            className="note-theme-btn"
            onClick={toggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          {selectedCategoryId ? (
            <button className="notes-new-btn" onClick={createNote} disabled={creating}>
              {creating ? 'Creating…' : '+ New Note'}
            </button>
          ) : (
            <button className="notes-new-btn" onClick={createCategory}>
              + New Category
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="notes-loading">
          <img src="/animation.gif" alt="Loading" />
        </div>
      ) : !selectedCategoryId ? (
        <main className="notes-workspace">
          <div className="notes-section-heading">
            <div>
              <h2>Categories</h2>
              <p>Choose a category to see its notes.</p>
            </div>
          </div>

          <div className="notes-category-grid">
            {categories.map((category) => (
              <article
                key={category._id}
                className="notes-category-card"
                onClick={() => openCategory(category._id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openCategory(category._id);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="notes-category-icon" aria-hidden="true">📁</div>
                <div className="notes-category-copy">
                  <h3>{category.name}</h3>
                  <span>{fmtCount(categoryCounts.get(category._id) || 0)}</span>
                </div>
                <div className="notes-category-actions">
                  <button
                    type="button"
                    title="Rename category"
                    aria-label={`Rename ${category.name}`}
                    onClick={(event) => renameCategory(event, category)}
                  >✎</button>
                  <button
                    type="button"
                    title="Delete category"
                    aria-label={`Delete ${category.name}`}
                    onClick={(event) => deleteCategory(event, category)}
                  >⋯</button>
                </div>
              </article>
            ))}

            <article
              className="notes-category-card notes-uncategorized-card"
              onClick={() => openCategory(UNCATEGORIZED_ID)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') openCategory(UNCATEGORIZED_ID);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="notes-category-icon" aria-hidden="true">🗂️</div>
              <div className="notes-category-copy">
                <h3>Uncategorized</h3>
                <span>{fmtCount(categoryCounts.get(UNCATEGORIZED_ID) || 0)}</span>
              </div>
              <span className="notes-category-arrow" aria-hidden="true">→</span>
            </article>
          </div>
        </main>
      ) : (
        <main className="notes-workspace">
          <div className="notes-section-heading notes-notes-heading">
            <div>
              <h2>Notes</h2>
              <p>Open a note to continue writing.</p>
            </div>
            <input
              className="notes-search-input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes…"
              aria-label="Search notes"
            />
          </div>

          {visibleNotes.length === 0 ? (
            <div className="notes-empty">
              <div className="notes-empty-icon">📝</div>
              <h3>{search ? 'No matching notes' : 'No notes in this category'}</h3>
              <p>{search ? 'Try a different search term.' : 'Create your first note in this category.'}</p>
              {!search && (
                <button className="notes-new-btn" onClick={createNote} disabled={creating}>
                  {creating ? 'Creating…' : '+ New Note'}
                </button>
              )}
            </div>
          ) : (
            <div className="notes-grid">
              {visibleNotes.map((note) => (
                <article
                  key={note._id}
                  className="note-card"
                  onClick={() => openNote(note)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') openNote(note);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="note-card-top">
                    <h3 className="note-card-title">{note.title || 'Untitled'}</h3>
                    <button
                      type="button"
                      className="note-card-delete"
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (!window.confirm('Delete this note?')) return;
                        try {
                          await api.delete(`/notes/${note._id}`);
                          setNotes((current) => current.filter((item) => item._id !== note._id));
                        } catch (error) {
                          window.alert(error.response?.data?.error || 'Could not delete note.');
                        }
                      }}
                      title="Delete note"
                      aria-label={`Delete ${note.title || 'Untitled'}`}
                    >🗑</button>
                  </div>
                  {note.summary && <p className="note-card-summary">{note.summary}</p>}
                  <span className="note-card-date">{formatDate(note.updatedAt)}</span>
                </article>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default NotesPage;
