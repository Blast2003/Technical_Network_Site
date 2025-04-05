import React from "react";
import { SafetyCertificateOutlined } from "@ant-design/icons";

const FreezeInfo = () => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <div className="flex items-start space-x-4">
        <SafetyCertificateOutlined className="text-blue-500 text-3xl" />
        <div>
          <h2 className="font-semibold mb-2">What happens when you freeze your account?</h2>
          <ul className="list-disc list-inside text-gray-700">
            <li>Temporarily deactivate account, protect your privacy</li>
            <li>Making your profile and content invisible to others</li>
            <li>You can unfreeze your account at any time</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FreezeInfo;
