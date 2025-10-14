// PostCard.jsx (fixed badge positioning: recommend left when sourceType also exists)
import React, { useEffect, useState } from "react";
import {
  HeartOutlined,
  HeartFilled,
  CommentOutlined,
  DeleteOutlined,
  ShareAltOutlined,
  CrownOutlined,
  UserOutlined,
  BankOutlined
} from "@ant-design/icons";
import { CiBookmark } from "react-icons/ci";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../../Atoms/userAtom";
import userPostAtom from "../../Atoms/userPostAtom";
import Linkify from "react-linkify";
import { useSocket } from "../../Context/SocketContext";

import ReplyModal from "../../Components/modal/ReplyModal";
import LikesModal from "../../Components/modal/LikesModal"; // NEW
import feedPostAtom from "../../Atoms/feedPostAtom";

const PostCard = ({
  userId,
  postId,
  profilePic,
  title,
  author,
  time,
  content,
  imageUrl,
  type,
  hashtag,
  sourceType,
  LikedUserByIds,
  likes,
  comments,
  recommend,
  mainField,
  onLikeUpdate,
  onCommentIconClick,
}) => {
  const [likeCount, setLikeCount] = useState(likes);
  const [commentCount, setCommentCount] = useState(comments);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [isLikesModalOpen, setIsLikesModalOpen] = useState(false);

  const currentUser = useRecoilValue(userAtom);
  const setUserPosts = useSetRecoilState(userPostAtom);
  const setFeedPosts = useSetRecoilState(feedPostAtom);
  const { socket } = useSocket();

  useEffect(() => {
    socket.emit("joinPostRoom", { postId });

    const likeHandler = ({ postId: updatedId, totalLikes, isLiked, actorId }) => {
      if (updatedId === postId) {
        // update local count
        setLikeCount(totalLikes);

        // update global atoms (feed/user lists) using actorId if present
        handleLikeGlobalUpdate(updatedId, totalLikes, isLiked, actorId);

        // inform parent (SearchResults or SpecificPostPage) with actorId
        if (typeof onLikeUpdate === "function") {
          onLikeUpdate(updatedId, totalLikes, isLiked, actorId);
        }
      }
    };
    socket.on("postLikeUpdated", likeHandler);

    const replyHandler = ({ postId: updatedId, totalReplies, action }) => {
      if (updatedId === postId) {
        setCommentCount(totalReplies);
      }
    };
    socket.on("postReplyUpdated", replyHandler);

    return () => {
      socket.off("postLikeUpdated", likeHandler);
      socket.off("postReplyUpdated", replyHandler);
      socket.emit("leavePostRoom", { postId });
    };
  }, [postId, onLikeUpdate, socket]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await fetch(`/api/post/delete/${postId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setUserPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
      toast.success(data.message);
    } catch (error) {
      console.error("Error in deleting post:", error);
      toast.error("Failed to delete post.");
    }
  };

  const handleLikeGlobalUpdate = (postIdArg, newLikeCount, newLikeStatus, actorId = currentUser?.id) => {
    // update feed posts
    setFeedPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postIdArg) {
          let updatedLikedUserIds = [...(post.LikedUserIds || [])];

          // only modify arrays using actorId (if actorId isn't provided, we default to currentUser.id)
          if (actorId) {
            if (newLikeStatus) {
              if (!updatedLikedUserIds.includes(actorId)) {
                updatedLikedUserIds.push(actorId);
              }
            } else {
              updatedLikedUserIds = updatedLikedUserIds.filter((id) => id !== actorId);
            }
          }

          return { ...post, TotalLikeNumber: newLikeCount, LikedUserIds: updatedLikedUserIds };
        }
        return post;
      })
    );

    // update the user's own post list (if present)
    setUserPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postIdArg) {
          let updatedLikedUserIds = [...(post.likedByUserIds || [])];
          if (actorId) {
            if (newLikeStatus) {
              if (!updatedLikedUserIds.includes(actorId)) {
                updatedLikedUserIds.push(actorId);
              }
            } else {
              updatedLikedUserIds = updatedLikedUserIds.filter((id) => id !== actorId);
            }
          }
          return { ...post, TotalLikeNumber: newLikeCount, likedByUserIds: updatedLikedUserIds };
        }
        return post;
      })
    );
  };

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/post/like/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const newLikeStatus = data.isLiked;
      const newLikeCount = newLikeStatus ? likeCount + 1 : likeCount - 1;
      setLikeCount(newLikeCount);
      handleLikeGlobalUpdate(postId, newLikeCount, newLikeStatus, currentUser?.id);
      toast.success(data.message);
      onLikeUpdate(postId, newLikeCount, newLikeStatus);
    } catch (error) {
      console.log("Error in liking/unliking post: " + error.message);
    }
  };

  // open likes modal (clicking the number)
  const handleOpenLikesModal = (e) => {
    e.stopPropagation();
    setIsLikesModalOpen(true);
  };

  const handleCommentIconClick = (e) => {
    e.stopPropagation();

    // emit interaction to server so we can track it for followers
    try {
      // include actor info if available, and mainField (taxonomy)
      socket.emit("postViewed", {
        postId,
        actorId: currentUser?.id,
        actorUsername: currentUser?.username,
        mainField: mainField || type || ""
      });
    } catch (err) {
      console.warn("socket emit postViewed failed", err);
    }

    if (onCommentIconClick) {
      return onCommentIconClick();
    }
    setIsReplyModalOpen(true);
  };

  useEffect(() => {
    setCommentCount(comments);
  }, [comments]);

  useEffect(() => {
    setLikeCount(likes);
  }, [likes]);

  // decide badge positions
  const hasSourceBadge = type === "Recruitment" && sourceType;
  const hasRecommendBadge = !!recommend;

  return (
    <div className="relative bg-gray-300 p-4 rounded-lg shadow-md">
      {/* Badges:
          - If both exist: sourceType => right, recommend => left
          - If only recommend exists: show it on the right (preserves previous behavior)
      */}
      {hasSourceBadge && (
        <div className="absolute top-0 right-0 z-10 bg-blue-500 text-white px-2 py-1 rounded-bl-lg flex items-center">
          {sourceType === "enterprise" ? (
            <BankOutlined className="mr-1" />
          ) : (
            <UserOutlined className="mr-1" />
          )}
          <span className="text-xs font-bold">{sourceType}</span>
        </div>
      )}

      {hasRecommendBadge && (
        <div
          className={`absolute top-0 z-10 bg-blue-500 text-white px-2 py-1 flex items-center ${
            hasSourceBadge ? "left-0 rounded-br-lg" : "right-0 rounded-br-lg"
          }`}
        >
          <CrownOutlined className="mr-1" />
          <span className="text-xs font-bold">Recommendation</span>
        </div>
      )}

      {currentUser && currentUser.id === userId && (
        <DeleteOutlined
          onClick={handleDelete}
          className="text-2xl mt-6 mr-2 absolute top-2 right-2 text-gray-600 hover:text-gray-800 cursor-pointer"
        />
      )}

      <div className="flex items-center space-x-4 mt-4">
        <Link
          to={`/tech/profile/${author}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsReplyModalOpen(false);
          }}
        >
          <img
            src={profilePic || "https://placehold.co/32x32"}
            alt={`${author}'s profile`}
            className="h-10 w-10 rounded-full cursor-pointer"
            loading="lazy"
          />
        </Link>
        <div className="flex flex-col">
          <Link
            to={`/tech/profile/${author}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsReplyModalOpen(false);
            }}
            className="font-semibold hover:font-bold cursor-pointer"
          >
            {author}
          </Link>
          <p className="text-gray-500 text-sm cursor-pointer border-b border-gray-200 hover:border-gray-500 transition duration-300">
            {time}
          </p>
        </div>
      </div>

      <div className="hover:no-underline hover:text-current">
        <h2 className="text-xl font-semibold mb-2">
          <Link
            to={`/tech/post/${postId}`}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="hover:underline"
          >
            {title}
          </Link>
        </h2>
        <p className="mt-2">Type: {type}</p>
        <Linkify componentDecorator={(href, text, key) => (
            <a href={href} key={key} target="_blank" rel="noopener noreferrer"
               className="text-blue-500 underline hover:text-blue-700">
              {text}
            </a>
        )}>
          <p className="mt-2" style={{ whiteSpace: "pre-line" }}>{content}</p>
        </Linkify>
        {imageUrl && <img src={imageUrl} alt="Post" className="w-full h-auto rounded-lg my-2" />}
        <p className="mt-4 text-blue-500">{hashtag}</p>
      </div>

      <div className="flex justify-between items-center text-gray-500 mt-2">
        <div className="flex space-x-4">
          {/* Like area: separate clickable pieces */}
          <div className="text-sm mt-2 flex items-center">
            <span
              onClick={handleLikeClick}
              className={`cursor-pointer ${LikedUserByIds?.includes(currentUser?.id) ? "text-red-500" : "text-gray-500"}`}
            >
              {LikedUserByIds?.includes(currentUser?.id) ? (
                <HeartFilled style={{ fontSize: "20px" }} />
              ) : (
                <HeartOutlined style={{ fontSize: "20px" }} />
              )}
            </span>

            {/* number is clickable to open modal */}
            <span
              onClick={handleOpenLikesModal}
              className="ml-1 cursor-pointer hover:text-blue-500 hover:underline"
              title="See who liked this"
            >
              {likeCount}
            </span>
          </div>

          <span className="text-sm mt-2">
            <CommentOutlined
              style={{ fontSize: "20px" }}
              onClick={handleCommentIconClick}
            />{" "}
            {commentCount}
          </span>
          <span className="text-sm mt-2">
            <ShareAltOutlined style={{ fontSize: "20px" }} /> Share
          </span>
        </div>
        <CiBookmark style={{ fontSize: "20px" }} />
      </div>

      {/* Reply Modal */}
      <ReplyModal
        isOpen={isReplyModalOpen}
        onCancel={() => setIsReplyModalOpen(false)}
        postId={postId}
        username={author}
      />

      {/* Likes Modal */}
      <LikesModal
        isOpen={isLikesModalOpen}
        onClose={() => setIsLikesModalOpen(false)}
        likedUserIds={LikedUserByIds || []}
      />
    </div>
  );
};

export default PostCard;
