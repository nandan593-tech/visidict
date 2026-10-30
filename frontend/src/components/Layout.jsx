import React from 'react';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

export default function Layout() {
  return (
    <div className="layout-wrapper">
      <NavBar />
      <main className="app-container">
        <Outlet />
      </main>
    </div>
  );
}
