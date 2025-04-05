import React from 'react';
import Header from "../Components/Header";
import { Outlet } from "react-router";

const DefaultPage = () => {
  return (
    <div className="bg-gray-200 flex flex-col min-h-screen">
      <Header />
      <Outlet />
    </div>
  );
};

export default DefaultPage;
