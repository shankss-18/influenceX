import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Shield, Eye, Calendar, ArrowLeft, ArrowRight, UserCheck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { formatDateTimeIST } from '../utils/date';

export const AdminAuditLogsPage: React.FC = () => {
  const { error } = useToast();

  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (actionFilter) params.append('action', actionFilter);
      if (roleFilter) params.append('actorRole', roleFilter);
      if (targetTypeFilter) params.append('targetType', targetTypeFilter);

      const res = await api.get<{
        success: boolean;
        logs: any[];
        pagination: any;
      }>(`/audit-logs?${params.toString()}`);

      if (res.data.success) {
        setLogs(res.data.logs);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      error('Failed to load audit logs', err.response?.data?.error || 'Unable to fetch audit log stream');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter, roleFilter, targetTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const getActionBadgeVariant = (action: string): 'brand' | 'green' | 'amber' | 'red' | 'gray' => {
    if (action.includes('CREATED') || action.includes('APPROVED') || action.includes('SUCCESS') || action.includes('DISTRIBUTED')) {
      return 'green';
    }
    if (action.includes('PENDING') || action.includes('REQUESTED') || action.includes('UPDATED')) {
      return 'amber';
    }
    if (action.includes('FORBIDDEN') || action.includes('FAILED') || action.includes('REJECTED') || action.includes('DISABLED')) {
      return 'red';
    }
    return 'brand';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Security & Audit Stream"
        description="Immutable, append-only system activity log capturing every mutation, approval, and administrative action."
      />

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="Search reason, action, or target ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-gray-400" />}
              />
            </div>

            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: '', label: 'All Roles' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'EVENT_TEAM', label: 'Event Team' },
                { value: 'FACULTY', label: 'Faculty' },
                { value: 'STUDENT', label: 'Student' },
                { value: 'SYSTEM_SEED', label: 'System Seed' },
              ]}
            />

            <Select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              options={[
                { value: '', label: 'All Target Types' },
                { value: 'CREDIT_TRANSACTION', label: 'Credit Transaction' },
                { value: 'ATTENDANCE', label: 'Attendance' },
                { value: 'EVENT', label: 'Event' },
                { value: 'STUDENT', label: 'Student' },
                { value: 'REWARD_CLAIM', label: 'Reward Claim' },
                { value: 'USER', label: 'User' },
              ]}
            />

            <Button type="submit" variant="primary" size="sm" className="w-full">
              Filter Audit Stream
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-16 text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-3 text-xs text-gray-500">Querying append-only audit stream...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<History className="w-6 h-6 text-gray-400" />}
                title="No audit log records match your filter"
                description="System activities and data mutations are logged continuously."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp (IST)</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor & Role</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason / Notes</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-gray-500 font-mono whitespace-nowrap">
                      {formatDateTimeIST(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)} size="sm">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-gray-900">{log.actor?.name || 'System / Auto'}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{log.actorRole}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-brand-700">{log.targetType}</div>
                      <div className="text-[11px] text-gray-400 font-mono truncate max-w-[120px]">{log.targetId}</div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-sm truncate">
                      {log.reason}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 px-2 text-gray-600 hover:text-brand-600 text-xs"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLogs(pagination.page - 1)}
                  leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchLogs(pagination.page + 1)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Record: ${selectedLog.action}`}
          description={`Logged on ${formatDateTimeIST(selectedLog.createdAt)}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <span className="text-gray-500 block">Actor</span>
                <span className="font-bold text-gray-900">{selectedLog.actor?.name || 'System / Cron'}</span>
                <span className="text-gray-500 block text-[11px]">{selectedLog.actor?.email} ({selectedLog.actorRole})</span>
              </div>
              <div>
                <span className="text-gray-500 block">Target Entity</span>
                <span className="font-mono font-bold text-brand-700">{selectedLog.targetType}</span>
                <span className="font-mono text-gray-500 block text-[11px] truncate">{selectedLog.targetId}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Client IP Address</span>
                <span className="font-mono text-gray-700">{selectedLog.ipAddress || '127.0.0.1'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">User Agent</span>
                <span className="text-gray-700 truncate block text-[11px]">{selectedLog.userAgent || 'API/Browser'}</span>
              </div>
            </div>

            <div>
              <span className="font-semibold text-gray-700 block mb-1">Reason / Change Note</span>
              <div className="p-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-medium">
                {selectedLog.reason}
              </div>
            </div>

            {selectedLog.afterValue && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Snapshot State</span>
                <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.afterValue, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-3 flex justify-end border-t border-gray-100">
              <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                Close Record
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
