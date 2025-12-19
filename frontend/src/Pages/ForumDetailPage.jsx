import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ThreadCard from "../Components/forums/ThreadCard";
import { useSocket } from "../Context/SocketContext";
import { useRecoilValue } from "recoil";
import userAtom from "../Atoms/userAtom";
import loader from "../assets/loader.svg";
import { toast } from 'react-toastify';
import { FiFileText } from "react-icons/fi"; // NEW: logs icon

export default function ForumDetailPage(){
  const { forumId } = useParams();
  const navigate = useNavigate();
  const user = useRecoilValue(userAtom);
  const { socket } = useSocket();

  const [forum, setForum] = useState(null);
  const [threads, setThreads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  console.log("threads: ", threads)

  // Invite modal
  const [inviting, setInviting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // forum-specific invites (invites created for this forum)
  const [forumInvites, setForumInvites] = useState([]);
  const [forumInvitesLoading, setForumInvitesLoading] = useState(false);

  // Members modal & data
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  // processing id + action so only clicked button shows Processing...
  const [memberProcessingId, setMemberProcessingId] = useState(null);
  const [memberProcessingAction, setMemberProcessingAction] = useState(null); // 'promote' | 'revoke' | 'remove'

  console.log("members: ", members)

  // Thread edit/create state
  const [editingThread, setEditingThread] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const [creatingThread, setCreatingThread] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createImagePreview, setCreateImagePreview] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  // small page-level error toast
  const [pageError, setPageError] = useState(null);

  // membership action loading
  const [joinLoading, setJoinLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // NEW: ban states (check current user's ban status)
  const [banNoticeOpen, setBanNoticeOpen] = useState(false);
  const [banInfo, setBanInfo] = useState(null); // { banned: true, ban: { expires_at, ... } }
  const [banCountdown, setBanCountdown] = useState(null);
  const [banChecking, setBanChecking] = useState(false);

  useEffect(()=> {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/forum/${forumId}`);
        if (!res.ok) {
          const text = await res.text().catch(()=>null);
          console.error("getForum failed", res.status, text);
          if (mounted) setErrorMsg("Forum not found or permission denied.");
          return;
        }
        const data = await res.json();
        if (!mounted) return;
        setForum(data);
        setErrorMsg(null);

        const canViewThreads = data.status === "joined" || data.isAdmin || user?.is_global_admin;
        if (canViewThreads) {
          if (Array.isArray(data.threads)) {
            setThreads(data.threads || []);
          } else {
            const thrRes = await fetch(`/api/forum/${forumId}/threads`);
            if (!thrRes.ok) {
              console.warn("threads fetch failed", thrRes.status);
              setPageError("Failed to load threads");
              setThreads([]);
            } else {
              const tdata = await thrRes.json();
              setThreads(tdata || []);
            }
          }
        } else {
          setThreads([]);
        }
      } catch (err) {
        console.error("ForumDetailPage load error", err);
        if (mounted) setErrorMsg("Failed to load forum.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  },[forumId, user?.id]);

  // fetch invites for this forum (invites created by others or you)
  const fetchForumInvites = async () => {
    setForumInvitesLoading(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/invites`);
      if (!res.ok) {
        setForumInvites([]);
        return;
      }
      const data = await res.json();
      setForumInvites(data || []);
    } catch (err) {
      console.error("fetchForumInvites error", err);
      setForumInvites([]);
    } finally {
      setForumInvitesLoading(false);
    }
  };

  // fetch members for this forum
  const fetchForumMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/members`);
      if (!res.ok) {
        setMembers([]);
        return;
      }
      const data = await res.json();
      setMembers(data || []);
    } catch (err) {
      console.error("fetchForumMembers error", err);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  // live updates (optional)
  useEffect(()=> {
    if (!socket) return;
    const onUpdated = (f) => { if (f.id === Number(forumId)) setForum(prev => ({ ...prev, ...f })); };
    const onNewThread = ({ thread }) => {
      if (thread.forum_id === Number(forumId)) setThreads(prev => [thread, ...prev]);
    };
    const onInvite = (invite) => {
      if (invite.forum_id === Number(forumId)) {
        setForumInvites(prev => prev.some(i => i.id === invite.id) ? prev : [invite, ...prev]);
      }
    };

    socket.on("forum_updated", onUpdated);
    socket.on("new_thread", onNewThread);
    socket.on("forum_invite", onInvite);
    return () => {
      socket.off("forum_updated", onUpdated);
      socket.off("new_thread", onNewThread);
      socket.off("forum_invite", onInvite);
    };
  }, [socket, forumId]);

  // NEW: check current user's ban status (returns the status object)
  const checkMyBanStatus = async () => {
    if (!user || !forumId) return { banned: false };
    setBanChecking(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/ban/me`);
      if (!res.ok) {
        setBanChecking(false);
        return { banned: false };
      }
      const data = await res.json();
      setBanChecking(false);
      return data;
    } catch (err) {
      console.error("checkMyBanStatus error", err);
      setBanChecking(false);
      return { banned: false };
    }
  };

  // NEW: countdown for banInfo
  useEffect(()=> {
    if (!banInfo?.banned || !banInfo?.ban?.expires_at) {
      setBanCountdown(null);
      return;
    }
    const update = () => {
      const now = Date.now();
      const end = new Date(banInfo.ban.expires_at).getTime();
      const diff = Math.max(0, end - now);
      const days = Math.floor(diff / (24*60*60*1000));
      const hours = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));
      const mins = Math.floor((diff % (60*60*1000)) / (60*1000));
      const secs = Math.floor((diff % (60*1000)) / 1000);
      setBanCountdown(`${days}d ${hours}h ${mins}m ${secs}s`);
      if (diff <= 0) {
        setBanInfo(null);
        setBanNoticeOpen(false);
        setBanCountdown(null);
      }
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [banInfo]);

  // NOTE: updated to async to check ban before navigation
  const handleThreadClick = async (thread) => {
    // check if current user is banned
    const status = await checkMyBanStatus();
    if (status?.banned) {
      setBanInfo(status);
      setBanNoticeOpen(true);
      return; // prevent navigation
    }
    navigate(`/tech/forums/${forumId}/threads/${thread.id}`, { state: { thread } });
  };

  const handleJoin = async () => {
    if (joinLoading) return;
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/join`, { method: "POST" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("join failed", data);
        setPageError(data?.error || "Failed to join forum.");
        setTimeout(()=> setPageError(null), 4000);
        setJoinLoading(false);
        return;
      }
      if (data && data.id) {
        setForum(data);
        if (Array.isArray(data.threads)) setThreads(data.threads);
        else {
          const thrRes = await fetch(`/api/forum/${forumId}/threads`);
          if (thrRes.ok) setThreads(await thrRes.json());
        }
      } else {
        const updated = await (await fetch(`/api/forum/${forumId}`)).json();
        setForum(updated);
        if (updated.status === "joined") {
          if (Array.isArray(updated.threads)) setThreads(updated.threads);
          else {
            const thrRes = await fetch(`/api/forum/${forumId}/threads`);
            if (thrRes.ok) setThreads(await thrRes.json());
          }
        }
      }
    } catch (err) {
      console.error("handleJoin error", err);
      setPageError("Failed to join forum.");
      setTimeout(()=> setPageError(null), 4000);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeave = async () => {
    if (leaveLoading) return;
    setLeaveLoading(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/leave`, { method: "POST" });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("leave failed", data);
        setPageError(data?.error || "Failed to leave forum.");
        setTimeout(()=> setPageError(null), 4000);
        setLeaveLoading(false);
        return;
      }
      if (data && data.id) {
        setForum(data);
        setThreads([]);
      } else {
        const updated = await (await fetch(`/api/forum/${forumId}`)).json();
        setForum(updated);
        setThreads([]);
      }
    } catch (err) {
      console.error(err);
      setPageError("Failed to leave forum.");
      setTimeout(()=> setPageError(null), 4000);
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleBack = () => navigate("/tech/forums");

  // Invite search
  const runSearch = async (term) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/user/search/${encodeURIComponent(term)}`);
      if (!res.ok) {
        setSearchResults([]);
        return;
      }
      const data = await res.json();
      setSearchResults(data.searchResults || []);
    } catch (err) {
      console.error("user search error", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const doInvite = async (receiverId) => {
    if (!receiverId) return;
    setInviteSending(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: receiverId, message: inviteMessage || null }),
      });

      if (res.status === 201) {
        const created = await res.json().catch(()=>({}));
        setForumInvites(prev => prev.some(i => i.id === created.id) ? prev : [created, ...prev]);
        setInviting(false);
        setSearchTerm("");
        setSearchResults([]);
        setInviteMessage("");
        toast("Invite sent")
        return;
      }

      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("invite failed", data);
        setPageError(data?.error || "Invite failed.");
        setTimeout(()=> setPageError(null), 4000);
        setInviteSending(false);
        return;
      }

      if (data?.message === "Already invited") {
        await fetchForumInvites();
        setPageError("User already invited");
        setTimeout(()=> setPageError(null), 3000);
        return;
      }

      await fetchForumInvites();
      setInviting(false);
      setSearchTerm("");
      setSearchResults([]);
      setInviteMessage("");
      setPageError("Invite processed");
      setTimeout(()=> setPageError(null), 3000);
    } catch (err) {
      console.error("doInvite error", err);
      setPageError("Invite failed");
      setTimeout(()=> setPageError(null), 3000);
    } finally {
      setInviteSending(false);
    }
  };

  const openInviteModal = () => {
    setInviting(true);
    fetchForumInvites();
  };
  const closeInviteModal = () => {
    setInviting(false);
    setSearchTerm("");
    setSearchResults([]);
  };

  // ---------- Privilege helpers ----------
  const roleLevel = (r) => {
    if (!r) return 1;
    if (r === "global_admin") return 3;
    if (r === "forum_admin") return 2;
    return 1;
  };

  // Check whether current user may act on target member (strictly greater level and not self)
  const canActOn = (targetRole, targetUserId) => {
    if (!user) return false;
    if (targetUserId === user.id) return false; // never act on self
    const currLvl = user?.is_global_admin ? 3 : (forum?.isAdmin ? 2 : 1);
    const targetLvl = roleLevel(targetRole);
    return currLvl > targetLvl;
  };

  // Member actions
  const openMembersModal = () => {
    setMembersOpen(true);
    fetchForumMembers();
  };
  const closeMembersModal = () => {
    setMembersOpen(false);
    setMembers([]);
  };

  // ---- UPDATED: restrict promotion to global_admin only ----
  const promoteToForumAdmin = async (memberUserId, memberRole) => {
    // client-side guard: only global_admin can assign forum_admin
    if (!user?.is_global_admin) {
      setPageError("Only global admins can assign forum admin role.");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }
    // still ensure you can't act on self and privilege hierarchy
    if (!canActOn(memberRole, memberUserId)) {
      setPageError("Not allowed to promote this user.");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }

    setMemberProcessingId(memberUserId);
    setMemberProcessingAction("promote");
    try {
      const res = await fetch(`/api/forum/${forumId}/members/${memberUserId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "forum_admin" }),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("promote failed", data);
        setPageError(data?.error || "Failed to promote member");
        setTimeout(()=> setPageError(null), 4000);
        return;
      }
      setMembers(prev => prev.map(m => m.user.id === memberUserId ? { ...m, role: "forum_admin" } : m));
      toast("Member promoted to forum admin");
    } catch (err) {
      console.error("promoteToForumAdmin error", err);
      setPageError("Failed to promote member");
      setTimeout(()=> setPageError(null), 4000);
    } finally {
      setMemberProcessingId(null);
      setMemberProcessingAction(null);
    }
  };

  const revokeForumAdmin = async (memberUserId, memberRole) => {
    if (!canActOn(memberRole, memberUserId)) {
      setPageError("Not allowed to revoke this user's role.");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }
    setMemberProcessingId(memberUserId);
    setMemberProcessingAction("revoke");
    try {
      const res = await fetch(`/api/forum/${forumId}/members/${memberUserId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "member" }),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("revoke failed", data);
        setPageError(data?.error || "Failed to revoke role");
        setTimeout(()=> setPageError(null), 4000);
        return;
      }
      setMembers(prev => prev.map(m => m.user.id === memberUserId ? { ...m, role: "member" } : m));
      toast("Forum admin role revoked");
    } catch (err) {
      console.error("revokeForumAdmin error", err);
      setPageError("Failed to revoke role");
      setTimeout(()=> setPageError(null), 4000);
    } finally {
      setMemberProcessingId(null);
      setMemberProcessingAction(null);
    }
  };

  const removeMember = async (memberUserId, memberRole) => {
    if (!canActOn(memberRole, memberUserId)) {
      setPageError("Not allowed to remove this user.");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }
    const ok = window.confirm("Remove this member from forum?");
    if (!ok) return;
    setMemberProcessingId(memberUserId);
    setMemberProcessingAction("remove");
    try {
      const res = await fetch(`/api/forum/${forumId}/members/${memberUserId}`, {
        method: "DELETE",
      });
      if (res.status === 204 || res.ok) {
        setMembers(prev => prev.filter(m => m.user.id !== memberUserId));
        setForum(prev => prev ? { ...prev, member_count: Math.max(0, (prev.member_count || 1) - 1) } : prev);
        toast("Member removed");
      } else {
        const data = await res.json().catch(()=>({}));
        console.warn("remove member failed", data);
        setPageError(data?.error || "Failed to remove member");
        setTimeout(()=> setPageError(null), 4000);
      }
    } catch (err) {
      console.error("removeMember error", err);
      setPageError("Failed to remove member");
      setTimeout(()=> setPageError(null), 4000);
    } finally {
      setMemberProcessingId(null);
      setMemberProcessingAction(null);
    }
  };

  // ---------- Permissions & membership logic ----------
  const isGlobalAdmin = !!user?.is_global_admin;
  const isForumAdmin = !!forum?.isAdmin;
  const isMember = !!(forum && (forum.status === "joined" || isForumAdmin || isGlobalAdmin));
  const canLeave = !!(forum && (forum.status === "joined" || isForumAdmin) && !isGlobalAdmin);
  const canInvite = !!(forum && (forum.status === "joined" || isForumAdmin || isGlobalAdmin));
  const canManage = !!(forum && (isForumAdmin || isGlobalAdmin));
  const canViewMembers = !!(forum && (isGlobalAdmin || isForumAdmin || forum.status === "joined"));
  // ----------------------------------------------------

  // ========== Thread edit/delete handlers ==========
  const handleEditClick = (thread) => {
    setEditingThread(thread);
    setEditTitle(thread.title || "");
    setEditContent(thread.content || "");
    setEditImagePreview(thread.image_url || null);
  };

  const handleDeleteClick = async (thread) => {
    const ok = window.confirm(`Delete thread "${thread.title}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/forum/${forumId}/threads/${thread.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(()=>({}));
        console.warn("delete failed", body);
        setPageError(body?.error || "Delete failed.");
        setTimeout(()=> setPageError(null), 4000);
        return;
      }
      setThreads(prev => prev.filter(t => t.id !== thread.id));
    } catch (err) {
      console.error("delete thread error", err);
      setPageError("Delete failed");
      setTimeout(()=> setPageError(null), 4000);
    }
  };

  // helper: file -> data URL (for create/edit thread)
  const readFileAsDataURL = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

  const handleEditImageChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return setEditImagePreview(null);
    try {
      const dataUrl = await readFileAsDataURL(f);
      setEditImagePreview(dataUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const submitEdit = async () => {
    if (!editingThread) return;
    setEditLoading(true);
    try {
      const payload = { title: editTitle, content: editContent, image: editImagePreview || null };
      const res = await fetch(`/api/forum/${forumId}/threads/${editingThread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("update thread failed", data);
        setPageError(data?.error || "Update failed");
        setTimeout(()=> setPageError(null), 4000);
        setEditLoading(false);
        return;
      }
      setThreads(prev => prev.map(t => t.id === data.id ? data : t));
      setEditingThread(null);
    } catch (err) {
      console.error("submitEdit error", err);
      setPageError("Update failed");
      setTimeout(()=> setPageError(null), 4000);
    } finally {
      setEditLoading(false);
    }
  };

  // ========== Create thread logic ==========
  const openCreateThread = () => setCreatingThread(true);
  const closeCreateThread = () => {
    setCreatingThread(false);
    setCreateTitle("");
    setCreateContent("");
    setCreateImagePreview(null);
    setCreateLoading(false);
  };

  const handleCreateImageChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return setCreateImagePreview(null);
    try {
      const dataUrl = await readFileAsDataURL(f);
      setCreateImagePreview(dataUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const submitCreateThread = async () => {
    if (!canManage) {
      setPageError("Only forum admins or global admins can create threads.");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }
    if (!createTitle) {
      setPageError("Thread title required");
      setTimeout(()=> setPageError(null), 3000);
      return;
    }
    setCreateLoading(true);
    try {
      const payload = { title: createTitle, content: createContent || null, image: createImagePreview || null };
      const res = await fetch(`/api/forum/${forumId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        console.warn("create thread failed", data);
        setPageError(data?.error || "Create thread failed");
        setTimeout(()=> setPageError(null), 4000);
        setCreateLoading(false);
        return;
      }
      setThreads(prev => [data, ...prev]);
      closeCreateThread();
    } catch (err) {
      console.error("create thread error", err);
      setPageError("Create thread failed");
      setTimeout(()=> setPageError(null), 3000);
      setCreateLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p className="mt-3 text-gray-600">Loading forum...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6">
        <button onClick={handleBack} className="mb-4 text-blue-600 hover:underline">← Back to forums</button> <br/><br/>
        <div className="bg-white p-6 rounded shadow">
          <p className="text-red-600 font-semibold">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <button
            onClick={handleBack}
            className="text-blue-600 hover:underline mr-3 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95"
          >
            ← Back
          </button> <br/><br/>
          <h1 className="text-2xl font-semibold inline">{forum?.title}</h1>
          {forum?.isAdmin && <span className="ml-3 text-xs px-2 py-1 bg-purple-600 text-white rounded">Admin</span>}
        </div>

        <div className="flex items-center gap-2">
          {isMember ? (
            <>
              {canLeave && (
                <button
                  onClick={handleLeave}
                  disabled={leaveLoading}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition transform hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-300 active:scale-95"
                >
                  {leaveLoading ? "Leaving..." : "Leave"}
                </button>
              )}
              {canInvite && (
                <button
                  onClick={openInviteModal}
                  disabled={inviting || forumInvitesLoading}
                  className={`px-3 py-1 bg-yellow-500 text-black rounded hover:bg-yellow-600 transition transform hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-300 active:scale-95 ${ (inviting || forumInvitesLoading) ? 'opacity-60 cursor-not-allowed' : '' }`}
                >
                  { (inviting || forumInvitesLoading) ? "Loading..." : "Invite" }
                </button>
              )}
              {canViewMembers && (
                <button
                  onClick={openMembersModal}
                  disabled={membersOpen || membersLoading}
                  className={`px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition transform hover:scale-105 focus:outline-none ${ (membersOpen || membersLoading) ? 'opacity-60 cursor-not-allowed' : '' }`}
                >
                  { (membersOpen || membersLoading) ? "Loading..." : `Members${forum?.member_count ? ` (${forum.member_count})` : ''}` }
                </button>
              )}
              {canManage && (
                <button
                  onClick={openCreateThread}
                  className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 active:scale-95"
                >
                  Create Thread
                </button>
              )}

              {/* NEW: Logs button visible only to forum admin */}
              {isForumAdmin && (
                <button
                  onClick={() => navigate(`/tech/forums/${forumId}/toxic`)}
                  className="flex items-center gap-2 px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-900 transform transition hover:-translate-y-1 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 active:scale-95"
                >
                  <FiFileText className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Logs</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joinLoading}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition transform hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95"
            >
              {joinLoading ? "Joining..." : "Join"}
            </button>
          )}
        </div>
      </div>

      {pageError && (
        <div className="mb-3 rounded bg-red-50 border border-red-200 p-3 text-red-700">{pageError}</div>
      )}

      <p className="text-gray-700 mb-4 bg-white p-4 rounded shadow">{forum?.description}</p>

      <div className="grid grid-cols-1 gap-4">
        {threads.length === 0 ? (
          <div className="bg-white p-6 rounded shadow text-center text-gray-500">
            {isMember ? "No threads yet — create one if you're an admin." : "Join the forum to see threads"}
          </div>
        ) : (
          threads.map(t => (
            <div key={t.id} className="transform hover:-translate-y-1 transition cursor-pointer">
              <ThreadCard
                thread={t}
                onSelect={() => handleThreadClick(t)}
                canManage={canManage}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            </div>
          ))
        )}
      </div>

      {/* Invite modal (unchanged) */}
      {inviting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Invite user to Forum &quot;{forum?.title}&quot;</h3>
              <button onClick={closeInviteModal} className="text-sm text-gray-600 px-3 py-1 rounded transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300">Close</button>
            </div>

            {forumInvitesLoading ? (
              <div className="flex items-center justify-center py-8">
                <img width="36" src={loader} alt="loading invites" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Search user (by username)</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") runSearch(searchTerm); }}
                      className="flex-1 border rounded p-2"
                      placeholder="Type at least 2 characters and press Enter"
                    />
                    <button
                      onClick={() => runSearch(searchTerm)}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95"
                    >
                      Search
                    </button>
                  </div>
                  {searchLoading && <div className="text-sm text-gray-500 mt-2">Searching...</div>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Message (optional)</label>
                  <textarea value={inviteMessage} onChange={(e)=>setInviteMessage(e.target.value)} rows={3} className="mt-1 w-full border rounded p-2" />
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Results</div>
                  {searchResults.length === 0 ? (
                    <div className="text-gray-500">No results</div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map(u => {
                        const alreadyInvited = forumInvites.some(inv => (inv.receiver_id === u.id) || (inv.receiver?.id === u.id));
                        return (
                          <div key={u.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center gap-3">
                              <img src={u.profilePic || "https://placehold.co/40x40"} alt={u.name} className="w-8 h-8 rounded" />
                              <div>
                                <div className="font-medium">{u.name}</div>
                                <div className="text-xs text-gray-500">{u.position}</div>
                              </div>
                            </div>
                            <div>
                              {alreadyInvited ? (
                                <div className="px-3 py-1 rounded text-xs bg-yellow-600 text-black">Invited</div>
                              ) : (
                                <button
                                  onClick={() => doInvite(u.id)}
                                  disabled={inviteSending}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95"
                                >
                                  {inviteSending ? "Sending..." : "Invite"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={closeInviteModal} className="px-4 py-2 bg-gray-200 rounded transition transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 active:scale-95">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members modal */}
      {membersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Members — {forum?.title}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => { fetchForumMembers(); }} className="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50">Refresh</button>
                <button onClick={closeMembersModal} className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300">Close</button>
              </div>
            </div>

            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <img width="36" src={loader} alt="loading members" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center text-gray-500 py-6">No members</div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
                {members.map(m => {
                  const targetRole = m.role || "member";
                  const canAct = canActOn(targetRole, m.user.id);
                  const isSelf = m.user.id === user?.id;

                  return (
                    <div key={m.user.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <div className="flex items-center gap-3">
                        <img src={m.user.profilePic || "https://placehold.co/40x40"} alt={m.user.name} className="w-10 h-10 rounded-full object-cover" />
                        <div>
                          <div className="font-medium">{m.user.name} {m.user.username ? <span className="text-xs text-gray-400">(@{m.user.username})</span> : null}</div>
                          <div className="text-xs text-gray-500">{m.user.position}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs px-2 py-1 rounded-full border text-gray-700">
                          {targetRole}
                        </div>

                        {/* Promote to forum_admin: NOW only visible to global_admin */}
                        {targetRole !== "forum_admin" && user?.is_global_admin && canAct && (
                          <button
                            onClick={() => promoteToForumAdmin(m.user.id, targetRole)}
                            disabled={memberProcessingId === m.user.id}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition transform hover:scale-105 focus:outline-none disabled:opacity-60"
                          >
                            {memberProcessingId === m.user.id && memberProcessingAction === "promote" ? "Processing..." : "Make Admin"}
                          </button>
                        )}

                        {/* Revoke forum_admin (target must be forum_admin and you must be allowed to act) */}
                        {targetRole === "forum_admin" && canAct && (
                          <button
                            onClick={() => revokeForumAdmin(m.user.id, targetRole)}
                            disabled={memberProcessingId === m.user.id}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition transform hover:scale-105 focus:outline-none disabled:opacity-60"
                          >
                            {memberProcessingId === m.user.id && memberProcessingAction === "revoke" ? "Processing..." : "Revoke Admin"}
                          </button>
                        )}

                        {/* Remove member (only if current has strictly higher level) */}
                        {canAct && (
                          <button
                            onClick={() => removeMember(m.user.id, targetRole)}
                            disabled={memberProcessingId === m.user.id}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:scale-105 transition transform focus:outline-none disabled:opacity-60"
                          >
                            {memberProcessingId === m.user.id && memberProcessingAction === "remove" ? "Processing..." : "Remove"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Thread modal (unchanged) */}
      {editingThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Thread</h3>
              <button onClick={() => setEditingThread(null)} className="text-sm text-gray-600 px-3 py-1 rounded transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300">Close</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input value={editTitle} onChange={(e)=>setEditTitle(e.target.value)} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" disabled={editLoading}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Content</label>
                <textarea value={editContent} onChange={(e)=>setEditContent(e.target.value)} rows={4} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" disabled={editLoading}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image (optional)</label>
                {editImagePreview ? (
                  <div className="mb-2 relative">
                    <img src={editImagePreview} alt="preview" className="max-h-48 object-contain rounded" />
                    <button onClick={()=>setEditImagePreview(null)} className="absolute top-1 right-1 bg-gray-900 text-white rounded px-2 transition transform hover:scale-105 active:scale-95">X</button>
                  </div>
                ) : null}
                <input type="file" accept="image/*" onChange={handleEditImageChange} disabled={editLoading} />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingThread(null)} className="px-4 py-2 bg-gray-200 rounded transition transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300" disabled={editLoading}>Cancel</button>
                <button onClick={submitEdit} disabled={editLoading} className="px-4 py-2 bg-blue-600 text-white rounded transition transform hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-300 active:scale-95">
                  {editLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Thread modal (unchanged) */}
      {creatingThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create Thread</h3>
              <button onClick={closeCreateThread} className="text-sm text-gray-600 px-3 py-1 rounded transition transform hover:scale-105">Close</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input value={createTitle} onChange={(e)=>setCreateTitle(e.target.value)} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" disabled={createLoading}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Content</label>
                <textarea value={createContent} onChange={(e)=>setCreateContent(e.target.value)} rows={4} className="mt-1 w-full border border-gray-400 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150" disabled={createLoading}/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image (optional)</label>
                {createImagePreview ? (
                  <div className="mb-2 relative">
                    <img src={createImagePreview} alt="preview" className="max-h-48 object-contain rounded" />
                    <button onClick={()=>setCreateImagePreview(null)} className="absolute top-1 right-1 bg-gray-900 text-white rounded px-2 transition transform hover:scale-105 active:scale-95">X</button>
                  </div>
                ) : null}
                <input type="file" accept="image/*" onChange={handleCreateImageChange} disabled={createLoading} />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={closeCreateThread} className="px-4 py-2 bg-gray-200 rounded hover:scale-105 focus:outline-none hover:bg-gray-300" disabled={createLoading}>Cancel</button>
                <button onClick={submitCreateThread} disabled={createLoading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 active:scale-95">
                  {createLoading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Ban notice modal when a user is banned and tries to access threads */}
      {banNoticeOpen && banInfo?.banned && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-lg p-6 text-center">
            <h3 className="text-xl font-semibold text-red-600 mb-3">You have been banned</h3>
            <p className="text-gray-700 mb-4">
              You have been banned by the forum admin due to recent toxic behavior.
            </p>

            <div className="mb-4">
              <div className="text-sm text-gray-600">Ban in effect</div>
              <div className="text-lg font-medium">{(banInfo?.ban && banInfo.ban.expires_at) ? (banCountdown || "—") : "Permanent"}</div>
            </div>

            <div className="flex justify-center gap-2">
              <button onClick={() => setBanNoticeOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Close</button>
              <button onClick={async () => {
                const s = await checkMyBanStatus();
                if (s?.banned) {
                  setBanInfo(s);
                } else {
                  setBanInfo(null);
                  setBanNoticeOpen(false);
                }
              }} className="px-4 py-2 bg-blue-600 text-white rounded">{banChecking ? "Checking..." : "Refresh"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
