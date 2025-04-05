import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import loader from "../assets/loader.svg";
import { BankOutlined, UserOutlined, ReadOutlined } from "@ant-design/icons";
import PostCard from "../Components/feed/PostCard";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";


const SearchResults = () => {
  const [posts, setPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const query = queryParams.get("q");
  const filterType = queryParams.get("filterType");
  const sourceType = queryParams.get("sourceType");
  const [loading, setLoading] = useState(false);

  const fetchPosts = async (page) => {
    setLoading(true);
    try {
      // handle url
      let url = `/api/post/filter/${query}?page=${page}&limit=3`;
      if (filterType) url += `&filterType=${filterType}`;
      if (filterType === "Recruitment" && sourceType) url += `&sourceType=${sourceType}`;

      const response = await fetch(url);
      const data = await response.json();
      console.log(data)
      if (data.error) {
        setPosts([]);
        setTotalPages(0);
        return;
      }
      if (page === 1) {
        setPosts(data.posts);
      } else {
        setPosts(prevPosts => [...prevPosts, ...data.posts]);
      }
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Error fetching posts:" + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      setCurrentPage(1);
      fetchPosts(1);
    }
  }, [query, filterType, sourceType]);

  useEffect(() => {
    if (!query || query.trim() === "") {
      navigate("/tech");
    }
  }, [query, navigate]);

  const handleShowMore = () => {
    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchPosts(nextPage);
    }
  };

  const handleLikeUpdate = (postId, newLikeCount) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, likes: newLikeCount } : post
      )
    );
  };

  const handleCommentUpdate = (postId, newCommentCount) => {
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId
          ? { ...post, TotalRepliesNumber: newCommentCount }
          : post
      )
    );
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-4">
        Search Results for &quot;{query}&quot;
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.length !== 0 ? (
          posts.map((post) => (
            <div
              key={post.id}
              className="cursor-pointer"
            >
              <div
                className="relative bg-gray-200 shadow-md rounded-lg p-6 transition-transform duration-500 hover:-translate-y-2.5"
              >
                {post.type === "Recruitment" ? (
                  <div className="absolute top-1 right-1 flex items-center bg-gray-200 rounded-full px-2 py-1 shadow">
                    {post.sourceType === "enterprise" ? (
                      <>
                        <BankOutlined className="text-blue-600 mr-1" />
                        <span className="text-sm">Enterprise</span>
                      </>
                    ) : post.sourceType === "freelancer" ? (
                      <>
                        <UserOutlined className="text-green-600 mr-1" />
                        <span className="text-sm">Freelancer</span>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="absolute top-1 right-1 flex items-center bg-gray-200 rounded-full px-2 py-1 shadow">
                    <ReadOutlined className="text-gray-600 mr-1" />
                  </div>
                )}
                <div className="mt-1">
                <PostCard
                  key={post?.id}
                  userId={post.userId || post.UserId} // adjust as needed
                  postId={post.id}
                  profilePic={post.profilePic || "https://placehold.co/40x40"}
                  title={post.title}
                  author={post.UserName}
                  time={formatDistanceToNow(new Date(post.createdAt), {addSuffix: true,})}
                  content={post.text}
                  imageUrl={post.img}
                  type={post.type}
                  hashtag={post.hashtag || ""}
                  sourceType={post.sourceType}
                  LikedUserIds={post?.likedByUserIds || []}
                  likes={post.LikeCount || post.TotalLikeNumber || 0}
                  comments={post.TotalRepliesNumber || 0}
                  recommend={post.recommend || false}
                  onLikeUpdate={handleLikeUpdate}
                  onCommentUpdate={handleCommentUpdate}
                />
                </div>
              </div>
            </div>
          ))
        ) : (
          <h2 className="text-2xl font-bold mb-4 mt-5">Post Not Found</h2>
        )}
      </div>

      {currentPage < totalPages && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleShowMore}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm"
          >
            Show More
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
