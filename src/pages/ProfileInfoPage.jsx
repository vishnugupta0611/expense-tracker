import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import api from '@services/api';
import FamilyPostList from '../family-link/components/Post';
import './ProfileInfoPage.css';


const frameOptions = [
  { value: 'square', label: 'Square', helper: 'Best for old photos' },
  { value: 'portrait', label: 'Portrait', helper: 'Best for phone photos' },
  { value: 'fit', label: 'Fit', helper: 'Show full image' },
];




const ProfileInfoPage = () => {
  const { user, login } = useAuth();
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [caption, setCaption] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [frameType, setFrameType] = useState('square');
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [memberUsername, setMemberUsername] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Keep local avatar in sync with user context
  useEffect(() => {
    if (user?.avatar) setAvatarUrl(user.avatar);
  }, [user?.avatar]);

  const displayName = user?.name || 'Vishnu Gupta';
  const avatar = avatarUrl || user?.avatar || `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(user?.name || 'user')}`;

  const openPicker = () => fileInputRef.current?.click();

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(res.data.avatar);
      // Update user in AuthContext so the new avatar persists across pages and refreshes
      const token = localStorage.getItem('token');
      login(token, res.data.user);
    } catch (err) {
      alert('Failed to upload avatar: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    let cancelled = false;

    setIsPostsLoading(true);

    api.get('/family-posts/getownposts')
      .then((response) => {
        if (!cancelled) setPosts(response.data.posts || []);
      })
      .catch((error) => {
        console.error('Failed to fetch own posts:', error.response?.data?.error || error.message);
      })
      .finally(() => {
        if (!cancelled) setIsPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!user?.familyKey) {
      setIsMembersLoading(false);
      return;
    }

    setIsMembersLoading(true);

    api.get(`/family/${user.familyKey}/members`)
      .then((response) => {
        if (!cancelled) setMembers(response.data.members || []);
      })
      .catch((error) => {
        console.error('Failed to fetch family members:', error.response?.data?.error || error.message);
        setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setIsMembersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.familyKey]);

  // Fetch username suggestions
  useEffect(() => {
    if (!memberUsername.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`/users/search?query=${encodeURIComponent(memberUsername)}`);
        setSuggestions(response.data.usernames || []);
        console.log(response.data.usernames[0]?.email)
        setShowSuggestions(true);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      }
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [memberUsername]);

  const changeFrameType = (nextFrameType) => {
    setFrameType(nextFrameType);
    setSelectedFiles((prev) =>
      prev.map((item) => ({
        ...item,
        frameType: nextFrameType,
      }))
    );
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(
      files.map((file, index) => ({
        id: `${file.name}-${Date.now()}-${index}`,
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        frameType,
      }))
    );
    event.target.value = '';
  };

  const addPost = async () => {
    if (isPosting || selectedFiles.length === 0) return;

    const formData = new FormData();
    formData.append('text', caption.trim() || 'New family post');
    formData.append('familyKey', user?.familyKey);
    formData.append('frameType', frameType);
    formData.append('frametype', frameType);
    selectedFiles.forEach((item) => {
      formData.append('image', item.file);
    });

    setIsPosting(true);

    try {
      const response = await api.post('/family-posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPosts((prev) => [response.data.post, ...prev]);
      setCaption('');
      setSelectedFiles([]);
    } catch (error) {
      alert(`Post failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await api.delete(`/family-posts/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (error) {
      alert(`Delete failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleAddMember = async () => {
    if (!memberUsername.trim() || !user?.familyKey) return;

    setIsAddingMember(true);
    try {
      //instead of username i wanna give email to add member because email is unique but username is not unique
      await api.post(`/family/${user.familyKey}/add-person`, { username: suggestions[0]?.email });
      setMemberUsername('');
      setShowAddMemberForm(false);
      setSuggestions([]);
      setShowSuggestions(false);
      // Refresh members list
      const response = await api.get(`/family/${user.familyKey}/members`);
      setMembers(response.data.members || []);
      alert('Family member added successfully!');
    } catch (error) {
      alert(`Failed to add member: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    setMemberUsername(suggestion.name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="profile-info-page">
      <div className="profile-info-container">
        <div className="profile-info-header">
          <Link to="/family" className="profile-info-back">Back to Family</Link>
          <button type="button" className="profile-info-chip">Family-only</button>
        </div>

        <section className="profile-card">
          <div className="profile-avatar-wrap" onClick={() => avatarInputRef.current?.click()} title="Change profile photo">
            <img src={avatar} alt={displayName} className="profile-avatar" />
            <div className="avatar-upload-badge">
              {isUploadingAvatar ? '⏳' : '📷'}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarUpload}
          />
          <h1 className="profile-name">{displayName}</h1>
          <p className="profile-bio">Family Admin - Family Media</p>

          <div className="profile-stats">
            <div className="stat-box">
              <strong>{posts.length}</strong>
              <span>Posts</span>
            </div>
            <div className="stat-box">
              <strong>{members.length}</strong>
              <span>Members</span>
            </div>
          </div>

          <div className="composer-card">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Write something for the family..."
              className="composer-input"
            />

            <div className="frame-type-row">
              <span className="frame-type-label">Photo shape</span>
              <div className="frame-type-group">
                {frameOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`frame-chip ${frameType === option.value ? 'active' : ''}`}
                    onClick={() => changeFrameType(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="composer-actions">
              <button type="button" className="upload-btn" onClick={openPicker}>Add Photos / Video</button>
              <button type="button" className="post-btn" onClick={addPost} disabled={isPosting || selectedFiles.length === 0}>
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              hidden
              onChange={handleFileChange}
            />

            {selectedFiles.length > 0 && (
              <div className="preview-strip">
                {selectedFiles.map((item) => (
                  <div key={item.id} className="preview-card">
                    {item.type === 'video' ? (
                      <video className={`upload-preview-media ${item.frameType || frameType}`} src={item.url} controls />
                    ) : (
                      <img className={`upload-preview-media ${item.frameType || frameType}`} src={item.url} alt={item.file.name} />
                    )}
                    <span className="preview-label">{item.file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="section-block">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="section-title">Family Members</h2>
            <button
              type="button"
              onClick={() => setShowAddMemberForm(!showAddMemberForm)}
              style={{
                background: '#fff',
                color: '#000',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
              }}
            >

              {showAddMemberForm ? 'Cancel' : '+ Add Member'}
            </button>
          </div>

          {showAddMemberForm && (
            <div
              style={{
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    value={memberUsername}
                    onChange={(e) => setMemberUsername(e.target.value)}
                    onFocus={() => memberUsername.trim() && setShowSuggestions(true)}
                    placeholder="Enter username to add..."
                    style={{
                      width: '100%',
                      background: '#090909',
                      border: '1px solid #2a2a2a',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      color: '#fff',
                      outline: 'none',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />

                  {/* Suggestions Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#090909',
                        border: '1px solid #2a2a2a',
                        borderTop: 'none',
                        borderRadius: '0 0 6px 6px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10,
                      }}
                    >
                      {suggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => handleSelectSuggestion(suggestion)}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: index < suggestions.length - 1 ? '1px solid #2a2a2a' : 'none',
                            color: '#fff',
                            fontSize: '14px',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#090909')}
                        >
                          <div style={{ fontWeight: '500' }}>{suggestion.name}</div>
                          <div style={{ fontSize: '12px', color: '#999' }}>{suggestion.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* ↑ closes inner div (flex: 1) */}

                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={isAddingMember || !memberUsername.trim()}
                  style={{
                    background: '#fff',
                    color: '#000',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    cursor: isAddingMember ? 'wait' : 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    opacity: isAddingMember || !memberUsername.trim() ? 0.6 : 1,
                  }}
                >
                  {isAddingMember ? 'Adding...' : 'Add'}
                </button>
              </div>
              {/* ↑ closes outer flex div (display: flex, gap: 8px) — THIS WAS THE MISSING TAG */}
            </div>
          )}

          {isMembersLoading ? (
            <p style={{ color: '#999' }}>Loading members...</p>
          ) : members.length > 0 ? (
            <div className="members-row">
              {members.map((member) => (
                <div key={member._id} className="member-pill">
                  <img
                    src={
                      member.avatar ||
                      `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(member.name)}`
                    }
                    alt={member.name}
                  />
                  <span>{member.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#999' }}>No family members yet.</p>
          )}
        </section>

        <section className="section-block">
          <h2 className="section-title">Your Posts</h2>
          <FamilyPostList
            posts={posts}
            onPostsChange={setPosts}
            onDeletePost={handleDeletePost}
            currentUser={{ id: user?._id || user?.id, name: displayName, avatar }}
            isLoading={isPostsLoading}
            isLoadingMore={isPosting}
            emptyMessage="No family posts yet."
          />
        </section>
      </div>
    </div>
  );
};

export default ProfileInfoPage;