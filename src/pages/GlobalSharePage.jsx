import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import './GlobalSharePage.css';

const GlobalSharePage = () => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const printFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const uploafile=async () => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      try {
        const response = await fetch('http://localhost:5000/api/telegram-bot/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Upload successful:', result);
      } catch (error) {
        console.error('Error uploading files:', error);
      }
    }
      uploafile();


    console.log('Global Share with Telegram files:', files);
    files.forEach((file) => {
      console.log({
        name: file.name,
        type: file.type || 'unknown',
        size: file.size,
        lastModified: file.lastModified,
      });
    });
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    printFiles(event.dataTransfer.files);
  };

  const handleBrowse = (event) => {
    printFiles(event.target.files);
   

    event.target.value = '';
  };

  return (
    <main className="global-share-page">
      <section className="global-share-panel">
        <div className="global-share-heading">
          <span className="global-share-kicker">Profile tool</span>
          <h1>Global Share with Telegram</h1>
        </div>

        <button
          type="button"
          className={`global-dropzone ${isDragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <UploadCloud size={40} strokeWidth={1.8} />
          <span className="global-drop-title">Drop file here</span>
          <span className="global-drop-copy">or browse from your device</span>
        </button>

        <input
          ref={inputRef}
          className="global-file-input"
          type="file"
          multiple
          onChange={handleBrowse}
        />
      </section>
    </main>
  );
};

export default GlobalSharePage;
