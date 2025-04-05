import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import LeftNav from '../Components/LeftNav';
import loader from "../assets/loader.svg";

const FollowingUsers = () => {
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const fetchUsers = async (page) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/user/follow?page=${page}&limit=3`);
      const data = await response.json();
      if (data.error) {
        setUsers([]);
        return;
      }
      // If it's the first page, replace the list; otherwise, append new users
      if (page === 1) {
        setUsers(data.users);
      } else {
        setUsers((prevUsers) => [...prevUsers, ...data.users]);
      }
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Error fetching following users:', error);
      toast.error('Error fetching following users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users when the component mounts or when the page changes
  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage]);

  const handleShowMore = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-200 min-h-screen">
      <div className="flex flex-row justify-center">
        <aside className="sm:items-center sm:justify-center md:block md:w-66 p-4 lg:h-[560px]">
          <div className="bg-white rounded-lg shadow p-4 h-full mt-8">
            <LeftNav />
          </div>
        </aside>

        <div className="w-full md:w-[600px] lg:w-[1050px] p-4 bg-gray-200 text-white py-10">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6 text-black text-center">Following Users</h1>
            {users.length === 0 ? (
              <div className="flex justify-center items-center">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-gray-700 mb-4">
                      You are not following anyone.
                    </p>
                    <p className="text-gray-500">
                      Explore users and start following them!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {users.map((user, index) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -10 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
                    >
                      <Link to={`/tech/profile/${user.name}`} className="block">
                        <div className="relative h-48">
                            <img
                              src={user?.profilePic || "https://placehold.co/290x190"}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-4">
                          <h2 className="text-xl text-center font-bold text-gray-300 truncate mb-4">
                            {user.name}
                          </h2>
                          <p className="text-sm font-bold text-center text-gray-400 truncate mb-3">
                            {user.position}
                          </p>
                          <p className="text-sm mt-2 text-center text-gray-300 line-clamp-3">
                            {user.bio}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
                {currentPage < totalPages && (
                  <div className="flex justify-center sm:mt-6 md:mt-12 lg:mt-18">
                    <button
                      onClick={handleShowMore}
                      className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm"
                    >
                      Show More
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowingUsers;
