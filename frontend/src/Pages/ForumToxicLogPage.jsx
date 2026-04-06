import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import loader from "../assets/loader.svg";
import { toast } from "react-toastify";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import { FaCheck, FaUserSlash } from "react-icons/fa";

export default function ForumToxicLogPage(){
  const { forumId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]); // toxic users summary
  const [error, setError] = useState(null);

  // active bans map: { [userId]: { banId, userId, username, start_at, expires_at, reason, banned_by } }
  const [bannedMap, setBannedMap] = useState({});

  // modal state for selected user
  const [selected, setSelected] = useState(null); // { userId, username, profilePic, toxic_count, ... }
  const [modalLoading, setModalLoading] = useState(false);
  const [userActions, setUserActions] = useState([]); // detailed toxic answers for selected user
  const [userBanHistory, setUserBanHistory] = useState([]); // full ban history for selected user
  const [expandedAnswerId, setExpandedAnswerId] = useState(null);

  // ban UI inside modal
  const BAN_OPTIONS = [
    { key: "1d", label: "1 day" },
    { key: "7d", label: "7 days" },
    { key: "1m", label: "1 month" },
    { key: "6m", label: "6 months" },
    { key: "forever", label: "Forever" },
  ];
  const [banOpen, setBanOpen] = useState(false);
  const [banSelecting, setBanSelecting] = useState(null); // { key, label, recommended? }
  const [banProcessing, setBanProcessing] = useState(false);

  // selected user's ban info + countdown
  const [selectedBanInfo, setSelectedBanInfo] = useState(null); // { banned: true, ban: { ... } } or null
  const [selectedBanCountdown, setSelectedBanCountdown] = useState(null);

  // fetch toxic users list + bans
  useEffect(()=> {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      setList([]);
      try {
        // fetch toxic users summary
        const res = await fetch(`/api/forum/${forumId}/toxic-users`);
        if (!res.ok) {
          const txt = await res.text().catch(()=>null);
          console.warn("load toxic-users failed", res.status, txt);
          if (mounted) setError("Failed to fetch toxic users");
          return;
        }
        const data = await res.json();
        if (mounted) setList(data.list || []);
      } catch (err) {
        console.error("load toxic users error", err);
        if (mounted) setError("Failed to fetch toxic users");
      } finally {
        if (mounted) setLoading(false);
      }

      // fetch current active bans for this forum (to show badges)
      try {
        const bres = await fetch(`/api/forum/${forumId}/bans`);
        if (!bres.ok) {
          console.warn("failed to load bans", bres.status);
          return;
        }
        const bdata = await bres.json();
        if (!mounted) return;
        const map = {};
        (bdata.list || []).forEach(b => {
          if (b.userId) map[b.userId] = b;
        });
        setBannedMap(map);
      } catch (err) {
        console.error("load bans error", err);
      }
    };

    loadAll();
    return () => { mounted = false; };
  }, [forumId]);

  // helper to refresh toxic-users list and bans (used after ban/unban)
  const refreshLists = async () => {
    try {
      const [tRes, bRes] = await Promise.all([
        fetch(`/api/forum/${forumId}/toxic-users`),
        fetch(`/api/forum/${forumId}/bans`)
      ]);
      if (tRes.ok) {
        const tdata = await tRes.json();
        setList(tdata.list || []);
      }
      if (bRes.ok) {
        const bdata = await bRes.json();
        const map = {};
        (bdata.list || []).forEach(b => { if (b.userId) map[b.userId] = b; });
        setBannedMap(map);
      }
    } catch (err) {
      console.error("refreshLists error", err);
    }
  };

  // compute "isNew" flag for answers using ban history
  const attachIsNewFlag = (answers = [], bans = []) => {
    // bans expected sorted by start_at desc (most recent first)
    // compute last_end_time = max(lifted_at || expires_at) in ms (0 if none)
    let last_end_time = 0;
    bans.forEach(b => {
      const end = b.lifted_at || b.expires_at;
      if (end) {
        const t = new Date(end).getTime();
        if (t > last_end_time) last_end_time = t;
      }
    });

    return (answers || []).map(a => {
      const ansTime = new Date(a.createdAt).getTime();

      // punished: there exists a ban that either:
      //  - is permanent (no expires_at and no lifted_at) -> punish
      //  - OR has start_at >= answer.createdAt (ban applied after the answer) -> punish
      const punished = (bans || []).some(b => {
        // if ban is permanent (no end fields) -> treat as punished (covers the case you described)
        if (!b.expires_at && !b.lifted_at) return true;

        if (!b.start_at) return false;
        const s = new Date(b.start_at).getTime();
        return s >= ansTime;
      });

      // If no bans at all -> all answers are new
      const noBans = (bans || []).length === 0;

      // new if answer created after last_end_time and not punished
      const isNew = noBans ? true : (!punished && ansTime > last_end_time);

      return { ...a, isNew };
    });
  };


  // open user modal and load user's toxic answers + ban status + ban history
  const openUserModal = async (u) => {
    // set selected immediately so modal opens
    setSelected(u);
    setModalLoading(true);
    setUserActions([]);
    setUserBanHistory([]);
    setExpandedAnswerId(null);
    setBanOpen(false);
    setBanSelecting(null);
    setSelectedBanInfo(null);
    setSelectedBanCountdown(null);

    // local bannedMap guess
    const localBan = bannedMap[u.userId];
    if (localBan) {
      setSelectedBanInfo({ banned: true, ban: localBan });
      startSelectedBanCountdown(localBan, u.userId);
    }

    try {
      // fetch toxic answers
      const [ares, bhres] = await Promise.all([
        fetch(`/api/forum/${forumId}/toxic-users/${u.userId}/answers`),
        fetch(`/api/forum/${forumId}/bans/${u.userId}/history`)
      ]);

      let answers = [];
      if (ares.ok) {
        const adata = await ares.json();
        answers = adata.answers || [];
      } else {
        console.warn("fetch user toxic answers failed", ares.status);
        answers = [];
      }

      let bans = [];
      if (bhres.ok) {
        const bdata = await bhres.json();
        bans = bdata.bans || [];
        // ensure bans sorted by start_at desc (server should already)
        bans.sort((x,y) => new Date(y.start_at).getTime() - new Date(x.start_at).getTime());
      } else {
        console.warn("fetch ban history failed", bhres.status);
        bans = [];
      }

      // Update userBanHistory state
      setUserBanHistory(bans);

      // --- NEW: update the selected object's toxic_count & last_toxic_at and also update page list ---
      const newCount = answers.length;
      const newestAt = answers && answers.length ? answers[0].createdAt : null;

      // update selected (modal header)
      setSelected(prev => {
        if (!prev) return { ...u, toxic_count: newCount, last_toxic_at: newestAt };
        return { ...prev, toxic_count: newCount, last_toxic_at: newestAt || prev.last_toxic_at };
      });

      // update list (the grid) so the card shows updated count immediately
      setList(prevList => {
        if (!Array.isArray(prevList)) return prevList;
        return prevList.map(item => {
          if (item.userId === u.userId) {
            return {
              ...item,
              toxic_count: newCount,
              last_toxic_at: newestAt || item.last_toxic_at
            };
          }
          return item;
        });
      });
      // --- end update ---

      // attach isNew flag
      const withFlag = attachIsNewFlag(answers, bans);
      setUserActions(withFlag);
    } catch (err) {
      console.error("openUserModal error", err);
      setUserActions([]);
      setUserBanHistory([]);
    } finally {
      setModalLoading(false);
    }

    // authoritative ban status check for selected user
    try {
      const sres = await fetch(`/api/forum/${forumId}/ban/${u.userId}/status`);
      if (sres.ok) {
        const sdata = await sres.json();
        if (sdata?.banned) {
          setSelectedBanInfo(sdata);
          startSelectedBanCountdown(sdata.ban, u.userId);
        } else {
          setSelectedBanInfo(null);
          setSelectedBanCountdown(null);
          // choose recommended ban if present
          if (u.recommended_ban && u.recommended_ban.duration) {
            const recKey = u.recommended_ban.duration;
            const found = BAN_OPTIONS.find(x => x.key === recKey);
            if (found) setBanSelecting({ ...found, recommended: true });
          } else {
            setBanSelecting(null);
          }
        }
      } else {
        // fallback: if earlier we had local ban it remains; else use recommended selection
        if (!localBan && u.recommended_ban && u.recommended_ban.duration) {
          const recKey = u.recommended_ban.duration;
          const found = BAN_OPTIONS.find(x => x.key === recKey);
          if (found) setBanSelecting({ ...found, recommended: true });
        }
      }
    } catch (err) {
      console.error("check ban status error", err);
      if (!localBan && u.recommended_ban && u.recommended_ban.duration) {
        const recKey = u.recommended_ban.duration;
        const found = BAN_OPTIONS.find(x => x.key === recKey);
        if (found) setBanSelecting({ ...found, recommended: true });
      }
    }
  };

  // start countdown for selected ban (accepts ban object with expires_at)
  const startSelectedBanCountdown = (ban, userIdForKey) => {
    const ivKey = `forum_toxic_countdown_${forumId}_${(ban && (ban.userId || ban.user_id)) || userIdForKey || "sel"}`;

    if (window[ivKey]) {
      clearInterval(window[ivKey]);
      window[ivKey] = null;
    }

    if (!ban) {
      setSelectedBanCountdown(null);
      return;
    }

    if (!ban.expires_at) {
      setSelectedBanCountdown("Permanent");
      return;
    }

    const update = () => {
      const now = Date.now();
      const end = new Date(ban.expires_at).getTime();
      const diff = Math.max(0, end - now);
      setSelectedBanCountdown(formatRemainingFromMs(diff));
      if (diff <= 0) {
        setSelectedBanInfo(null);
        setSelectedBanCountdown(null);
        if (window[ivKey]) {
          clearInterval(window[ivKey]);
          window[ivKey] = null;
        }
      }
    };
    update();
    window[ivKey] = setInterval(update, 1000);
  };

  // helper to format remaining ms -> "1d 3h 2m 5s"
  const formatRemainingFromMs = (ms) => {
    const days = Math.floor(ms / (24*60*60*1000));
    const hours = Math.floor((ms % (24*60*60*1000)) / (60*60*1000));
    const mins = Math.floor((ms % (60*60*1000)) / (60*1000));
    const secs = Math.floor((ms % (60*1000)) / 1000);
    return `${days}d ${hours}h ${mins}m ${secs}s`;
  };

  const formatRemaining = (expires_at) => {
    if (!expires_at) return "Permanent";
    const end = new Date(expires_at).getTime();
    const diff = Math.max(0, end - Date.now());
    return formatRemainingFromMs(diff);
  };

  const closeUserModal = () => {
    // clear any countdown interval created for this selected user
    const banUserId = selectedBanInfo?.ban?.userId || selectedBanInfo?.ban?.user_id || selected?.userId;
    if (banUserId) {
      const ivName = `forum_toxic_countdown_${forumId}_${banUserId}`;
      if (window[ivName]) { clearInterval(window[ivName]); window[ivName] = null; }
    }
    setSelected(null);
    setUserActions([]);
    setUserBanHistory([]);
    setExpandedAnswerId(null);
    setBanOpen(false);
    setBanSelecting(null);
    setSelectedBanInfo(null);
    setSelectedBanCountdown(null);
  };

  // apply ban (POST /api/forum/:forumId/ban/:userId with body { duration, reason })
  const applyBan = async () => {
    if (!selected || !banSelecting) {
      toast("Please select a ban duration");
      return;
    }
    setBanProcessing(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/ban/${selected.userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: banSelecting.key, reason: `Auto-ban per admin action (toxic_count=${selected.toxic_count})` })
      });
      if (res.status === 201 || res.ok) {
        toast("User banned");
        // refresh bans + list
        await refreshLists();

        // re-fetch selected user's ban status/history and answers to update "New" labels
        try {
          const [sres, bhres, ares] = await Promise.all([
            fetch(`/api/forum/${forumId}/ban/${selected.userId}/status`),
            fetch(`/api/forum/${forumId}/bans/${selected.userId}/history`),
            fetch(`/api/forum/${forumId}/toxic-users/${selected.userId}/answers`)
          ]);
          if (sres.ok) {
            const sdata = await sres.json();
            if (sdata?.banned) {
              setSelectedBanInfo(sdata);
              startSelectedBanCountdown(sdata.ban, selected.userId);
            }
          }
          if (bhres.ok) {
            const bdata = await bhres.json();
            const bans = bdata.bans || [];
            bans.sort((x,y) => new Date(y.start_at).getTime() - new Date(x.start_at).getTime());
            setUserBanHistory(bans);
            if (ares.ok) {
              const adata = await ares.json();
              const withFlag = attachIsNewFlag(adata.answers || [], bans);
              setUserActions(withFlag);

              // update counts as well (keep UI consistent)
              const newCount = (adata.answers || []).length;
              const newestAt = (adata.answers && adata.answers.length) ? adata.answers[0].createdAt : null;
              setSelected(prev => prev ? { ...prev, toxic_count: newCount, last_toxic_at: newestAt || prev.last_toxic_at } : prev);
              setList(prevList => prevList.map(item => item.userId === selected.userId ? { ...item, toxic_count: newCount, last_toxic_at: newestAt || item.last_toxic_at } : item));
            }
          }
        } catch (e) { /* ignore */ }

        setBanOpen(false);
        setBanSelecting(null);
        return;
      }
      const body = await res.json().catch(()=> ({}));
      console.warn("ban failed", body);
      toast("Ban failed");
    } catch (err) {
      console.error("applyBan error", err);
      toast("Ban failed");
    } finally {
      setBanProcessing(false);
    }
  };

  // unban for selected user: POST /api/forum/:forumId/ban/:userId/unban
  const unbanSelectedUser = async () => {
    if (!selected) return;
    setBanProcessing(true);
    try {
      const res = await fetch(`/api/forum/${forumId}/ban/${selected.userId}/unban`, { method: "POST" });
      if (res.ok) {
        toast("User unbanned");
        await refreshLists();
        setSelectedBanInfo(null);
        setSelectedBanCountdown(null);
        setBanOpen(false);
        setBanSelecting(null);

        // re-fetch ban history + answers to update "New" labels
        try {
          const [bhres, ares] = await Promise.all([
            fetch(`/api/forum/${forumId}/bans/${selected.userId}/history`),
            fetch(`/api/forum/${forumId}/toxic-users/${selected.userId}/answers`)
          ]);
          let bans = [];
          if (bhres.ok) {
            const bdata = await bhres.json();
            bans = bdata.bans || [];
            bans.sort((x,y) => new Date(y.start_at).getTime() - new Date(x.start_at).getTime());
            setUserBanHistory(bans);
          }
          if (ares.ok) {
            const adata = await ares.json();
            const withFlag = attachIsNewFlag(adata.answers || [], bans);
            setUserActions(withFlag);

            // update counts as well (keep UI consistent)
            const newCount = (adata.answers || []).length;
            const newestAt = (adata.answers && adata.answers.length) ? adata.answers[0].createdAt : null;
            setSelected(prev => prev ? { ...prev, toxic_count: newCount, last_toxic_at: newestAt || prev.last_toxic_at } : prev);
            setList(prevList => prevList.map(item => item.userId === selected.userId ? { ...item, toxic_count: newCount, last_toxic_at: newestAt || item.last_toxic_at } : item));
          }
        } catch(e){ /* ignore */ }

      } else {
        const body = await res.json().catch(()=>({}));
        console.warn("unban failed", body);
        toast("Unban failed");
      }
    } catch (err) {
      console.error("unbanSelectedUser error", err);
      toast("Unban failed");
    } finally {
      setBanProcessing(false);
    }
  };

  // convenience: check if user is currently banned (from bannedMap)
  const isUserBanned = (userId) => {
    return !!bannedMap[userId];
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={()=> navigate(-1)} className="text-blue-600 hover:underline mr-3">← Back</button>
          <h1 className="text-3xl font-extrabold mt-2">Toxic Actions & Management</h1>
          <p className="text-sm text-gray-500 mt-1">Admin console — review flagged users, inspect actions, and manage bans.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <img width="72" src={loader} alt="loading" />
        </div>
      ) : error ? (
        <div className="bg-white p-4 rounded shadow text-red-600">{error}</div>
      ) : list.length === 0 ? (
        <div className="bg-white p-8 rounded shadow text-center text-gray-500">No toxic activity found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map(u => {
            const banned = isUserBanned(u.userId);
            const banObj = banned ? bannedMap[u.userId] : null;
            return (
              <div key={u.userId}
                onClick={() => openUserModal(u)}
                className="bg-white p-4 rounded-2xl shadow-md hover:shadow-xl transform hover:-translate-y-1 transition cursor-pointer border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={u.profilePic || "https://placehold.co/48x48"} className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-50" alt={u.username} />
                    <div>
                      <div className="font-semibold">{u.username}</div>
                      <div className="text-xs text-gray-500">Toxic: <span className="font-semibold text-indigo-600">{u.toxic_count}</span></div>
                      {banned && banObj?.expires_at ? (
                        <div className="text-xs text-red-600">Banned — expires {new Date(banObj.expires_at).toLocaleString()}</div>
                      ) : banned ? (
                        <div className="text-xs text-red-600">Banned — Permanent</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {banned && <div className="text-xs px-2 py-1 bg-red-600 text-white rounded-md">Banned</div>}
                    {!banned && u.recommended_ban?.label ? (
                      <div className="text-xs px-2 py-1 bg-yellow-50 text-yellow-800 rounded-md">Recommend: {u.recommended_ban.label}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* modal for selected user - redesigned UI only */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeUserModal}></div>

          <div className="relative w-full max-w-4xl mx-4">
            <div className="bg-gradient-to-br from-white via-indigo-50 to-indigo-100 rounded-2xl shadow-2xl overflow-hidden border border-gray-100">

              {/* Header */}
              <div className="flex items-center gap-4 p-6 border-b border-indigo-100">
                <div className="relative">
                  <img src={selected.profilePic || "https://placehold.co/96x96"} className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-lg" alt={selected.username} />
                  {selectedBanInfo?.banned && (
                    <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow"> 
                      <FaUserSlash className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl font-bold">{selected.username}</div>
                      <div className="text-sm text-gray-600">Total toxic actions: <span className="font-medium text-indigo-700">{selected.toxic_count}</span></div>
                      <div className="text-xs text-gray-500 mt-1">Last flagged: {selected.last_toxic_at ? new Date(selected.last_toxic_at).toLocaleString() : '—'}</div>

                      {selectedBanInfo?.banned && (
                        <div className="mt-2 inline-flex items-center gap-3 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm">
                          <strong>{selectedBanInfo.ban?.expires_at ? 'Banned — expires in' : 'Banned — Permanent'}</strong>
                          {selectedBanInfo.ban?.expires_at && selectedBanCountdown ? <span className="text-sm">{selectedBanCountdown}</span> : null}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedBanInfo?.banned ? (
                        <>
                          <button
                            onClick={unbanSelectedUser}
                            disabled={banProcessing}
                            className="px-3 py-2 bg-white border border-gray-200 text-sm rounded-lg shadow-sm hover:shadow-md transition"
                          >
                            {banProcessing ? "Processing..." : "Unban"}
                          </button>
                          <button onClick={closeUserModal} className="p-2 rounded-lg bg-gray-50 border hover:bg-gray-100" aria-label="Close modal"><FiX /></button>
                        </>
                      ) : (
                        <>
                          <div className="relative">
                            <button
                              onClick={() => setBanOpen(prev=>!prev)}
                              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:shadow-md flex items-center gap-2"
                            >
                              <FiAlertTriangle />
                              <span className="font-medium">Ban</span>
                            </button>

                            {banOpen && (
                              <div className="absolute right-0 mt-3 w-72 bg-white rounded-lg shadow-lg border p-3 z-50">
                                <div className="text-xs text-gray-500 mb-2 px-1">Select duration</div>
                                <div className="space-y-2">
                                  {BAN_OPTIONS.map(opt => {
                                    const recommended = selected.recommended_ban && selected.recommended_ban.duration === opt.key;
                                    const chosen = banSelecting && banSelecting.key === opt.key;
                                    return (
                                      <div
                                        key={opt.key}
                                        onClick={() => setBanSelecting({...opt, recommended})}
                                        className={`flex items-center justify-between gap-2 p-2 rounded cursor-pointer ${chosen ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className="text-sm">{opt.label}</div>
                                          {recommended ? <div className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">Recommend</div> : null}
                                        </div>
                                        <div className="text-sm text-green-700">{chosen ? <FaCheck /> : ''}</div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-3 flex items-center justify-end gap-3">
                                  <button onClick={()=> { setBanOpen(false); setBanSelecting(null); }} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
                                  <button
                                    onClick={applyBan}
                                    disabled={!banSelecting || banProcessing}
                                    className="px-3 py-1 bg-red-600 text-white rounded hover:shadow-md disabled:opacity-60"
                                    aria-label={banSelecting ? `Confirm ban ${banSelecting.label}` : "Confirm ban"}
                                  >
                                    {banProcessing ? (
                                      <span className="whitespace-nowrap">Processing...</span>
                                    ) : (
                                      banSelecting ? (
                                        <div className="flex flex-col items-center leading-tight">
                                          <span className="text-sm font-medium">Confirm</span>
                                          <span className="text-xs opacity-90">({banSelecting.label})</span>
                                        </div>
                                      ) : (
                                        <span className="text-sm">Confirm</span>
                                      )
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <button onClick={closeUserModal} className="ml-2 p-2 rounded-lg bg-gray-50 border hover:bg-gray-100" aria-label="Close modal"><FiX /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body: actions list */}
              <div className="p-6 min-h-[400px] max-h-[60vh] overflow-auto">
                {modalLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <img width="36" src={loader} alt="loading" />
                  </div>
                ) : userActions.length === 0 ? (
                  <div className="text-center text-gray-500 p-6">No toxic actions found for this user.</div>
                ) : (
                  <div className="space-y-4">
                    {userActions.map(a => (
                      <div key={a.id} className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium text-gray-700">{new Date(a.createdAt).toLocaleString()}</div>
                              {a.isNew ? (
                                <div className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800 animate-pulse">
                                  New
                                </div>
                              ) : null}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">{a.content?.slice(0,160)}{a.content && a.content.length > 160 ? '...' : ''}</div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <button onClick={() => setExpandedAnswerId(expandedAnswerId === a.id ? null : a.id)} className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-sm rounded">{expandedAnswerId === a.id ? 'Hide' : 'Details'}</button>
                          </div>
                        </div>

                        {expandedAnswerId === a.id && (
                          <div className="mt-3 border-t pt-3 text-sm text-gray-700">
                            <div className="font-semibold">Answer content</div>
                            <div className="mt-2 whitespace-pre-wrap">{a.content}</div>
                            <div className="mt-3 text-xs text-gray-500">Belongs to: <button onClick={() => {
                              if (a.threadId) navigate(`/tech/forums/${forumId}/threads/${a.threadId}`, { state: { threadId: a.threadId }}); 
                            }} className="text-indigo-600 hover:underline">{a.threadTitle || '—'} (Thread)</button> — question: {a.questionTitle}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
