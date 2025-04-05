import React, { useRef, useEffect, useState } from 'react';
import ProfileSection from '../Components/section/ProfileSection';
import PostCard from '../Components/feed/PostCard';
import { PlusOutlined, FileImageOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Modal, Select, Input, Button, Tooltip, Radio } from 'antd';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { formatDistanceToNow } from 'date-fns';
import { useRecoilState, useRecoilValue } from 'recoil';
import userAtom from '../Atoms/userAtom';
import usePreviewImg from '../Hooks/usePreviewImg';
import LeftNav from '../Components/LeftNav';
import loader from "../assets/loader.svg";
import { useInView } from 'react-intersection-observer';
import { useAsyncList } from 'react-stately';
import userPostAtom from '../Atoms/userPostAtom';

const { Option } = Select;

const UserProfilePage = () => {
  const { username } = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form fields
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [postContent, setPostContent] = useState('');
  const [hashtagContent, setHashtagContent] = useState('');

  const [sourceTypeContent, setSourceTypeContent] = useState('');

  // Error states
  const [errors, setErrors] = useState({});

  // Other states
  const [userProfile, setUserProfile] = useState(null);
  const currentUser = useRecoilValue(userAtom);
  const [userPosts, setUserPosts] = useRecoilState(userPostAtom);
  const [loading, setLoading] = useState(false);

  // Image preview
  const fileRef = useRef(null);
  const { handleImageChange, imgUrl, setImgUrl } = usePreviewImg();

  // Intersection observer for infinite scroll
  const { ref: loaderRef, inView } = useInView({ threshold: 0 });
  const list = useAsyncList({
    async load({ signal, cursor }) {
      const pageNum = cursor ?? 1;
      const response = await fetch(
        `/api/post/user/${username}?page=${pageNum}&limit=5`,
        { cache: 'no-store', signal }
      );
      if (!response.ok) {
        throw new Error('Error fetching posts');
      }
      const data = await response.json();
      return {
        items: data.posts || [],
        cursor: data.posts && data.posts.length === 5 ? pageNum + 1 : null
      };
    },
    getKey: (item) => item.id
  });

  // reset the post for the first time
    useEffect(() => {
      setUserPosts([]);
    }, []);  

  useEffect(() => {
    list.reload();
  }, [username]);

  useEffect(() => {
    setUserPosts(list.items);
  }, [list.items]);

  useEffect(() => {
    if (inView && list.cursor !== null && list.loadingState !== 'loadingMore') {
      list.loadMore();
    }
  }, [inView, list.cursor, list.loadingState]);

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedTopic('');
    setSelectedType('');
    setPostContent('');
    setHashtagContent('');
    setImgUrl('');
    setErrors({}); // Clear errors on cancel
  };

  const handlePost = async () => {
    setLoading(true);
    setErrors({}); // reset old errors

    try {
      const response = await fetch('/api/post/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postedBy: userProfile.id,
          text: postContent,
          title: selectedTopic,
          img: imgUrl,
          type: selectedType,
          hashtag: hashtagContent,
          sourceType: sourceTypeContent
        }),
      });
      const data = await response.json();

      // If the backend returns field-specific errors, store them in state
      if (data.topicError || data.contentError || data.hashtagError || data.typeError) {
        setErrors({
          topic: data.topicError,
          content: data.contentError,
          hashtag: data.hashtagError,
          type: data.typeError
        });
        return;
      }

      // If there's a general error
      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Success: prepend new post
      toast.success("Post created successfully!");
      setUserPosts((prev) => [data, ...prev]);

      // Reset the modal fields
      setIsModalOpen(false);
      setSelectedTopic('');
      setSelectedType('');
      setPostContent('');
      setHashtagContent('');
      setImgUrl('');
    } catch (error) {
      console.error("Error posting:", error);
      toast.error("Error creating post: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`/api/user/profile/${username}`);
        if (!response.ok) {
          toast.error('User profile not found');
        }
        const data = await response.json();
        setUserProfile(data);
      } catch (error) {
        toast.error("Error fetching user profile:" + error);
      }
    };
    fetchUserProfile();
  }, [username]);


  if (!userProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting...</p>
      </div>
    );
  }

  if (userProfile.isFrozen) {
    return <h2 className='text-2xl font-bold mt-10 text-center'>User Not Found</h2>;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="flex flex-col md:flex-row justify-center">
        {/* LEFT NAVIGATION */}
        <aside className={`sm:items-center sm:justify-center md:block md:w-66 p-4 ${currentUser ? 'lg:h-[560px]' : 'lg:h-[120px]'}`}>
          <div className="bg-white rounded-lg shadow p-4 h-full mt-8">
            <LeftNav />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="w-full md:w-[600px] lg:w-[700px] p-4">
          <ProfileSection
            id={userProfile.id}
            name={userProfile.name}
            username={userProfile.username}
            profilePic={userProfile.profilePic}
            bio={userProfile.bio}
            position={userProfile.position}
            postsCount={userProfile.postCount}
            followerCount={userProfile.followerCount}
            followingCount={userProfile.followingCount}
          />

          <div className="space-y-4 mt-5">
            {list.items.length === 0 && list.loadingState === 'loading' ? (
              <div className="text-center py-8">
                <div className="text-2xl font-bold text-gray-600 mb-4">
                  This user has no posts yet.
                </div>
              </div>
            ) : (
              userPosts.map((post) => (
                <PostCard
                  key={post.id}
                  userId={post.postedBy}
                  title={post?.title}
                  postId={post.id}
                  profilePic={post.profilePic === "" ? "https://placehold.co/40x40" : post.profilePic}
                  author={post.UserName || username}
                  time={formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                  content={post.text}
                  imageUrl={post.img}
                  type={post.type}
                  hashtag={post.hashtag}
                  LikedUserByIds={post.likedByUserIds || []}
                  likes={post.TotalLikeNumber || 0}
                  comments={post.TotalRepliesNumber || 0}
                />
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

          {/* Floating Button for Creating a Post */}
          {currentUser && currentUser.id === userProfile.id && (
            <div className="fixed bottom-12 right-5 z-10">
              <Tooltip title="Create New Post" placement="left">
                <PlusOutlined
                  className="cursor-pointer bg-gray-300 rounded-full p-2 hover:bg-gray-400 transition duration-300 ease-in-out shadow-lg"
                  style={{ fontSize: "45px" }}
                  onClick={showModal}
                />
              </Tooltip>
            </div>
          )}

          <Modal
            title="Create Post"
            open={isModalOpen}
            onCancel={handleCancel}
            footer={[
              <Button key="cancel" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>,
              <Button key="post" type="primary" onClick={handlePost} loading={loading}>
                Post
              </Button>,
            ]}
          >
            {/* Topic */}
            <div className="mb-4">
              <Input
                status={errors.topic ? 'error' : ''}
                prefix={errors.topic && <ExclamationCircleOutlined style={{ color: 'red' }} />}
                placeholder="Topic"
                style={{ width: '100%' }}
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setErrors((prev) => ({ ...prev, topic: '' }));
                }}
              />
              {errors.topic && (
                <div className="text-red-500 text-sm mt-1 flex items-center">
                  <ExclamationCircleOutlined className="mr-1 mt-1" />
                  {errors.topic}
                </div>
              )}
            </div>

            {/* Type (Select) */}
            <div className="mb-4">
              <Select
                status={errors.type ? 'error' : ''}
                style={{ width: '100%' }}
                placeholder="Type"
                value={selectedType || undefined}
                onChange={(val) => {
                  setSelectedType(val);
                  setErrors((prev) => ({ ...prev, type: '' }));
                }}
              >
                <Option value="Knowledge">Knowledge</Option>
                <Option value="Recruitment">Recruitment</Option>
              </Select>
              {errors.type && (
                <div className="text-red-500 text-sm mt-1 flex items-center">
                  <ExclamationCircleOutlined className="mr-1 mt-1" />
                  {errors.type}
                </div>
              )}
            </div>

            {selectedType === 'Recruitment' && (
              <div className="mb-4">
                <Radio.Group
                  options={[
                    { label: 'Enterprise', value: 'enterprise' },
                    { label: 'Freelancer', value: 'freelancer' },
                  ]}
                  value={sourceTypeContent}
                  onChange={(e) => setSourceTypeContent(e.target.value)}
                />
              </div>
            )}

            {/* Content */}
            <div className="mb-4">
              <Input.TextArea
                status={errors.content ? 'error' : ''}
                prefix={errors.content && <ExclamationCircleOutlined style={{ color: 'red' }} />}
                rows={4}
                className="bg-gray-300"
                placeholder="Post content goes here..."
                maxLength={500}
                value={postContent}
                onChange={(e) => {
                  setPostContent(e.target.value);
                  setErrors((prev) => ({ ...prev, content: '' }));
                }}
              />
              {errors.content && (
                <div className="text-red-500 text-sm mt-1 flex items-center">
                  <ExclamationCircleOutlined className="mr-1 mt-1" />
                  {errors.content}
                </div>
              )}
            </div>

            {/* Hashtag */}
            <div className="mb-4">
              <Input.TextArea
                status={errors.hashtag ? 'error' : ''}
                prefix={errors.hashtag && <ExclamationCircleOutlined style={{ color: 'red' }} />}
                rows={2}
                className="bg-gray-300"
                placeholder="Hashtag"
                maxLength={200}
                value={hashtagContent}
                onChange={(e) => {
                  setHashtagContent(e.target.value);
                  setErrors((prev) => ({ ...prev, hashtag: '' }));
                }}
              />
              {errors.hashtag && (
                <div className="text-red-500 text-sm mt-1 flex items-center">
                  <ExclamationCircleOutlined className="mr-1 mt-1" />
                  {errors.hashtag}
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div className="my-2 flex justify-end cursor-pointer">
              <FileImageOutlined
                onClick={() => fileRef.current.click()}
                style={{ fontSize: "20px" }}
              />
              <input type="file" hidden ref={fileRef} onChange={handleImageChange} />
            </div>

            {imgUrl && (
              <div className="flex justify-center my-3">
                <img
                  src={imgUrl}
                  alt="Selected Preview"
                  className="max-w-full h-auto rounded-lg shadow-lg"
                />
              </div>
            )}
          </Modal>
        </main>

        <aside className="hidden lg:block w-[90px] p-4">
          {/* Right-side spacing or content */}
        </aside>
      </div>
    </div>
  );
};

export default UserProfilePage;
