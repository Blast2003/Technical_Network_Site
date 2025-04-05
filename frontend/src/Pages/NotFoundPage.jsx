// src/Pages/NotFoundPage.jsx
import React from 'react';
import { FrownOutlined } from '@ant-design/icons';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <FrownOutlined style={{ fontSize: '80px', color: '#ff4d4f' }} />
      <h1 className="text-4xl font-bold mt-4 text-gray-800">Page Not Found</h1>
      <p className="mt-2 text-gray-600">Sorry, the page you visited does not exist.</p>
    </div>
  );
};

export default NotFoundPage;
