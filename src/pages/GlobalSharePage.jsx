import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Check, Copy, ExternalLink, ArrowLeft, FileText, Image, Film, Music, AlertCircle } from 'lucide-react';
import api from '@services/api';
import './GlobalSharePage.css';

const GlobalSharePage = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }
  const [filesList, setFilesList] = useState([]);
  const [botStatus, setBotStatus] = useState(null);

  useEffect(() => {
    // Check bot connection status
    api.get('/telegram-bot/status')
      .then(res => setBotStatus(res.data))
      .catch(() => setBotStatus({ ok: false }));

    // Fetch previous uploaded files
    api.get('/telegram-bot/files')
      .then(res => setFilesList(res.data.files || []))
      .catch(() => {});
  }, []);

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setUploading(true);
    setFeedback(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await api.post('/telegram-bot/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success && res.data.files) {
        setFilesList(prev => [...res.data.files, ...prev]);
        setFeedback({
          type: 'success',
          message: `Successfully uploaded ${res.data.files.length} file${res.data.files.length > 1 ? 's' : ''} to Telegram!`,
        });
      } else {
        throw new Error(res.data.error || 'Upload failed');
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Error uploading to Telegram';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleUpload(event.dataTransfer.files);
  };

  const handleBrowse = (event) => {
    handleUpload(event.target.files);
    event.target.value = '';
  };

  const copyToClipboard = (url, id) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (mimeType, name) => {
    if (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return <Image size={18} />;
    if (mimeType?.startsWith('video/') || /\.(mp4|mkv|mov|webm)$/i.test(name)) return <Film size={18} />;
    if (mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg)$/i.test(name)) return <Music size={18} />;
    return <FileText size={18} />;
  };

  return (
    <main className="global-share-page">
      <section className="global-share-panel">
        <div className="global-share-top-nav">
          <button className="global-back-btn" onClick={() => navigate('/profile')}>
            <ArrowLeft size={16} /> Back
          </button>
          {botStatus?.ok && (
            <span className="global-bot-status-badge">
              🟢 {botStatus.channel?.title || 'Telegram Connected'}
            </span>
          )}
        </div>

        <div className="global-share-heading">
          <span className="global-share-kicker">Cloud Storage</span>
          <h1>Global Share with Telegram</h1>
          <p className="global-share-subtitle">
            Upload images, documents, videos or any files directly to your private Telegram storage channel.
          </p>
        </div>

        {feedback && (
          <div className={`global-feedback-banner ${feedback.type}`}>
            {feedback.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <button
          type="button"
          disabled={uploading}
          className={`global-dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="global-upload-spinner-wrap">
              <div className="global-spinner" />
              <span className="global-drop-title">Uploading to Telegram...</span>
              <span className="global-drop-copy">Please wait a moment</span>
            </div>
          ) : (
            <>
              <UploadCloud size={44} strokeWidth={1.8} />
              <span className="global-drop-title">Drop file here</span>
              <span className="global-drop-copy">or browse from your device (Images, PDFs, Videos, Docs)</span>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          className="global-file-input"
          type="file"
          multiple
          onChange={handleBrowse}
        />

        {filesList.length > 0 && (
          <div className="global-files-section">
            <div className="global-files-header">
              <h2>Recent Uploads ({filesList.length})</h2>
              {botStatus?.channel?.inviteLink && (
                <a
                  href={botStatus.channel.inviteLink}
                  target="_blank"
                  rel="noreferrer"
                  className="global-channel-link"
                >
                  Open Channel ↗
                </a>
              )}
            </div>

            <div className="global-files-list">
              {filesList.map((f, idx) => (
                <div key={f.fileId || idx} className="global-file-item">
                  <div className="global-file-icon">
                    {getFileIcon(f.mimeType, f.fileName)}
                  </div>
                  <div className="global-file-details">
                    <span className="global-file-name" title={f.fileName}>{f.fileName}</span>
                    <span className="global-file-meta">{formatSize(f.fileSize)}</span>
                  </div>
                  <div className="global-file-actions">
                    {f.url && (
                      <button
                        className="global-action-btn"
                        title="Copy direct file URL"
                        onClick={() => copyToClipboard(f.url, f.fileId || idx)}
                      >
                        {copiedId === (f.fileId || idx) ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                    )}
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="global-action-btn"
                        title="Open file"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default GlobalSharePage;
