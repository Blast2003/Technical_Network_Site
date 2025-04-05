import React, { useEffect, useRef, useState } from "react";
import PostCard from "../../Components/feed/PostCard";
import AppPromotion from "../../Components/section/AppPromotion";
import RepliesSection from "../../Components/section/RepliesSection";
import { toast } from "react-toastify";
import { formatDistanceToNow } from "date-fns";
import { Button, Input, Modal } from "antd";
import loader from "../../assets/loader.svg";
import { useSetRecoilState, useRecoilValue } from "recoil";
import replyAtom from "../../Atoms/replyAtom";
import feedPostAtom from "../../Atoms/feedPostAtom";
import userPostAtom from "../../Atoms/userPostAtom";
import userAtom from "../../Atoms/userAtom";

const ReplyModal = ({ isOpen, onCancel, postId, username }) => {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ownerPost, setOwnerPost] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const setNewReply = useSetRecoilState(replyAtom);
  // Import global states for feed posts and user posts:
  const setFeedPosts = useSetRecoilState(feedPostAtom);
  const setUserPosts = useSetRecoilState(userPostAtom);
  const currentUser = useRecoilValue(userAtom);

  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setReplyContent("");
      return;
    }
    const fetchPost = async () => {
      setLoading(true);
      setPost(null);
      try {
        const response = await fetch(`/api/post/${postId}`);
        const data = await response.json();
        console.log("Post in Modal", data)
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setPost(data);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchOwnerPost = async () => {
      try {
        const response = await fetch(`/api/user/profile/${username}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user profile");
        }
        const data = await response.json();
        setOwnerPost(data);
      } catch (err) {
        toast.error(err.message);
      }
    };

    fetchPost();
    fetchOwnerPost();
  }, [postId, username, isOpen]);


  // update for Modal + global
  const onLikeUpdateForModal = (pid, newLikeCount, newLikeStatus) => {
    setPost((prevPost) => {
      if (prevPost.id === pid) {
        // Use prevPost instead of post
        let updatedLikedUserIds = [...(prevPost.LikedUserIds || [])];
        if (newLikeStatus) {
          if (!updatedLikedUserIds.includes(currentUser.id)) {
            updatedLikedUserIds.push(currentUser.id);
          }
        } else {
          updatedLikedUserIds = updatedLikedUserIds.filter(
            (id) => id !== currentUser.id
          );
        }
        return {
          ...prevPost,
          TotalLikeNumber: newLikeCount,
          LikedUserIds: updatedLikedUserIds,
        };
      }
      return prevPost;
    });
  };
  

  // Update comment count function remains the same.
  const updateCommentCount = (pid, newCount) => {
    setPost((prevPost) =>
      prevPost?.id === pid ? { ...prevPost, TotalRepliesNumber: newCount } : prevPost
    );
  };

  // Post a reply remains unchanged
  const handleReplyPost = async () => {
    if (!replyContent.trim()) {
      toast.error("Reply cannot be empty!");
      return;
    }
    try {
      setReplyLoading(true);
      const response = await fetch(`/api/post/reply/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyContent }),
      });
  
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
  
      toast.success(data.message);
  
      // Update the local post state 
      setPost((prevPost) => {
        if (!prevPost) return null;
        const newRepliesCount = (prevPost.TotalRepliesNumber || 0) + 1;
        return { ...prevPost, TotalRepliesNumber: newRepliesCount };
      });
  
      // Update global feed posts:
      setFeedPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, TotalRepliesNumber: (post.TotalRepliesNumber || 0) + 1 }
            : post
        )
      );
  
      // Update global user posts:
      setUserPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, TotalRepliesNumber: (post.TotalRepliesNumber || 0) + 1 }
            : post
        )
      );
  

      setNewReply(data.reply);

      // Clear the text area
      setReplyContent("");
    } catch (error) {
      toast.error("Error posting reply: " + error.message);
    } finally {
      setReplyLoading(false);
    }
  };

  const renderContent = () => {
    if (loading || ownerPost === null) {
      return (
        <div className="flex flex-col items-center justify-center h-96">
          <img width="100" src={loader} alt="loader" />
          <p>Loading...</p>
        </div>
      );
    }

    if ((!post && !loading) || ownerPost.isFrozen) {
      return (
        <h2 className="text-2xl font-bold mt-10 text-center">Post Not Found</h2>
      );
    }

    return (
      <div className="bg-gray-200">
        <div className="flex flex-col md:flex-row justify-center">
          <div className="w-full md:w-[600px] lg:w-[700px] p-4 rounded-sm">
            <PostCard
              postId={post?.id ?? postId}
              profilePic={post?.profilePic || "https://placehold.co/40x40"}
              author={post?.UserName || username}
              time={formatDistanceToNow(new Date(post.createdAt), {
                addSuffix: true,
              })}
              title={post?.title}
              content={post?.text}
              imageUrl={post?.img}
              type={post?.type}
              hashtag={post?.hashtag}
              LikedUserByIds={post?.LikedUserIds}
              likes={post?.LikeCount || post?.TotalLikeNumber || 0}
              comments={post?.TotalRepliesNumber || 0}
              onLikeUpdate={onLikeUpdateForModal}
            />

            {/* New Reply Text Area */}
            <div className="my-4">
              <Input.TextArea
                rows={4}
                className="bg-gray-300"
                placeholder="Reply goes here..."
                maxLength={500}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <Button
                  type="primary"
                  onClick={handleReplyPost}
                  loading={replyLoading}
                >
                  Post
                </Button>
              </div>
            </div>

            <AppPromotion />

            {/* Replies Section */}
            <RepliesSection postId={postId} onCommentUpdate={updateCommentCount} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title="Post Details"
      open={isOpen}
      onCancel={onCancel}
      footer={null}
      width={600}
      height={700}
      centered
      bodyStyle={{
        height: "70vh",
        overflowY: "auto",
      }}
      modalRender={(modal) => (
        <div
          ref={modalRef}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "700px",
            height: "80vh",
            background: "#fff",
            overflow: "hidden",
            borderRadius: "15px",
          }}
        >
          {modal}
        </div>
      )}
    >
      {renderContent()}
    </Modal>
  );
};

export default ReplyModal;
