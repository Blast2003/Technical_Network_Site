import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ForumCard({
  forum: initialForum,
  currentUser,
  onUpdate,
  canManage = false,
  onEdit,
  onDelete,
}) {
  // keep local state but sync to prop changes
  const [forum, setForum] = useState(initialForum || {});
  useEffect(() => setForum(initialForum || {}), [initialForum]);

  const [loading, setLoading] = useState(false); // used for join
  const [deleting, setDeleting] = useState(false); // used for delete
  const navigate = useNavigate();

  const badgeLabel = currentUser?.is_global_admin
    ? "Joined"
    : forum.status === "joined"
      ? "Joined"
      : forum.status === "invited"
      ? "Invited"
      : "Join";

  // Join handler — stops propagation so clicking doesn't navigate
  const handleJoin = async (e) => {
    e.stopPropagation();
    if (loading || forum.status === "joined") return;
    setLoading(true);
    try {
      const res = await fetch(`/api/forum/${forum.id}/join`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn("join failed", data);
        return;
      }
      // use server response when possible, fallback to optimistic local update
      const updated = {
        ...forum,
        status: data.status ?? "joined",
        member_count: data.member_count ?? (forum.member_count || 0) + 1,
        isAdmin: data.isAdmin ?? forum.isAdmin,
      };
      setForum(updated);
      if (typeof onUpdate === "function") onUpdate(updated);
    } catch (err) {
      console.error("join error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = () => navigate(`/tech/forums/${forum.id}`);

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (typeof onEdit === "function") onEdit(forum);
  };

  const handleDeleteClick = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    if (typeof onDelete === "function") {
      try {
        setDeleting(true);
        // allow parent to return a promise and await it
        const maybePromise = onDelete(forum);
        if (maybePromise && typeof maybePromise.then === "function") {
          await maybePromise;
        }
      } catch (err) {
        console.error("delete callback error", err);
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <div
      className="bg-gray-800 text-white rounded-lg p-4 shadow hover:shadow-lg transition transform hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleCardClick(); }}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 flex items-center justify-center rounded bg-blue-500 mr-4 mt-1 flex-shrink-0">
          <span className="text-lg font-bold">{(forum.title || "").slice(0, 2).toUpperCase()}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <Link to={`/tech/forums/${forum.id}`} className="text-lg font-semibold hover:underline">
              {forum.title}
            </Link>

            <div className="flex items-center gap-2">
              {canManage && (
                <>
                  <button
                    onClick={handleEditClick}
                    className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded hover:scale-105 transition transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-300 active:scale-95"
                    title="Edit forum"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:scale-105 transition transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-300 active:scale-95"
                    title="Delete forum"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </>
              )}

              {/* Single control for join/invited/joined */}
              {badgeLabel === "Join" ? (
                <button
                  onClick={handleJoin}
                  disabled={loading}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:scale-105 transition transform focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95"
                  title="Join forum"
                >
                  {loading ? "Joining..." : "Join"}
                </button>
              ) : badgeLabel === "Invited" ? (
                <div className="px-2 py-1 rounded text-xs bg-yellow-600 text-black">Invited</div>
              ) : (
                <div className="px-2 py-1 rounded text-xs bg-green-600">Joined</div>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-300 line-clamp-2 mt-2">{forum.description}</p>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
            <div>{forum.member_count ?? 0} members</div>

            {/* removed bottom "Join" duplicate — top-right button handles join */}
            <div />
          </div>
        </div>
      </div>
    </div>
  );
}
