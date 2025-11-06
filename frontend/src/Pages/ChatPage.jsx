// ChatPage.jsx
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

  // console.log("conversations: ", conversations)
  // Socket: when newMessage arrives update sidebar (source of truth) and also update selectedChat if needed
  useEffect(() => {
    if (!socket) return;

    const handleLastMessage = async (newMessage) => {
      // update last message and play sound when window not focused
      setLastMessage(newMessage);
      if (!document.hasFocus()) {
        const sound = new Audio(messageSound);
        sound.play();
      }

      // Single fetch -> set the conversations from server (server is source of truth)
      try {
        const res = await fetch("/api/message/");
        const data = await res.json();
        // Replace the conversations state with the server's list (avoid any local prepend logic)
        setConversations(data);

        // If user currently has a selectedChat that matches the updated conversation,
        // update selectedChat to the fresh object so ChatArea uses the real conversationId.
        if (selectedChat) {
          const match = data.find((c) =>
            // if selectedChat is a mock (conversationId === ""), match by otherUserId
            (selectedChat.conversationId === "" && c.otherUserId === selectedChat.otherUserId) ||
            // else match by conversationId
            (c.conversationId === selectedChat.conversationId)
          );
          if (match) {
            setSelectedChat(match);
          }
        }
      } catch (error) {
        console.error("Error fetching updated conversations", error);
      }
    };

    socket.on("newMessage", handleLastMessage);
    return () => socket.off("newMessage", handleLastMessage);
  }, [socket, selectedChat]); // include selectedChat so we can update it when conversations change

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

  // Handle mockConversation updates (from Search -> create mock -> send first message -> backend creates real conversation)
  useEffect(() => {
    if (Object.keys(mockConversation).length !== 0) {
      // Update conversations list (replace existing mock or prepend)
      setConversations((prevConversations) => {
        // Check if the mockConversation already exists in the conversations array
        const existingConversationIndex = prevConversations.findIndex(
          (convo) =>
            (convo.otherUserId === mockConversation.otherUserId &&
             convo.conversationId === mockConversation.conversationId) ||
            (convo.otherUserId === mockConversation.otherUserId && convo.conversationId === "")
        );

        if (existingConversationIndex !== -1) {
          const updatedConversations = [...prevConversations];
          updatedConversations[existingConversationIndex] = mockConversation;
          return updatedConversations;
        } else {
          // Prepend the new conversation to the list
          return [mockConversation, ...prevConversations];
        }
      });

      // If the currently selected chat refers to this same otherUser (e.g. the user is chatting in the mock),
      // update selectedChat to the new object (mockConversation may already contain the real conversationId after the send).
      if (selectedChat && selectedChat.otherUserId === mockConversation.otherUserId) {
        setSelectedChat(mockConversation);
      }

      // Reset the mockConversation state
      setMockConversation({});
    }
  }, [mockConversation, setMockConversation, selectedChat, setSelectedChat]);

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
      <ChatArea selectedChat={selectedChat} setConversations={setConversations} />
    </div>
  );
};

export default ChatPage;