import React from "react";
import { NavLink } from "react-router-dom";
import { LiaUserFriendsSolid } from "react-icons/lia";
import { GiInterstellarPath } from "react-icons/gi";
import { FaHome } from "react-icons/fa";
import { MailOutlined, SettingOutlined   } from "@ant-design/icons";
import { useRecoilValue } from "recoil";
import userAtom from "../Atoms/userAtom";
import { FaBriefcase } from "react-icons/fa6";

const LeftNav = () => {
  // Define the active and inactive text colors
  const activeClass = "text-blue-600";
  const inactiveClass = "text-gray-600";
  const currentUser = useRecoilValue(userAtom);

  return (
    <nav>
      {/* Adjust the spacing as you prefer, e.g. space-y-4, space-y-6, etc. */}
      <ul className="space-y-8">
        <li className="p-2 rounded-lg transition-shadow hover:shadow-xl">
          <NavLink
            to="/tech"
            end
            className={({ isActive }) =>
              `flex items-center text-2xl cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2 ${
                isActive ? activeClass : inactiveClass
              }`
            }
          >
            {/* Icon + Text Container */}
            <div className="w-8 flex-shrink-0 flex justify-center">
              <FaHome className="text-2xl align-middle" />
            </div>
            <span className="font-semibold cursor-pointer text-2xl ml-1 align-middle">
              Home Page
            </span>
          </NavLink>
        </li>

        {currentUser && (
          <>
            <li className="p-2 rounded-lg transition-shadow hover:shadow-xl">
              <NavLink
                to="/tech/following"
                className={({ isActive }) =>
                  `flex items-center text-2xl cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2 ${
                    isActive ? activeClass : inactiveClass
                  }`
                }
              >
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <LiaUserFriendsSolid className="text-2xl align-middle " />
                </div>
                <span className="font-semibold cursor-pointer text-2xl ml-1 align-middle">
                  Following
                </span>
              </NavLink>
            </li>
            <li className="p-2 rounded-lg transition-shadow hover:shadow-xl">
              <NavLink
                to="/tech/Recruitment"
                className={({ isActive }) =>
                  `flex items-center text-2xl cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2 ${
                    isActive ? activeClass : inactiveClass
                  }`
                }
              >
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <FaBriefcase className="text-2xl align-middle" />
                </div>
                <span className="font-semibold cursor-pointer text-2xl ml-1 align-middle">
                  Recruitment
                </span>
              </NavLink>
            </li>
            <li className="p-2 rounded-lg transition-shadow hover:shadow-xl">
              <NavLink
                to="/tech/chat"
                className="flex items-center text-gray-600 hover:text-blue-600 transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2"
              >
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <MailOutlined className="text-2xl align-middle" />
                </div>
                <span className="font-semibold cursor-pointer text-2xl ml-1 align-middle">
                  Chatting
                </span>
              </NavLink>
            </li>
            <li className="p-2 rounded-lg transition-shadow hover:shadow-xl">
              <NavLink
                to="/tech/freeze"
                className={({ isActive }) =>
                  `flex items-center text-2xl cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2 ${
                    isActive ? activeClass : inactiveClass
                  }`
              }
              >
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <SettingOutlined className="text-2xl align-middle" />
                </div>
                <span className="font-semibold cursor-pointer text-2xl ml-1 align-middle whitespace-nowrap">
                  Freeze Account
                </span>
              </NavLink>
            </li>
            <li className="p-2 rounded-lg transition-shadow hover:shadow-xl">
              <NavLink
                to="/tech/career-paths"
                className={({ isActive }) =>
                  `flex items-center text-2xl cursor-pointer transition transform hover:translate-x-1 active:text-blue-800 active:translate-x-2 ${
                    isActive ? activeClass : inactiveClass
                  }`
                }
              >
                <div className="w-8 flex-shrink-0 flex justify-center">
                  <GiInterstellarPath className="text-2xl align-middle" />
                </div>
                <span className="font-semibold cursor-pointer text-2xl ml-1 align-middle">
                  Career Paths
                </span>
              </NavLink>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default LeftNav;
