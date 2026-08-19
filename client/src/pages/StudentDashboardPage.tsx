import React from 'react';
import { Sparkles, Inbox } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

export const StudentDashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name || 'Student'}`}
        description="Your NIAT Influencers Club student engagement portal."
        badge={<Badge variant="gray">STUDENT</Badge>}
      />

      <EmptyState
        icon={<Inbox className="w-6 h-6 text-gray-400" />}
        title="Nothing here yet"
        description="Student engagement features, attendance tracking, and credit logs will be activated in upcoming phases."
        action={
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Phase 1: Authentication & Core Architecture Ready</span>
          </div>
        }
      />
    </div>
  );
};
