import React, { useState } from 'react';
import { Menu, LogOut, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu }) => {
  const { user, logout } = useAuth();
  const { success } = useToast();
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    success('Logged out', 'You have been safely signed out of InfluenceX.');
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'brand';
      case 'EVENT_TEAM':
        return 'amber';
      case 'FACULTY':
        return 'green';
      default:
        return 'gray';
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Mobile Hamburger Toggle & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden text-gray-500 hover:text-gray-700 p-2 rounded-lg -ml-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Open sidebar navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500 font-medium">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>NIAT Influencers Club</span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-700 font-semibold">InfluenceX v1.0</span>
          </div>
        </div>

        {/* User info, Password Change & Logout button */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center text-xs font-semibold text-brand-700">
              {initials}
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-xs font-semibold text-gray-900 leading-tight truncate max-w-[150px]">
                {user?.name || 'Authenticated User'}
              </div>
              <div className="text-[11px] text-gray-500 truncate max-w-[150px]">
                {user?.ixId || user?.email}
              </div>
            </div>
          </div>

          <Badge variant={getRoleBadgeVariant(user?.role)} size="sm" dot>
            {user?.role || 'STUDENT'}
          </Badge>

          <div className="h-5 w-px bg-gray-200 mx-0.5 hidden sm:block" />

          {/* Change Password Button (Hidden for Volunteers) */}
          {user?.role !== 'VOLUNTEER' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsChangePassOpen(true)}
              className="text-gray-600 hover:text-brand-700 hover:bg-brand-50 text-xs gap-1.5 px-2.5"
              title="Change your account password"
            >
              <KeyRound className="w-4 h-4" />
              <span className="hidden md:inline">Change Password</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-600 hover:bg-red-50 text-xs gap-1.5 px-2.5"
            title="Sign out of InfluenceX"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePassOpen}
        onClose={() => setIsChangePassOpen(false)}
      />
    </>
  );
};
