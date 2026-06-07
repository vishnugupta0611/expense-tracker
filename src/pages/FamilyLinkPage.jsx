import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@context/AuthContext';
import api from '@services/api';
import Banner from '../family-link/components/Banner.jsx';
import MessagesButton from '../family-link/components/Messages.jsx';
import Post from '../family-link/components/Post.jsx';
import './FamilyLinkPage.css';

const PAGE_SIZE = 5;

const FamilyLinkPage = () => {
  const { user } = useAuth();
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const skipRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchPosts = useCallback(
    async ({ reset = false } = {}) => {
      if (!user?.familyKey) return;

      const nextSkip = reset ? 0 : skipRef.current;

      if (!reset && (!hasMoreRef.current || loadingMoreRef.current)) return;

      if (reset) {
        setIsLoading(true);
      } else {
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
      }

      try {
        const response = await api.get(`/family-posts/family/${user.familyKey}/top`, {
          params: {
            skip: nextSkip,
            limit: PAGE_SIZE,
          },
        });

        const nextPosts = response.data.posts || [];

        setPosts((prev) => (reset ? nextPosts : [...prev, ...nextPosts]));
        skipRef.current = response.data.nextSkip ?? nextSkip + nextPosts.length;
        hasMoreRef.current = Boolean(response.data.hasMore);
        setHasMore(hasMoreRef.current);
      } catch (error) {
        console.error('Error fetching family posts:', error.response?.data?.error || error.message);
      } finally {
        setIsLoading(false);
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    },
    [user?.familyKey]
  );

  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    skipRef.current = 0;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;
    fetchPosts({ reset: true });
  }, [fetchPosts]);

  useEffect(() => {
    if (!sentinelRef.current || isLoading || isLoadingMore || !hasMore) return undefined;

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchPosts();
        }
      },
      { rootMargin: '280px 0px' }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
  }, [fetchPosts, hasMore, isLoading, isLoadingMore]);

  return (
    <div className="family-link-page">
      <Banner />
      <MessagesButton />
      <Post
        posts={posts}
        onPostsChange={setPosts}
        currentUser={{ ...user, id: user?._id || user?.id }}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        emptyMessage="No family posts yet."
      />
      <div ref={sentinelRef} className="family-scroll-sentinel" aria-hidden="true" />
      {!hasMore && posts.length > 0 && <p className="family-end-text">You are all caught up.</p>}
    </div>
  );
};

export default FamilyLinkPage;
