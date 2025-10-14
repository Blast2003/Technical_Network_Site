import React, { useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import loader from "../assets/loader.svg";
import { ReadOutlined } from "@ant-design/icons";
import PostCard from "../Components/feed/PostCard";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../Atoms/userAtom";
import feedPostAtom from "../Atoms/feedPostAtom";

const SearchResults = () => {
  const [posts, setPosts] = useRecoilState(feedPostAtom);
  const [currentPage, setCurrentPage] = useState(1); // page we've successfully loaded
  const [totalPages, setTotalPages] = useState(1);
  const totalPagesRef = useRef(totalPages);
  useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);

  const [totalPosts, setTotalPosts] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const query = queryParams.get("q");
  const filterType = queryParams.get("filterType");
  const sourceType = queryParams.get("sourceType");
  const [loading, setLoading] = useState(false);

  const currentUser = useRecoilValue(userAtom);

  // Reset posts whenever the query or filters change
  useEffect(() => {
    setPosts([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalPosts(0);
  }, [query, filterType, sourceType, setPosts]);

  // Fetch posts and return the fetched array (so caller can decide whether to update currentPage)
  const fetchPosts = async (page) => {
    // guard: don't fetch invalid pages (use ref to avoid race with setState)
    if (totalPagesRef.current && page > totalPagesRef.current) {
      // already beyond known pages
      return [];
    }

    setLoading(true);
    try {
      let url = `/api/post/filter/${encodeURIComponent(query)}?page=${page}&limit=3`;
      if (filterType) url += `&filterType=${encodeURIComponent(filterType)}`;
      if (filterType === "Recruitment" && sourceType) url += `&sourceType=${encodeURIComponent(sourceType)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        // If first page fails, clear; otherwise keep what we have and show a toast
        if (page === 1) {
          setPosts([]);
          setTotalPages(0);
          setTotalPosts(0);
        }
        toast.error(data.error || "Error fetching posts");
        return [];
      }

      const fetchedPosts = Array.isArray(data.posts) ? data.posts : [];
      const tp = data.totalPages != null ? data.totalPages : Math.ceil((data.totalPosts || 0) / 3);

      setTotalPages(tp);
      setTotalPosts(data.totalPosts || 0);

      if (page === 1) {
        setPosts(fetchedPosts);
      } else {
        // Append new posts, preventing duplicates by id
        setPosts((prevPosts) => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newUnique = fetchedPosts.filter(p => !existingIds.has(p.id));
          return [...prevPosts, ...newUnique];
        });
      }

      return fetchedPosts;
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Error fetching posts: " + (error.message || "Unknown"));
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Initial and dependency-driven fetch
  useEffect(() => {
    let mounted = true;
    if (query) {
      // load page 1 and set currentPage to 1 only after success
      (async () => {
        const fetched = await fetchPosts(1);
        if (mounted) {
          // ensure currentPage reflects a successful load; if fetch returned [], keep currentPage=1 but posts will be empty
          setCurrentPage(1);
        }
      })();
    }
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filterType, sourceType]);

  useEffect(() => {
    if (
      location.pathname === "/tech/search" &&
      !location.search.includes("q=")
    ) {
      navigate("/tech", { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const handleShowMore = async () => {
    // Prevent extra fetch if already loading or we've reached last page
    if (loading) return;
    if (totalPosts && posts.length >= totalPosts) return;

    const nextPage = currentPage + 1;
    const fetched = await fetchPosts(nextPage);

    if (fetched && fetched.length > 0) {
      // only set currentPage when fetch actually returned posts
      setCurrentPage(nextPage);
    } else {
      // no data returned for nextPage -> we probably reached the end
      // ensure totalPages doesn't claim there are more pages
      setTotalPages(prev => Math.max(prev, currentPage));
    }
  };

  const handleLikeUpdate = (postId, newLikeCount, isLiked, actorId) => {
    setPosts(prev =>
      prev.map(post => {
        if (post.id !== postId) return post;

        // decide which id we should add/remove:
        // - if actorId provided: change that actor's presence in LikedUserIds
        // - otherwise: assume it's the current user (local action)
        const targetId = actorId || currentUser?.id;

        // If actorId is not provided but currentUser is undefined, do nothing to arrays
        const prevLiked = Array.isArray(post.LikedUserIds) ? [...post.LikedUserIds] : [];

        let updatedLikedUserIds;
        if (typeof targetId !== "undefined") {
          updatedLikedUserIds = isLiked
            ? Array.from(new Set([...prevLiked, targetId]))
            : prevLiked.filter(id => id !== targetId);
        } else {
          // no actor id and no current user -> keep previous array unchanged
          updatedLikedUserIds = prevLiked;
        }

        return {
          ...post,
          TotalLikeNumber: newLikeCount,
          LikedUserIds: updatedLikedUserIds,
        };
      })
    );
  };


  // full-screen loader if first load
  if (loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-4">
        Search Results for &quot;{query}&quot;
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.length !== 0 ? (
          posts.map((post) => (
            <div key={post.id} className="cursor-pointer">
              <div className="relative bg-gray-200 shadow-md rounded-lg p-6 transition-transform duration-500 hover:-translate-y-2.5">
                {post.type === "Recruitment" ? null : (
                  <div className="absolute top-1 right-1 flex items-center bg-gray-200 rounded-full px-2 py-1 shadow">
                    <ReadOutlined className="text-gray-600 mr-1" />
                  </div>
                )}
                <div className="mt-1">
                  <PostCard
                    userId={post.userId || post.UserId}
                    postId={post.id}
                    profilePic={post.profilePic || "https://placehold.co/40x40"}
                    title={post.title}
                    author={post.UserName}
                    time={formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    content={post.text}
                    imageUrl={post.img}
                    type={post.type}
                    hashtag={post.hashtag || ""}
                    sourceType={post.sourceType}
                    LikedUserByIds={post?.LikedUserIds || []}
                    likes={post.LikeCount || post.TotalLikeNumber || 0}
                    comments={post.TotalRepliesNumber || 0}
                    recommend={post.recommend || false}
                    onLikeUpdate={handleLikeUpdate}
                    mainField ={post?.mainField}
                  />
                </div>
              </div>
            </div>
          ))
        ) : (
          // show "not found" only when we truly have no posts and not currently loading
          !loading && (
            <h2 className="text-2xl font-bold mb-4 mt-5">Post Not Found</h2>
          )
        )}
      </div>

      {/* Footer / Show More controls */}
      <div className="flex flex-col items-center mt-6 space-y-3">
        <div className="text-sm text-gray-600">
          {posts.length > 0 ? `\nShowing ${posts.length} of ${totalPosts} posts` : null}
        </div>

        <div>
          {posts.length > 0 && posts.length >= totalPosts ? (
            <div className="text-sm text-gray-500">No more posts</div>
          ) : (
            // only show button if there are more posts to load
            posts.length < totalPosts && (
              <button
                onClick={handleShowMore}
                disabled={loading}
                className={`bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {loading ? "Loading..." : "Show More"}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchResults;
