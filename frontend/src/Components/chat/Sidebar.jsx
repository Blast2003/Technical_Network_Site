import React, { useCallback, useState, useRef, useEffect } from "react";
import { FaCircle } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";
import { useSocket } from "../../context/SocketContext";
import { FileImageOutlined, SearchOutlined } from "@ant-design/icons";
import { debounce } from "lodash";
import { useSetRecoilState } from "recoil";
import conversationAtom from "../../Atoms/conversationAtom";
import { toast } from "react-toastify";

// Custom locale to remove "about"
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

const Sidebar = ({ conversations, setSelectedChat, lastMessage, loading }) => {
  const { onlineUsers } = useSocket();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const setMockConversation = useSetRecoilState(conversationAtom);
  const searchContainerRef = useRef(null);

  // Debounced function for initial search (page 1)
  const debouncedFetchSearchResults = useCallback(
    debounce(async (term) => {
      try {
        const response = await fetch(`/api/user/search/${term}?page=1`);
        if (!response.ok) {
          const errorData = await response.json();
          setSearchError(errorData.error || "Failed to fetch users");
          setSearchResults([]);
          setCurrentPage(1);
          setTotalPages(0);
          return;
        }
        const data = await response.json();
        if (data.searchResults.length === 0) {
          setSearchError("No users found");
          setSearchResults([]);
          setCurrentPage(1);
          setTotalPages(0);
        } else {
          setSearchError("");
          setSearchResults(data.searchResults);
          setCurrentPage(data.currentPage);
          setTotalPages(data.totalPages);
        }
      } catch (error) {
        setSearchError("Error fetching users", error);
        setSearchResults([]);
        setCurrentPage(1);
        setTotalPages(0);
      }
    }, 300),
    []
  );

  const fetchMoreResults = async () => {
    try {
      const nextPage = currentPage + 1;
      const response = await fetch(
        `/api/user/search/${searchTerm}?page=${nextPage}`
      );
      if (!response.ok) {
        const errorData = await response.json();
        setSearchError(errorData.error || "Failed to fetch users");
        return;
      }
      const data = await response.json();
      setSearchError("");
      setSearchResults((prev) => [...prev, ...data.searchResults]);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (error) {
      setSearchError("Error fetching more users", error);
    }
  };

  const handleSearchClick = (user) => {
    const newMockConversation = {
      lastMessage: "",
      img: "",
      conversationId: "",
      createdTime: new Date().toISOString(),
      otherUsername: user.name,
      otherUserId: user.id,
      otherProfilePic: user.profilePic || "https://placehold.co/40x40",
    };

    // Check if the conversation already exists
    const conversationExists = conversations.some((conversation) => {
      return (
        conversation?.otherUsername === newMockConversation.otherUsername ||
        conversation?.otherUserId === newMockConversation.otherUserId
      );
    });

    if (conversationExists) {
      toast.error("The Conversation has already existed");
      setSearchResults([]);
      setSearchTerm("");
      return;
    }

    setMockConversation(newMockConversation);
    setSelectedChat(newMockConversation);
    setSearchResults([]);
    setSearchTerm("");
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term.trim() === "") {
      debouncedFetchSearchResults.cancel();
      setSearchResults([]);
      setSearchError("");
      setCurrentPage(1);
      setTotalPages(0);
    } else {
      debouncedFetchSearchResults(term);
    }
  };

  // Click outside to clear search results
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setSearchResults([]);
        setSearchError("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside className="md:block md:w-1/4 lg:w-65 p-4 h-full border-r border-gray-700 flex flex-col bg-gray-200 overflow-y-auto">
      {/* Search Container */}
      <div ref={searchContainerRef}>
        <div className="relative mb-3">
          <input
            id="searchField"
            type="text"
            placeholder="Search user for new chat"
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10 pr-4 py-2 w-[350px] rounded-full bg-gray-200 border border-gray-400 focus:outline-none focus:border-gray-500"
          />
          <label htmlFor="searchField">
            <SearchOutlined className="text-xl absolute left-3 mt-1 top-2 text-gray-500 cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2" />
          </label>
        </div>

        {/* Search Results */}
        {searchError ? (
          <>
            <p className="text-sm text-red-500 mb-3 ml-2">{searchError}</p>
            <hr className="h-1 bg-gray-700 my-4" />
          </>
        ) : (
          <>
            {searchResults.length > 0 && (
              <>
                <div className="search-results max-h-40 overflow-y-auto">
                  {searchResults.slice(0, 3).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center p-2 border-b bg-gray-100 hover:bg-gray-300 cursor-pointer"
                      onClick={() => handleSearchClick(user)}
                    >
                      <div className="relative flex items-center justify-center">
                        <img
                          src={user.profilePic || "https://placehold.co/40x40"}
                          alt={`${user.name}'s profile`}
                          className="w-10 h-10 rounded-full mr-3"
                        />
                        <FaCircle
                          className={`absolute bottom-0 right-3 text-sm ${
                            onlineUsers.includes(user.id.toString())
                              ? "text-green-500"
                              : "text-gray-500"
                          }`}
                        />
                      </div>
                      <span className="text-gray-800">{user.name}</span>
                    </div>
                  ))}

                  {/* Display additional results (if any) beyond the first 3 */}
                  {searchResults.length > 3 &&
                    searchResults.slice(3).map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center p-2 border-b bg-gray-100 hover:bg-gray-300 cursor-pointer"
                        onClick={() => handleSearchClick(user)}
                      >
                        <div className="relative flex items-center justify-center">
                          <img
                            src={user.profilePic || "https://placehold.co/40x40"}
                            alt={`${user.name}'s profile`}
                            className="w-10 h-10 rounded-full mr-3"
                          />
                          <FaCircle
                            className={`absolute bottom-0 right-3 text-sm ${
                              onlineUsers.includes(user.id.toString())
                                ? "text-green-500"
                                : "text-gray-500"
                            }`}
                          />
                        </div>
                        <span>{user.name}</span>
                      </div>
                    ))}
                </div>
                {/* "Show More" button if more pages are available */}
                {currentPage < totalPages && (
                  <div className="flex justify-center my-4">
                    <button
                      onClick={fetchMoreResults}
                      className="px-4 py-2 bg-blue-500 text-white rounded-full shadow-lg transform transition hover:scale-105 hover:bg-blue-600 focus:outline-none"
                    >
                      Show More
                    </button>
                  </div>
                )}
                <hr className="h-1 bg-gray-700 my-4" />
              </>
            )}
          </>
        )}
      </div>

      <div className="space-y-4">
        {!loading && conversations.length === 0 ? (
          <div className="bg-gradient-to-r from-gray-300 to-gray-100 rounded-lg shadow-lg p-8 transform hover:scale-105 transition duration-300 ease-in-out">
            <p className="text-black text-center text-2xl font-bold mb-2 whitespace-nowrap">
              No previous conversations.
            </p>
            <p className="text-black text-center text-lg">
              Use search to create new ones.
            </p>
          </div>
        ) : (
          conversations.map((conversation, index) => (
            <div
              key={index}
              className="flex items-center p-2 hover:bg-gray-300 cursor-pointer rounded-md"
              onClick={() => setSelectedChat(conversation)}
            >
              {/* User Avatar and Status */}
              <div className="flex items-center space-x-4 flex-grow">
                <div className="relative inline-block">
                  <img
                    src={conversation?.otherProfilePic}
                    alt={`${conversation?.otherUsername} profile`}
                    className="rounded-full w-10 h-10"
                  />
                  <FaCircle
                    className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-white p-0.5 -mr-1 -mb-1 ${
                      onlineUsers.includes(
                        conversation?.otherUserId.toString()
                      )
                        ? "text-green-500"
                        : "text-gray-700"
                    }`}
                  />
                </div>
                <div className="flex flex-col flex-grow overflow-hidden">
                  <p className="font-semibold truncate text-gray-800">
                    {conversation?.otherUsername}
                  </p>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {conversation.conversationId === "" ? (
                      "No message yet"
                    ) : lastMessage &&
                      lastMessage?.conversationId ===
                        conversation.conversationId ? (
                      lastMessage?.text ? (
                        lastMessage.text
                      ) : (
                        <FileImageOutlined />
                      )
                    ) : conversation?.lastMessage ? (
                      conversation.lastMessage
                    ) : (
                      <FileImageOutlined />
                    )}
                    {lastMessage &&
                    lastMessage?.conversationId ===
                      conversation.conversationId ? (
                      lastMessage?.img && (
                        <FileImageOutlined className="ml-1" />
                      )
                    ) : conversation?.lastMessage &&
                      conversation?.img !== "" ? (
                      <FileImageOutlined className="ml-1" />
                    ) : null}
                  </p>
                </div>
              </div>

              {/* Timestamp */}
              <p className="text-sm text-gray-500 whitespace-nowrap shrink-0 ml-2">
                {formatDistanceToNow(new Date(conversation?.createdTime), {
                  addSuffix: true,
                  locale: customLocale,
                })}
              </p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
