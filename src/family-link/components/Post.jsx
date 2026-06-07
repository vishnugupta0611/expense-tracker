import { useState } from 'react';
import { Heart, MessageCircle, Send, MoreVertical, Trash2 } from 'lucide-react';
import api from '@services/api';
import './Post.css';

const defaultPosts = [
  {
    id: 1,
    username: 'family_diary',
    caption: 'Cousins reunion after ages',
    location: 'Agra',
    createdAt: '2026-05-15T07:00:00Z',
    media: [
      {
        type: 'image',
        url: 'https://images.pexels.com/photos/935985/pexels-photo-935985.jpeg',
        frameType: 'portrait',
      },
    ],
    likes: [{ userId: 'user_101' }, { userId: 'user_125' }],
    comments: [
      {
        id: 'comment_13',
        userId: 'user_213',
        text: 'Everyone looks happy',
        createdAt: '2026-05-15T09:00:00Z',
      },
    ],
  },
  {
    id: 2,
    username: 'night_vibes',
    caption: 'Movie night setup complete',
    location: 'Prayagraj',
    createdAt: '2026-05-16T05:00:00Z',
    media: [
      {
        type: 'image',
        url: 'https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg',
        frameType: 'square',
      },
    ],
    likes: [{ userId: 'user_121' }, { userId: 'user_122' }, { userId: 'user_123' }],
    comments: [
      {
        id: 'comment_11',
        userId: 'user_211',
        text: 'Bring snacks',
        createdAt: '2026-05-16T08:20:00Z',
      },
    ],
  },
];

const fallbackUser = {
  id: 'user_101',
  name: 'Vishnu Gupta',
  avatar: 'https://api.dicebear.com/9.x/lorelei/svg?seed=Vishnu',
};

const getPostId = (post) => post._id || post.id;

const getUserId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getMedia = (post) => {
  const frameType = post.frameType || post.frametype || 'square';

  if (Array.isArray(post.media) && post.media.length > 0) return post.media;

  if (Array.isArray(post.image) && post.image.length > 0) {
    return post.image.map((url) => ({
      type: url.includes('/video/upload/') || url.endsWith('.mp4') ? 'video' : 'image',
      url,
      frameType,
    }));
  }

  if (post.image && typeof post.image === 'string') {
    return [{ type: 'image', url: post.image, frameType }];
  }

  return [];
};

const formatTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';

  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  return `${Math.floor(days / 7)}w ago`;
};

const PostSkeleton = () => (
  <article className="family-post-card family-post-skeleton" aria-hidden="true">
    <div className="family-post-header">
      <span className="skeleton-avatar" />
      <div className="skeleton-lines">
        <span />
        <span />
      </div>
    </div>
    <span className="skeleton-media" />
    <div className="skeleton-actions">
      <span />
      <span />
    </div>
    <span className="skeleton-caption" />
  </article>
);

const FamilyPostList = ({
  posts,
  onPostsChange,
  onDeletePost,
  currentUser = fallbackUser,
  emptyMessage = 'No posts yet.',
  isLoading = false,
  isLoadingMore = false,
  skeletonCount = 3,
}) => {
  const [localPosts, setLocalPosts] = useState(defaultPosts);
  const [commentText, setCommentText] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [activeSlides, setActiveSlides] = useState({});
  const [pendingLikes, setPendingLikes] = useState({});
  const [pendingComments, setPendingComments] = useState({});
  const [openMenus, setOpenMenus] = useState({});
  const [likeAnimate, setLikeAnimate] = useState({});

  const postItems = posts || localPosts;
  const updatePosts = onPostsChange || setLocalPosts;
  const user = {
    id: currentUser._id || currentUser.id || fallbackUser.id,
    name: currentUser.name || fallbackUser.name,
    avatar: currentUser.avatar || fallbackUser.avatar,
  };

  const updatePost = (postId, updater) => {
    updatePosts((prev) => prev.map((post) => (getPostId(post) === postId ? updater(post) : post)));
  };

  const toggleLike = async (post) => {
    const postId = getPostId(post);
    if (!postId || pendingLikes[postId]) return;

    const likes = post.likes || [];
    const liked = likes.some((like) => getUserId(like.userId) === user.id);

    // Trigger pop animation
    setLikeAnimate((prev) => ({ ...prev, [postId]: true }));
    setTimeout(() => setLikeAnimate((prev) => ({ ...prev, [postId]: false })), 400);

    updatePost(postId, (item) => ({
      ...item,
      likes: liked
        ? (item.likes || []).filter((like) => getUserId(like.userId) !== user.id)
        : [...(item.likes || []), { userId: user.id }],
    }));

    if (!post._id) return;

    setPendingLikes((prev) => ({ ...prev, [postId]: true }));

    try {
      const response = await api.patch(`/family-posts/${postId}/fluctuate-like`);
      updatePost(postId, (item) => ({
        ...item,
        likes: response.data.likes || item.likes,
      }));
    } catch (error) {
      updatePost(postId, (item) => ({ ...item, likes }));
      console.error('Failed to update like:', error.response?.data?.error || error.message);
    } finally {
      setPendingLikes((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const addComment = async (post) => {
    const postId = getPostId(post);
    const text = commentText[postId]?.trim();
    if (!postId || !text || pendingComments[postId]) return;

    // Optimistic: show comment immediately
    const optimisticComment = {
      commentId: `optimistic-${Date.now()}`,
      userId: { name: user.name, avatar: user.avatar, _id: user.id },
      text,
      createdAt: new Date().toISOString(),
      _optimistic: true,
    };

    updatePost(postId, (item) => ({
      ...item,
      comments: [...(item.comments || []), optimisticComment],
    }));
    setCommentText((prev) => ({ ...prev, [postId]: '' }));

    if (!post._id) return;

    setPendingComments((prev) => ({ ...prev, [postId]: true }));

    try {
      const response = await api.post(`/family-posts/${postId}/comments`, { text });
      // Replace optimistic comment with real data from server
      updatePost(postId, (item) => ({
        ...item,
        comments: response.data.comments || item.comments.filter((c) => !c._optimistic),
      }));
    } catch (error) {
      // Rollback optimistic comment on failure
      updatePost(postId, (item) => ({
        ...item,
        comments: (item.comments || []).filter((c) => c.commentId !== optimisticComment.commentId),
      }));
      setCommentText((prev) => ({ ...prev, [postId]: text })); // restore input
      console.error('Failed to add comment:', error.response?.data?.error || error.message);
    } finally {
      setPendingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const moveSlide = (postId, mediaCount, direction) => {
    setActiveSlides((prev) => {
      const current = prev[postId] || 0;
      return {
        ...prev,
        [postId]: (current + direction + mediaCount) % mediaCount,
      };
    });
  };

  const handleDeletePost = async (postId) => {
    if (!onDeletePost) return;
    setOpenMenus((prev) => ({ ...prev, [postId]: false }));
    await onDeletePost(postId);
  };

  if (isLoading && postItems.length === 0) {
    return (
      <div className="family-post-list">
        {Array.from({ length: skeletonCount }, (_, index) => <PostSkeleton key={index} />)}
      </div>
    );
  }

  if (postItems.length === 0) {
    return <p className="family-post-empty">{emptyMessage}</p>;
  }

  return (
    <div className="family-post-list">
      {postItems.map((post) => {
        const postId = getPostId(post);
        const media = getMedia(post);
        const imageMedia = media.filter((item) => item.type !== 'video');
        const videoMedia = media.find((item) => item.type === 'video');
        const activeIndex = activeSlides[postId] || 0;
        const activeImage = imageMedia[activeIndex] || imageMedia[0];
        const activeMedia = videoMedia || activeImage || media[0];
        const frameClass = activeMedia?.frameType || 'square';
        const likes = post.likes || [];
        const comments = post.comments || [];
        const isLiked = likes.some((like) => getUserId(like.userId) === user.id);
        const authorName = post.username || post.authorName || post.userId?.name || user.name;
        const authorAvatar =
          post.avatar || post.authorAvatar || post.userId?.avatar || `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(authorName)}`;

        return (
          <article key={postId} className="family-post-card">
            <div className="family-post-header">
              <img src={authorAvatar} alt={authorName} className="family-post-avatar" />
              <div>
                <h3>{authorName}</h3>
                <p>{post.location ? `${post.location} - ` : ''}{formatTime(post.createdAt)}</p>
              </div>
              {onDeletePost && getUserId(post.userId) === user.id && (
                <div className="family-post-menu">
                  <button
                    type="button"
                    className="family-post-menu-btn"
                    aria-label="Post menu"
                    onClick={() => setOpenMenus((prev) => ({ ...prev, [postId]: !prev[postId] }))}
                  >
                    <MoreVertical size={20} />
                  </button>
                  {openMenus[postId] && (
                    <div className="family-post-dropdown">
                      <button
                        type="button"
                        className="family-post-delete-btn"
                        onClick={() => handleDeletePost(postId)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {media.length > 0 && (
              videoMedia ? (
                <video className={`family-post-media ${frameClass}`} controls src={videoMedia.url} />
              ) : (
                activeImage && (
                  <div className="family-post-slider">
                    <img className={`family-post-media ${frameClass}`} src={activeImage.url} alt={post.caption || post.text || 'Family post'} />
                    {imageMedia.length > 1 && (
                      <>
                        <button type="button" className="family-slider-btn left" onClick={() => moveSlide(postId, imageMedia.length, -1)}>
                          Prev
                        </button>
                        <button type="button" className="family-slider-btn right" onClick={() => moveSlide(postId, imageMedia.length, 1)}>
                          Next
                        </button>
                      </>
                    )}
                  </div>
                )
              )
            )}

            <div className="family-post-actions">
              <button
                type="button"
                className={`${isLiked ? 'liked' : ''} ${likeAnimate[postId] ? 'like-animate' : ''}`}
                aria-label={isLiked ? 'Unlike post' : 'Like post'}
                disabled={Boolean(pendingLikes[postId])}
                onClick={() => toggleLike(post)}
              >
                <Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                aria-label="Comment on post"
                onClick={() => setOpenComments((prev) => ({ ...prev, [postId]: !prev[postId] }))}
              >
                <MessageCircle size={22} />
              </button>
            </div>

            <p className="family-post-counts">
              <strong>{likes.length}</strong> likes
              {comments.length > 0 && <span> - {comments.length} comments</span>}
            </p>

            {(post.caption || post.text) && (
              <p className="family-post-caption">
                <strong>{authorName}</strong> {post.caption || post.text}
              </p>
            )}

            {openComments[postId] && (
              <div className="family-comments">
                <div className="family-comment-input-row">
                  <input
                    value={commentText[postId] || ''}
                    onChange={(event) =>
                      setCommentText((prev) => ({ ...prev, [postId]: event.target.value }))
                    }
                    placeholder="Add comment..."
                  />
                  <button
                    type="button"
                    aria-label="Send comment"
                    disabled={Boolean(pendingComments[postId])}
                    onClick={() => addComment(post)}
                  >
                    <Send size={17} />
                  </button>
                </div>

                {comments.length > 0 && (
                  <div className="family-comment-list">
                    {comments.map((comment) => {
                      const commentUser = comment.userId?.name || comment.userId || 'Family member';
                      return (
                        <p key={comment.commentId || comment._id || comment.id} className={`family-comment${comment._optimistic ? ' optimistic' : ''}`}>
                          <strong>{commentUser}</strong> {comment.text}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}

      {isLoadingMore && Array.from({ length: 2 }, (_, index) => <PostSkeleton key={`more-${index}`} />)}
    </div>
  );
};

export default FamilyPostList;
