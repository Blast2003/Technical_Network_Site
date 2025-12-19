// QuestionDetail.jsx
import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "../../Context/SocketContext";
import { useRecoilValue } from "recoil";
import userAtom from "../../Atoms/userAtom";
import { FaCamera } from "react-icons/fa";
import { MdSend } from "react-icons/md";
import { FiX } from "react-icons/fi";
import { HiChevronDown } from "react-icons/hi";
import loader from "../../assets/loader.svg";

export default function QuestionDetail({ question, currentUser, forum, thread, onLeave }) {
  const { socket } = useSocket();
  const user = useRecoilValue(userAtom) || currentUser;

  const [answers, setAnswers] = useState([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  console.log("answers: ", answers)

  // composer
  const [composerText, setComposerText] = useState("");
  const [composerFile, setComposerFile] = useState(null);
  const [composerPreview, setComposerPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  // control whether composer (fixed bottom) is visible
  const [showComposer, setShowComposer] = useState(true);

  // inline reply
  const [inlineReplyId, setInlineReplyId] = useState(null);

  // editing: current editing answer id + map of drafts to persist preview across renders
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editingDrafts, setEditingDrafts] = useState({}); // { [answerId]: { text, preview, file } }
  const [editingSavingId, setEditingSavingId] = useState(null);

  // forum role detection
  const [myForumRole, setMyForumRole] = useState(null);

  const fileInputRef = useRef(null);
  const composerTextareaRef = useRef(null);

  // ---------- AI summary states ----------
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // ---------- helpers ----------
  const deepRemove = (nodes, id) => {
    const walk = (arr) => {
      const out = [];
      for (const n of arr) {
        if (String(n.id) === String(id)) continue;
        const copy = { ...n };
        if (copy.children && copy.children.length) copy.children = walk(copy.children);
        out.push(copy);
      }
      return out;
    };
    return walk(nodes || []);
  };

  const insertUnder = (nodes, parentId, child) => {
    for (const n of nodes) {
      if (String(n.id) === String(parentId)) {
        n.children = n.children || [];
        if (!n.children.some(c => String(c.id) === String(child.id))) n.children.unshift(child);
        return true;
      }
      if (n.children && n.children.length) {
        if (insertUnder(n.children, parentId, child)) return true;
      }
    }
    return false;
  };

  const sortDesc = (nodes) => {
    nodes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    nodes.forEach(n => { if (n.children && n.children.length) sortDesc(n.children); });
  };

  const normalize = (nodes) => {
    const dedupe = (arr) => {
      for (const n of arr) {
        if (n.children && n.children.length) {
          const seen = new Set();
          const uniq = [];
          for (const c of n.children) {
            if (!seen.has(String(c.id))) { seen.add(String(c.id)); uniq.push(c); }
          }
          n.children = uniq;
          dedupe(n.children);
        }
      }
    };
    dedupe(nodes);

    const childIds = new Set();
    const collect = (arr) => {
      for (const n of arr) {
        if (n.children && n.children.length) {
          for (const c of n.children) childIds.add(String(c.id));
          collect(n.children);
        }
      }
    };
    collect(nodes);
    return nodes.filter(n => !childIds.has(String(n.id)));
  };

  // update node by id — merges server-provided node (preserve existing children if server didn't supply them)
  const updateNodeById = (nodes, id, serverNode) => {
    const walk = (arr) => {
      return arr.map(n => {
        if (String(n.id) === String(id)) {
          const merged = { ...n, ...serverNode };
          if (Object.prototype.hasOwnProperty.call(serverNode, "children")) {
            merged.children = Array.isArray(serverNode.children) ? serverNode.children : [];
          } else {
            merged.children = Array.isArray(n.children) ? n.children : [];
          }
          return merged;
        }
        const copy = { ...n };
        if (n.children && n.children.length) copy.children = walk(n.children);
        return copy;
      });
    };
    return walk(nodes || []);
  };

  // ---------- fetch answers from server (authoritative) ----------
  const fetchAnswersFromServer = async () => {
    if (!question?.id) return;
    setLoadingAnswers(true);
    try {
      const res = await fetch(`/api/forum/questions/${question.id}/answers?depth=2&limit=200`);
      if (!res.ok) {
        setAnswers([]);
        return;
      }
      const data = await res.json();
      const highlighted = data.highlightedAnswers || [];
      const other = data.otherAnswers || [];
      const combined = [];
      const seen = new Set();
      for (const a of highlighted) { if (!seen.has(String(a.id))) { combined.push({ ...a, children: a.children || [] }); seen.add(String(a.id)); } }
      for (const a of other)       { if (!seen.has(String(a.id))) { combined.push({ ...a, children: a.children || [] }); seen.add(String(a.id)); } }
      sortDesc(combined);
      const normalized = normalize(combined);
      setAnswers(normalized);
    } catch (err) {
      console.error("fetchAnswersFromServer error", err);
      setAnswers([]);
    } finally {
      setLoadingAnswers(false);
    }
  };

  // ---------- count answers created within last 24h ----------
  const countNewAnswersFromNodes = (nodes) => {
    if (!nodes || nodes.length === 0) return 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let count = 0;
    const walk = (arr) => {
      for (const n of arr) {
        // skip counting toxic answers, but still walk into their children
        if (n.is_toxic) {
          if (n.children && n.children.length) walk(n.children);
          continue;
        }
        try {
          const t = new Date(n.createdAt).getTime();
          if (!Number.isNaN(t) && t >= cutoff) count++;
        } catch { /* ignore */ }
        if (n.children && n.children.length) walk(n.children);
      }
    };
    walk(nodes);
    return count;
  };

  // ---------- fetch my forum role so admins can delete ----------
  useEffect(() => {
    if (!forum?.id || !user?.id) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/forum/${forum.id}/members`);
        if (!res.ok) return;
        const arr = await res.json();
        if (!mounted) return;
        const me = arr.find(x =>
          Number(x.user?.id) === Number(user.id) ||
          Number(x.userId) === Number(user.id) ||
          Number(x.id) === Number(user.id)
        );
        if (me && me.role) setMyForumRole(me.role);
      } catch (err) {
        // silent
      }
    })();
    return () => { mounted = false; };
  }, [forum?.id, user?.id]);

  const isGlobalAdmin = !!user?.is_global_admin;
  const isForumAdmin = myForumRole === "forum_admin";
  const isCurrentUserAdmin = isGlobalAdmin || isForumAdmin;

  // ---------- load answers & sockets (fixed: do NOT depend on edit drafts/state) ----------
  useEffect(() => {
    if (!question) return;
    let mounted = true;

    const load = async () => {
      setLoadingAnswers(true);
      try {
        const res = await fetch(`/api/forum/questions/${question.id}/answers?depth=2&limit=200`);
        if (!res.ok) { if (mounted) setAnswers([]); return; }
        const data = await res.json();
        if (!mounted) return;
        const highlighted = data.highlightedAnswers || [];
        const other = data.otherAnswers || [];
        const combined = [];
        const seen = new Set();
        for (const a of highlighted) { if (!seen.has(String(a.id))) { combined.push({ ...a, children: a.children || [] }); seen.add(String(a.id)); } }
        for (const a of other)       { if (!seen.has(String(a.id))) { combined.push({ ...a, children: a.children || [] }); seen.add(String(a.id)); } }
        sortDesc(combined);
        const normalized = normalize(combined);
        setAnswers(normalized);
      } catch (err) {
        console.error("load answers error", err);
        if (mounted) setAnswers([]);
      } finally {
        if (mounted) setLoadingAnswers(false);
      }
    };

    load();

    const canJoin = forum && (forum.status === "joined" || forum.isAdmin || true);
    if (socket && canJoin) socket.emit("joinQuestionRoom", { questionId: question.id });

    // socket handlers
    const onNew = ({ answer }) => {
      if (!answer) return;
      setAnswers(prev => {
        let copy = JSON.parse(JSON.stringify(prev || []));
        copy = deepRemove(copy, answer.id);
        answer.children = answer.children || [];
        if (!answer.parent_answer_id) copy.unshift(answer);
        else {
          const ok = insertUnder(copy, answer.parent_answer_id, answer);
          if (!ok) copy.unshift(answer);
        }
        sortDesc(copy);
        copy = normalize(copy);
        return copy;
      });
    };

    const onUpdated = ({ answer }) => {
      if (!answer) return;
      setAnswers(prev => {
        // if node exists in prev tree -> merge/preserve existing children unless server provides children
        const existsInTree = (() => {
          const find = (arr) => {
            for (const n of arr || []) {
              if (String(n.id) === String(answer.id)) return true;
              if (n.children && n.children.length) {
                if (find(n.children)) return true;
              }
            }
            return false;
          };
          return find(prev || []);
        })();

        if (existsInTree) {
          const merged = updateNodeById(prev, answer.id, answer);
          sortDesc(merged);
          return normalize(merged);
        } else {
          // fallback: insert like a new node (preserve incoming children if provided)
          let copy = JSON.parse(JSON.stringify(prev || []));
          copy = deepRemove(copy, answer.id);
          answer.children = answer.children || [];
          if (!answer.parent_answer_id) copy.unshift(answer);
          else {
            const ok = insertUnder(copy, answer.parent_answer_id, answer);
            if (!ok) copy.unshift(answer);
          }
          sortDesc(copy);
          copy = normalize(copy);
          return copy;
        }
      });
    };

    const onDeleted = ({ answerId }) => {
      setAnswers(prev => deepRemove(prev || [], answerId));
      if (String(editingAnswerId) === String(answerId)) {
        setEditingAnswerId(null);
        setEditingDrafts(prev => {
          const next = { ...(prev || {}) };
          delete next[answerId];
          return next;
        });
      }
    };

    if (socket && canJoin) {
      socket.on("new_answer", onNew);
      socket.on("answer_updated", onUpdated);
      socket.on("answer_deleted", onDeleted);
    }

    return () => {
      if (socket && canJoin) {
        socket.off("new_answer", onNew);
        socket.off("answer_updated", onUpdated);
        socket.off("answer_deleted", onDeleted);
        socket.emit("leaveQuestionRoom", { questionId: question.id });
      }
      onLeave && onLeave();
      mounted = false;
    };
    // intentionally excluding editingDrafts/editingAnswerId from deps to avoid re-fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, forum?.id, myForumRole]);

  // ---------- composer helpers ----------
  const onSelectFileForComposer = (file) => {
    if (!file) { setComposerFile(null); setComposerPreview(null); return; }
    setComposerFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setComposerPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCameraClick = (e) => {
    e && e.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const clearComposer = (e) => {
    e && e.stopPropagation();
    setComposerText("");
    setComposerFile(null);
    setComposerPreview(null);
    setReplyTo(null);
    if (composerTextareaRef.current) {
      composerTextareaRef.current.style.height = "auto";
    }
  };

  const submitComposer = async (e) => {
    e && e.stopPropagation();
    const parent_answer_id = replyTo ? Number(replyTo) : null;

    if ((!composerText || !composerText.trim()) && !composerPreview && !composerFile) return;
    setSubmitting(true);
    try {
      let imageData = null;
      if (composerFile) {
        imageData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(composerFile);
        });
      } else if (composerPreview) {
        imageData = composerPreview;
      }

      const body = { content: (composerText || "").trim(), image: imageData, parent_answer_id: parent_answer_id };
      const res = await fetch(`/api/forum/questions/${question.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        console.warn("submit failed", data);
        alert(data.error || "Failed to submit answer");
      } else {
        clearComposer();
        // socket will provide final update
      }
    } catch (err) {
      console.error("submitComposer error", err);
      alert("Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- submit inline reply ----------
  const submitInlineReply = async (parentId, text, file, preview, onSuccessClose) => {
    if ((!text || !text.trim()) && !preview && !file) return;
    setSubmitting(true);
    try {
      let imageData = null;
      if (file) {
        imageData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else if (preview) {
        imageData = preview;
      }

      const body = { content: (text || "").trim(), image: imageData, parent_answer_id: parentId };
      const res = await fetch(`/api/forum/questions/${question.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        console.warn("submit inline failed", data);
        alert(data.error || "Failed to submit reply");
      } else {
        // restore composer when inline reply successfully sent
        setInlineReplyId(null);
        setShowComposer(true);
        onSuccessClose && onSuccessClose();
      }
    } catch (err) {
      console.error("submitInlineReply error", err);
      alert("Failed to submit reply");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- apply edit API helper ----------
  async function applyEditApi(id, content, imageData) {
    const body = { content, image: imageData };
    const res = await fetch(`/api/forum/answers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to update answer");
    return data; // server's updated answer (may include children)
  }

  const removeAnswer = async (id) => {
    if (!confirm("Delete this answer?")) return;
    try {
      const res = await fetch(`/api/forum/answers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error || "Failed to delete");
      } else {
        // server emits deletion
      }
    } catch (err) {
      console.error("removeAnswer error", err);
      alert("Failed to delete answer");
    }
  };

  // ---------- begin editing (initialize draft in parent store) ----------
const startEditing = (answer) => {
  if (!answer) return;
  // hide composer when starting an edit to avoid showing both composer + editor
  if (showComposer) setShowComposer(false);

  setEditingAnswerId(answer.id);
  setEditingDrafts(prev => {
    if (prev && prev[answer.id]) return prev; // don't overwrite existing draft
    return {
      ...prev,
      [answer.id]: {
        text: answer.content || "",
        preview: answer.image_url || null,
        file: null,
      }
    };
  });

  // scroll into view (best effort) — keep this, helps bring editor into viewport
  setTimeout(() => {
    try {
      const el = document.getElementById(`answer_node_${answer.id}`);
      el && el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) { /* ignore */ }
  }, 120);
};

  // ---------- InlineReply ----------
  function InlineReply({ parentId, onCancel }) {
    const [text, setText] = useState("");
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const ref = useRef(null);

    useEffect(() => {
      const handleOutside = (e) => {
        if (!ref.current) return;
        try {
          const path = (typeof e.composedPath === "function") ? e.composedPath() : (e.path || []);
          if (Array.isArray(path) && path.includes(ref.current)) return;
        } catch (err) {
          if (ref.current.contains(e.target)) return;
        }
        // when inline reply canceled by outside click, restore main composer
        setInlineReplyId(null);
        setShowComposer(true);
        onCancel && onCancel();
      };
      document.addEventListener("pointerdown", handleOutside);
      return () => document.removeEventListener("pointerdown", handleOutside);
    }, [onCancel]);

    const onChooseFile = (f) => {
      if (!f) { setFile(null); setPreview(null); return; }
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(f);
    };

    return (
      <div ref={ref} onClick={(e) => e.stopPropagation()} className="mt-3 ml-3">
        <div className="bg-white border rounded p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="Write a reply..."
                className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
              />
              {preview && (
                <div className="mt-2 relative">
                  <img src={preview} alt="preview" className="max-h-36 rounded" />
                  <button onClick={(ev) => { ev.stopPropagation(); setFile(null); setPreview(null); }} className="absolute top-1 right-1 bg-gray-900 text-white rounded px-2"><FiX /></button>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <label className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onChooseFile(e.target.files?.[0])} />
                <FaCamera />
              </label>
              <button onClick={(ev) => {
                ev.stopPropagation();
                setInlineReplyId(null);
                setShowComposer(true); // restore composer on cancel
                onCancel && onCancel();
              }} className="text-sm px-2 py-1 rounded border hover:bg-gray-50"><FiX /></button>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button onClick={(ev) => { ev.stopPropagation(); setInlineReplyId(null); setShowComposer(true); onCancel && onCancel(); }} className="px-3 py-1 border rounded hover:shadow-sm transform transition hover:-translate-y-0.5">Cancel</button>
            <button
              onClick={(ev) => { ev.stopPropagation(); submitInlineReply(parentId, text, file, preview, () => { /* onSuccessClose handled in submitInlineReply already */ }); }}
              disabled={submitting}
              className={`px-3 py-1 bg-blue-600 text-white rounded ${submitting ? 'opacity-60 cursor-wait' : 'hover:shadow-sm transform transition hover:-translate-y-0.5'}`}
            >
              <MdSend />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- EditAnswer component (reads/writes to parent editingDrafts) ----------
function EditAnswer({ answer, onCancel }) {
  // Always read the latest draft from parent editingDrafts (so this component stays controlled)
  const draft = editingDrafts[answer.id] || { text: answer.content || "", preview: answer.image_url || null, file: null };
  const localFileRef = useRef(null);
  const textareaRef = useRef(null);

  // keep last known caret position across re-renders
  const caretRef = useRef({ start: 0, end: 0 });

  // auto-focus on mount so keyboard input after clicking Edit goes into this textarea
  useEffect(() => {
    // small timeout to ensure DOM is visible/painted (helps with scrolling into view)
    const t = setTimeout(() => {
      try {
        if (textareaRef.current) {
          textareaRef.current.focus();
          // move caret to end
          const len = textareaRef.current.value?.length || 0;
          textareaRef.current.setSelectionRange(len, len);
          // ensure view follows caret on initial open
          try { textareaRef.current.scrollTo({ top: textareaRef.current.scrollHeight, behavior: "smooth" }); } catch (e) { textareaRef.current.scrollTop = textareaRef.current.scrollHeight; }
        }
      } catch (err) { /* ignore */ }
    }, 80);
    return () => clearTimeout(t);
  }, []);

  // update draft helpers
  const updateDraft = (patch) => {
    setEditingDrafts(prev => ({ ...(prev || {}), [answer.id]: { ...(prev?.[answer.id] || draft), ...patch } }));
  };

  // When parent-controlled draft text changes, restore caret and scroll so caret remains visible.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { start, end } = caretRef.current || { start: 0, end: 0 };
    try {
      // restore selection (caret) if possible
      ta.setSelectionRange(Math.min(start, ta.value.length), Math.min(end, ta.value.length));
      // scroll so caret is visible: scroll to bottom smoothly (typing usually at end)
      // fallback to instant assignment if smooth behavior not supported
      try {
        ta.scrollTo({ top: ta.scrollHeight, behavior: "smooth" });
      } catch (err) {
        ta.scrollTop = ta.scrollHeight;
      }
    } catch (err) {
      // ignore if browser does not allow selection change
    }
  }, [editingDrafts[answer.id]?.text]);

  const onChooseFile = (f) => {
    if (!f) {
      updateDraft({ file: null, preview: null });
      if (localFileRef.current) localFileRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateDraft({ file: f, preview: ev.target.result });
      if (localFileRef.current) localFileRef.current.value = "";
    };
    reader.readAsDataURL(f);
  };

  const onSave = async (ev) => {
    ev && ev.stopPropagation();
    const d = editingDrafts[answer.id];
    if (!d || !d.text || !d.text.trim()) {
      alert("Please enter content.");
      return;
    }
    setEditingSavingId(answer.id);
    try {
      let imageData = null;
      if (d.file) {
        imageData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(d.file);
        });
      } else if (d.preview) {
        imageData = d.preview;
      }

      const updated = await applyEditApi(answer.id, d.text.trim(), imageData);

      if (Object.prototype.hasOwnProperty.call(updated, "children")) {
        setAnswers(prev => {
          const next = updateNodeById(prev, answer.id, updated);
          sortDesc(next);
          return normalize(next);
        });
      } else {
        // server returned no children — fetch authoritative tree
        await fetchAnswersFromServer();
      }

      // remove draft and close editor
      setEditingDrafts(prev => {
        const next = { ...(prev || {}) };
        delete next[answer.id];
        return next;
      });
      setEditingAnswerId(null);

      // restore main composer after saving edit
      setShowComposer(true);
    } catch (err) {
      console.error("applyEdit error", err);
      alert(err.message || "Failed to update answer");
    } finally {
      setEditingSavingId(null);
    }
  };

  // handle input change while capturing caret pos BEFORE updating parent state
  const handleTextareaChange = (e) => {
    // capture caret positions
    try {
      caretRef.current = { start: e.target.selectionStart || 0, end: e.target.selectionEnd || 0 };
    } catch (err) {
      caretRef.current = { start: 0, end: 0 };
    }
    // update parent-controlled draft text
    updateDraft({ text: e.target.value });
  };

  return (
    <div id={`answer_node_${answer.id}`} onClick={(e) => e.stopPropagation()} className="mt-3">
      <div className="bg-white border rounded p-3 shadow-sm">
        <textarea
          ref={textareaRef}
          value={editingDrafts[answer.id]?.text ?? draft.text}
          onChange={handleTextareaChange}
          rows={3}
          className="w-full border rounded p-2"
        />

        {(editingDrafts[answer.id]?.preview || draft.preview) && (
          <div className="mt-2 relative">
            <img src={editingDrafts[answer.id]?.preview ?? draft.preview} alt="preview" className="max-h-40 rounded" />
            <button onClick={(ev) => { ev.stopPropagation(); updateDraft({ preview: null, file: null }); }} className="absolute top-1 right-1 bg-gray-900 text-white rounded px-2"><FiX /></button>
          </div>
        )}

        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={(ev) => { ev.stopPropagation(); localFileRef.current?.click(); }}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transform transition hover:-translate-y-0.5 hover:scale-105 shadow-sm"
              title="Attach image"
            >
              <FaCamera />
            </button>
            <input ref={localFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onChooseFile(e.target.files?.[0])} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                // close editor and restore main composer
                setEditingAnswerId(null);
                setEditingDrafts(prev => {
                  const next = { ...(prev || {}) };
                  delete next[answer.id];
                  return next;
                });
                setShowComposer(true);
                onCancel && onCancel();
              }}
              className="px-3 py-1 border rounded hover:shadow-sm transform transition hover:-translate-y-0.5"
              disabled={Boolean(editingSavingId)}
            >
              Cancel
            </button>

            <button
              onClick={onSave}
              disabled={Boolean(editingSavingId)}
              className={`px-3 py-1 bg-blue-600 text-white rounded ${editingSavingId ? "opacity-60 cursor-wait" : "hover:shadow-md transform transition hover:-translate-y-0.5 hover:scale-105"}`}
            >
              {editingSavingId ? (
                <span className="flex items-center gap-2">
                  <img src={loader} width="18" alt="saving" />
                  Saving...
                </span>
              ) : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



  // ---------- render node ----------
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const renderNode = (a, level = 0) => {
    const isOwner = user && String(user.id) === String(a.sender_id);
    const canEdit = isOwner;
    const canDelete = isOwner || isCurrentUserAdmin;
    const canReply = user && String(user.id) !== String(a.sender_id);
    const isToxic = a.is_toxic; // <-- check toxic flag
    const createdAt = new Date(a.createdAt).getTime ? new Date(a.createdAt).getTime() : Date.now();
    const isNew = !isToxic && (Date.now() - createdAt) < ONE_DAY_MS;
    const bg = level % 2 === 0 ? "bg-white" : "bg-gray-50";
    const leftIndentPx = Math.min(level * 20, 160);

    return (
      <div key={a.id} className="relative mb-4" style={{ marginLeft: `${leftIndentPx}px` }} onClick={(e) => e.stopPropagation()}>
        {level >= 1 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${-12}px`,
              top: "8px",
              bottom: "8px",
              width: "3px",
              background: "linear-gradient(180deg, #E5E7EB, #D1D5DB)",
              borderRadius: "2px",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.03)"
            }}
          />
        )}

        <div className={`${bg} border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition transform`}>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {a.senderProfilePic ? (
                  <img src={a.senderProfilePic} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                    {a.senderName ? a.senderName[0] : "U"}
                  </div>
                )}
              </div>

              <div>
                <div className={`flex items-center gap-2`}>
                  <div className="font-medium text-sm">{a.senderName || a.sender?.username}</div>
                  {(String(a.sender_id) === String(question.creator_id)) && (
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Author</div>
                  )}
                  {(a.senderRole === "forum_admin" || a.senderRole === "global_admin") && (
                    <div className="text-xs bg-gray-100 px-2 py-0.5 rounded">Admin</div>
                  )}
                  {isNew && (
                    <div className="ml-1 text-xs px-2 py-0.5 rounded bg-yellow-300 text-yellow-800 font-semibold animate-pulse transform transition hover:-translate-y-0.5">
                      NEW
                    </div>
                  )}
                  {isToxic && (
                    <div className="ml-1 text-xs px-2 py-0.5 rounded bg-red-300 text-red-800 font-semibold animate-pulse transform transition hover:-translate-y-0.5">
                      BANNED
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    startEditing(a);
                  }}
                  disabled={isToxic}
                  className={`text-xs px-2 py-1 border rounded hover:bg-gray-50 transition ${isToxic ? "cursor-not-allowed" : ""} `}
                >
                  Edit
                </button>
              )}
              {canDelete && <button onClick={(ev) => { ev.stopPropagation(); removeAnswer(a.id); }} disabled={isToxic} className={`text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50 transition ${isToxic ? "cursor-not-allowed" : ""}`}>Delete</button>}
              {canReply && (
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    // NEW: hide main composer when opening inline reply (avoid duplicate UI)
                    if (showComposer) setShowComposer(false);
                    setInlineReplyId(inlineReplyId === a.id ? null : a.id);
                    setTimeout(() => composerTextareaRef.current?.focus?.(), 80);
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Reply
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 text-gray-700 whitespace-pre-wrap">
            {editingAnswerId === a.id ? (
              <EditAnswer answer={a} onCancel={() => {
                setEditingAnswerId(null);
                setEditingDrafts(prev => {
                  const next = { ...(prev || {}) };
                  delete next[a.id];
                  return next;
                });
                setShowComposer(true); // restore composer on cancel
              }} />
            ) : (
              <>
                <div className={`text-sm ${isToxic ? "blur-sm hover:blur-0 hover:cursor-pointer" : ""}`}>{a.content}</div>
                {a.image_url && <img src={a.image_url} alt="answer" className="mt-3 max-h-48 rounded object-contain" />}
              </>
            )}
          </div>
        </div>

        {inlineReplyId === a.id && (
          <InlineReply parentId={a.id} onCancel={() => {
            setInlineReplyId(null);
            setShowComposer(true); // restore composer when inline reply cancelled
          }} />
        )}

        {a.children && a.children.map(child => renderNode(child, level + 1))}
      </div>
    );
  };

  // ---------- compute visible new count ----------
  const initialUnseen = Number(question?.unseenCount || 0);
  const nodeNewCount = countNewAnswersFromNodes(answers);
  const computedNewCount = loadingAnswers ? initialUnseen : nodeNewCount;

  // ---------- fetch AI summary and show modal ----------
  async function fetchAndShowSummary({ forceRefresh = false } = {}) {
    if (!question || !question.id) return;
    // always call API each click per requirement
    setShowSummaryModal(true);
    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryText(null);

    try {
      const res = await fetch(`/api/forum/questions/${question.id}/ai_summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error || data?.details || "AI summary failed";
        setSummaryError(errMsg);
        setSummaryLoading(false);
        return;
      }
      setSummaryText(data.summary || "");
      setSummaryError(null);
    } catch (err) {
      console.error("fetchSummary error", err);
      setSummaryError(err.message || "AI request failed");
    } finally {
      setSummaryLoading(false);
    }
  }

  // only Close button closes the modal
  const closeSummaryModal = () => {
    setShowSummaryModal(false);
  };

  // lock body scroll when modal open
  useEffect(() => {
    if (showSummaryModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev || ""; };
    }
    return;
  }, [showSummaryModal]);

  // ---------- render ----------
  return (
    <>
      {/* When summary modal is open, hide the entire main content so only modal is visible */}
      <div style={{ display: showSummaryModal ? "none" : undefined }}>
        {/* QUESTION card */}
        <div className="mb-4 border rounded p-4 bg-gray-50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold">{question.title}</h3>
              <div className="text-xs text-gray-500 mt-1">By {question.creatorName || question.User?.username || "Unknown"} • {new Date(question.createdAt).toLocaleString()}</div>
            </div>
          </div>
          <p className="mt-3 text-gray-700">{question.content}</p>
          {question.image_url && <div className="mt-3"><img src={question.image_url} alt="question" className="max-h-48 object-contain rounded w-full" /></div>}
        </div>

        {/* ALL ANSWERS header + composer toggle + AI summary button */}
        <div className="mb-4 flex items-center justify-between">
          <div className="font-semibold">All answers</div>

          <div className="flex items-center gap-3">
            {/* AI Summary Button: show ONLY after answers finished loading */}
            {!loadingAnswers && computedNewCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); if (!summaryLoading) fetchAndShowSummary({ forceRefresh: false }); }}
                disabled={summaryLoading}
                className={`flex items-center gap-2 px-3 py-1 border rounded transition focus:outline-none
                  ${summaryLoading ? "opacity-60 cursor-wait" : "hover:shadow-sm transform hover:-translate-y-0.5 hover:scale-105"}`}
                title="Generate summary of new answers (last 24 hours)"
              >
                <svg className={`w-4 h-4 transform ${summaryLoading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                <span className="text-sm text-gray-700">Summarize new ({computedNewCount})</span>
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); setShowComposer(v => !v); }}
              className="flex items-center gap-2 px-3 py-1 border rounded hover:shadow-sm transform transition hover:-translate-y-0.5"
              title={showComposer ? "Hide composer" : "Show composer"}
            >
              <span className={`transform transition ${showComposer ? "rotate-180" : "rotate-0"}`}>
                <HiChevronDown />
              </span>
              <span className="text-sm text-gray-700">{showComposer ? "Hide answer box" : "Show answer box"}</span>
            </button>
          </div>
        </div>

        {loadingAnswers ? (
          <div className="text-gray-500 py-6">Loading answers…</div>
        ) : (
          <div className="mb-24">
            {answers.length === 0 && <div className="text-sm text-gray-400">No answers yet — be the first to reply.</div>}
            {answers.map(a => renderNode(a, 0))}
          </div>
        )}

        {/* composer fixed bottom (toggleable) */}
        {showComposer && (
          <div className="fixed bottom-5 left-4 right-4 lg:right-8 lg:left-auto lg:w-[46%] z-50" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white border-4 rounded-lg shadow-lg p-3 transition-transform transform hover:-translate-y-0.5">
              {replyTo && (
                <div className="mb-2 text-xs text-gray-600 flex items-center justify-between">
                  <div>Replying to answer #{replyTo}</div>
                  <button onClick={(ev) => { ev.stopPropagation(); setReplyTo(null); }} className="text-sm px-2 py-0.5 rounded hover:bg-gray-100">Cancel</button>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {user?.profilePic ? (
                    <img src={user.profilePic} alt="me" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">{user?.name ? user.name[0] : "U"}</div>
                  )}
                </div>

                <div className="flex-1">
                  <textarea
                    ref={composerTextareaRef}
                    value={composerText}
                    onChange={(e) => {
                      setComposerText(e.target.value);
                      const ta = composerTextareaRef.current;
                      if (ta) {
                        ta.style.height = "auto";
                        ta.style.height = Math.min(200, ta.scrollHeight) + "px";
                      }
                    }}
                    rows={1}
                    placeholder={replyTo ? "Write a reply..." : "Write an answer..."}
                    className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                  />

                  {composerPreview && (
                    <div className="mt-2 relative">
                      <img src={composerPreview} alt="preview" className="max-h-36 rounded w-auto" />
                      <button onClick={(ev) => { ev.stopPropagation(); setComposerFile(null); setComposerPreview(null); }} className="absolute top-1 right-1 bg-gray-900 text-white rounded px-2"><FiX /></button>
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <button onClick={handleCameraClick} title="Attach image" className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transform hover:-translate-y-0.5 transition shadow-sm">
                    <FaCamera className="w-5 h-5 text-gray-700" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onSelectFileForComposer(e.target.files?.[0])} />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-3">
                <button onClick={clearComposer} title="Clear" className="flex items-center gap-2 text-sm px-3 py-1 border rounded hover:bg-gray-100 transition transform hover:-translate-y-0.5">
                  <FiX className="w-4 h-4" /> Clear
                </button>

                <button onClick={submitComposer} disabled={submitting} title={replyTo ? "Send reply" : "Send answer"} className={`inline-flex items-center justify-center w-11 h-11 rounded-full ${submitting ? "bg-blue-300 cursor-wait" : "bg-blue-600 hover:bg-blue-700"} text-white shadow-md transform transition hover:-translate-y-0.5 active:translate-y-0.5`}>
                  <MdSend className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: showComposer ? 120 : 20 }} />
      </div>

      {/* SUMMARY MODAL: when open it is the only visible content */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          {/* backdrop - no onClick to prevent outside-close */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />

          <div className="relative z-10 w-full max-w-3xl mx-4">
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden transform transition-all scale-100">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="text-sm font-medium">AI Summary — New answers (last 24h)</div>
                <div className="flex items-center gap-2">
                  {/* Only Close button remains. This button closes the modal. */}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeSummaryModal(); }}
                    className="text-xs px-3 py-1 border rounded hover:shadow-md transform transition hover:-translate-y-0.5 hover:scale-105 bg-white"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[60vh] overflow-auto">
                {summaryLoading ? (
                  <div className="flex items-center gap-3">
                    <img src={loader} width="36" alt="loading" />
                    <div>Generating summary... this may take a few seconds</div>
                  </div>
                ) : summaryError ? (
                  <div className="text-sm text-red-600">
                    AI summarization failed: {summaryError}
                    <div className="mt-3 text-xs text-gray-500">Only the Close button will dismiss this modal. Try again later if needed.</div>
                  </div>
                ) : summaryText ? (
                  <SummaryRenderer text={summaryText} />
                ) : (
                  <div className="text-sm text-gray-500">No summary available. Click Summarize from the question view to generate.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * SummaryRenderer
 * - helper that safely renders plain text with **bold** markers converted to <strong>.
 */
function SummaryRenderer({ text }) {
  const escapeHtml = (str) => str.replace(/[&<>\"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const escaped = escapeHtml(text || "");
  const html = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
  return <div className="prose-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
