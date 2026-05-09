import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Upload, ClipboardList, BarChart2,
  Share2, Settings, LogOut, Heart, X, Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload',     icon: Upload,          label: 'Upload Record' },
  { to: '/history',    icon: ClipboardList,   label: 'Medical History' },
  { to: '/reminders',  icon: Bell,            label: 'Reminders' },
  { to: '/insights',   icon: BarChart2,       label: 'Health Insights' },
  { to: '/share',      icon: Share2,          label: 'Share Access' },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <Heart size={22} fill="white" color="white" />
        </div>
        <div className="sidebar__logo-text">
          <span className="sidebar__logo-title">HealthRM</span>
          <span className="sidebar__logo-sub">Record Manager</span>
        </div>
        <button className="sidebar__close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        <p className="sidebar__section-label">Main Menu</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
            onClick={onClose}
          >
            <span className="sidebar__item-icon">
              <Icon size={20} />
            </span>
            <span className="sidebar__item-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="sidebar__bottom">
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
          onClick={onClose}
        >
          <span className="sidebar__item-icon"><Settings size={20} /></span>
          <span className="sidebar__item-label">Settings</span>
        </NavLink>
        <button className="sidebar__item sidebar__item--logout" onClick={handleLogout}>
          <span className="sidebar__item-icon"><LogOut size={20} /></span>
          <span className="sidebar__item-label">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
