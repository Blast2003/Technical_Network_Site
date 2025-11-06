// ChatArea.jsx (updated)
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

const ChatArea = ({ selectedChat, setConversations }) => {
  const setMockConversation = useSetRecoilState(conversationAtom);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const { socket } = useSocket();
  const currentUser = useRecoilValue(userAtom);
  const messageEndRef = useRef(null);

  // console.log("messages: ", messages)

  // refs to avoid unnecessary refetches
  const prevConversationIdRef = useRef(null);
  const prevOtherUserIdRef = useRef(null);

  // handle image
  const fileRef = useRef(null);
  const { handleImageChange, imgUrl, setImgUrl } = usePreviewImg();

  const handleCancelImage = () => {
    setImgUrl(null); // Clear the preview image
    if (fileRef.current) fileRef.current.value = ""; // Reset the file input value
  };

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      // Only add the new message if it belongs to the selected conversation
      if (newMessage.conversationId !== selectedChat?.conversationId) return;

      // current user => don't add new message
      if (newMessage.sender === currentUser.id) return;

      setMessages((prevMessages) => [...prevMessages, newMessage]);

      if (!document.hasFocus()) {
        const sound = new Audio(messageSound);
        sound.play();
      }
    };

    socket.on("newMessage", handleNewMessage);
    return () => socket.off("newMessage", handleNewMessage);
  }, [socket, selectedChat, currentUser.id]);

  // Fetch messages when the effective conversation changes
  useEffect(() => {
    // If there's no selected chat, do nothing (or optionally clear messages)
    if (!selectedChat) return;

    const currentConversationId = selectedChat?.conversationId ?? "";
    const currentOtherUserId = selectedChat?.otherUserId ?? "";

    // If conversationId and otherUserId are unchanged, skip fetching to avoid flicker
    if (
      prevConversationIdRef.current === currentConversationId &&
      prevOtherUserIdRef.current === currentOtherUserId
    ) {
      return;
    }

    // Update refs to reflect this selection
    prevConversationIdRef.current = currentConversationId;
    prevOtherUserIdRef.current = currentOtherUserId;

    // Only fetch when we have a real conversationId (existing conversation)
    if (currentConversationId !== "") {
      const fetchMessages = async () => {
        try {
          // DON'T clear messages here — keep current messages until the fresh payload arrives
          const res = await fetch(`/api/message/${currentOtherUserId}`);
          const data = await res.json();
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
    } else {
      // mock conversation (no conversationId yet) — keep messages as-is (likely empty)
      // If you prefer to clear messages for a brand new mock, uncomment next line:
      // setMessages([]);
    }
  }, [selectedChat?.conversationId, selectedChat?.otherUserId, selectedChat]);

  // scroll to bottom when messages update
  useEffect(() =>{
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socket || !messages.length) return;

    const hasUnseenMessagesFromOther = messages.some(
      (msg) => !msg.seen && msg.sender !== currentUser.id
    );

    if (hasUnseenMessagesFromOther) {
      socket.emit("markMessagesAsSeen", {
        conversationId: selectedChat?.conversationId,
        userId: selectedChat?.otherUserId,
      });

      // Optimistically update local messages and conversations
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          !msg.seen && msg.sender !== currentUser.id
            ? { ...msg, seen: true }
            : msg
        )
      );

      setConversations((prevConversations) =>
        prevConversations.map((convo) =>
          convo.conversationId === selectedChat?.conversationId
            ? { ...convo, unseenCount: 0 }
            : convo
        )
      );
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
    return () => socket.off("messagesSeen", handleMessagesSeen);
  }, [messages, socket, selectedChat?.conversationId, selectedChat?.otherUserId, currentUser.id, setConversations]);

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

      // Optimistically append the sent message locally
      setMessages((prev) => [...prev, data]);
      setNewMessage('');
      setImgUrl(null); // reset img

      // Update Recoil state with the new conversation data (if this was a mock)
      if (selectedChat?.conversationId === "") {
        const newConversation = {
          lastMessage: data.text,
          img: data.img,
          conversationId: data.conversationId,
          createdTime: data.createdAt,
          otherUsername: selectedChat?.otherUsername,
          otherUserId: selectedChat?.otherUserId,
          otherProfilePic: selectedChat?.otherProfilePic,
          unseenCount: 0, // Add unseenCount for new real conversation
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
                ref={messages.length - 1 === messages.indexOf(message) ? messageEndRef : null}
                key={index}
                className={`flex ${message.sender === selectedChat?.otherUserId ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`p-3 rounded-md shadow-md max-w-xs ${message.sender === selectedChat?.otherUserId ? 'bg-white ' : 'bg-gray-500 text-white'}`}>
                  <p>{message.text}</p>
                  {message.img !== "" && <img className='mt-3' src={message.img} alt="message attachment" />}
                  <div className="flex justify-end items-center space-x-2 mt-1">
                    <p className={`text-xs ${message.sender === selectedChat?.otherUserId ? 'text-gray-500' : 'text-gray-300'}`}>
                      {formatDistanceToNow(new Date(message?.createdAt), { addSuffix: true, locale: customLocale })}
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
              <button onClick={handleSendMessage} disabled={newMessage === "" && imgUrl === null} className="text-2xl">
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