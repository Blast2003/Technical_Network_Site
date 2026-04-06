// SpecificPostPage.jsx (updated)
import React, { useEffect, useState } from "react";
import PostCard from "../Components/feed/PostCard";

import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { formatDistanceToNow } from "date-fns";
import LeftNav from "../Components/LeftNav";
import TrendingTopics from "../Components/TrendingTopics";
import SuggestedFollows from "../Components/recommendation/SuggestedFollows";
import loader from "../assets/loader.svg";
import { useRecoilValue } from "recoil";
import userAtom from "../Atoms/userAtom";

const SpecificPostPage = () => {
  const currentUser = useRecoilValue(userAtom);
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ownerPost, setOwnerPost] = useState(null);

  useEffect(() => {
    const fetchById = async () => {
      setLoading(true);
      setPost(null);
      setOwnerPost(null);

      try {
        // gọi API theo id
        const res = await fetch(`/api/post/${id}`);
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to fetch post");
          setLoading(false);
          return;
        }
        setPost(data);

        // fetch owner profile
        const username = data.UserName;
        if (!username) {
          toast.error("Post does not have an owner");
          setLoading(false);
          return;
        }

        const ownerRes = await fetch(`/api/user/profile/${encodeURIComponent(username)}`);
        if (!ownerRes.ok) {
          const err = await ownerRes.json();
          toast.error(err.error || "Failed to fetch user profile");
          setLoading(false);
          return;
        }
        const ownerData = await ownerRes.json();
        setOwnerPost(ownerData);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchById();
  }, [id]);

  const handleLikeUpdate = (postId, newLikeCount, isLiked, actorId) => {
    setPost(prev => {
      if (!prev || prev.id !== postId) return prev;

      // Get the current liked-array (support both naming variants), clone to avoid mutation
      const prevLikedA = Array.isArray(prev.LikedUserIds)
        ? [...prev.LikedUserIds]
        : Array.isArray(prev.likedByUserIds)
          ? [...prev.likedByUserIds]
          : [];

      // Decide whether we should update the local client's liked-user array:
      // - If actorId is provided: only change the local array if actorId === currentUser.id
      // - If actorId is not provided: assume this is a local action and modify for current user
      const shouldModifyForCurrentUser = actorId ? actorId === currentUser?.id : true;

      let updatedLikedA = prevLikedA;

      if (shouldModifyForCurrentUser && currentUser?.id != null) {
        if (isLiked) {
          // add current user id (avoid duplicates)
          if (!updatedLikedA.includes(currentUser.id)) {
            updatedLikedA = [...updatedLikedA, currentUser.id];
          }
        } else {
          // remove current user id
          updatedLikedA = updatedLikedA.filter(id => id !== currentUser.id);
        }
      }
      // Ensure uniqueness
      updatedLikedA = Array.from(new Set(updatedLikedA));

      return {
        ...prev,
        // update canonical count fields
        TotalLikeNumber: newLikeCount,
        LikeCount: newLikeCount,
        // keep both naming variants in sync
        LikedUserIds: updatedLikedA,
        likedByUserIds: updatedLikedA,
      };
    });
  };


  // Wait until both post and ownerPost are loaded
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Loading...</p>
      </div>
    );
  }

  // If no post or the owner's account is frozen, render "Post Not Found"
  if (!post || ownerPost?.isFrozen) {
    return (
      <h2 className="text-2xl font-bold mt-10 text-center">Post Not Found</h2>
    );
  }


  return (
    <div className="bg-gray-200 min-h-screen">
      <div className="flex flex-col md:flex-row justify-center">
        {/* LEFT NAV */}
        <aside className="sm:items-center sm:justify-center md:block md:w-66 p-4 lg:h-[590px]">
          <div className="bg-white rounded-lg shadow p-4 h-full">
            <LeftNav />
          </div>
        </aside>

        <div className="w-full md:w-[600px] lg:w-[700px] p-4">
          <PostCard
            postId={post?.id}
            profilePic={post?.profilePic || "https://placehold.co/40x40"}
            author={post?.UserName}
            time={formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            title={post?.title}
            content={post?.text}
            imageUrl={post?.img}
            type={post?.type}
            hashtag={post?.hashtag}
            LikedUserByIds={post?.LikedUserIds} // match PostCard prop name
            likes={post?.LikeCount || post?.TotalLikeNumber || 0}
            comments={post?.TotalRepliesNumber || 0}
            onLikeUpdate={handleLikeUpdate}
            mainField ={post?.mainField}
          />
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
