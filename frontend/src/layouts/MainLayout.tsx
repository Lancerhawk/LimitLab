import React from 'react';
import { Outlet } from 'react-router-dom';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="border-b border-gray-800 bg-gray-900/50 p-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">LimitLab</h1>
      </header>
      <main className="p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
