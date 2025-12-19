// src/Pages/ThreadPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import QuestionsList from "../Components/forums/QuestionsList";
import QuestionDetail from "../Components/forums/QuestionDetail";
import loader from "../assets/loader.svg";
import { useRecoilValue } from "recoil";
import userAtom from "../Atoms/userAtom";
import { useSocket } from "../Context/SocketContext";

export default function ThreadPage() {
  const { forumId, threadId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useRecoilValue(userAtom);
  const { socket } = useSocket();

  const stateThread = location.state?.thread || null;

  const [thread, setThread] = useState(stateThread);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [hoveredQuestionId, setHoveredQuestionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const questionsOffsetRef = useRef(0);
  const questionsLimit = 5;

  console.log("questions: ", questions);

  // NEW: ban info for current user on this forum
  const [banInfo, setBanInfo] = useState(null);
  const [banCountdown, setBanCountdown] = useState(null);
  const [banNoticeOpen, setBanNoticeOpen] = useState(false);
  const [banChecking, setBanChecking] = useState(false);

  const rightRef = useRef(null); // for outside-click detection

  // fetch thread meta if not provided from state
  useEffect(() => {
    let mounted = true;
    const fetchThreadMetaIfNeeded = async () => {
      if (thread) return;
      try {
        const res = await fetch(`/api/forum/${forumId}/threads`);
        if (!res.ok) {
          console.warn("failed to fetch forum threads", res.status);
          navigate(`/tech/forums`);
          return;
        }
        const arr = await res.json();
        const t = arr.find(x => String(x.id) === String(threadId));
        if (mounted) setThread(t || { id: threadId, title: `Thread ${threadId}` });
      } catch (err) {
        console.error("fetchThreadMetaIfNeeded error", err);
      }
    };

    fetchThreadMetaIfNeeded();
    return () => { mounted = false; };
  }, [forumId, threadId, thread, navigate]);

  // NEW: check current user's ban status when entering the thread page
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

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const status = await checkMyBanStatus();
      if (!mounted) return;
      if (status?.banned) {
        setBanInfo(status);
        setBanNoticeOpen(true);
      } else {
        setBanInfo(null);
        setBanNoticeOpen(false);
      }
    };
    run();
    return () => { mounted = false; };
    // run only when forumId / user changes
  }, [forumId, user?.id]);

  // NEW: update countdown for ban
  useEffect(()=> {
    if (!banInfo?.banned) {
      setBanCountdown(null);
      return;
    }

    // If permanent (no expires_at) -> mark as Permanent
    if (!banInfo.ban || !banInfo.ban.expires_at) {
      setBanCountdown("Permanent");
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

  // load first page of questions (do NOT auto-select the first question)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setIsLoading(true);
      setQuestionsLoading(true);
      try {
        const res = await fetch(`/api/forum/threads/${threadId}/questions?limit=${questionsLimit}&offset=0`);
        if (!res.ok) {
          console.warn("listQuestions failed", res.status);
          if (mounted) {
            setQuestions([]);
            setTotalQuestions(0);
            questionsOffsetRef.current = 0;
          }
          return;
        }
        const data = await res.json();
        const arr = Array.isArray(data) ? data : (data.questions || data || []);
        const total = data.total ?? (Array.isArray(data) ? arr.length : (data.total || 0));
        if (mounted) {
          setQuestions(arr);
          setTotalQuestions(total);
          questionsOffsetRef.current = arr.length;
        }
      } catch (err) {
        console.error("load questions error", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setQuestionsLoading(false);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, [threadId]);

  // socket: join thread room to receive new_question, question_updated, question_deleted and answer deltas
  useEffect(() => {
    if (!socket || !threadId) return;
    socket.emit("joinThreadRoom", { threadId: Number(threadId) });

    const onNewQuestion = ({ question }) => {
      setQuestions(prev => {
        if (prev.some(q => String(q.id) === String(question.id))) return prev;
        const newList = [question, ...prev];
        questionsOffsetRef.current = newList.length;
        setTotalQuestions(prevTotal => prevTotal + 1);
        return newList;
      });
    };

    const onQuestionUpdated = ({ question }) => {
      setQuestions(prev => prev.map(q => (String(q.id) === String(question.id) ? question : q)));
      if (selectedQuestion && String(selectedQuestion.id) === String(question.id)) {
        setSelectedQuestion(question);
      }
    };

    const onQuestionDeleted = ({ questionId }) => {
      setQuestions(prev => prev.filter(q => String(q.id) !== String(questionId)));
      setTotalQuestions(prev => Math.max(0, prev - 1));
      if (selectedQuestion && String(selectedQuestion.id) === String(questionId)) {
        setSelectedQuestion(null);
      }
    };

    const onQuestionAnswerDelta = ({ questionId, delta }) => {
      setQuestions(prev => {
        const mapped = prev.map(q => {
          if (String(q.id) !== String(questionId)) return q;
          if (selectedQuestion && String(selectedQuestion.id) === String(questionId)) {
            return { ...q, unseenCount: 0 };
          }
          const prevCount = Number(q.unseenCount || 0);
          const inc = Number(delta) || 0;
          const next = Math.max(0, prevCount + inc);
          return { ...q, unseenCount: next };
        });
        return mapped;
      });
    };

    // NEW: real-time ban/unban for this forum while on the thread page
    const onForumBanned = (payload) => {
      try {
        if (!payload) return;
        // only care if this ban applies to the forum currently open
        if (Number(payload.forumId) !== Number(forumId)) return;
        if (!user) return;
        // if payload contains userId, ensure it targets current user
        if (payload.userId && Number(payload.userId) !== Number(user.id)) return;

        // set ban info and open modal immediately
        setBanInfo({ banned: true, ban: payload.ban || null });
        setBanNoticeOpen(true);

        // Optionally reflect locally - e.g., stop interactions
        // setQuestions([]); // uncomment if you want to hide questions when banned
      } catch (err) {
        console.error("onForumBanned handler error", err);
      }
    };

    const onForumUnbanned = (payload) => {
      try {
        if (!payload) return;
        if (Number(payload.forumId) !== Number(forumId)) return;
        if (!user) return;
        if (payload.userId && Number(payload.userId) !== Number(user.id)) return;

        setBanInfo(null);
        setBanNoticeOpen(false);

        // Optionally refresh the thread/questions or membership state
        // e.g. reload questions or call checkMyBanStatus()
      } catch (err) {
        console.error("onForumUnbanned handler error", err);
      }
    };

    socket.on("new_question", onNewQuestion);
    socket.on("question_updated", onQuestionUpdated);
    socket.on("question_deleted", onQuestionDeleted);
    socket.on("question_answer_delta", onQuestionAnswerDelta);

    socket.on("forum_banned", onForumBanned);
    socket.on("forum_unbanned", onForumUnbanned);

    return () => {
      socket.off("new_question", onNewQuestion);
      socket.off("question_updated", onQuestionUpdated);
      socket.off("question_deleted", onQuestionDeleted);
      socket.off("question_answer_delta", onQuestionAnswerDelta);

      socket.off("forum_banned", onForumBanned);
      socket.off("forum_unbanned", onForumUnbanned);

      socket.emit("leaveThreadRoom", { threadId: Number(threadId) });
    };
  }, [socket, threadId, selectedQuestion, forumId, user]);

  const loadMoreQuestions = async () => {
    setQuestionsLoading(true);
    try {
      const offset = questionsOffsetRef.current;
      const res = await fetch(`/api/forum/threads/${threadId}/questions?limit=${questionsLimit}&offset=${offset}`);
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.questions || data || []);
      const total = data.total ?? totalQuestions;
      setQuestions(prev => {
        const merged = [...prev, ...arr];
        const seen = new Set();
        const deduped = [];
        for (const q of merged) {
          if (!seen.has(String(q.id))) {
            deduped.push(q);
            seen.add(String(q.id));
          }
        }
        questionsOffsetRef.current = deduped.length;
        return deduped;
      });
      setTotalQuestions(total);
    } catch (err) {
      console.error("loadMoreQuestions error", err);
    } finally {
      setQuestionsLoading(false);
    }
  };

  // called by left list when user explicitly clicks on a question
  const handleOpenQuestion = (q) => {
    setSelectedQuestion(q);
  };

  // when leaving a question we notify server to mark answers seen
  const handleLeaveQuestion = async (q) => {
    if (!q) return;
    try {
      await fetch(`/api/forum/questions/${q.id}/mark_answers_seen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setQuestions(prev => prev.map(item => (String(item.id) === String(q.id) ? { ...item, unseenCount: 0 } : item)));
      if (selectedQuestion && String(selectedQuestion.id) === String(q.id)) {
        setSelectedQuestion(prev => prev ? { ...prev, unseenCount: 0 } : prev);
      }
    } catch (err) {
      console.warn("markAnswersSeen failed", err);
    }
  };

  // clicking outside RIGHT card returns to placeholder (clear selection)
  useEffect(() => {
    const onDocPointer = (e) => {
      if (!rightRef.current) return;
      try {
        const path = (typeof e.composedPath === "function") ? e.composedPath() : (e.path || []);
        if (Array.isArray(path) && path.includes(rightRef.current)) return;
      } catch (err) {
        if (rightRef.current.contains(e.target)) return;
      }
      setSelectedQuestion(null);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        setSelectedQuestion(null);
      }
    };

    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [rightRef]);

  const goBackToForum = () => navigate(`/tech/forums/${forumId}`);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p className="mt-3 text-gray-600">Loading thread...</p>
      </div>
    );
  }

  const hasMore = questionsOffsetRef.current < (totalQuestions || 0);

  return (
    <div className="px-6 py-5">
      
        <button
          onClick={goBackToForum}
          className="text-blue-600 hover:underline transition transform hover:scale-105 focus:outline-none"
        >
          ← Back to forum 
        </button>
      <div className="flex items-baseline justify-start gap-4 mt-4 mb-2"> 
        <div className="text-2xl font-bold tracking-tight">{thread?.title || `Thread #${threadId}`}</div>
        <div className="ml-4 text-sm text-gray-500">{(totalQuestions ?? questions.length)} questions</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/2 bg-white rounded shadow-md p-4 ">
          <QuestionsList
            thread={thread}
            questions={questions}
            onOpen={(q, e) => {
              e && e.stopPropagation();
              handleOpenQuestion(q);
            }}
            onShowMore={loadMoreQuestions}
            onCreateOptimistic={(q) => {
              setQuestions(prev => {
                if (prev.some(x => String(x.id) === String(q.id))) return prev;
                questionsOffsetRef.current = prev.length + 1;
                setTotalQuestions(prevTotal => prevTotal + 1);
                return [q, ...prev];
              });
            }}
            questionsLoading={questionsLoading}
            hasMore={hasMore}
            onHover={(id) => setHoveredQuestionId(id)}
            onHoverLeave={() => setHoveredQuestionId(null)}
          />
        </div>

        <div className="w-full lg:w-1/2 bg-white rounded shadow-md p-6" ref={rightRef}>
          {selectedQuestion ? (
            <QuestionDetail
              key={selectedQuestion.id}
              question={selectedQuestion}
              currentUser={user}
              forum={{ id: forumId }}
              thread={thread}
              onLeave={() => handleLeaveQuestion(selectedQuestion)}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className={`text-center max-w-lg transition-opacity duration-200 ${hoveredQuestionId ? "opacity-100" : "opacity-90"}`}>
                <h3 className="text-xl font-semibold mb-2">Select a question to view answers</h3>
                <p className="text-sm text-gray-500">
                  {hoveredQuestionId
                    ? "You are hovering a question — click it to open answers. Or create a new question on the left to start the conversation."
                    : "Or create a new question on the left to start the conversation."}
                </p>
                <div className="mt-6 text-xs text-gray-400 italic">Tip: Hover a question to preview instructions — then click to open.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* NEW: Ban overlay/modal shown for banned users who visit a thread */}
      {banNoticeOpen && banInfo?.banned && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded w-full max-w-lg p-6 text-center">
            <h3 className="text-xl font-semibold text-red-600 mb-3">You have been banned</h3>
            <p className="text-gray-700 mb-4">You have been banned by the forum admin due to recent toxic behavior and need to wait for this ban to expire.</p>

            <div className="mb-4">
              <div className="text-sm text-gray-600">Ban in effect</div>
              <div className="text-lg font-medium">{(banInfo?.ban && banInfo.ban.expires_at) ? (banCountdown || "—") : "Permanent"}</div>
            </div>

            <div className="flex justify-center gap-2">
              <button onClick={() => goBackToForum()} className="px-4 py-2 bg-gray-200 rounded hover:-translate-y-1 transform transition">Close</button>
              <button onClick={async () => {
                const s = await checkMyBanStatus();
                if (s?.banned) {
                  setBanInfo(s);
                  setBanNoticeOpen(true);
                } else {
                  setBanInfo(null);
                  setBanNoticeOpen(false);
                }
              }} className="px-4 py-2 bg-blue-600 text-white rounded hover:-translate-y-1 transform transition">{banChecking ? "Checking..." : "Refresh"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
