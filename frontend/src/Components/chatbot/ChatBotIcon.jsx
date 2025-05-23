import React, { useState, useEffect, useRef } from "react";
import { FaRobot } from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import { visit } from "unist-util-visit";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";


// Utility function for delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Custom rehype plugin to transform bolded text into clickable links
// Custom rehype plugin to transform bolded text and headings into clickable links
const rehypeBoldToLink = () => {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "strong" || /^h[1-6]$/.test(node.tagName)) {

        // 1) pull out ALL of the text under this node:
        const raw = toString(node);

        // 2) clean it (strip numbers, slashes, &, punctuation, collapse spaces)
        const cleaned = raw
          .replace(/^\d+\.\s*/, "")    // remove leading “1. ”
          .replace(/&/g, " ")          // turn “&” into space
          .replace(/[^A-Za-z0-9 ]+/g, "") // drop any other symbol
          .replace(/\s+/g, " ")         // collapse multiple spaces
          .trim();

        // 3) if there’s nothing left, don’t turn this into a link
        if (!cleaned) return;

        const searchTerm = encodeURIComponent(cleaned);

        node.tagName = "a";
        node.properties = {
          ...node.properties,
          href: `/tech/search?q=${searchTerm}`,
          className:
            "text-blue-600 hover:text-blue-800 hover:underline transition",
          onClick: (e) => e.stopPropagation(),
        };
      }
    });
  };
};


const ChatBotIcon = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [botIsTyping, setBotIsTyping] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);

  const textareaRef = useRef(null);

  // For auto-scrolling the chat container
  const chatContainerRef = useRef(null);

  // Toggle Chatbot
  const toggleChatbot = async () => {
    setIsOpen(!isOpen);

    // Only start a new conversation once (the first time user opens chat)
    if (!hasStarted && !isOpen) {
      setHasStarted(true);
      await startConversation();
    }
  };

  // Call "/api/bot/start" to get thread_id
  const startConversation = async () => {
    try {
      // Show bot is typing while we do the intro
      setBotIsTyping(true);

      const res = await fetch("/api/bot/start");
      const data = await res.json();
      if (data?.thread_id) {
        setThreadId(data.thread_id);
      }

      // Simulate delayed intro messages
      await sleep(500); // wait 0.5s
      addBotMessage("Hi there, this is user support at Technical Network 😊.");
      await sleep(700); // wait ~0.7s
      addBotMessage("I can help you with any questions on website usage.");
      await sleep(700); // wait ~0.7s
      addBotMessage("How can I help you today?");
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setBotIsTyping(false);
    }
  };

  // Adds a new message from the bot
  const addBotMessage = (text) => {
    setMessages((prev) => [...prev, { role: "bot", content: text }]);
  };

  // Adds a new message from the user
  const addUserMessage = (text) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
  };

  // Handle user submitting a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    // Add user's message (right side)
    const userMessage = userInput.trim();
    addUserMessage(userMessage);
    setUserInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Call the bot API
    if (threadId) {
      try {
        setBotIsTyping(true);

        const res = await fetch("/api/bot/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            thread_id: threadId,
            message: userMessage,
          }),
        });

        const data = await res.json();
        if (data?.response) {
          // Process the bot's response: check if the last line is a question.
          const trimmedResponse = data.response.trim();
          const lines = trimmedResponse.split("\n").map(line => line.trim()).filter(line => line !== "");
          const lastLine = lines[lines.length - 1];
          
          if (lastLine && lastLine.endsWith("?")) {
            const answerPart = lines.slice(0, lines.length - 1).join("\n\n").trim();
            if (answerPart) {
              addBotMessage(answerPart);
            }
            addBotMessage(lastLine);
          } else {
            addBotMessage(data.response);
            // If there's no question in the response, automatically add a follow-up.
            if (!trimmedResponse.includes("?")) {
              addBotMessage("Do you want to ask anything else?");
            }
          }
        }

      } catch (error) {
        console.error("Error sending message:", error);
        addBotMessage("Oops, something went wrong. Please try again later.");
      } finally {
        setBotIsTyping(false);
      }
    } else {
      // If threadId is missing for some reason
      addBotMessage("I can't find our conversation. Please refresh or try again.");
    }
  };

  useEffect(() => {
    if (textareaRef.current && userInput === "") {
      textareaRef.current.style.height = "auto";
    }
  }, [userInput]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, botIsTyping]);

  return (
    <>
      {/* Floating Icon */}
      <div className="fixed bottom-10 right-6 z-50">
        <button
          onClick={toggleChatbot}
          className="
            bg-blue-600 
            hover:bg-blue-700 
            text-white 
            p-4 
            rounded-full 
            shadow-lg 
            transition 
            transform 
            hover:scale-110 
            hover:rotate-12 
            focus:outline-none
          "
        >
          <FaRobot size={24} />
        </button>
      </div>

      {/* Chatbot Panel */}
      {isOpen && (
        <div
          className="
            fixed 
            mb-5
            bottom-20 
            right-6 
            md:w-[400px]
            sm:w-[300px]
            md:h-[500px]
            sm:h-[400px]
            bg-white 
            border 
            border-gray-200 
            rounded-md 
            shadow-xl 
            z-50
            flex
            flex-col
            overflow-hidden
          "
        >
          {/* Header */}
          <div className="bg-blue-600 text-white p-3 rounded-t-md">
            <h2 className="text-lg font-semibold text-center">
              Technical Network&apos;s Support Assistant
            </h2>
          </div>

          {/* Chat Messages */}
          <div
            className="flex-1 p-3 overflow-y-auto space-y-2"
            ref={chatContainerRef}
          >
            {messages.map((msg, index) => {
              const isBot = msg.role === "bot";
              return (
                <div
                  key={index}
                  className={`flex ${isBot ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`
                      max-w-[70%] 
                      p-2 
                      rounded-md 
                      text-sm 
                      break-words
                      ${isBot ? "bg-gray-300 " : "bg-blue-600  mb-5 mt-5"}
                    `}
                  >
                    <div className={`prose prose-ms ${isBot ? "text-gray-800" : "text-white"}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeBoldToLink]}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    
                  </div>
                </div>
              );
            })}

            {/* Bot typing indicator */}
            {botIsTyping && (
              <div className="flex justify-start items-center">
                <div className="bg-gray-100 text-gray-800 p-2 rounded-md flex items-center">
                  <div className="dot-typing"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */} 
          <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Type your message..."
                className="
                  w-full
                  border
                  border-gray-300
                  rounded-md
                  p-2
                  focus:outline-none
                  focus:ring-2
                  focus:ring-blue-600
                  focus:border-transparent
                  resize-none
                  overflow-hidden
                "
                value={userInput}
                onChange={e => {
                  setUserInput(e.target.value);
                  // auto-expand:
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";

                }}
              />
              <button
                type="submit"
                className={
                  `
                  ${botIsTyping ? 'bg-gray-600 ' : 'bg-blue-600 '}
                  ${botIsTyping ? 'cursor-not-allowed' : 'cursor-pointer'}
                  ${botIsTyping ? 'hover:bg-gray-600 ' : 'hover:bg-blue-700 '}
                  text-white 
                  px-4 
                  py-2 
                  rounded-md 
                  transition 
                  focus:outline-none
                `
                }
                disabled={botIsTyping}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBotIcon;
