import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { User, UserRole } from '../types';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // New user form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('STUDENT');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { success, error } = useToast();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; users: User[] }>('/users');
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (err: any) {
      error('Failed to load users', err.response?.data?.error || 'Server error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name || !email || !password) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    try {
      setIsCreating(true);
      const res = await api.post<{ success: boolean; user: User }>('/users', {
        name,
        email,
        password,
        role,
        status: 'ACTIVE',
      });

      if (res.data.success) {
        success('User Created', `Account for ${name} (${role}) has been provisioned.`);
        setIsModalOpen(false);
        setName('');
        setEmail('');
        setPassword('');
        setRole('STUDENT');
        fetchUsers();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to create user account');
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleVariant = (userRole: string) => {
    switch (userRole) {
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
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Administer and provision accounts across NIAT Influencers Club."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Provision User
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="mt-3 text-xs text-gray-500">Fetching users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Users className="w-6 h-6 text-gray-400" />}
                title="No users found"
                description="No users have been registered yet."
                action={
                  <Button size="sm" onClick={() => setIsModalOpen(true)}>
                    Create First User
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleVariant(u.role)} size="sm">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === 'ACTIVE' ? 'green' : 'red'} size="sm" dot>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Provision User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision New User"
        description="Register an authorized member or administrator. Passwords will be securely hashed."
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <Input
            label="Full Name"
            placeholder="e.g. Rahul Sharma"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="e.g. rahul@influencex.niat.edu"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Initial Password"
            type="password"
            placeholder="Minimum 6 characters"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Select
            label="Assign Role"
            options={[
              { value: 'STUDENT', label: 'STUDENT (Club Member)' },
              { value: 'EVENT_TEAM', label: 'EVENT_TEAM (Coordinator)' },
              { value: 'FACULTY', label: 'FACULTY (Mentor / Advisor)' },
              { value: 'ADMIN', label: 'ADMIN (System Administrator)' },
            ]}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          />

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
