import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Calendar,
  Users,
  Shield,
  Layers,
  Award,
  ArrowRight,
  Clock,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EditWorkshopModal } from '../../components/workshop/EditWorkshopModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { WorkshopSummary, WorkshopStatus } from '../../types/workshop';
import { formatDateIST } from '../../utils/date';

export const WorkshopsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit / Delete states
  const [editingWorkshop, setEditingWorkshop] = useState<any | null>(null);
  const [deleteTargetWorkshop, setDeleteTargetWorkshop] = useState<WorkshopSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchWorkshops = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; workshops: WorkshopSummary[] }>('/workshops');
      if (res.data.success) {
        setWorkshops(res.data.workshops);
      }
    } catch (err) {
      console.error('Failed to load workshops:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const getStatusBadge = (status: WorkshopStatus) => {
    switch (status) {
      case 'Live':
        return <Badge variant="brand" size="sm">Live</Badge>;
      case 'Setup Pending':
        return <Badge variant="amber" size="sm">Setup Pending</Badge>;
      case 'Ready':
        return <Badge variant="brand" size="sm">Ready</Badge>;
      case 'Attendance Open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Attendance Open
          </span>
        );
      case 'Attendance Closed':
        return <Badge variant="red" size="sm">Attendance Closed</Badge>;
      case 'Ended':
        return <Badge variant="gray" size="sm">Ended</Badge>;
      default:
        return <Badge variant="gray" size="sm">{status}</Badge>;
    }
  };

  const handleRowClick = (workshop: WorkshopSummary) => {
    if (workshop.status === 'Live' || workshop.status === 'Setup Pending') {
      navigate(`/admin/workshops/${workshop.id}/setup`);
    } else {
      navigate(`/admin/workshops/${workshop.id}/console`);
    }
  };

  const handleOpenEdit = async (e: React.MouseEvent, workshopId: string) => {
    e.stopPropagation();
    try {
      const res = await api.get<{ success: boolean; workshop: any }>(`/workshops/${workshopId}/setup`);
      if (res.data.success) {
        setEditingWorkshop(res.data.workshop);
      }
    } catch (err) {
      error('Error', 'Failed to load workshop for editing');
    }
  };

  const handleDeleteWorkshop = async () => {
    if (!deleteTargetWorkshop) return;
    try {
      setIsDeleting(true);
      const res = await api.delete<{ success: boolean; message: string }>(
        `/workshops/${deleteTargetWorkshop.id}`
      );
      if (res.data.success) {
        success('Workshop Deleted', res.data.message);
        setDeleteTargetWorkshop(null);
        fetchWorkshops();
      }
    } catch (err: any) {
      error('Delete Error', err.response?.data?.error || 'Failed to delete workshop');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Workshops</h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage club workshops, volunteer staffing, attendance evaluation, and credit distributions.
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/admin/workshops/create')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Workshop
          </Button>
        )}
      </div>

      {/* Flat Workshops Table */}
      <Card className="shadow-xs border-gray-200 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="mt-3 text-xs text-gray-500">Loading workshops...</p>
            </div>
          ) : workshops.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto" />
              <h3 className="text-sm font-bold text-gray-900">No Workshops Created Yet</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Get started by creating your first workshop to setup halls, volunteers, and student rosters.
              </p>
              {user?.role === 'ADMIN' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/admin/workshops/create')}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Create First Workshop
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workshop Name</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Halls</TableHead>
                  <TableHead>Students / Capacity</TableHead>
                  <TableHead>Volunteers</TableHead>
                  <TableHead>Credits Issued</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workshops.map((w) => (
                  <TableRow
                    key={w.id}
                    onClick={() => handleRowClick(w)}
                    className="cursor-pointer hover:bg-brand-50/30 transition-colors"
                  >
                    <TableCell>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                          <span>{w.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-normal">
                            {w.eventId}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{w.description}</p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <div className="font-medium text-gray-900">{formatDateIST(w.date)}</div>
                        <div className="text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{w.startTime} — {w.endTime}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>{getStatusBadge(w.status)}</TableCell>

                    <TableCell>
                      <div className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-gray-400" />
                        <span>{w.hallsCount} Hall{w.hallsCount !== 1 ? 's' : ''}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <div className="font-semibold text-gray-900">
                          {w.studentsAssigned} / {w.totalCapacity}
                        </div>
                        <div className="w-20 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-brand-600 h-full"
                            style={{
                              width: `${Math.min(100, (w.studentsAssigned / (w.totalCapacity || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs">
                        <div className="font-semibold text-gray-900">
                          {w.volunteersAssigned} Assigned
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{w.creditsIssuedSoFar} pts</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {user?.role === 'ADMIN' && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(e, w.id)}
                              title="Edit Workshop Details"
                              className="p-1 rounded text-gray-400 hover:text-brand-600 hover:bg-gray-100 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTargetWorkshop(w);
                              }}
                              title="Delete Workshop"
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRowClick(w)}
                          className="text-xs text-brand-600 font-semibold py-1 px-2 h-7"
                          rightIcon={<ArrowRight className="w-3 h-3" />}
                        >
                          {w.status === 'Live' || w.status === 'Setup Pending' ? 'Setup' : 'Console'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* EDIT WORKSHOP MODAL */}
      {editingWorkshop && (
        <EditWorkshopModal
          isOpen={!!editingWorkshop}
          onClose={() => setEditingWorkshop(null)}
          workshop={editingWorkshop}
          onUpdated={fetchWorkshops}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deleteTargetWorkshop}
        onClose={() => setDeleteTargetWorkshop(null)}
        title="Delete Workshop"
        description="Are you sure you want to permanently delete this workshop?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Deleting <span className="font-bold text-gray-900">{deleteTargetWorkshop?.name}</span> ({deleteTargetWorkshop?.eventId}) will remove all associated hall rosters and reset volunteer assignments.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDeleteTargetWorkshop(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteWorkshop}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
