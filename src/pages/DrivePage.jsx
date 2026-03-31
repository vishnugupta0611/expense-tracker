import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import './DrivePage.css';

// ── File type helpers ─────────────────────────────────────────────────────────
const fileIcon = (mimeType) => {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '🗜️';
  return '📄';
};

const fmtSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
});

// ── DrivePage ─────────────────────────────────────────────────────────────────
const DrivePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState(null); // null = root
  const [crumbs, setCrumbs] = useState([]); // breadcrumb
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [shareInput, setShareInput] = useState('');
  const [showRename, setShowRename] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [view, setView] = useState('grid');

  // Lock/password modals
  const [showFolderSettings, setShowFolderSettings] = useState(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [settingsTab, setSettingsTab] = useState('share');             // 'share' | 'lock'
  const [lockPassword, setLockPassword] = useState('');
  const [lockConfirm, setLockConfirm] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [lockMsg, setLockMsg] = useState('');
  // Password prompt when opening a locked folder
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(null); // folder item
  const [promptPassword, setPromptPassword] = useState('');
  const [promptError, setPromptError] = useState('');
  // Track unlocked folders for this session
  const [unlockedFolders, setUnlockedFolders] = useState(new Set());

  const fetchItems = useCallback(async (folderId = null) => {
    setLoading(true);
    try {
      const params = folderId ? `?parentId=${folderId}` : '';
      const r = await api.get(`/drive${params}`);
      setItems(r.data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCrumbs = useCallback(async (folderId) => {
    if (!folderId) { setCrumbs([]); return; }
    try {
      const r = await api.get(`/drive/breadcrumb?id=${folderId}`);
      setCrumbs(r.data.crumbs || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchItems(currentFolder);
    fetchCrumbs(currentFolder);
  }, [currentFolder, fetchItems, fetchCrumbs]);

  // Navigate into folder — check lock first
  const openFolder = (item) => {
    if (item.isLocked && !unlockedFolders.has(item._id)) {
      setPromptPassword('');
      setPromptError('');
      setShowPasswordPrompt(item);
      return;
    }
    setCurrentFolder(item._id);
  };

  // Breadcrumb nav
  const navToCrumb = (id) => setCurrentFolder(id);

  // ── Upload flow ──────────────────────────────────────────────────────────────
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setPendingFiles(files);
    setShowFolderPicker(true);
  };

  const uploadFiles = async (targetFolderId) => {
    setShowFolderPicker(false);
    setUploading(true);
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      setUploadProgress(`Uploading ${i + 1}/${pendingFiles.length}: ${file.name}`);
      try {
        const base64 = await toBase64(file);
        const r = await api.post('/drive/upload', {
          base64,
          mimeType: file.type || 'application/octet-stream',
          name: file.name,
          parentId: targetFolderId || null,
          size: file.size,
        });
        if (!targetFolderId || targetFolderId === currentFolder) {
          setItems(prev => [r.data.item, ...prev]);
        }
      } catch (err) {
        console.error('Upload failed:', file.name, err);
        alert(`Failed to upload ${file.name}`);
      }
    }
    setPendingFiles([]);
    setUploading(false);
    setUploadProgress('');
    fetchItems(currentFolder);
  };

  const toBase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  // ── Create folder ────────────────────────────────────────────────────────────
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const r = await api.post('/drive/folder', { name: newFolderName, parentId: currentFolder });
      setItems(prev => [r.data.item, ...prev]);
      setNewFolderName('');
      setShowNewFolder(false);
    } catch { alert('Failed to create folder'); }
  };

  // ── Rename ───────────────────────────────────────────────────────────────────
  const doRename = async () => {
    if (!renameVal.trim() || !showRename) return;
    try {
      await api.patch(`/drive/${showRename._id}/rename`, { name: renameVal });
      setItems(prev => prev.map(i => i._id === showRename._id ? { ...i, name: renameVal } : i));
      setShowRename(null);
    } catch { alert('Rename failed'); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const doDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(`/drive/${item._id}`);
      setItems(prev => prev.filter(i => i._id !== item._id));
    } catch { alert('Delete failed'); }
    setCtxMenu(null);
  };

  // ── Share ────────────────────────────────────────────────────────────────────
  const doShare = async () => {
    if (!shareInput.trim() || !showFolderSettings) return;
    const usernames = shareInput.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await api.post(`/drive/${showFolderSettings._id}/members`, { usernames });
      setShareInput('');
      setLockMsg('Access granted!');
      setTimeout(() => setLockMsg(''), 2000);
    } catch { setLockMsg('Failed to share'); }
  };

  // ── Lock folder ───────────────────────────────────────────────────────────────
  const doLockFolder = async () => {
    if (!lockPassword || lockPassword !== lockConfirm) {
      setLockMsg('Passwords do not match');
      return;
    }
    try {
      await api.post(`/drive/${showFolderSettings._id}/lock`, { password: lockPassword });
      setItems(prev => prev.map(i => i._id === showFolderSettings._id ? { ...i, isLocked: true } : i));
      setLockPassword(''); setLockConfirm('');
      setLockMsg('Folder locked ✓');
      setTimeout(() => { setLockMsg(''); setShowFolderSettings(null); }, 1200);
    } catch { setLockMsg('Failed to lock'); }
  };

  // ── Unlock folder ─────────────────────────────────────────────────────────────
  const doUnlockFolder = async () => {
    try {
      await api.post(`/drive/${showFolderSettings._id}/unlock`, { password: unlockPassword });
      setItems(prev => prev.map(i => i._id === showFolderSettings._id ? { ...i, isLocked: false } : i));
      setUnlockPassword('');
      setLockMsg('Folder unlocked ✓');
      setTimeout(() => { setLockMsg(''); setShowFolderSettings(null); }, 1200);
    } catch (e) {
      setLockMsg(e.response?.data?.error || 'Wrong password');
    }
  };

  // ── Password prompt to open locked folder ─────────────────────────────────────
  const doVerifyAndOpen = async () => {
    try {
      await api.post(`/drive/${showPasswordPrompt._id}/verify`, { password: promptPassword });
      setUnlockedFolders(prev => new Set([...prev, showPasswordPrompt._id]));
      const folderId = showPasswordPrompt._id;
      setShowPasswordPrompt(null);
      setCurrentFolder(folderId);
    } catch {
      setPromptError('Wrong password');
    }
  };

  // ── Context menu ─────────────────────────────────────────────────────────────
  const openCtx = (e, item) => {
    e.preventDefault();
    setCtxMenu({ item, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // ── Folder list for picker ───────────────────────────────────────────────────
  const rootFolders = items.filter(i => i.type === 'folder');

  return (
    <div className="drive-page">
      {/* ── Sidebar ── */}
      <aside className="drive-sidebar">
        <div className="drive-sidebar-logo">📁 My Drive</div>
        <button className="drive-upload-big" onClick={handleUploadClick} disabled={uploading}>
          <span className="drive-upload-plus">+</span>
          <span>{uploading ? uploadProgress || 'Uploading…' : 'Upload'}</span>
        </button>
        <button className="drive-sidebar-btn" onClick={() => setShowNewFolder(true)}>
          🗂 New Folder
        </button>
        <div className="drive-sidebar-divider" />
        <button
          className={`drive-sidebar-nav ${!currentFolder ? 'active' : ''}`}
          onClick={() => setCurrentFolder(null)}
        >🏠 Home</button>
      </aside>

      {/* ── Main ── */}
      <main className="drive-main">
        {/* Header */}
        <header className="drive-header">
          <div className="drive-breadcrumb">
            <button className="crumb" onClick={() => setCurrentFolder(null)}>Home</button>
            {crumbs.map((c, i) => (
              <span key={c._id}>
                <span className="crumb-sep">›</span>
                <button
                  className={`crumb ${i === crumbs.length - 1 ? 'active' : ''}`}
                  onClick={() => navToCrumb(c._id)}
                >{c.name}</button>
              </span>
            ))}
          </div>
          <div className="drive-header-right">
            <button className={`view-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⊞</button>
            <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>☰</button>
            <button className="drive-back-btn" onClick={() => navigate('/profile')}>← Back</button>
          </div>
        </header>

        {/* Upload progress bar */}
        {uploading && (
          <div className="drive-upload-bar">
            <div className="drive-upload-bar-inner" />
            <span>{uploadProgress}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="drive-loading"><div className="spinner" /></div>
        ) : items.length === 0 ? (
          <div className="drive-empty">
            <span>📂</span>
            <h3>This folder is empty</h3>
            <p>Upload files or create a folder to get started.</p>
            <button className="drive-upload-big-empty" onClick={handleUploadClick}>+ Upload Files</button>
          </div>
        ) : view === 'grid' ? (
          <div className="drive-grid">
            {items.map(item => (
              <div
                key={item._id}
                className={`drive-item ${item.type}`}
                onDoubleClick={() => item.type === 'folder' ? openFolder(item) : window.open(item.url, '_blank')}
                onContextMenu={(e) => openCtx(e, item)}
              >
                {/* Image file — full thumbnail, no overlay */}
                {item.type === 'file' && item.mimeType?.startsWith('image/') ? (
                  <>
                    <div className="drive-img-card">
                      <img src={item.url} alt={item.name} className="drive-thumb-full" />
                      <button
                        className="drive-copy-btn"
                        title="Copy link"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.url);
                        }}
                      >⎘</button>
                    </div>
                    <div className="drive-item-name" title={item.name}>{item.name}</div>
                    <div className="drive-item-meta">{fmtSize(item.size)}</div>
                  </>
                ) : item.type === 'file' ? (
                  /* Non-image file */
                  <>
                    <div className="drive-file-card">
                      <span className="drive-file-icon">{fileIcon(item.mimeType)}</span>
                      <button
                        className="drive-copy-btn"
                        title="Copy link"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.url);
                        }}
                      >⎘</button>
                    </div>
                    <div className="drive-item-name" title={item.name}>{item.name}</div>
                    <div className="drive-item-meta">{fmtSize(item.size)}</div>
                  </>
                ) : (
                  /* Folder */
                  <>
                    <div className="drive-folder-card">
                      <span className="drive-folder-emoji">📁</span>
                      {item.isLocked && <span className="folder-lock-dot">🔐</span>}
                    </div>
                    <div className="drive-item-name" title={item.name}>{item.name}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="drive-list">
            <div className="drive-list-header">
              <span>Name</span><span>Size</span><span>Modified</span>
            </div>
            {items.map(item => (
              <div
                key={item._id}
                className="drive-list-row"
                onDoubleClick={() => item.type === 'folder' ? openFolder(item) : window.open(item.url, '_blank')}
                onContextMenu={(e) => openCtx(e, item)}
              >
                <span className="dlr-name">
                  <span>
                    {item.type === 'folder' ? '' : fileIcon(item.mimeType)}
                    {item.type === 'folder' && item.isLocked && ' 🔐'}
                  </span>
                  {item.name}
                </span>
                <span className="dlr-size">{fmtSize(item.size)}</span>
                <span className="dlr-date">{fmtDate(item.updatedAt || item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div className="drive-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          {ctxMenu.item.type === 'file' && (
            <button onClick={() => { window.open(ctxMenu.item.url, '_blank'); setCtxMenu(null); }}>
              🔗 Open / Copy Link
            </button>
          )}
          {ctxMenu.item.type === 'folder' && (
            <button onClick={() => { openFolder(ctxMenu.item); setCtxMenu(null); }}>📂 Open</button>
          )}
          <button onClick={() => { setShowRename(ctxMenu.item); setRenameVal(ctxMenu.item.name); setCtxMenu(null); }}>
            ✏️ Rename
          </button>
          <button onClick={() => {
            setShowFolderSettings(ctxMenu.item);
            setSettingsTab('share');
            setShareInput(''); setLockMsg('');
            setCtxMenu(null);
          }}>
            ⚙️ Settings
          </button>
          <button className="ctx-delete" onClick={() => doDelete(ctxMenu.item)}>🗑 Delete</button>
        </div>
      )}

      {/* ── New Folder modal ── */}
      {showNewFolder && (
        <div className="drive-modal-overlay" onClick={() => setShowNewFolder(false)}>
          <div className="drive-modal" onClick={e => e.stopPropagation()}>
            <h3>New Folder</h3>
            <input
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              onKeyDown={e => e.key === 'Enter' && createFolder()}
            />
            <div className="drive-modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowNewFolder(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Folder picker on upload ── */}
      {showFolderPicker && (
        <div className="drive-modal-overlay" onClick={() => setShowFolderPicker(false)}>
          <div className="drive-modal" onClick={e => e.stopPropagation()}>
            <h3>Upload {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''} to…</h3>
            <div className="folder-picker-list">
              <button className="folder-pick-item" onClick={() => uploadFiles(currentFolder)}>
                📂 {crumbs.length ? crumbs[crumbs.length - 1]?.name : 'Home (root)'}
                <span className="fp-current">current</span>
              </button>
              {rootFolders.map(f => (
                <button key={f._id} className="folder-pick-item" onClick={() => uploadFiles(f._id)}>
                  📁 {f.name}
                </button>
              ))}
            </div>
            <div className="drive-modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowFolderPicker(false); setPendingFiles([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename modal ── */}
      {showRename && (
        <div className="drive-modal-overlay" onClick={() => setShowRename(null)}>
          <div className="drive-modal" onClick={e => e.stopPropagation()}>
            <h3>Rename</h3>
            <input
              autoFocus
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doRename()}
            />
            <div className="drive-modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRename(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doRename}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Folder Settings modal (Share + Lock tabs) ── */}
      {showFolderSettings && (
        <div className="drive-modal-overlay" onClick={() => setShowFolderSettings(null)}>
          <div className="drive-modal drive-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="drive-modal-title-row">
              <h3>⚙️ {showFolderSettings.name}</h3>
              <button className="drive-modal-close" onClick={() => setShowFolderSettings(null)}>✕</button>
            </div>
            <div className="drive-settings-tabs">
              <button className={settingsTab === 'share' ? 'active' : ''} onClick={() => { setSettingsTab('share'); setLockMsg(''); }}>
                👥 Share
              </button>
              <button className={settingsTab === 'lock' ? 'active' : ''} onClick={() => { setSettingsTab('lock'); setLockMsg(''); }}>
                {showFolderSettings.isLocked ? '� Locked' : 'Lock'}
              </button>
            </div>

            {settingsTab === 'share' && (
              <div className="drive-settings-body">
                <p className="drive-modal-hint">Add usernames (comma-separated). They'll see this folder in their Drive.</p>
                <input
                  autoFocus
                  value={shareInput}
                  onChange={e => setShareInput(e.target.value)}
                  placeholder="username1, username2"
                  onKeyDown={e => e.key === 'Enter' && doShare()}
                />
                {lockMsg && <p className="drive-lock-msg">{lockMsg}</p>}
                <div className="drive-modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowFolderSettings(null)}>Close</button>
                  <button className="btn btn-primary" onClick={doShare}>Share</button>
                </div>
              </div>
            )}

            {settingsTab === 'lock' && (
              <div className="drive-settings-body">
                {showFolderSettings.isLocked ? (
                  <>
                    <p className="drive-modal-hint">This folder is locked. Enter the current password to remove the lock.</p>
                    <input
                      type="password"
                      autoFocus
                      value={unlockPassword}
                      onChange={e => setUnlockPassword(e.target.value)}
                      placeholder="Current password"
                      onKeyDown={e => e.key === 'Enter' && doUnlockFolder()}
                    />
                    {lockMsg && <p className="drive-lock-msg">{lockMsg}</p>}
                    <div className="drive-modal-actions">
                      <button className="btn btn-secondary" onClick={() => setShowFolderSettings(null)}>Cancel</button>
                      <button className="btn btn-primary" onClick={doUnlockFolder}>Remove Lock</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="drive-modal-hint">Set a password to lock this folder. Anyone opening it will need to enter the password.</p>
                    <input
                      type="password"
                      autoFocus
                      value={lockPassword}
                      onChange={e => setLockPassword(e.target.value)}
                      placeholder="New password"
                    />
                    <input
                      type="password"
                      value={lockConfirm}
                      onChange={e => setLockConfirm(e.target.value)}
                      placeholder="Confirm password"
                      onKeyDown={e => e.key === 'Enter' && doLockFolder()}
                      style={{ marginTop: '0.5rem' }}
                    />
                    {lockMsg && <p className="drive-lock-msg">{lockMsg}</p>}
                    <div className="drive-modal-actions">
                      <button className="btn btn-secondary" onClick={() => setShowFolderSettings(null)}>Cancel</button>
                      <button className="btn btn-primary" onClick={doLockFolder}>Lock Folder</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Password prompt to open locked folder ── */}
      {showPasswordPrompt && (
        <div className="drive-modal-overlay" onClick={() => setShowPasswordPrompt(null)}>
          <div className="drive-modal" onClick={e => e.stopPropagation()}>
            <div className="drive-lock-icon">�</div>
            <h3>"{showPasswordPrompt.name}" is locked</h3>
            <p className="drive-modal-hint">Enter the password to open this folder.</p>
            <input
              type="password"
              autoFocus
              value={promptPassword}
              onChange={e => { setPromptPassword(e.target.value); setPromptError(''); }}
              placeholder="Password"
              onKeyDown={e => e.key === 'Enter' && doVerifyAndOpen()}
            />
            {promptError && <p className="drive-lock-msg error">{promptError}</p>}
            <div className="drive-modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowPasswordPrompt(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doVerifyAndOpen}>Open</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile FAB ── */}
      <button
        className="drive-fab"
        onClick={() => setShowMobileActions(true)}
        disabled={uploading}
        title="Upload or create folder"
      >
        {uploading ? '…' : '+'}
      </button>

      {/* ── Mobile action sheet ── */}
      {showMobileActions && (
        <div className="drive-sheet-overlay" onClick={() => setShowMobileActions(false)}>
          <div className="drive-action-sheet" onClick={e => e.stopPropagation()}>
            <div className="drive-sheet-handle" />
            <button className="drive-sheet-btn" onClick={() => {
              setShowMobileActions(false);
              handleUploadClick();
            }}>
              <span className="sheet-btn-icon">⬆</span>
              <div>
                <div className="sheet-btn-label">Upload Files</div>
                <div className="sheet-btn-sub">Images, videos, docs, any file</div>
              </div>
            </button>
            <button className="drive-sheet-btn" onClick={() => {
              setShowMobileActions(false);
              setShowNewFolder(true);
            }}>
              <span className="sheet-btn-icon">📁</span>
              <div>
                <div className="sheet-btn-label">New Folder</div>
                <div className="sheet-btn-sub">Organise your files</div>
              </div>
            </button>
            <button className="drive-sheet-cancel" onClick={() => setShowMobileActions(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFilesSelected} />
    </div>
  );
};

export default DrivePage;
