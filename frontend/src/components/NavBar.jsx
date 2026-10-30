import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity, LayoutDashboard, History, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './NavBar.css';

export default function NavBar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="app-navbar">
      <div className="navbar-container">
        <NavLink to="/dashboard" className="navbar-brand">
          <Activity size={28} color="var(--color-primary)" />
          <h1>
            <span className="brand-visi">VISI</span>
            <span className="brand-dict">DICT</span>
          </h1>
          <span className="navbar-brand-badge">Presence AI</span>
        </NavLink>

        <div className="navbar-links">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `nav-link-item ${isActive ? 'active' : ''}`
            }
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/history"
            className={({ isActive }) =>
              `nav-link-item ${isActive ? 'active' : ''}`
            }
          >
            <History size={18} />
            <span>History & Logs</span>
          </NavLink>
        </div>

        <div className="navbar-actions">
          <div className="user-badge">
            <span className="user-avatar-dot" />
            <span>Admin</span>
          </div>
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
            title="Sign out of VISIDICT"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
