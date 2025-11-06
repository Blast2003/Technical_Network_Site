import React, { useState } from "react";

export default function ThreadCard({ thread = {}, onSelect, canManage = false, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const handleClick = () => {
    if (typeof onSelect === "function") onSelect(thread);
  };

  const titleInitials = (thread.title || "").slice(0, 2).toUpperCase();
  const creatorName = thread.creatorName || thread.User?.username || thread.creator?.username || "Unknown";
  const createdAt = thread.createdAt ? new Date(thread.createdAt).toLocaleString() : "";

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (typeof onEdit === "function") onEdit(thread);
  };

  const handleDeleteClick = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    if (typeof onDelete === "function") {
      try {
        setDeleting(true);
        const maybePromise = onDelete(thread);
        if (maybePromise && typeof maybePromise.then === "function") {
          await maybePromise;
        }
      } catch (err) {
        console.error("thread delete error", err);
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      role={onSelect ? "button" : "article"}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      className="cursor-pointer bg-white p-3 rounded shadow hover:shadow-md flex gap-3 focus:outline-none focus:ring-2 focus:ring-blue-200 transition transform hover:-translate-y-0.5"
    >
      {thread.image_url ? (
        <img src={thread.image_url} alt={thread.title || "thread image"} className="w-20 h-20 object-cover rounded" />
      ) : (
        <div className="w-20 h-20 rounded bg-gray-100 flex items-center justify-center text-gray-600">
          {titleInitials || "T?"}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-lg truncate">{thread.title || "Untitled thread"}</div>

          {canManage && (typeof onEdit === "function" || typeof onDelete === "function") && (
            <div className="flex items-center gap-2">
              {typeof onEdit === "function" && (
                <button
                  onClick={handleEditClick}
                  className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded transition transform hover:scale-105 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-300 active:scale-95"
                >
                  Edit
                </button>
              )}
              {typeof onDelete === "function" && (
                <button
                  onClick={handleDeleteClick}
                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded transition transform hover:scale-105 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-300 active:scale-95"
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 line-clamp-2 mt-1">{thread.content || ""}</div>
        <div className="text-xs text-gray-400 mt-2">admin{createdAt ? ` • ${createdAt}` : ""}</div>
      </div>
    </div>
  );
}
