import React, { useRef, useState } from "react";
import { useRecoilValue } from "recoil";
import userAtom from "../../Atoms/userAtom";
import usePreviewImg from "../../Hooks/usePreviewImg";
import { toast } from "react-toastify";
import { FileImageOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Select, Radio } from "antd";

const { Option } = Select;

const PostInput = () => {

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [hashtagContent, setHashtagContent] = useState('');
  const [postContent, setPostContent] = useState('');
  const currentUser = useRecoilValue(userAtom);
  const [loading, setLoading] = useState(false);

  const [sourceTypeContent, setSourceTypeContent] = useState('');

  // handle image
  const fileRef = useRef(null);
  const { handleImageChange, imgUrl, setImgUrl } = usePreviewImg();
  

  // Error states
  const [errors, setErrors] = useState({});

  const showModal = () => {
    setIsModalOpen(true);
  };


  const handleCancel = () => {
    setIsModalOpen(false);
    setSelectedTopic('');
    setSelectedType('');
    setPostContent('');
    setImgUrl('');
    setErrors({});
  };

  const handlePost = async () => {
      setLoading(true);
      setErrors({});

      try {
        const response = await fetch('/api/post/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postedBy: currentUser.id, 
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

        if (data.error) {
          toast.error(data.error || "Error creating post");
          return;
        } 
        if (!data.error && !data.topicError && !data.contentError && !data.hashtagError) {
          toast.success("Post created successfully!");
          setIsModalOpen(false);
          setSelectedTopic('');
          setSelectedType('');
          setPostContent('');
          setHashtagContent('');
          setImgUrl('');
        }
      } catch (error) {
        console.error("Error posting:", error);
        toast.error("Error creating post: " + error.message);
        return;
      } finally{
        setLoading(false)
      }
    };


  return (
    <div className="bg-white 0 p-4 rounded-lg shadow mb-4">
      <div className="flex items-center space-x-4">
        <img
          src={currentUser?.profilePic || "https://placehold.co/32x32"}
          alt="User"
          className="rounded-full w-10 h-10"
        />
        <input
          onClick={showModal}
          type="text"
          placeholder="What's on your mind?"
          className="w-full p-2 border rounded-lg text-sm"
        />

        {/* Modal */}
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

      </div>     
    </div>
  );
};

export default PostInput;
