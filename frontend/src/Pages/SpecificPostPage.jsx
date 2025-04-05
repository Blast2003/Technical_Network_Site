import React, { useEffect, useState } from "react";
import PostCard from "../Components/feed/PostCard";
import AppPromotion from "../Components/section/AppPromotion";
import RepliesSection from "../Components/section/RepliesSection";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { formatDistanceToNow } from "date-fns";
import LeftNav from "../Components/LeftNav";
import TrendingTopics from "../Components/TrendingTopics";
import SuggestedFollows from "../Components/recommendation/SuggestedFollows";
import loader from "../assets/loader.svg";

const SpecificPostPage = () => {
  const { username, id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ownerPost, setOwnerPost] = useState(null);

  useEffect(() => {
    const fetchPost = async () => {
      setPost(null);
      try {
        const response = await fetch(`/api/post/${id}`);
        const data = await response.json();
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
  }, [id, username]);

  // Wait until both post and ownerPost are loaded
  if (loading || ownerPost === null) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting...</p>
      </div>
    );
  }

  // If no post or the owner's account is frozen, render "Post Not Found"
  if (!post || ownerPost.isFrozen) {
    return (
      <h2 className="text-2xl font-bold mt-10 text-center">Post Not Found</h2>
    );
  }

  const handleCommentUpdate = (postId, newCommentCount) => {
    setPost((post) =>
        post.id === postId
          ? { ...post, TotalRepliesNumber: newCommentCount }
          : post
      );
  };

  return (
    <div className="bg-gray-200 min-h-screen">
      <div className="flex flex-col md:flex-row justify-center">
        {/* LEFT NAV */}
        <aside className="sm:items-center sm:justify-center md:block md:w-66 p-4 lg:h-[560px]">
          <div className="bg-white rounded-lg shadow p-4 h-full">
            <LeftNav />
          </div>
        </aside>

        <div className="w-full md:w-[600px] lg:w-[700px] p-4">
          <PostCard
            postId={post?.id ?? id}
            profilePic={post?.profilePic || "https://placehold.co/40x40"}
            author={post?.UserName || username}
            time={formatDistanceToNow(new Date(post.createdAt), {
              addSuffix: true,
            })}
            content={post?.text}
            imageUrl={post?.img}
            type={post?.type}
            hashtag={post?.hashtag}
            LikedUserIds={post?.LikedUserIds}
            likes={post?.LikeCount || post?.TotalLikeNumber || 0}
            comments={post?.TotalRepliesNumber || 0}
            onLikeUpdate={(postId, newLikeCount) =>
              setPost((prevPost) =>
                prevPost?.id === postId
                  ? { ...prevPost, likes: newLikeCount }
                  : prevPost
              )
            }
            onCommentUpdate={handleCommentUpdate}
          />
          <AppPromotion />
          <RepliesSection postId={id} onCommentUpdate={handleCommentUpdate} />
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="hidden lg:block w-80 p-4">
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <TrendingTopics />
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <SuggestedFollows />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SpecificPostPage;
