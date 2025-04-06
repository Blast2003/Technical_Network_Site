import React, { useEffect, useRef, useState } from 'react';
import seenIcon from "../../../public/seen.png";
import { CloseCircleOutlined, CommentOutlined, FileImageOutlined, SendOutlined } from '@ant-design/icons';
import { formatDistanceToNow } from "date-fns";
import messageSound from "../../assets/message.mp3";
import { toast } from 'react-toastify';
import { useSocket } from "../../Context/SocketContext";
import { useRecoilValue, useSetRecoilState } from 'recoil';
import userAtom from '../../Atoms/userAtom';
import usePreviewImg from '../../Hooks/usePreviewImg';
import conversationAtom from '../../Atoms/conversationAtom';

const customLocale = {
  formatDistance: (token, count) => {
    const defaultLocale = {
      lessThanXSeconds: `${count} seconds ago`,
      xSeconds: `${count} seconds ago`,
      halfAMinute: "30 seconds ago",
      lessThanXMinutes: `${count} minutes ago`,
      xMinutes: `${count} minutes ago`,
      aboutXHours: `${count} hours ago`,
      xHours: `${count} hours ago`,
      xDays: `${count} days ago`,
      aboutXMonths: `${count} months ago`,
      xMonths: `${count} months ago`,
      aboutXYears: `${count} years ago`,
      xYears: `${count} years ago`,
      overXYears: `${count} years ago`,
      almostXYears: `${count} years ago`,
    };

    return defaultLocale[token].replace("about ", "");
  },
};

const ChatArea = ({ selectedChat }) => {
  const setMockConversation = useSetRecoilState(conversationAtom);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const { socket } = useSocket();
  const currentUser = useRecoilValue(userAtom);
  const messageEndRef = useRef(null)

  // console.log("selectedChat", selectedChat);

  // handle image
  const fileRef = useRef(null);
  const { handleImageChange, imgUrl, setImgUrl } = usePreviewImg();

  const handleCancelImage = () => {
    setImgUrl(null); // Clear the preview image
    fileRef.current.value = ""; // Reset the file input value
  };

  useEffect(() => {
    if (!socket) return;
  
    const handleNewMessage = (newMessage) => {
      // Only add the new message if it belongs to the selected conversation
      if (newMessage.conversationId !== selectedChat?.conversationId) return;
      
       // current user => don't add new message
       if (newMessage.sender === currentUser.id) return;

      // console.log("New Message: ", newMessage);
      setMessages((prevMessages) => [...prevMessages, newMessage]);
  
      if (!document.hasFocus()) {
        const sound = new Audio(messageSound);
        sound.play();
      }
  
    };
  
    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [ socket, selectedChat]);

  useEffect(() => {
    setMessages([]);
    if(selectedChat?.conversationId !== ""){
      const fetchMessages = async () => {
        if (!selectedChat?.otherUserId) return;
        setMessages([]);
        try {
          const res = await fetch(`/api/message/${selectedChat.otherUserId}`);
          const data = await res.json();
          // console.log(data)
          if (data.error) {
            toast.error(data.error);
          } else {
            setMessages(data);
          }
        } catch (error) {
          toast.error("Error fetching messages", error);
        }
      };
      fetchMessages();
    }
    
  }, [selectedChat, selectedChat?.otherUserId]);

  useEffect(() =>{
    messageEndRef.current?.scrollIntoView( {behavior: "smooth"} )
}, [messages])

  useEffect(() => {
    if (!socket || !messages.length) return;

    const lastMessageIsFromOtherUser = messages[messages.length - 1].sender !== currentUser.id;
    if (lastMessageIsFromOtherUser) {
      socket.emit("markMessagesAsSeen", {
        conversationId: selectedChat?.conversationId,
        userId: selectedChat?.otherUserId,
      });
    }

    const handleMessagesSeen = ({ conversationId }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.sender === currentUser.id && msg.conversationId === conversationId
            ? { ...msg, seen: true }
            : msg
        )
      );
    };

    socket.on("messagesSeen", handleMessagesSeen);

  }, [messages, socket, selectedChat?.conversationId, selectedChat?.otherUserId, currentUser.id]);

  const handleSendMessage = async () => {
    const message = newMessage.trim() || null;

    try {
      const res = await fetch('/api/message/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: selectedChat?.otherUserId, message: message, img: imgUrl ? imgUrl : "" }),
      });
      const data = await res.json();
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setMessages((prev) => [...prev, data]);
      setNewMessage('');
      setImgUrl(null); // reset img

      // Update Recoil state with the new conversation data
      if (selectedChat?.conversationId === "") {
        const newConversation = {
          lastMessage: data.text,
          img: data.img,
          conversationId: data.conversationId,
          createdTime: data.createdAt,
          otherUsername: selectedChat?.otherUsername,
          otherUserId: selectedChat?.otherUserId,
          otherProfilePic: selectedChat?.otherProfilePic,
        };
        setMockConversation(newConversation);
      }
    } catch (error) {
      toast.error("Error sending message", error);
      return;
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col h-full bg-blue-200">
      {selectedChat ? (
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {messages?.map((message, index) => (
            <div 
              ref={messages.length - 1 === messages.indexOf(message) ? messageEndRef : null }
              key={index} className={`flex ${message.sender === selectedChat?.otherUserId ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`p-3 rounded-md shadow-md max-w-xs ${message.sender === selectedChat?.otherUserId ? 'bg-white ' : 'bg-gray-500 text-white'}`}>
                <p>{message.text}</p>
                {message.img !== "" && <img className='mt-3' src={message.img}/>}
                <div className="flex justify-end items-center space-x-2 mt-1">
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(message?.createdAt), { addSuffix: true, locale: customLocale }) && console.log(message?.createdAt)}
                  </p>
                  {message.seen && message.sender === currentUser.id && (
                    <img src={seenIcon} className="w-5 h-5" alt="Seen Icon" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CommentOutlined className="text-6xl text-gray-400 mb-4" />
            <p className="text-xl text-gray-600">Select a conversation to start chatting</p>
          </div>
        </div>
      )}
        <div className="chat-input-area"> 
              {imgUrl && (
              <div className="relative">
                <img src={imgUrl} alt="Selected" className="max-h-40 rounded-md" />
                <button
                  onClick={handleCancelImage}
                  className="absolute top-0 bg-gray-800 text-white rounded-full p-1 hover:bg-red-500 transition"
                  aria-label="Cancel Image"
                >
                  <CloseCircleOutlined className="text-xl" />
                </button>
              </div>
            )}
            {selectedChat && (
                <div className="bg-blue-300 p-4 border-t flex items-center space-x-4">
                  <FileImageOutlined onClick={() => fileRef.current.click()} className="text-2xl cursor-pointer" />
                  <input
                    type='file'
                    hidden
                    ref={fileRef}
                    onChange={handleImageChange}
                  />
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 p-2 border rounded-md"
                  />
                  <button onClick={handleSendMessage} disabled={newMessage === ""} className="text-2xl">
                    <SendOutlined />
                  </button>
                </div>
            )}
        </div>
    </div>
    </>
  );
};

export default ChatArea;
