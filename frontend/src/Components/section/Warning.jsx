import React from "react";
import { ExclamationCircleOutlined } from "@ant-design/icons";

const Warning = () => {
  return (
    <div className="bg-yellow-100 p-4 rounded-lg shadow-md mb-6">
      <div className="flex items-start space-x-2">
        <ExclamationCircleOutlined className="text-yellow-500 text-2xl" />
        <p className="text-yellow-700">
          This action will immediately restrict access to your account. Make sure you have completed any pending transactions.
        </p>
      </div>
    </div>
  );
};

export default Warning;
