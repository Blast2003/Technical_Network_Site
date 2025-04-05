import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

const TrendingTopics = () => {
  const [topics, setTopics] = useState([]);
  const [titleClicked, setTitleClicked] = useState(false);

  useEffect(() => {
    const fetchTrendingTopics = async () => {
      try {
        const res = await fetch("/api/post/topic/trending");
        const data = await res.json();
        if (data.message) {
          toast.success(data.message);
          setTopics([]);
          return;
        }
        setTopics(data.trendingTopics);
      } catch (error) {
        toast.error("Error in fetchTrendingTopics", error);
        setTopics([]);
      }
    };

    fetchTrendingTopics();
  }, []);

  const toggleTitle = () => {
    setTitleClicked((prev) => !prev);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2
        onClick={toggleTitle}
        className={`font-bold mb-2 text-lg cursor-pointer transition transform ${
          titleClicked ? "translate-x-2 text-blue-800" : "hover:text-blue-600 hover:translate-x-1"
        }`}
      >
        Trending Topics
      </h2>
      <ul className="space-y-2">
        {topics.map(({ title, count }) => (
          <li key={title} className="flex justify-between items-center">
            <span>{title}</span>
            <span className="text-gray-500 whitespace-nowrap">
              {count} {count === 1 ? "post" : "posts"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrendingTopics;
