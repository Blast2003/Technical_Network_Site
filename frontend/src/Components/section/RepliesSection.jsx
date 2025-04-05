import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { formatDistanceToNow } from "date-fns";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { DeleteOutlined } from "@ant-design/icons";

import replyAtom from "../../Atoms/replyAtom";
import repliesAtom from "../../Atoms/repliesAtom";
import userAtom from "../../Atoms/userAtom";
import feedPostAtom from "../../Atoms/feedPostAtom";
import userPostAtom from "../../Atoms/userPostAtom";

const RepliesSection = ({ postId, onCommentUpdate }) => {
  const { id } = useParams();
  const [allReplies, setAllReplies] = useRecoilState(repliesAtom);
  const [visibleReplies, setVisibleReplies] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [newReply, setNewReply] = useRecoilState(replyAtom);
  const currentUser = useRecoilValue(userAtom);
  const [loading, setLoading] = useState(false);

  // Global state setters for feed and user posts:
  const setPosts = useSetRecoilState(feedPostAtom);
  const setUserPosts = useSetRecoilState(userPostAtom);

  // Fetch replies
  useEffect(() => {
    const fetchReplies = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/post/${id ?? postId}/replies`);
        const data = await res.json();
        setAllReplies(data);
        const initialReplies = data.slice(0, 3);
        setVisibleReplies(initialReplies);
        setHasMore(data.length > initialReplies.length);
      } catch (error) {
        toast.error("Error fetching replies", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReplies();
  }, [postId, id, setAllReplies]);

  // Handle new reply
  useEffect(() => {
    if (newReply) {
      setAllReplies((prev) => {
        if (!prev.some((r) => r.id === newReply.id)) {
          return [newReply, ...prev];
        }
        return prev;
      });
      setVisibleReplies((prev) => {
        if (!prev.some((r) => r.id === newReply.id)) {
          return [newReply, ...prev];
        }
        return prev;
      });
      if (allReplies.length === 0) {
        setHasMore(false);
      } else {
        setHasMore(allReplies.length + 1 > visibleReplies.length + 1);
      }
      setNewReply(null);
    }
  }, [allReplies, newReply, visibleReplies, setNewReply, setAllReplies]);

  // Delete reply and update global states
  const handleDeleteReply = async (replyId) => {
    if (!window.confirm("Are you sure you want to delete this reply?")) return;
    try {
      const res = await fetch(`/api/post/reply/${replyId}`, {
        method: "DELETE",
      });
      const result = await res.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message || "Reply deleted successfully");

      // Remove deleted reply from local replies state
      setAllReplies((prevReplies) => {
        const newReplies = prevReplies.filter((r) => r.id !== replyId);
        // Call the parent's update function with the new count:
        if (onCommentUpdate) {
          onCommentUpdate(postId, newReplies.length);
        }
        return newReplies;
      });

      setVisibleReplies((prev) => prev.filter((r) => r.id !== replyId));
      setHasMore(
        allReplies.filter((r) => r.id !== replyId).length > visibleReplies.length
      );

      // Update global feed posts:
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                TotalRepliesNumber: (post.TotalRepliesNumber || 0) - 1,
              }
            : post
        )
      );

      // Update global user posts:
      setUserPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                TotalRepliesNumber: (post.TotalRepliesNumber || 0) - 1,
              }
            : post
        )
      );
    } catch (error) {
      toast.error("Error deleting reply", error);
    }
  };

  // Show more replies
  const handleShowMore = () => {
    const currentCount = visibleReplies.length;
    const newVisible = allReplies.slice(0, currentCount + 3);
    setVisibleReplies(newVisible);
    setHasMore(allReplies.length > newVisible.length);
  };

  return (
    <div className="bg-gray-300 p-4 mt-6 rounded-lg shadow-md">
      {visibleReplies.length === 0 && !loading ? (
        <h2 className="font-bold">No comments yet</h2>
      ) : (
        visibleReplies.map((reply, index) => (
          <div
            key={reply.id}
            className={`relative pb-4 py-6 ${
              index < visibleReplies.length - 1 ? "border-b-4" : ""
            } px-4`}
          >
            {currentUser && reply.username === currentUser.username && (
              <DeleteOutlined
                onClick={() => handleDeleteReply(reply.id)}
                className="absolute top-2 right-2 cursor-pointer text-gray-500 hover:text-red-500 text-2xl"
              />
            )}

            <div className="flex items-center space-x-2">
              <img
                src={reply.userProfilePic || "https://placehold.co/32x32"}
                alt="Profile"
                className="rounded-full w-12 h-12"
              />
              <div className="flex-1">
                <h2 className="font-bold">{reply.username}</h2>
                <p className="text-gray-500">{reply.text}</p>
              </div>
              <p className="text-gray-500">
                {formatDistanceToNow(new Date(reply.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        ))
      )}
      {hasMore && visibleReplies.length > 0 && (
        <button
          onClick={handleShowMore}
          className="bg-blue-500 text-white px-4 py-2 rounded mt-4"
        >
          Show More
        </button>
      )}
    </div>
  );
};

export default RepliesSection;
