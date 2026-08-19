import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleRoute } from './routes/RoleRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';

// 6 Exact Admin Screens
import { WorkshopsListPage } from './pages/admin/WorkshopsListPage';
import { CreateWorkshopPage } from './pages/admin/CreateWorkshopPage';
import { WorkshopSetupPage } from './pages/admin/WorkshopSetupPage';
import { WorkshopConsolePage } from './pages/admin/WorkshopConsolePage';
import { AdminLeaderboardPage } from './pages/admin/AdminLeaderboardPage';
import { GoodieTrackingPage } from './pages/admin/GoodieTrackingPage';

// Single-Page Role Portals
import { VolunteerPortalPage } from './pages/volunteer/VolunteerPortalPage';
import { StudentPortalPage } from './pages/student/StudentPortalPage';

import { ForbiddenPage } from './pages/ForbiddenPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Root redirector based on authenticated user's role
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'VOLUNTEER') {
    return <Navigate to="/volunteer/portal" replace />;
  }

  if (user.role === 'STUDENT') {
    return <Navigate to="/student/portal" replace />;
  }

  return <Navigate to="/admin/workshops" replace />;
};

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Authenticated Protected Shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* ================= VOLUNTEER SINGLE PAGE ================= */}
        <Route
          path="/volunteer/portal"
          element={
            <RoleRoute allowedRoles={['VOLUNTEER']}>
              <VolunteerPortalPage />
            </RoleRoute>
          }
        />
        <Route path="/volunteer/workshop" element={<Navigate to="/volunteer/portal" replace />} />

        {/* ================= STUDENT SINGLE PAGE ================= */}
        <Route
          path="/student/portal"
          element={
            <RoleRoute allowedRoles={['STUDENT']}>
              <StudentPortalPage />
            </RoleRoute>
          }
        />
        <Route path="/student/dashboard" element={<Navigate to="/student/portal" replace />} />
        <Route path="/student/events" element={<Navigate to="/student/portal" replace />} />
        <Route path="/student/credits" element={<Navigate to="/student/portal" replace />} />
        <Route path="/student/leaderboard" element={<Navigate to="/student/portal" replace />} />
        <Route path="/student/rewards" element={<Navigate to="/student/portal" replace />} />

        {/* ================= EXACT SIX ADMIN & STAFF SCREENS ================= */}
        {/* Screen 1: Workshops List (Home) */}
        <Route
          path="/admin/workshops"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'EVENT_TEAM', 'FACULTY']}>
              <WorkshopsListPage />
            </RoleRoute>
          }
        />

        {/* Screen 2: Create Workshop */}
        <Route
          path="/admin/workshops/create"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <CreateWorkshopPage />
            </RoleRoute>
          }
        />

        {/* Screen 3: Workshop Setup (Volunteers & Students) */}
        <Route
          path="/admin/workshops/:id/setup"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <WorkshopSetupPage />
            </RoleRoute>
          }
        />

        {/* Screen 4: Workshop Console (Live Manage) */}
        <Route
          path="/admin/workshops/:id/console"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'EVENT_TEAM', 'FACULTY']}>
              <WorkshopConsolePage />
            </RoleRoute>
          }
        />

        {/* Screen 5: Leaderboards & Rankings */}
        <Route
          path="/admin/leaderboard"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'EVENT_TEAM', 'FACULTY']}>
              <AdminLeaderboardPage />
            </RoleRoute>
          }
        />

        {/* Screen 6: Goodie Tracking */}
        <Route
          path="/admin/goodies"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'EVENT_TEAM', 'FACULTY']}>
              <GoodieTrackingPage />
            </RoleRoute>
          }
        />
        <Route path="/admin/rewards" element={<Navigate to="/admin/goodies" replace />} />

        {/* Admin aliases for smooth backward navigation */}
        <Route path="/admin/dashboard" element={<Navigate to="/admin/workshops" replace />} />
        <Route path="/admin/events" element={<Navigate to="/admin/workshops" replace />} />
        <Route path="/admin/events/:id" element={<Navigate to="/admin/workshops" replace />} />

        {/* Common Authenticated Routes */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
