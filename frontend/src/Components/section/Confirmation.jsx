import React, { useState } from "react";
import { LockOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";

const Confirmation = ({onFreezeUpdate}) => {
  const [isChecked, setIsChecked] = useState(false);

  const handleCheckboxChange = () => {
    setIsChecked(!isChecked);
  };



  const handleFreezeAccount = async() => {
    if (!isChecked) {
      alert("Please confirm by checking the box before freezing your account.");
      return;
    }
    
    try {
      const res = await fetch("/api/user/freeze", {
        method: "PUT",
        headers:{"Content-Type": "application/json"}
      })

      const data = await res.json();

      if(data.error){
        toast.error(data.error)
      }
      onFreezeUpdate(data.success)
      toast.success("You frozen your account successfully")
      

    } catch (error) {
      toast.error("Error in Freeze Account", error)
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex items-center space-x-2 mb-4">
        <input
          type="checkbox"
          className="form-checkbox h-5 w-5 text-red-600"
          id="confirm"
          checked={isChecked}
          onChange={handleCheckboxChange}
        />
        <label htmlFor="confirm" className="text-gray-700">
          I understand that freezing my account will temporarily disable all transactions
        </label>
      </div>
      <button
        className="bg-red-600 text-white px-4 py-2 rounded-lg w-full flex items-center justify-center"
        onClick={handleFreezeAccount}
      >
        <LockOutlined className="mr-2" />
        Freeze Account
      </button>
    </div>
  );
};

export default Confirmation;
