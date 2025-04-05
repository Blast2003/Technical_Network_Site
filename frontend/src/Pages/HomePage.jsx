import React, { useEffect, useState } from "react";
import PostInput from "../Components/feed/PostInput";
import PostCard from "../Components/feed/PostCard";
import TrendingTopics from "../Components/TrendingTopics";
import SuggestedFollows from "../Components/recommendation/SuggestedFollows";
import LeftNav from "../Components/LeftNav";
import { useRecoilState } from "recoil";
import feedPostAtom from "../Atoms/feedPostAtom";
import { formatDistanceToNow } from "date-fns";
import loader from "../assets/loader.svg";
import { useSocket } from "../Context/SocketContext";
import { useRecoilValue } from "recoil";
import userAtom from "../Atoms/userAtom";

import { useAsyncList } from "react-stately";
import { useInView } from "react-intersection-observer";
import ChatBotIcon from "../Components/chatbot/ChatBotIcon";

const HomePage = () => {
  const [posts, setPosts] = useRecoilState(feedPostAtom);
  const [isLoading, setIsLoading] = useState(true);
  const { socket } = useSocket();
  const user = useRecoilValue(userAtom);

  // Setup infinite scroll hooks:
  const { ref: loaderRef, inView } = useInView({ threshold: 0 });
  const list = useAsyncList({
    async load({ signal, cursor }) {
      const pageNum = cursor ?? 1;
      const response = await fetch(
        `/api/post/feed/post?page=${pageNum}&limit=5`,
        { cache: 'no-store', signal }
      );
      if (!response.ok) {
        throw new Error("Error fetching posts");
      }
      const data = await response.json();
      return {
        items: data.posts || [],
        cursor: data.posts && data.posts.length === 5 ? pageNum + 1 : null,
      };
    },
    getKey: (item) => item.id,
  });

  // reset the post for the first time
  useEffect(() => {
    setPosts([]);
  }, []);  

  // Update feed posts atom when list items change
  useEffect(() => {
    setPosts(list.items);
  }, [list.items]);

  // Update local isLoading state based on list loading state
  useEffect(() => {
    setIsLoading(list.loadingState === "loading");
  }, [list.loadingState]);

  // Load more posts when the loader comes into view
  useEffect(() => {
    if (inView && list.cursor !== null && list.loadingState !== "loadingMore") {
      list.loadMore();
    }
  }, [inView, list.cursor, list.loadingState]);

  // Listen for "notificationDeleted" event 
  useEffect(() => {
    if (socket && user?.id) {
      const handleNotificationDeleted = (notification) => {
        // Check if the deleted notification corresponds to a post deletion event
        if (
          notification.action ===
          "The person you're following has made a new post"
        ) {
          // Remove the deleted post from the async list
          const updatedItems = list.items.filter(
            (post) => post.id !== notification.post_id
          );
          setPosts(updatedItems);
        }
      };

      socket.on("notificationDeleted", handleNotificationDeleted);
      return () => {
        socket.off("notificationDeleted", handleNotificationDeleted);
      };
    }
  }, [socket, user, list]);


  

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting to homepage...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="flex flex-col md:flex-row justify-center">
        <aside className="sm:items-center sm:justify-center md:block md:w-66 p-4 lg:h-[560px]">
          <div className="bg-white rounded-lg shadow p-4 h-full">
            <LeftNav />
          </div>
        </aside>

        <main className="w-full md:w-[600px] lg:w-[700px] p-4 ">
          <div className="bg-gray-200 rounded-lg shadow p-4">
            <PostInput />
          </div>

          {!isLoading && list.items.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-4 mt-4 text-center">
              <p className="text-xl font-semibold text-gray-700 mb-2">
                You need to follow someone to see posts.
              </p>
              <p className="text-gray-500">
                Explore suggested follows and start connecting!
              </p>
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-white rounded-lg shadow p-4">
                  <PostCard
                    postId={post.id}
                    profilePic={
                      post?.profilePic === ""
                        ? "https://placehold.co/40x40"
                        : post?.profilePic || post?.Owners[0].profilePic
                    }
                    author={post.UserName ?? post?.Owners[0].username}
                    time={formatDistanceToNow(new Date(post.createdAt), {
                      addSuffix: true,
                    })}
                    content={post?.text}
                    title={post?.title}
                    imageUrl={post?.img}
                    type={post?.type}
                    hashtag={post?.hashtag}
                    LikedUserByIds={post?.LikedUserIds}
                    likes={post?.TotalLikeNumber || 0}
                    comments={post?.TotalRepliesNumber || 0}
                    recommend={post?.recommend} 
                  />
                </div>
              ))}
            </div>
          )}

          {/* Loader element for infinite scrolling */}
          {list.cursor !== null && (
            <div
              ref={loaderRef}
              style={{
                height: "50px",
                margin: "10px 0",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {(list.loadingState === "loadingMore" ||
                list.loadingState === "loading") && (
                <>
                  <img
                    width="100"
                    src={loader}
                    alt="loader"
                    className="mt-8"
                  />
                  <p style={{ marginLeft: "10px" }}>Loading More Posts...</p>
                </>
              )}
            </div>
          )}
        </main>

        <aside className="hidden lg:block w-[350px] p-4">
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

          {/* ChatBot icon */}
          <ChatBotIcon />
    </div>
  );
};

export default HomePage;
