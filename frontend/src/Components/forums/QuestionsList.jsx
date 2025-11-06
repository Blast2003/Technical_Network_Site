import React, { useEffect, useRef, useState } from "react";
import { useRecoilValue } from "recoil";
import userAtom from "../../Atoms/userAtom";

export default function QuestionsList({
  thread,
  questions = [],
  onOpen,
  onShowMore,
  onCreateOptimistic,
  questionsLoading,
  hasMore,
  onHover,
  onHoverLeave
}) {
  const currentUser = useRecoilValue(userAtom);

  // modal states (unchanged)
  const [isModalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef();

  useEffect(() => {
    if (isModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev || ""; };
    }
    return;
  }, [isModalOpen]);

  if (!thread) return <div className="text-gray-500">Select a thread to view questions</div>;

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      setImageFile(null);
      setPreviewUrl(null);
      return;
    }
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewUrl(ev.target.result);
    reader.readAsDataURL(f);
  };

  const openModal = (e) => {
    e && e.stopPropagation();
    setModalOpen(true);
    setTitle("");
    setContent("");
    setImageFile(null);
    setPreviewUrl(null);
  };

  const closeModal = (e) => {
    e && e.stopPropagation();
    if (!creating) setModalOpen(false);
  };

  const createQuestion = async (e) => {
    e && e.stopPropagation();
    if (!title.trim() && !content.trim() && !imageFile) return;
    setCreating(true);
    try {
      let imageData = null;
      if (imageFile) {
        imageData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }
      const body = { title: title.trim(), content: content.trim() || null, image: imageData };
      const res = await fetch(`/api/forum/threads/${thread.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onCreateOptimistic && onCreateOptimistic(data);
        setTimeout(() => {
          setCreating(false);
          setModalOpen(false);
        }, 300);
      } else {
        console.warn("create question failed", data);
        alert(data.error || "Failed to create question");
        setCreating(false);
      }
    } catch (err) {
      console.error("createQuestion error", err);
      alert("Failed to create question");
      setCreating(false);
    }
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-lg">Questions</h3>
        <button
          onClick={openModal}
          onMouseDown={(e) => e.stopPropagation()}
          className="px-3 py-1 bg-white border rounded shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5"
          aria-label="Create a new question"
        >
          + New Question
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="py-8 text-center text-gray-500 bg-gray-50 rounded p-6">
            <div className="text-xl font-medium mb-2">No questions yet</div>
            <div className="text-sm">Be the first to ask something — use the button above to create a question.</div>
            <div className="mt-4 text-xs text-gray-400">Your question will appear here after posting.</div>
          </div>
        ) : (
          questions.map((q) => (
            <button
              key={q.id}
              onClick={(e) => { e.stopPropagation(); onOpen && onOpen(q, e); }}
              onMouseEnter={() => onHover && onHover(q.id)}
              onMouseLeave={() => onHoverLeave && onHoverLeave()}
              className="w-full text-left p-3 rounded-lg hover:bg-gray-50 hover:shadow-md transition transform duration-150 ease-out bg-white flex gap-3 items-start"
              title={q.content ? q.content.slice(0, 120) : "Open to view answers"}
            >
              {/* left: optional image or avatar */}
              <div className="flex-shrink-0">
                {q.creatorProfilePic ? (
                  <img src={q.creatorProfilePic} alt="creator" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">No</div>
                )}
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm text-gray-800">{q.title}</div>
                  <div className="text-xs text-gray-400">{formatDate(q.createdAt)}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{q.content || "—"}</div>
                <div className="mt-2 text-xs text-gray-400">By {q.creatorName || q.User?.username || "Unknown"}</div>
              </div>

              <div className="flex flex-col items-end ml-3">
                {/* SHOW badge for ALL users now */}
                { (q.unseenCount > 0) && (
                  <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold animate-pulse">{q.unseenCount}</div>
                )}
                <div className="mt-3 text-xs text-blue-600">Open</div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* show more */}
      {questions.length > 0 && hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); onShowMore && onShowMore(); }}
            disabled={questionsLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition transform hover:scale-105 focus:outline-none"
          >
            {questionsLoading ? "Loading..." : "Show more"}
          </button>
        </div>
      )}

      {/* Modal: create question (unchanged) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Create question"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !creating && closeModal()} />
          <div className="relative w-full max-w-3xl bg-white rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="max-h-[82vh] overflow-auto p-6">
              <div className="flex items-start justify-between">
                <h4 className="text-lg font-semibold">Ask a question</h4>
                <button onClick={(e) => closeModal(e)} className="text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
              </div>

              <div className="mt-4 space-y-4">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Question title (short)"
                  className="mt-1 w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={140}
                />
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add details, code snippets, links..."
                  rows={6}
                  className="mt-1 w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {previewUrl && (
                  <div className="rounded overflow-hidden border border-gray-200 p-2 bg-gray-50">
                    <div className="max-h-[40vh] overflow-auto flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="preview"
                        className="object-contain max-h-[40vh] w-full"
                        style={{ display: "block" }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewUrl(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = null; }}
                          className="px-2 py-1 border rounded text-sm hover:bg-gray-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 bg-gray-50 border rounded cursor-pointer hover:shadow-sm">
                    Attach image
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                  <div className="flex-1 text-sm text-gray-500">Optional — add a helpful screenshot or diagram.</div>

                  <button
                    onClick={createQuestion}
                    disabled={creating}
                    className={`px-4 py-2 rounded text-white ${creating ? "bg-blue-300 cursor-wait" : "bg-blue-600 hover:bg-blue-700"}`}
                  >
                    {creating ? "Posting..." : "Post question"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
