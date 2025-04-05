import React, { useState } from 'react'
import FreezeInfo from "../Components/section/FreezeInfo"
import Warning from "../Components/section/Warning"
import Confirmation from "../Components/section/Confirmation"
import userAtom from '../Atoms/userAtom'
import { useSetRecoilState } from 'recoil'
import LeftNav from '../Components/LeftNav'
const FreezeAccountPage = () => {
  const [success, setSuccess] = useState(false)
  const setUser = useSetRecoilState(userAtom);

  const handleCheckFrozenAccount = (success) =>{
    setSuccess(success)
  }

  if(success){
    setTimeout(() => {
      localStorage.removeItem("user-network");
      setUser(null);
    }, 2500);
  }

  return (
    <div className="bg-gray-200 min-h-screen">
      {/* 
        Switch from column layout on small screens 
        to row layout on medium screens and up 
      */}
      <div className="flex flex-col md:flex-row justify-center">
        <aside className="sm:items-center sm:justify-center md:block md:w-66 p-4 lg:h-[560px]">
          <div className="bg-white rounded-lg shadow p-4 h-full mt-5">
            <LeftNav />
          </div>
        </aside>

        <div className="w-full md:w-[600px] lg:w-[1050px] bg-gray-200 
                        py-8 px-4 sm:px-8 md:px-20">
          <h1 className="text-2xl font-bold mb-6">Freeze Your Account</h1>
          <p className="text-gray-600 mb-8">
            Temporarily disable access to your account for security purposes
          </p>

          {/* Container for freeze info, warning, and confirmation */}
          <div className="w-full max-w-2xl">
            <FreezeInfo />
            <Warning />
            <Confirmation onFreezeUpdate={handleCheckFrozenAccount} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreezeAccountPage