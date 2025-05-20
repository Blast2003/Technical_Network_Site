import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRecoilValue } from "recoil";
import userAtom from "../../Atoms/userAtom";
import { toast } from "react-toastify";

const ProfileSection = ({
  id,
  name,
  username,
  profilePic,
  bio,
  position,
  postsCount,
  followerCount,
  followingCount,
}) => {
  const user = useRecoilValue(userAtom);
  const [following, setFollowing] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true); // loading state added

  useEffect(() => {
    const fetchFollowingId = async () => {
      try {
        setLoading(true); // start loading
        const res = await fetch("/api/user/following");
        const data = await res.json();

        if (data.error) {
          toast.error(data.error);
        } else if (data.message) {
          setFollowing([]);
        } else {
          setFollowing(data);
        }
      } catch (error) {
        console.log("Error in Get Suggested Users", error);
      } finally {
        setLoading(false); // stop loading after fetch
      }
    };

    fetchFollowingId();
  }, [id]);

  useEffect(() => {
    if (message === "User unfollowed successfully") {
      setFollowing((prev) => prev.filter((val) => val !== id));
    } else if (message === "User followed successfully") {
      setFollowing((prev) => [...prev, id]);
    }

    setMessage("");
  }, [message, id]);

  const handleFollow = async (id) => {
    try {
      const res = await fetch(`/api/user/follow/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setMessage(data.message);
      toast.success(data.message);
    } catch (error) {
      toast.error("Error in Follow/Unfollow", error);
    }
  };

  return (
    <>
      <div className="mt-8 p-4 bg-gray-300 shadow-md rounded-lg">
        <div className="flex flex-col sm:flex-row items-center sm:space-x-4 justify-between">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="flex justify-center">
              <img
                src={profilePic || "https://placehold.co/40x40"}
                alt={name}
                className="h-16 w-16 rounded-full"
              />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-bold">{name}</h1>
              <p className="text-gray-500">@{username}</p>
              <p className="text-gray-700">
                {position === null && user?.id === id && username ? "Update Your Job/Position At Edit Profile" : position}
              </p>
            </div>
          </div>
          {user && user.id === id && (
            <Link to={`/tech/updateProfile/${user.id}`}>
              <button className="mt-4 sm:mt-0 sm:ml-auto bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm w-1/10">
                Edit Profile
              </button>
            </Link>
          )}
        </div>

        <p className="text-gray-500 mt-5">
          {bio === null && user?.id === id && username
            ? "Please Update Your Bio At Update Profile"
            : bio }
        </p>

        <div className="flex justify-center sm:justify-start space-x-4 mt-4">
          <div>
            <span className="font-bold">{postsCount}</span>{" "}
            <span className="text-gray-500">Posts</span>
          </div>
          <div>
            <span className="font-bold">{followerCount}</span>{" "}
            <span className="text-gray-500">Followers</span>
          </div>
          <div>
            <span className="font-bold">{followingCount}</span>{" "}
            <span className="text-gray-500">Following</span>
          </div>
          <div className="mr-auto"></div>

          {!loading && user && user?.id !== id && (
            following.includes(Number(id)) ? (
              <button
                onClick={() => handleFollow(id)}
                className="bg-gray-600 text-white py-2 px-5 rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              >
                Following
              </button>
            ) : (
              <button
                onClick={() => handleFollow(id)}
                className="bg-blue-600 text-white py-2 px-5 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              >
                Follow
              </button>
            )
          )}
        </div>

        <hr className="border-t-4 border-gray-300 my-4" />
      </div>
    </>
  );
};

export default ProfileSection;
