import { useEffect, useState } from 'react';
import { Edit2 } from 'lucide-react';
import './Banner.css';

const Banner = () => {
  const defaultBanner = {
    title: '🏠 Ghar ki Chugli',
    description: 'Papa remote lekar phir gayab 🚨',
    image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg',
    bg: '#1c1c1c',
    textColor: '#ffffff',
    layout: 'both',
  };

  const [showModal, setShowModal] = useState(false);
  const [banner, setBanner] = useState(defaultBanner);
  const [form, setForm] = useState(defaultBanner);

  useEffect(() => {
    const saved = localStorage.getItem('familyBanner');
    if (saved) {
      const data = JSON.parse(saved);
      setBanner(data);
      setForm(data);
    }
  }, []);

  const save = () => {
    setBanner(form);
    localStorage.setItem('familyBanner', JSON.stringify(form));
    setShowModal(false);
  };

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <div
        style={{ background: banner.bg }}
        className="banner-container"
      >
        {banner.layout === 'text' && (
          <div style={{ color: banner.textColor }} className="banner-text-only">
            <h1 className="banner-title">{banner.title}</h1>
            <p className="banner-description">{banner.description}</p>
          </div>
        )}

        {banner.layout === 'image' && (
          <div className="banner-image-only">
            <img
              src={banner.image}
              alt="banner"
              className="banner-image"
            />
          </div>
        )}

        {banner.layout === 'both' && (
          <div className="banner-both">
            <img
              src={banner.image}
              alt="banner"
              className="banner-image"
            />
            <div
              style={{ color: banner.textColor }}
              className="banner-text-overlay"
            >
              <h1 className="banner-title">{banner.title}</h1>
              <p className="banner-description">{banner.description}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowModal(true)}
          className="banner-edit-btn"
          aria-label="Edit banner"
        >
          <Edit2 size={18} />
        </button>
      </div>

      {showModal && (
        <div className="banner-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="banner-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Edit Banner</h2>

            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Image URL</label>
              <input
                type="text"
                value={form.image}
                onChange={(e) => handleChange('image', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Background Color</label>
              <input
                type="color"
                value={form.bg}
                onChange={(e) => handleChange('bg', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Text Color</label>
              <input
                type="color"
                value={form.textColor}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Layout</label>
              <select
                value={form.layout}
                onChange={(e) => handleChange('layout', e.target.value)}
                className="form-input"
              >
                <option value="text">Text Only</option>
                <option value="image">Image Only</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="modal-actions">
              <button onClick={save} className="btn-save">
                Save
              </button>
              <button onClick={() => setShowModal(false)} className="btn-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Banner;
