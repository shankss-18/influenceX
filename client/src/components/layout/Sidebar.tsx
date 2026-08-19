import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCircle,
  Shield,
  X,
  Calendar,
  Award,
  Trophy,
  Gift,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  // If user is Volunteer or Student, no sidebar is rendered (single-page portal)
  if (user?.role === 'VOLUNTEER' || user?.role === 'STUDENT') {
    return null;
  }

  const navItems = [
    {
      name: 'Workshops',
      to: '/admin/workshops',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      name: 'Leaderboards & Rankings',
      to: '/admin/leaderboard',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      name: 'Goodie Tracking',
      to: '/admin/goodies',
      icon: <Gift className="w-4 h-4" />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-base shadow-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-gray-900 tracking-tight text-base leading-none block">
                Influence<span className="text-brand-600">X</span>
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 block mt-0.5">
                NIAT Influencers Club
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-gray-600 p-1.5 rounded-lg -mr-2"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Scope Indicator */}
        <div className="px-6 py-3 bg-surface border-b border-gray-100">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Workspace Scope
          </span>
          <span className="text-xs font-bold text-brand-700 mt-0.5 block truncate">
            {user?.role === 'ADMIN'
              ? '👑 Administrator Portal'
              : '🛡️ Staff Portal'}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => onClose()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-gray-100 bg-surface/50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">InfluenceX v5.0 • Production</span>
          </div>
        </div>
      </aside>
    </>
  );
};
