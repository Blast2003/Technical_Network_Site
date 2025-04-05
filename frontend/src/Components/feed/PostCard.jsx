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
import {  useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "../../Atoms/userAtom";
import userPostAtom from "../../Atoms/userPostAtom";
import Linkify from "react-linkify";

// Import the new ReplyModal
import ReplyModal from "../../Components/modal/ReplyModal"; 
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
  onLikeUpdate
}) => {
  const [likeCount, setLikeCount] = useState(likes);
  const [commentCount, setCommentCount] = useState(comments);
  // Instead of showing a Modal here, we will open our new ReplyModal
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);

  const currentUser = useRecoilValue(userAtom);
  const setUserPosts = useSetRecoilState(userPostAtom);
  const setFeedPosts = useSetRecoilState(feedPostAtom);

  // console.log("User Ids: ", LikedUserByIds)

  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await fetch(`/api/post/delete/${postId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Remove deleted post from userPostAtom state
      setUserPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
      toast.success(data.message);
    } catch (error) {
      console.error("Error in deleting post:", error);
      toast.error("Failed to delete post.");
    }
  };

  const handleLikeGlobalUpdate = (postId, newLikeCount, newLikeStatus) => {
    // Update global feed posts:
    setFeedPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postId) {
          // Copy LikedUserIds to avoid direct state mutation:
          let updatedLikedUserIds = [...(post.LikedUserIds || [])];
          if (newLikeStatus) {
            if (!updatedLikedUserIds.includes(currentUser.id)) {
              updatedLikedUserIds.push(currentUser.id);
            }
          } else {
            updatedLikedUserIds = updatedLikedUserIds.filter(
              (id) => id !== currentUser.id
            );
          }
          return { ...post, TotalLikeNumber: newLikeCount, LikedUserIds: updatedLikedUserIds };
        }
        return post;
      })
    );
  
    // Update global user posts:
    setUserPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postId) {
          let updatedLikedUserIds = [...(post.likedByUserIds || [])];
          if (newLikeStatus) {
            if (!updatedLikedUserIds.includes(currentUser.id)) {
              updatedLikedUserIds.push(currentUser.id);
            }
          } else {
            updatedLikedUserIds = updatedLikedUserIds.filter(
              (id) => id !== currentUser.id
            );
          }
          return { ...post, TotalLikeNumber: newLikeCount, likedByUserIds: updatedLikedUserIds };
        }
        return post;
      })
    );
  };
  
  const handleLikeClick = async () => {
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
      // console.log("Lik status:", newLikeStatus)
      // Update the like counter based on the new like status:
      const newLikeCount = newLikeStatus ? likeCount + 1 : likeCount - 1;
  
      setLikeCount(newLikeCount);
      // Update both global states:
      handleLikeGlobalUpdate(postId, newLikeCount, newLikeStatus);
  
      toast.success(data.message);
      onLikeUpdate(postId, newLikeCount, newLikeStatus);
    } catch (error) {
      console.log("Error in liking/unliking post: " + error.message);
    }
  };
  

  // When the user clicks the comment icon, open the ReplyModal
  const handleCommentIconClick = () => {
    setIsReplyModalOpen(true);
  };

  useEffect(() => {
    setCommentCount(comments);
  }, [comments]);

  useEffect(() => {
    setLikeCount(likes);
  }, [likes]);

  return (
    <div className="relative bg-gray-300 p-4 rounded-lg shadow-md">

      {type === "Recruitment" && sourceType && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white px-2 py-1 rounded-bl-lg flex items-center">
          {sourceType === "enterprise" ? (
            <BankOutlined className="mr-1" />
          ) : (
            <UserOutlined className="mr-1" />
          )}
          <span className="text-xs font-bold">{sourceType}</span>
        </div>
      )}

      {recommend && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white px-2 py-1 rounded-br-lg flex items-center">
          <CrownOutlined className="mr-1" />
          <span className="text-xs font-bold">Recommendation</span>
        </div>
      )}

      {/* Delete icon in top-right corner if it's the current user's post */}
      {currentUser && currentUser.id === userId && (
        <DeleteOutlined
          onClick={handleDelete}
          className="text-2xl mt-4 mr-2 absolute top-2 right-2 text-gray-600 hover:text-gray-800 cursor-pointer"
        />
      )}

      <div className="flex items-center space-x-4">
        <img
          src={profilePic || "https://placehold.co/32x32"}
          alt={`${author}'s profile`}
          onClick={() => {
            navigate(`/tech/profile/${author}`);
            setIsReplyModalOpen(false)
          }}
          className="h-10 w-10 rounded-full cursor-pointer"
          loading="lazy"
        />
        <div className="flex flex-col">
          <h2
            onClick={() => navigate(`/tech/profile/${author}`)}
            className="font-semibold hover:font-bold cursor-pointer"
          >
            {author}
          </h2>
          <p
            className="text-gray-500 text-sm cursor-pointer border-b border-gray-200 hover:border-gray-500 transition duration-300"
          >
            {time}
          </p>
        </div>
      </div>

      <div className="hover:no-underline hover:text-current">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="mt-2">Type: {type}</p>
        <Linkify
          componentDecorator={(href, text, key) => (
            <a
              href={href}
              key={key}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline hover:text-blue-700"
            >
              {text}
            </a>
          )}
        >
          <p className="mt-2" style={{ whiteSpace: "pre-line" }}>
            {content}
          </p>
        </Linkify>
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Post"
            className="w-full h-auto rounded-lg my-2"
          />
        )}
        <p className="mt-4 text-blue-500">{hashtag}</p>
      </div>

      <div className="flex justify-between items-center text-gray-500 mt-2">
        <div className="flex space-x-4">
          <span
            className={`text-sm mt-2 cursor-pointer ${
              LikedUserByIds?.includes(currentUser?.id) ? "text-red-500" : "text-gray-500"
            }`}
            onClick={handleLikeClick}
          >
            {LikedUserByIds?.includes(currentUser?.id) ? (
              <HeartFilled style={{ fontSize: "20px" }} />
            ) : (
              <HeartOutlined style={{ fontSize: "20px" }} />
            )}{" "}
            {likeCount}
          </span>
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

      {/* Reply Modal (new component) */}
      <ReplyModal
        isOpen={isReplyModalOpen}
        onCancel={() => setIsReplyModalOpen(false)}
        postId={postId}
        username={author}
      />
    </div>
  );
};

export default PostCard;
