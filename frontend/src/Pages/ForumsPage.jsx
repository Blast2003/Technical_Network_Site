import React, { useEffect, useState } from "react";
import ForumCard from "../Components/forums/ForumCard";
import { useRecoilValue } from "recoil";
import userAtom from "../Atoms/userAtom";
import { useSocket } from "../Context/SocketContext";
import LeftNav from "../Components/LeftNav";
import loader from "../assets/loader.svg";

export default function ForumsPage() {
  const [forums, setForums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const user = useRecoilValue(userAtom);
  const { socket } = useSocket();

  // invites that were sent TO the current user (received invites)
  const [invites, setInvites] = useState([]);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // NOTE: track both id and action so only the clicked button shows "Processing..."
  const [inviteProcessingId, setInviteProcessingId] = useState(null); // id of invite being processed (used to disable both buttons)
  const [inviteProcessingAction, setInviteProcessingAction] = useState(null); // "accept" or "decline" to display "Processing..." only on clicked button

  // Edit modal states
  const [editingForum, setEditingForum] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState("public");
  const [editLoading, setEditLoading] = useState(false);

  // Create modal states
  const [creating, setCreating] = useState(false);
  const [createFieldKey, setCreateFieldKey] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createVisibility, setCreateVisibility] = useState("public");
  const [createLoading, setCreateLoading] = useState(false);

  const [pageError, setPageError] = useState(null);

  useEffect(()=> {
    let mounted = true;
    setIsLoading(true);
    fetch("/api/forum")
      .then(async r => {
        if (!r.ok) {
          console.warn("Failed fetching forums", r.status);
          return [];
        }
        return r.json();
      })
      .then(data => { if (mounted) setForums(data || []); })
      .catch((err)=> { console.error("Forums fetch error", err); if (mounted) setForums([]); })
      .finally(()=> mounted && setIsLoading(false));
    return () => { mounted = false; };
  }, [user]); // refetch when user changes so permissions UI updates

  // Load received invites for the current user
  const fetchReceivedInvites = async () => {
    if (!user) return;
    setInvitesLoading(true);
    try {
      const res = await fetch("/api/forum/invites/received"); // <-- backend endpoint expected
      if (!res.ok) {
        console.warn("failed loading invites", res.status);
        setInvites([]);
        return;
      }
      const data = await res.json();
      // Expect array of invites, optionally populated with forum and sender info
      setInvites(data || []);
      // annotate forums list so cards show "Invited"
      setForums(prev => {
        if (!Array.isArray(data)) return prev;
        const invitedForumIds = new Set((data || []).map(inv => inv.forum_id || inv.forum?.id).filter(Boolean));
        return prev.map(f => {
          if (invitedForumIds.has(f.id) && f.status !== "joined") return { ...f, status: "invited" };
          return f;
        });
      });
    } catch (err) {
      console.error("fetchReceivedInvites error", err);
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    // fetch invites when user becomes available
    if (!user) return;
    fetchReceivedInvites();
  }, [user]);

  // Socket updates: dedupe on create and handle invites & forum events
  useEffect(() => {
    if (!socket) return;
    const onCreated = (f) => {
      setForums(prev => {
        if (prev.some(p => p.id === f.id)) return prev;
        return [f, ...prev];
      });
    };
    const onUpdated = (f) => setForums(prev => prev.map(x => x.id === f.id ? { ...x, ...f } : x));
    const onDeleted = ({ forumId }) => setForums(prev => prev.filter(x => x.id !== forumId));

    // invite delivered to recipient
    const onInvite = (invite) => {
      // invite is sent specifically to the recipient; only the recipient will get this socket event
      setInvites(prev => {
        // avoid duplicates
        if (prev.some(i => i.id === invite.id)) return prev;
        return [invite, ...prev];
      });
      // mark corresponding forum as invited in the UI
      setForums(prev => prev.map(f => {
        if (f.id === (invite.forum_id || invite.forum?.id)) {
          if (f.status !== "joined") return { ...f, status: "invited" };
        }
        return f;
      }));
    };

    // member_joined events are emitted to forum room on accept — update member_count
    const onMemberJoined = ({ forumId, userId }) => {
      setForums(prev => prev.map(f => f.id === forumId ? { ...f, member_count: (f.member_count || 0) + 1 } : f));
      // if current user is the joined user, update status to joined and remove invite
      if (user && user.id === userId) {
        setForums(prev => prev.map(f => f.id === forumId ? { ...f, status: "joined" } : f));
        setInvites(prev => prev.filter(i => (i.forum_id || i.forum?.id) !== forumId));
      }
    };

    socket.on("forum_created", onCreated);
    socket.on("forum_updated", onUpdated);
    socket.on("forum_deleted", onDeleted);
    socket.on("forum_invite", onInvite);
    socket.on("member_joined", onMemberJoined);

    return () => {
      socket.off("forum_created", onCreated);
      socket.off("forum_updated", onUpdated);
      socket.off("forum_deleted", onDeleted);
      socket.off("forum_invite", onInvite);
      socket.off("member_joined", onMemberJoined);
    };
  }, [socket, user]);

  const updateForumInList = (updated) => {
    setForums(prev => {
      const i = prev.findIndex(f => f.id === updated.id);
      if (i === -1) return [updated, ...prev];
      const copy = [...prev];
      copy[i] = { ...copy[i], ...updated };
      return copy;
    });
  };

  // Edit handlers
  const handleEditClick = (forum) => {
    setEditingForum(forum);
    setEditTitle(forum.title || "");
    setEditDescription(forum.description || "");
    setEditVisibility(forum.visibility || "public");
  };
  const closeEdit = () => {
    setEditingForum(null);
    setEditTitle("");
    setEditDescription("");
    setEditVisibility("public");
    setEditLoading(false);
  };
  const submitEdit = async () => {
    if (!editingForum) return;
    // NOTE: updateForum API requires global admin. UI should only allow that (see canManage below).
    setEditLoading(true);
    try {
      const payload = { title: editTitle, description: editDescription, visibility: editVisibility };
      const res = await fetch(`/api/forum/${editingForum.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("update forum failed", data);
        setPageError(data?.error || "Update failed");
        setTimeout(()=> setPageError(null), 3000);
        setEditLoading(false);
        return;
      }
      updateForumInList(data);
      closeEdit();
    } catch (err) {
      console.error("submitEdit error", err);
      setPageError("Update failed");
      setTimeout(()=> setPageError(null), 3000);
      setEditLoading(false);
    }
  };

  const handleDeleteClick = async (forum) => {
    const ok = window.confirm(`Delete forum "${forum.title}"? This action cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/forum/${forum.id}`, { method: "DELETE" });
      const body = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("delete forum failed", body);
        setPageError(body?.error || "Delete failed");
        setTimeout(()=> setPageError(null), 3000);
        return;
      }
      setForums(prev => prev.filter(f => f.id !== forum.id));
      // remove any related invites in our invites list
      setInvites(prev => prev.filter(i => (i.forum_id || i.forum?.id) !== forum.id));
    } catch (err) {
      console.error("delete forum error", err);
      setPageError("Delete failed");
      setTimeout(()=> setPageError(null), 3000);
    }
  };

  // Create forum logic
  const openCreate = () => setCreating(true);
  const closeCreate = () => {
    setCreating(false);
    setCreateFieldKey("");
    setCreateTitle("");
    setCreateDescription("");
    setCreateVisibility("public");
    setCreateLoading(false);
  };

  const submitCreate = async () => {
    if (!user?.is_global_admin) {
      setPageError("Only global admins can create forums");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }
    if (!createFieldKey || !createTitle) {
      setPageError("Field key and title are required");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }
    setCreateLoading(true);
    try {
      const payload = {
        field_key: createFieldKey,
        title: createTitle,
        description: createDescription || null,
        visibility: createVisibility,
        create_template_threads: false,
      };
      const res = await fetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("create forum failed", data);
        setPageError(data?.error || "Create forum failed");
        setTimeout(()=> setPageError(null), 3000);
        setCreateLoading(false);
        return;
      }

      // Use server-returned forum object directly (don't rely on purely-local mutations)
      const newForum = {
        ...data,
        status: data.status || "joined",           // treat creator as joined if backend didn't return status
        isAdmin: data.isAdmin ?? true,
        member_count: data.member_count ?? 1,
      };

      // add locally only if not already present (socket might add it too)
      setForums(prev => prev.some(p => p.id === newForum.id) ? prev : [newForum, ...prev]);
      closeCreate();
    } catch (err) {
      console.error("create forum error", err);
      setPageError("Create forum failed");
      setTimeout(()=> setPageError(null), 3000);
      setCreateLoading(false);
    }
  };

  // ----- Invites modal actions (for current user received invites) -----
  const openInvitesModal = () => {
    setInvitesOpen(true);
    // refresh list when opening
    fetchReceivedInvites();
  };
  const closeInvitesModal = () => setInvitesOpen(false);

  const acceptInvite = async (invite) => {
    if (!invite) return;
    // set both id (disables both buttons) and action (only accept shows Processing...)
    setInviteProcessingId(invite.id);
    setInviteProcessingAction("accept");
    try {
      const res = await fetch(`/api/forum/${invite.forum_id}/invite/${invite.id}/accept`, { method: "POST" });
      const body = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("accept invite failed", body);
        setPageError(body?.error || "Accept failed");
        setTimeout(()=> setPageError(null), 3000);
        // clear processing state
        setInviteProcessingId(null);
        setInviteProcessingAction(null);
        return;
      }
      // remove invite locally
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      // update forum card to joined
      setForums(prev => prev.map(f => f.id === invite.forum_id ? { ...f, status: "joined", member_count: (f.member_count || 0) + 1 } : f));
    } catch (err) {
      console.error("accept invite error", err);
      setPageError("Accept failed");
      setTimeout(()=> setPageError(null), 3000);
    } finally {
      setInviteProcessingId(null);
      setInviteProcessingAction(null);
    }
  };

  const declineInvite = async (invite) => {
    if (!invite) return;
    // set both id (disables both buttons) and action (only decline shows Processing...)
    setInviteProcessingId(invite.id);
    setInviteProcessingAction("decline");
    try {
      const res = await fetch(`/api/forum/${invite.forum_id}/invite/${invite.id}/decline`, { method: "POST" });
      const body = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("decline invite failed", body);
        setPageError(body?.error || "Decline failed");
        setTimeout(()=> setPageError(null), 3000);
        // clear processing state
        setInviteProcessingId(null);
        setInviteProcessingAction(null);
        return;
      }
      // remove invite locally
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      // update forum card to allow join again
      setForums(prev => prev.map(f => f.id === invite.forum_id ? { ...f, status: undefined } : f));
    } catch (err) {
      console.error("decline invite error", err);
      setPageError("Decline failed");
      setTimeout(()=> setPageError(null), 3000);
    } finally {
      setInviteProcessingId(null);
      setInviteProcessingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p className="mt-3 text-gray-600">Loading forums...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen p-4">
      <div className="flex flex-col md:flex-row justify-center gap-6">
        <aside className="hidden md:block md:w-64">
          <div className="bg-white rounded-lg shadow p-4">
            <LeftNav />
          </div>
        </aside>

        <main className="flex-1 max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Forums</h1>

            <div className="flex items-center gap-3">
              {/* invites bell */}
              <div className="relative">
                <button
                  onClick={openInvitesModal}
                  className="p-2 rounded-full hover:bg-gray-200 transition focus:outline-none"
                  title="Invites"
                >
                  {/* simple bell icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>

                {invites.length > 0 && (
                  <div className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                    {invites.length}
                  </div>
                )}
              </div>

              {user?.is_global_admin && (
                <button
                  onClick={openCreate}
                  className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 active:scale-95"
                >
                  Create Forum
                </button>
              )}
            </div>
          </div>

          {pageError && (
            <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-red-700">{pageError}</div>
          )}

          {forums.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-lg font-semibold">No forums yet</p>
              <p className="text-gray-500 mt-2">Global admins can create new forums from the admin panel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-20">
              {forums.map(f => {
                // Align UI permissions with backend: forum-level update/delete are global-admin only
                const canManage = !!user?.is_global_admin;
                return (
                  <ForumCard
                    key={f.id}
                    forum={f}
                    currentUser={user}
                    onUpdate={updateForumInList}
                    canManage={canManage}
                    onEdit={() => handleEditClick(f)}
                    onDelete={async (forum) => await handleDeleteClick(forum)}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Invites modal */}
      {invitesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Invites</h3>
        
            </div>

            <div className="space-y-3">
              {invitesLoading ? (
                <div className="text-center text-gray-500">Loading invites...</div>
              ) : invites.length === 0 ? (
                <div className="text-center text-gray-500">No invites</div>
              ) : (
                <div className="space-y-2">
                  {invites.map(inv => {
                    const forumId = inv.forum_id || inv.forum?.id;
                    const forumTitle = inv.forum?.title || (forums.find(f => f.id === forumId)?.title) || "Forum";
                    const sender = inv.sender || inv.sender_id ? (inv.sender || { id: inv.sender_id, name: inv.sender_name || "Unknown", profilePic: inv.sender_profilePic }) : null;
                    return (
                      <div key={inv.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                        <div className="flex flex-col gap-1">
                          {/* Top line: avatar + username */}
                          <div className="flex items-center gap-2">
                            <img src={sender?.profilePic || "https://placehold.co/40x40"} alt={sender?.name} className="w-8 h-8 rounded-full object-cover" />
                            <div className="font-medium text-gray-800">{sender?.name || "Someone"}</div>
                          </div>

                          {/* Second line: forum title */}
                          <div className="text-sm text-gray-700 font-medium">
                            Forum: {forumTitle}
                          </div>

                          {/* Third line: message */}
                          {inv.message && (
                            <div className="text-xs text-gray-500 italic">Message: “{inv.message}”</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => acceptInvite(inv)}
                            disabled={inviteProcessingId === inv.id}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition transform hover:scale-105 focus:outline-none disabled:opacity-60"
                          >
                            {/* show Processing... only on accept when action === 'accept' */}
                            {inviteProcessingId === inv.id && inviteProcessingAction === "accept" ? "Processing..." : "Accept"}
                          </button>
                          <button
                            onClick={() => declineInvite(inv)}
                            disabled={inviteProcessingId === inv.id}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:scale-105 transition transform focus:outline-none disabled:opacity-60"
                          >
                            {/* show Processing... only on decline when action === 'decline' */}
                            {inviteProcessingId === inv.id && inviteProcessingAction === "decline" ? "Processing..." : "Decline"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 text-right">
              <button onClick={closeInvitesModal} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingForum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded w-full max-w-2xl p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Forum</h3>
              <button
                onClick={closeEdit}
                className="text-sm text-gray-600 px-3 py-1 rounded transition transform hover:scale-105 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Field key (read-only)</label>
                <input value={editingForum.field_key} disabled className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input value={editTitle} onChange={(e)=>setEditTitle(e.target.value)} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} rows={4} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Visibility</label>
                <select value={editVisibility} onChange={(e)=>setEditVisibility(e.target.value)} className="mt-1 border rounded p-2">
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={closeEdit}
                  className="px-4 py-2 bg-gray-200 rounded transition transform hover:scale-105 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEdit}
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded transition transform hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95"
                >
                  {editLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Forum</h3>
              <button onClick={closeCreate} className="text-sm text-gray-600 px-3 py-1 rounded transition transform hover:scale-105">Close</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Field key</label>
                <input value={createFieldKey} onChange={(e)=>setCreateFieldKey(e.target.value)} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" placeholder="unique-key" disabled={createLoading}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input value={createTitle} onChange={(e)=>setCreateTitle(e.target.value)} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" disabled={createLoading}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea value={createDescription} onChange={(e)=>setCreateDescription(e.target.value)} rows={4} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" disabled={createLoading}/>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={closeCreate} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition transform hover:scale-105 focus:outline-none" disabled={createLoading}>Cancel</button>
                <button onClick={submitCreate} disabled={createLoading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-blue-700 transition transform hover:scale-105 focus:outline-none">
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
