import React, { useState } from 'react'
import { EyeOutlined, EyeInvisibleOutlined, CodeSandboxOutlined } from '@ant-design/icons';
import {GooglePlusOutlined, GithubOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { useSetRecoilState } from 'recoil';
import userAtom from '../../Atoms/userAtom';
const SignUpCard = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fullname, setFullName] = useState("");
  const [username, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const setUser = useSetRecoilState(userAtom);

  const handleEmailChange = (e) =>{
    setEmail(e.target.value);
  }

  const handleFullNameChange = (e) =>{
    setFullName(e.target.value);
  }
  
  const handleUserName = (e) =>{
    setUserName(e.target.value);
  }

  const handlePasswordChange = (e) =>{
    setPassword(e.target.value);
  }

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const handleSignUp = async (e) =>{
    e.preventDefault();
    // console.log(username, fullname, email, password)
    try {
      let inputs= {name: fullname, email: email, username: username, password: password};
      const res = await fetch("/api/user/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(inputs)
      });
  
      const data = await res.json();
      if(data.error){
        toast.error(data.error)
        return 
      }
      
      localStorage.setItem("user-network", data);
      setUser(data);

    } catch (error) {
      toast.error(error)
      return
    }

  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-blue-200">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
      <center><CodeSandboxOutlined style={{ fontSize: '65px' }}/></center>
        <h2 className="text-2xl font-bold text-center mb-2">Create your account</h2>
        <p className="text-center text-gray-700 mb-6">
        The Future of Tech Awaits
        </p>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={fullname}
              onChange={handleFullNameChange}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              placeholder="johndoe"
              value={username}
              onChange={handleUserName}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={handleEmailChange}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative mt-1">
              <input
                type={passwordVisible ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={handlePasswordChange}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {passwordVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            onClick={handleSignUp}
            className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create Account
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{' '}
          <a href="/signin" className="text-blue-600 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}

export default SignUpCard