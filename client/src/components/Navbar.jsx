import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, Headset, User, LogOut, Sparkles } from 'lucide-react';

export const getRoleBadge = (role) => {
  switch (role) {
    case 'ADMIN':
      return {
        label: 'Admin',
        bg: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: <ShieldCheck className="w-3.5 h-3.5 mr-1" />,
      };
    case 'SUPPORT_MANAGER':
      return {
        label: 'Support Manager',
        bg: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: <UserCheck className="w-3.5 h-3.5 mr-1" />,
      };
    case 'SUPPORT_AGENT':
      return {
        label: 'Support Agent',
        bg: 'bg-teal-100 text-teal-800 border-teal-200',
        icon: <Headset className="w-3.5 h-3.5 mr-1" />,
      };
    case 'CUSTOMER':
    default:
      return {
        label: 'Customer',
        bg: 'bg-slate-100 text-slate-800 border-slate-200',
        icon: <User className="w-3.5 h-3.5 mr-1" />,
      };
  }
};

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const badge = user ? getRoleBadge(user.role) : null;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
            R
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">ResolveIQ</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                Phase 1
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium -mt-0.5">Intelligent Helpdesk</p>
          </div>
        </Link>

        {/* Right Nav Options */}
        <div className="flex items-center space-x-3">
          {isAuthenticated && user ? (
            <>
              {/* Role Badge */}
              <div
                className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.bg}`}
              >
                {badge.icon}
                {badge.label}
              </div>

              {/* User Name */}
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-400">{user.email}</div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors border border-slate-200"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-indigo-600 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;

