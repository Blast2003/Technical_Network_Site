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
import { useInView } from 'react-intersection-observer';
import { useAsyncList } from 'react-stately';

const RecruitmentPage = () => {
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useRecoilState(feedPostAtom);

  const { ref: loaderRef, inView } = useInView({ threshold: 0 });

  const list = useAsyncList({
    async load({ signal, cursor }) {
      // Start at page 1 if no cursor is provided.
      const pageNum = cursor ?? 1;
      const response = await fetch(
        `/api/post/recruitment/post?page=${pageNum}&limit=5`,
        { cache: 'no-store', signal }
      );
      if (!response.ok) {
        throw new Error('Error fetching posts');
      }
      const data = await response.json();
      return {
        items: data.posts || [],
        // If we got exactly 5 posts, assume there may be more.
        cursor: data.posts && data.posts.length === 5 ? pageNum + 1 : null
      };
    },
    getKey: (item) => item.id
  });

  // reset the post for the first time
    useEffect(() => {
      setPosts([]);
    }, []);  

  // When the loader element is in view, load more posts.
  useEffect(() => {
    if (inView && list.cursor !== null && list.loadingState !== 'loadingMore') {
      list.loadMore();
    }
  }, [inView, list.cursor, list.loadingState]);

  // Update your state with the items loaded by asyncList.
  useEffect(() => {
    setPosts(list.items);
    setLoading(list.loadingState === "loading");

  }, [list.items, setPosts, list.loadingState]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting to recruitment page...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Container for the three columns */}
      <div className="flex flex-col md:flex-row justify-center">
        {/* LEFT NAV */}
        <aside className="sm:items-center sm:justify-center md:block md:w-66 p-4 lg:h-[560px]">
          <div className="bg-white rounded-lg shadow p-4 h-full">
            <LeftNav />
          </div>
        </aside>

        {/* MAIN FEED: takes up full width on small screens, center portion on larger */}
        <main className="w-full md:w-[600px] lg:w-[700px] p-4">
          {/* Post Input */}
          <div className="bg-gray-200 rounded-lg shadow p-4">
            <PostInput />
          </div>

          {/* Feed Posts */}
          <div className="space-y-4">
            {!loading && posts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl font-bold text-gray-600 mb-4">
                  There are no recruitment announcements
                </div>
                <p className="text-gray-500">Check back later for new opportunities.</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-white rounded-lg shadow p-4">
                  <PostCard
                    postId={post.id}
                    profilePic={
                      post.profilePic === ""
                        ? "https://placehold.co/40x40"
                        : post.profilePic
                    }
                    author={post.UserName}
                    time={formatDistanceToNow(new Date(post.createdAt), {
                      addSuffix: true,
                    })}
                    content={post.text}
                    title={post?.title}
                    imageUrl={post.img}
                    type={post?.type}
                    hashtag={post?.hashtag}
                    sourceType = {post?.sourceType}
                    LikedUserByIds={post?.LikedUserIds}
                    likes={post?.TotalLikeNumber || 0}
                    comments={post?.TotalRepliesNumber || 0}
                  />
                </div>
              ))
            )}
          </div>
          {/* Loader for infinite scrolling */}
          {list.cursor !== null && (
            <div
              ref={loaderRef}
              style={{
                height: '50px',
                margin: '10px 0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              {(list.loadingState === 'loadingMore' || list.loadingState === 'loading') && (
                <>
                  <img width="100" src={loader} alt="loader" className="mt-8" />
                  <p style={{ marginLeft: '10px' }}>Loading More Posts...</p>
                </>
              )}
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR */}
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
    </div>
  );
};

export default RecruitmentPage;
