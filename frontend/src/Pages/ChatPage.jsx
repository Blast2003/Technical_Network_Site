import React, { useEffect, useState } from 'react';
import Sidebar from '../Components/chat/Sidebar';
import ChatArea from '../Components/chat/ChatArea';
import { toast } from "react-toastify";
import { useRecoilState } from 'recoil';
import conversationAtom from '../Atoms/conversationAtom';
import loader from "../assets/loader.svg";
import { useSocket } from "../Context/SocketContext";
import messageSound from "../assets/message.mp3";

const ChatPage = () => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [mockConversation, setMockConversation] = useRecoilState(conversationAtom);
  const [lastMessage, setLastMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Handler for new message events
    const handleLastMessage = async (newMessage) => {
      // Reset lastMessage, then update
      setLastMessage(null);
      // console.log("Last Message: ", newMessage);
      setLastMessage(newMessage);

      // Play sound if the window is not focused
      if (!document.hasFocus()) {
        const sound = new Audio(messageSound);
        sound.play();
      }

      // Check if the new message's conversationId exists in the current conversations
      const conversationExists = conversations.some(
        (conv) => conv.conversationId === newMessage.conversationId
      );

      // If it does not exist, call the API again to fetch all conversations
      if (!conversationExists) {
        try {
          const res = await fetch("/api/message/");
          const data = await res.json();
          // Compare the new data length with previous conversations length
          if (data.length > conversations.length) {
            // Find the conversation whose conversationId matches the new message
            const newConversation = data.find(
              (conv) => conv.conversationId === newMessage.conversationId
            );
            if (newConversation) {
              // Prepend the new conversation to the current conversations state
              setConversations((prev) => [newConversation, ...prev]);
            }
          }
        } catch (error) {
          console.error("Error fetching updated conversations", error);
        }
      }
    };

    socket.on("newMessage", handleLastMessage);
    return () => socket.off("newMessage", handleLastMessage);
  }, [socket, conversations]);

  useEffect(() => {
    setConversations([]);
    const fetchConversations = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/message/");
        const data = await res.json();
        // console.log("Conversations: ", data);
        if (data.message) {
          console.log(data.message);
          return;
        }
        setConversations(data);
      } catch (error) {
        toast.error("Error in fetching conversations", error);
        setConversations([]);
        return;
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (Object.keys(mockConversation).length !== 0) {
      setConversations((prevConversations) => {
        // Check if the mockConversation already exists in the conversations array
        const existingConversationIndex = prevConversations.findIndex(
          (convo) =>
            (convo.otherUserId === mockConversation.otherUserId &&
             convo.conversationId === mockConversation.conversationId) ||
            (convo.otherUserId === mockConversation.otherUserId && convo.conversationId === "")
        );

        if (existingConversationIndex !== -1) {
          // Replace the existing conversation with the updated one
          const updatedConversations = [...prevConversations];
          updatedConversations[existingConversationIndex] = mockConversation;
          return updatedConversations;
        } else {
          // Prepend the new conversation to the list
          return [mockConversation, ...prevConversations];
        }
      });

      // Reset the mockConversation state
      setMockConversation({});
    }
  }, [mockConversation, setMockConversation]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden h-[674px]">
      <Sidebar
        conversations={conversations}
        setSelectedChat={setSelectedChat}
        lastMessage={lastMessage}
        loading={loading}
      />
      <ChatArea selectedChat={selectedChat} />
    </div>
  );
};

export default ChatPage;
