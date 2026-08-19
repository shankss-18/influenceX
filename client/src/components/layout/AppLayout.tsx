import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '../../context/AuthContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const isSinglePageRole = user?.role === 'VOLUNTEER' || user?.role === 'STUDENT';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Forced first-login password reset modal */}
      <ChangePasswordModal />

      {/* Sidebar Navigation (Admin only) */}
      {!isSinglePageRole && (
        <Sidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      {/* Main Container */}
      <div className={`flex flex-col flex-1 ${!isSinglePageRole ? 'md:pl-64' : ''}`}>
        <Topbar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
