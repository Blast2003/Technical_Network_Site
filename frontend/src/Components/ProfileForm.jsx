import React, { useRef, useState } from 'react';
import {CameraOutlined} from "@ant-design/icons";
import { EyeOutlined, EyeInvisibleOutlined} from '@ant-design/icons';
import { useRecoilState } from 'recoil';
import userAtom from '../Atoms/userAtom';
import { Link } from 'react-router-dom';
import usePreviewImg from '../Hooks/usePreviewImg';
import { toast } from 'react-toastify';

const ProfileForm = () =>{ 
  const [user, setUser] = useRecoilState(userAtom);
  const [showPassword, setShowPassword] = useState(false);
    const [inputs, setInputs]  = useState({
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio,
        password: "",
        position: user.position,
    })
  const fileRef = useRef(null);

  const {handleImageChange, imgUrl} = usePreviewImg();
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleUpdateProfile = async (e) =>{
    e.preventDefault();
    try {
        const res = await fetch(`/api/user/update/${user.id}`, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({... inputs, profilePic: imgUrl})
        })

        const data = await res.json()
        if(data.error){
            toast.error(data.error)
            return
        }
        toast.success("Profile updated successfully");
        setUser(data)
        localStorage.setItem("user-network", JSON.stringify(data)); 
    } catch (error) {
        toast.error("Error in Update Profile", error)
    } 
  }
  

  return (
  <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-lg">
    <h2 className="text-2xl font-semibold mb-2">Edit Profile</h2>
    <p className="text-gray-600 mb-6">Update your personal information and manage your account</p>
    <div className="flex items-center space-x-4 p-4 bg-gray-300 rounded-lg shadow">
      {/* Profile Picture */}
      <div className="relative mr-2">
        <img
          src={imgUrl || user?.profilePic || "https://placehold.co/32x32"}
          alt="Profile"
          className="w-25 h-20 rounded-full"
        />
        {/* Camera Icon */}
        <div className="absolute bottom-0 right-0 bg-blue-400 text-gray rounded-full p-1 shadow-sm">
          <CameraOutlined onClick={() => fileRef.current.click()} className='cursor-pointer' style={{ fontSize: "20px" }}/>
          <input type='file' hidden ref={fileRef} onChange={handleImageChange}/>
        </div>
      </div>

      {/* Text Section */}
      <div>
        <p className="text-lg font-semibold text-gray-700">Profile Picture</p>
        <p className="text-sm text-gray-600">
          Upload a new avatar or change your current one
        </p>
      </div>
    </div>
    <form>
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label className="text-gray-700">Full Name</label>
          <input className="mt-1 p-2 border-4 rounded-md w-full" value={inputs.name} onChange={(e) => setInputs({... inputs, name: e.target.value})} type="text" />
        </div>
        <div>
          <label className="text-gray-700">Username</label>
          <div className="flex items-center mt-1 p-2 border-4 rounded-md">
            <span className="text-gray-500">@</span>
            <input className="ml-2 flex-grow outline-none" value={inputs.username} onChange={(e) => setInputs({... inputs, username: e.target.value})} type="text" />
          </div>
        </div>
        <div>
          <label className="text-gray-700">Position</label>
          <input className="mt-1 p-2 border-4 rounded-md w-full" value={inputs.position} onChange={(e) => setInputs({... inputs, position: e.target.value})} type="text" />
        </div>
        <div>
          <label className="text-gray-700">Email Address</label>
          <div className="flex items-center mt-1 p-2 border-4 rounded-md">
            <i className="fas fa-envelope text-gray-500"></i>
            <input className="ml-2 flex-grow outline-none" value={inputs.email} onChange={(e) => setInputs({... inputs, email: e.target.value})} type="email" />
          </div>
        </div>
        <div>
          <label className="text-gray-700">Bio</label>
          <textarea rows={"4"} className="mt-1 p-2 border-4 rounded-md w-full" value={inputs.bio} onChange={(e) => setInputs({... inputs, bio: e.target.value})}></textarea>
        </div>
        <div>
          <label className="text-gray-700">Password</label>
          <div className='relative'>
          <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={inputs.password}
                onChange={(e) => setInputs({...inputs, password: e.target.value})}
                placeholder="Enter your password"
                className="mt-1 p-2 border-4 rounded-md w-full focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </button>
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <Link to={`/tech/profile/${user.username}`}>
          <button className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md mr-2 hover:bg-gray-200" type="button">Cancel</button>
        </Link>
        <button onClick={handleUpdateProfile} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-500" type="submit">Save Changes</button>
      </div>
    </form>
  </div>
);
}

export default ProfileForm;
