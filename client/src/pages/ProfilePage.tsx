import React from 'react';
import { User, ShieldCheck, Mail, Calendar, KeyRound } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

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

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="User Profile"
        description="View your authenticated credentials and platform authorization details."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1 text-center p-6 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-brand-50 border-2 border-brand-200 flex items-center justify-center text-2xl font-bold text-brand-700 mb-4">
            {user?.name
              ? user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : 'U'}
          </div>
          <h3 className="text-base font-bold text-gray-900">{user?.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
              {user?.role}
            </Badge>
            <Badge variant={user?.status === 'ACTIVE' ? 'green' : 'red'} size="sm" dot>
              {user?.status}
            </Badge>
          </div>
        </Card>

        {/* Details Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>System metadata and access level attributes</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-gray-100 p-0">
            <div className="px-6 py-3.5 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 text-gray-500 font-medium">
                <User className="w-4 h-4 text-gray-400" />
                <span>Account Identifier</span>
              </div>
              <span className="font-mono text-xs text-gray-900 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                {user?.id}
              </span>
            </div>

            <div className="px-6 py-3.5 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 text-gray-500 font-medium">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>Primary Email</span>
              </div>
              <span className="text-gray-900 font-medium">{user?.email}</span>
            </div>

            <div className="px-6 py-3.5 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 text-gray-500 font-medium">
                <KeyRound className="w-4 h-4 text-gray-400" />
                <span>Authorization Role</span>
              </div>
              <span className="text-gray-900 font-medium">{user?.role}</span>
            </div>

            <div className="px-6 py-3.5 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 text-gray-500 font-medium">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>Account Registered</span>
              </div>
              <span className="text-gray-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>

            <div className="px-6 py-3.5 flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 text-gray-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                <span>Last Session Login</span>
              </div>
              <span className="text-gray-900">
                {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Current Session'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
