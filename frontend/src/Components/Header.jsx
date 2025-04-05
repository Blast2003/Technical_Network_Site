import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  HomeOutlined,
  LogoutOutlined,
  ArrowDownOutlined,
  SearchOutlined,
  ProfileOutlined,
  BellOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import { NavLink, useParams, useNavigate, useLocation } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { debounce } from "lodash";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";
import { useSocket } from "../Context/SocketContext";
import userAtom from "../Atoms/userAtom";
import useLogout from "../Hooks/useLogout";
import ReplyModal from "../Components/modal/ReplyModal";

// Helper function to format date labels
function getDateLabel(date) {
  if (isToday(date)) {
    return "Today";
  } else if (isYesterday(date)) {
    return "Yesterday";
  } else {
    return format(date, "dd/MM/yyyy", { locale: vi });
  }
}

// Group notifications by their date label
function groupNotificationsByDate(notifications) {
  return notifications.reduce((acc, item) => {
    const date = new Date(item.createdAt);
    const label = getDateLabel(date);
    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(item);
    return acc;
  }, {});
}

const Header = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNotOpen, setIsNotOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unseenCount, setUnseenCount] = useState(0);

  // New states for filter dropdown
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [sourceType, setSourceType] = useState("");

  // New states for Reply Modal
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const user = useRecoilValue(userAtom);
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = useLogout();
  const { socket } = useSocket();

  // Refs for detecting outside clicks
  const bellRef = useRef(null);
  const dropdownRef = useRef(null);
  const filterRef = useRef(null);

  // Fetch notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/post/recipient/notification");
        if (!res.ok) {
          throw new Error("Failed to fetch notifications");
        }
        const data = await res.json();
        // console.log("Notification", data);
        setNotifications(data);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
  }, []);

  // Group notifications by date label
  const groupedNotifications = groupNotificationsByDate(notifications);

  // Toggle user dropdown
  const handleDropdownToggle = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  // Close dropdowns on outside click
  const handleOutsideClick = (event) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target) &&
      !event.target.closest(".dropdown-container")
    ) {
      setIsDropdownOpen(false);
    }
    if (bellRef.current && !bellRef.current.contains(event.target)) {
      setIsNotOpen(false);
    }
    if (filterRef.current && !filterRef.current.contains(event.target)) {
      setIsFilterOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  // Create a stable debounced function instance for search
  const handleSearch = useMemo(
    () =>
      debounce((term, filterType, sourceType) => {
        if (term) {
          // Build URL with filter query params if available
          let url = `/tech/search?q=${term}`;
          if (filterType) {
            url += `&filterType=${filterType}`;
            if (filterType === "Recruitment" && sourceType) {
              url += `&sourceType=${sourceType}`;
            }
          }
          navigate(url);
        }
      }, 500),
    [navigate]
  );

  // Update search on searchTerm or filter changes
  useEffect(() => {
    if (searchTerm.trim() === "" && location.pathname.includes("/search")) {
      handleSearch.cancel();
      navigate("/tech");
      setIsFilterOpen((prev) => !prev);
    } else {
      handleSearch(searchTerm, filterType, sourceType);
    }
  }, [searchTerm, filterType, sourceType, location.pathname, navigate, handleSearch]);

  useEffect(() => {
    if (!location.pathname.includes("/search")) {
      setSearchTerm("");
    }
  }, [location.pathname]);

  const activeClass = "text-blue-600";
  const inactiveClass = "text-gray-900";

  // Toggle notifications dropdown
  const toggleNotifications = () => {
    setIsNotOpen((prev) => !prev);
  };

  // Mark notifications as seen when dropdown is open
  useEffect(() => {
    if (isNotOpen && socket && user?.id) {
      socket.emit("markNotificationsAsSeen", { userId: user.id });
    }
  }, [isNotOpen, socket, user]);

  // Listen for "NotificationsSeen" event from the server
  useEffect(() => {
    if (socket) {
      const handleNotificationsSeen = ({ userId }) => {
        if (user?.id === userId) {
          setNotifications((prevNotifs) =>
            prevNotifs.map((n) => (n.seen === false ? { ...n, seen: true } : n))
          );
        }
      };

      socket.on("NotificationsSeen", handleNotificationsSeen);

      return () => {
        socket.off("NotificationsSeen", handleNotificationsSeen);
      };
    }
  }, [socket, user]);

  // Real-time update notifications
  useEffect(() => {
    if (socket && user?.id) {
      const handleNewNotification = (notification) => {
        if (user.id === notification.recipient_id) {
          setNotifications((prev) => {
            if (prev.notification_id !== notification.notification_id) {
              return [notification, ...prev];
            }
            return [...prev];
          });
        }
      };

      socket.on("newNotification", handleNewNotification);

      return () => {
        socket.off("newNotification", handleNewNotification);
      };
    }
  }, [socket, user]);

  // Real-time update deleted notifications 
  useEffect(() => {
    if (socket && user?.id) {
      const handleNotificationDeleted = (deletedNotification) => {
        setNotifications((prev) =>
          prev.filter((n) => n.notification_id !== deletedNotification.notification_id)
        );
      };

      socket.on("notificationDeleted", handleNotificationDeleted);

      return () => {
        socket.off("notificationDeleted", handleNotificationDeleted);
      };
    }
  }, [socket, user]);

  // Update unseenCount whenever notifications change
  useEffect(() => {
    const count = notifications.filter((n) => n.seen === false).length;
    setUnseenCount(count);
  }, [notifications]);

  // Helper function to determine ReplyModal props based on notification action
  const getReplyModalProps = (notification) => {
    if (!notification) return {};
    if (notification.action === "The person you're following has made a new post") {
      return {
        postId: notification.post_id,
        username: notification.Sender.username,
      };
    } else if (
      notification.action === "A user liked your post" ||
      notification.action === "A user replied on your post"
    ) {
      return {
        postId: notification.post_id,
        username: notification.Recipient.username,
      };
    }
    return {};
  };

  // Updated notification click handler to open ReplyModal
  const handleNotificationClick = (n) => {
    setSelectedNotification(n);
    setIsReplyModalOpen(true);
    toggleNotifications();
  };

  return (
    <header className="bg-gray-400 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Left Side: Search */}
          <div className="flex items-center">
            <div className="relative">
              <input
                type="text"
                placeholder="Search posts..."
                className="pl-10 pr-10 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-gray-500"
                value={searchTerm}
                onChange={(e) => {
                  e.stopPropagation();
                  setSearchTerm(e.target.value);
                }}
                id="search"
              />
              <label htmlFor="search">
                <SearchOutlined className="text-xl absolute left-3 mt-1 top-2 text-gray-500 cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2" />
              </label>
              {/* Filter icon positioned on the opposite side */}
              <FilterOutlined
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterOpen((prev) => !prev);
                }}
                className="text-xl absolute right-3 mt-1 top-2 text-gray-500 cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2"
              />
              {/* Filter dropdown */}
              {isFilterOpen && (
                <div
                  ref={filterRef}
                  className="absolute right-0 mt-3 mr-5 w-64 bg-white border border-gray-300 rounded shadow-md z-20 p-4"
                >
                  <div className="mb-2">
                    <p className="font-medium text-gray-700 mb-1">Filter by Type</p>
                    <div>
                      <label className="inline-flex items-center mr-4">
                        <input
                          type="radio"
                          name="filterType"
                          value="Knowledge"
                          checked={filterType === "Knowledge"}
                          onChange={() => {
                            setFilterType("Knowledge");
                            setSourceType("");
                          }}
                          className="form-radio"
                        />
                        <span className="ml-2">Knowledge</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="filterType"
                          value="Recruitment"
                          checked={filterType === "Recruitment"}
                          onChange={() => setFilterType("Recruitment")}
                          className="form-radio"
                        />
                        <span className="ml-2">Recruitment</span>
                      </label>
                    </div>
                  </div>
                  {filterType === "Recruitment" && (
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Source Type</p>
                      <div>
                        <label className="inline-flex items-center mr-4">
                          <input
                            type="radio"
                            name="sourceType"
                            value="enterprise"
                            checked={sourceType === "enterprise"}
                            onChange={() => setSourceType("enterprise")}
                            className="form-radio"
                          />
                          <span className="ml-2">Enterprise</span>
                        </label>
                        <label className="inline-flex items-center">
                          <input
                            type="radio"
                            name="sourceType"
                            value="freelancer"
                            checked={sourceType === "freelancer"}
                            onChange={() => setSourceType("freelancer")}
                            className="form-radio"
                          />
                          <span className="ml-2">Freelancer</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center: Home and Profile Icons */}
          <div className="flex items-center space-x-6">
            <NavLink
              onClick={(e) => e.stopPropagation()}
              to="/tech"
              end
              className={({ isActive }) =>
                `flex items-center space-x-2 text-3xl cursor-pointer transition-all transform hover:bg-gray-500 hover:scale-105 rounded-full p-2 ${
                  isActive ? activeClass : inactiveClass
                }`
              }
            >
              <HomeOutlined />
              <span className="hidden md:inline text-lg font-medium">Home</span>
            </NavLink>

            <NavLink
              onClick={(e) => e.stopPropagation()}
              to={`/tech/profile/${user ? user.username : username}`}
              className={({ isActive }) =>
                `flex items-center space-x-2 text-3xl cursor-pointer transition-all transform hover:bg-gray-500 hover:scale-105 rounded-full p-2 ${
                  isActive ? activeClass : inactiveClass
                }`
              }
            >
              <ProfileOutlined />
              <span className="hidden md:inline text-lg font-medium">Profile</span>
            </NavLink>
          </div>

          {/* Right Side: Bell Icon and Profile Dropdown */}
          <div className="flex items-center space-x-4">
            {user && (
              <div ref={bellRef} className="relative">
                <div className="relative">
                  <BellOutlined
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNotifications();
                    }}
                    className={`text-3xl cursor-pointer transition transform hover:translate-x-1 mr-1 active:text-blue-800 active:translate-x-1 ${
                      isNotOpen ? "text-blue-600" : "text-gray-900"
                    }`}
                  />
                  {unseenCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                      {unseenCount}
                    </span>
                  )}
                </div>

                <AnimatePresence>
                  {isNotOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="absolute right-0 mt-4 w-[400px] left-[-200px] bg-gray-300 border border-gray-300 rounded shadow-md z-10 p-4"
                      style={{ maxHeight: "600px", overflowY: "auto" }}
                    >
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-10">
                          <p className="text-lg font-semibold text-gray-700">No Notifications</p>
                          <p className="text-sm text-gray-500">You&apos;re all caught up!</p>
                        </div>
                      ) : (
                        Object.entries(groupedNotifications).map(([label, notis]) => (
                          <div key={label} className="mb-4">
                            <h3 className="font-bold mb-2">{label}</h3>
                            {notis.map((n) => (
                              <div
                                onClick={() => handleNotificationClick(n)}
                                key={n.notification_id}
                                className="border-b border-gray-400 pb-2 mb-2 rounded-lg cursor-pointer hover:bg-gray-400"
                              >
                                <div className="flex items-center space-x-8">
                                  <img
                                    src={
                                      n?.Sender?.profilePic ||
                                      "https://placehold.co/32x32"
                                    }
                                    alt={n?.Sender?.name}
                                    className="rounded-full w-10 h-10"
                                  />
                                  <div>
                                    <p className="text-gray-700">{n.action}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {format(new Date(n.createdAt), "HH:mm", {
                                        locale: vi,
                                      })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {user && (
              <div ref={dropdownRef} className="relative dropdown-container">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDropdownToggle();
                  }}
                  className="flex items-center space-x-2 px-2 py-1 bg-gray-500 hover:bg-gray-600 rounded-full transition transform hover:translate-x-1 active:translate-x-2"
                >
                  <img
                    src={user?.profilePic || "https://placehold.co/32x32"}
                    alt="User"
                    className="h-8 w-8 rounded-full"
                  />
                  <ArrowDownOutlined />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-40 bg-white border rounded shadow-md z-10">
                    <ul className="py-1">
                      <li>
                        <button
                          className="block px-4 py-2 text-gray-600 hover:text-gray-800"
                          onClick={handleLogout}
                        >
                          <LogoutOutlined className="mr-2" />
                          Logout
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Reply Modal rendered based on selected notification */}
      {isReplyModalOpen && (
        <ReplyModal
          isOpen={isReplyModalOpen}
          onCancel={() => setIsReplyModalOpen(false)}
          {...getReplyModalProps(selectedNotification)}
        />
      )}
    </header>
  );
};

export default Header;
