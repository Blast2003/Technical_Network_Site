import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { AiFillStar } from "react-icons/ai"; 
import {Button} from "antd";

const SuggestedFollows = () => {
  const [follow, setFollow] = useState([]);
  const [titleClicked, setTitleClicked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuggestedUser = async () => {
      try {
        const res = await fetch("/api/user/suggested");
        const data = await res.json();

        if (data.error) {
          console.log("Error in SuggestedFollows",data.error)
          return;
        }
        setFollow(data);
      } catch (error) {
        toast.error("Error in Get Suggested Users", error);
      }
    };

    fetchSuggestedUser();
  }, []);

  const handleFollow = async (id) => {
    setLoadingId(id);
    setLoading(true);
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

      toast.success(data.message);

      // Remove followed user from the list
      setFollow((prevFollow) => prevFollow.filter((person) => person.id !== id));
    } catch (error) {
      toast.error("Error in Follow/Unfollow", error);
    } finally{
      setLoading(false);
    }
  };

  const toggleTitle = () => {
    setTitleClicked((prev) => !prev);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2
        onClick={toggleTitle}
        className={`font-bold mb-2 text-lg cursor-pointer transition transform ${
          titleClicked
            ? "translate-x-2 text-blue-800"
            : "hover:text-blue-600 hover:translate-x-1"
        }`}
      >
        Suggested Follows
      </h2>

      <ul className="space-y-2">
        {follow.map((person, index) => (
          <div key={person.id} className="relative">
            {/* If the user is recommended, show a "Recommendation" badge */}
            {person.recommend && (
              <div className="absolute top-0 right-0 flex items-center bg-white px-2 py-1 rounded-full shadow ">
                <AiFillStar className="text-yellow-400 w-4 h-4 mr-1" />
                <span className="text-xs text-gray-600">Recommendation</span>
              </div>
            )}

            <li className="flex justify-between items-center cursor-pointer hover:bg-gray-300 px-2 py-2 rounded">
              <div
                className="flex items-center space-x-2"
                onClick={() => navigate(`/tech/profile/${person?.username}`)}
              >
                <img
                  src={person.profilePic || "https://placehold.co/32x32"}
                  alt={person.name}
                  className="rounded-full w-10 h-10"
                />
                <div>
                  <p className="font-bold">{person.name}</p>
                  <p className="text-gray-500 text-sm">
                    {person.position || "None"}
                  </p>
                </div>
              </div>

              <Button
              loading={loadingId === person.id}
                onClick={() => handleFollow(person.id)}
                className="bg-blue-600 text-white py-1 px-3 mt-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition transform hover:translate-x-1 active:translate-x-2"
              >
                Follow
              </Button>
            </li>

            {index < follow.length - 1 && (
              <hr className="my-2 h-px border-0 bg-gray-400" />
            )}
          </div>
        ))}
      </ul>
    </div>
  );
};

export default SuggestedFollows;
