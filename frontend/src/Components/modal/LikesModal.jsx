// src/Components/modal/LikesModal.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import loader from "../../assets/loader.svg";

/**
 * Likes modal:
 * - 1-based paging (page=1 is first page)
 * - Shows initial loading, then list of users
 * - If hasMore true => shows "Show more" button to fetch next page
 * - Console.debug logs for each fetch
 */
const LikesModalInner = ({ onClose, isOpen, likedUserIds }) => {
  const [currentPage, setCurrentPage] = useState(1); // 1-based
  const [users, setUsers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false); // for "Show More" button
  const [hasMore, setHasMore] = useState(true);
  const scrollerRef = useRef(null);
  const navigate = useNavigate();

  // prevents concurrent fetches
  const fetchingRef = useRef(false);

  const LIMIT = 5; // server limit must match

  const fetchPage = useCallback(
    async (pageToFetch = 1) => {
      if (!likedUserIds || likedUserIds.length === 0) {
        console.debug("[LikesModal] No likedUserIds provided.");
        setUsers([]);
        setHasMore(false);
        setInitialLoading(false);
        setLoadingMore(false);
        return;
      }

      if (fetchingRef.current) {
        console.debug("[LikesModal] fetch in progress, skipping");
        return;
      }
      fetchingRef.current = true;

      // debug
      console.debug("[LikesModal] fetchPage start", {
        page: pageToFetch,
        limit: LIMIT,
        totalIds: likedUserIds.length,
      });

      if (pageToFetch === 1) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await fetch(`/api/user/likedUsers?page=${pageToFetch}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: likedUserIds }),
        });
        const data = await res.json();

        if (!res.ok) {
          console.error("[LikesModal] fetch error response:", data);
          return;
        }

        const fetched = Array.isArray(data.users) ? data.users : [];
        console.debug("[LikesModal] fetchPage result", {
          page: pageToFetch,
          fetchedLength: fetched.length,
          hasMore: data.hasMore,
          total: data.total,
        });

        if (pageToFetch === 1) {
          setUsers(fetched);
          setCurrentPage(1);
        } else {
          setUsers(prev => {
            const existing = new Set(prev.map(u => u.id));
            const unique = fetched.filter(u => !existing.has(u.id));
            return [...prev, ...unique];
          });
          setCurrentPage(pageToFetch);
        }

        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        console.error("[LikesModal] fetch exception:", err);
      } finally {
        fetchingRef.current = false;
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [likedUserIds]
  );

  // open modal: reset and load page 1
  useEffect(() => {
    if (!isOpen) return;
    setUsers([]);
    setHasMore(true);
    setInitialLoading(true);
    setLoadingMore(false);
    setCurrentPage(1);
    fetchingRef.current = false;

    // reset scroll
    requestAnimationFrame(() => {
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    });

    fetchPage(1);
  }, [isOpen, fetchPage, likedUserIds]);

  // lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-2xl max-w-full"
        style={{ width: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-lg">Liked by</h3>
            <span className="text-sm text-gray-500">({likedUserIds?.length || 0})</span>
          </div>
          <button onClick={onClose} className="text-xl font-bold px-2 leading-none hover:text-gray-700" aria-label="Close">×</button>
        </div>

        {/* Content */}
        <div ref={scrollerRef} className="px-4 py-3 overflow-y-auto" style={{ height: 480 }}>
          {/* initial loader */}
          {initialLoading && users.length === 0 && (
            <div className="flex flex-col items-center justify-center h-72">
              <img width="80" src={loader} alt="loading" />
              <p className="mt-3 text-sm text-gray-600">Loading likers...</p>
            </div>
          )}

          {/* empty */}
          {!initialLoading && users.length === 0 && (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-gray-500">No users yet</p>
            </div>
          )}

          {/* list */}
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center space-x-4 py-3 px-2 rounded-lg transition-shadow bg-gray-100 duration-150 cursor-pointer hover:shadow-lg hover:bg-gray-200"
              onClick={() => {
                onClose();
                navigate(`/tech/profile/${user.username}`);
              }}
            >
              <img src={user.profilePic || "https://placehold.co/48x48"} alt={user.name} className="h-12 w-12 rounded-full object-cover flex-shrink-0" loading="lazy" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{user.name}</span>
                <span className="text-xs text-gray-500 truncate">@{user.username}</span>
                {user.position && <span className="text-xs text-gray-400 truncate">{user.position}</span>}
              </div>
            </div>
          ))}

          {/* bottom loader when loading more pages */}
          {loadingMore && users.length > 0 && (
            <div className="flex items-center justify-center py-3">
              <img width="36" src={loader} alt="loading more" />
            </div>
          )}

          {/* Show More button when there are more pages */}
          {hasMore && users.length > 0 && (
            <div className="flex items-center justify-center py-3">
              <button
                onClick={() => fetchPage(currentPage + 1)}
                disabled={fetchingRef.current}
                className={`px-4 py-2 rounded-lg font-medium transition transform ${fetchingRef.current ? "opacity-60 cursor-not-allowed" : "bg-white border border-gray-200 hover:bg-blue-600 hover:text-white hover:scale-105"}`}
              >
                {fetchingRef.current ? "Loading..." : "Show more"}
              </button>
            </div>
          )}

          {/* no more */}
          {!hasMore && users.length > 0 && (
            <div className="text-center text-xs text-gray-400 py-3">No more users</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const LikesModal = (props) => {
  if (typeof window === "undefined") return null;
  return <LikesModalInner {...props} />;
};

export default LikesModal;
