import React, {  useState } from 'react'; 
import {Link} from "react-router-dom";
import { EyeOutlined, EyeInvisibleOutlined, GithubOutlined, LockFilled } from '@ant-design/icons';
import { useSetRecoilState } from 'recoil';
import userAtom from '../../Atoms/userAtom';
import { toast } from 'react-toastify';
import { GoogleLogin } from '@react-oauth/google';
import {jwtDecode} from "jwt-decode";

const SignInCard = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const setUser = useSetRecoilState(userAtom); 

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      let inputs = {email, password}
      // console.log(inputs)

      const res = await fetch("/api/user/login", {
        method: "POST",
        headers:{
          "Content-Type": "application/json"
        },
        body: JSON.stringify(inputs)
      });

      const data = await res.json();

      if(data.error){
        toast.error(data.error)
        return
      }

      localStorage.setItem("user-network", JSON.stringify(data));
      setUser(data)

    } catch (error) {
      toast.error(error)
      return
    }

  };

  const handleGHLogin = () => {
    // console.log(import.meta.env.VITE_GH_CLIENT_ID)
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${import.meta.env.VITE_GH_CLIENT_ID}&scope=user`;
  }

  const handleGGLogInServer = async (info) => {
    try {
      const payload = {
        name: info?.name,
        username: info?.given_name, 
        email: info?.email,
        password: String(info?.iat), //change iat => sub if can not use
        profilePic: info?.picture
      };
  
      console.log("Payload:", payload);
  
      const res = await fetch("/api/user/login/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
  
      const data = await res.json();
  
      if (data.error) {
        console.log("Error In handleOAuthLogInServer", data.error);
        return;
      }
  
      localStorage.setItem("user-network", JSON.stringify(data));
      setUser(data);
    } catch (error) {
      console.error("Error in handle OAuth Login at Server", error);
    }
  };


  return (
    <div className="flex justify-center items-center min-h-screen bg-blue-200">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-[500px]">
          <center>
            <div className="w-20 bg-gray-200 rounded-lg opacity-90">
              <LockFilled style={{ fontSize: '65px' }}/>
            </div>
          </center>
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Welcome Back</h2>
        <p className="text-gray-600 mb-6 text-center">Sign in to access your account</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter your password"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
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

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            Sign In
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-blue-600 hover:underline">
            Sign Up
          </Link>
        </p>


        <div className="relative flex items-center my-6">
          <div className="flex-grow border-t border-gray-500"></div>
          <span className="mx-4 text-gray-500 text-sm">Or continue with</span>
          <div className="flex-grow border-t border-gray-500"></div>
        </div>


        <div className="mt-4 flex space-x-3 justify-between text-sm">
        <GoogleLogin
          onSuccess={credentialResponse => {
            const decode = jwtDecode(credentialResponse.credential);
            console.log(decode)
            handleGGLogInServer(decode);
          }}
          onError={() => {
            console.log('Login Failed');
          }}
        />

          <button className="w-full flex items-center 
          justify-center bg-gray-500 
          text-white py-2 px-4 rounded-lg hover:bg-gray-700 
          focus:ring-2 focus:ring-gray-600 focus:outline-none"
          onClick={handleGHLogin}
          >
            <GithubOutlined style={{ marginRight: '10px' }} />
            Sign in with GitHub
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignInCard;
