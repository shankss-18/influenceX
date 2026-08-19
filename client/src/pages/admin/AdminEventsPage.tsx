import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Plus,
  Search,
  Clock,
  MapPin,
  Users,
  Eye,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Download,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { EventItem, EventCategory, EventStatus } from '../../types';
import { formatDateTimeIST, formatDateIST, toDatetimeLocalValue } from '../../utils/date';

export const AdminEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [serverTimeIST, setServerTimeIST] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00 AM',
    endTime: '01:00 PM',
    venue: '',
    capacity: 60,
    registrationStart: toDatetimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    registrationEnd: toDatetimeLocalValue(new Date(Date.now() + 48 * 60 * 60 * 1000)),
    attendanceWindowStart: toDatetimeLocalValue(new Date(Date.now() + 72 * 60 * 60 * 1000)),
    attendanceWindowEnd: toDatetimeLocalValue(new Date(Date.now() + 76 * 60 * 60 * 1000)),
    creditWindowStart: toDatetimeLocalValue(new Date(Date.now() + 76 * 60 * 60 * 1000)),
    creditWindowEnd: toDatetimeLocalValue(new Date(Date.now() + 120 * 60 * 60 * 1000)),
    status: 'OPEN' as EventStatus,
  });

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (search) params.search = search;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (statusFilter) params.status = statusFilter;

      const [eventsRes, catRes, timeRes] = await Promise.all([
        api.get<{ success: boolean; events: EventItem[]; serverTimeIST: string }>('/events', { params }),
        api.get<{ success: boolean; categories: EventCategory[] }>('/event-categories?all=true'),
        api.get<{ success: boolean; serverTimeIST: string }>('/time'),
      ]);

      if (eventsRes.data.success) {
        setEvents(eventsRes.data.events);
      }
      if (catRes.data.success) {
        setCategories(catRes.data.categories);
        if (!formData.categoryId && catRes.data.categories.length > 0) {
          setFormData((prev) => ({ ...prev, categoryId: catRes.data.categories[0].id }));
        }
      }
      if (timeRes.data.success) {
        setServerTimeIST(timeRes.data.serverTimeIST);
      }
    } catch (err: any) {
      error('Failed to load events', err.response?.data?.error || 'Server error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [categoryFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormError(null);
    const now = new Date();
    setFormData({
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startTime: '10:00 AM',
      endTime: '01:00 PM',
      venue: '',
      capacity: 60,
      registrationStart: toDatetimeLocalValue(now),
      registrationEnd: toDatetimeLocalValue(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)),
      attendanceWindowStart: toDatetimeLocalValue(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)),
      attendanceWindowEnd: toDatetimeLocalValue(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 4 * 3600000)),
      creditWindowStart: toDatetimeLocalValue(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 4 * 3600000)),
      creditWindowEnd: toDatetimeLocalValue(new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)),
      status: 'OPEN',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (event: EventItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setFormError(null);
    const catId = typeof event.categoryId === 'string' ? event.categoryId : event.categoryId?.id;
    setFormData({
      name: event.name,
      description: event.description,
      categoryId: catId,
      date: new Date(event.date).toISOString().split('T')[0],
      startTime: event.startTime,
      endTime: event.endTime,
      venue: event.venue,
      capacity: event.capacity,
      registrationStart: toDatetimeLocalValue(event.registrationStart),
      registrationEnd: toDatetimeLocalValue(event.registrationEnd),
      attendanceWindowStart: toDatetimeLocalValue(event.attendanceWindowStart),
      attendanceWindowEnd: toDatetimeLocalValue(event.attendanceWindowEnd),
      creditWindowStart: toDatetimeLocalValue(event.creditWindowStart),
      creditWindowEnd: toDatetimeLocalValue(event.creditWindowEnd),
      status: event.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name || !formData.categoryId || !formData.venue) {
      setFormError('Please fill out all required fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingEvent) {
        const res = await api.patch<{ success: boolean; event: EventItem }>(
          `/events/${editingEvent.id}`,
          formData
        );
        if (res.data.success) {
          success('Event Updated', `Event '${res.data.event.name}' has been updated.`);
          setIsModalOpen(false);
          fetchEvents();
        }
      } else {
        const res = await api.post<{ success: boolean; event: EventItem }>('/events', formData);
        if (res.data.success) {
          success('Event Created', `Created event ${res.data.event.eventId}`);
          setIsModalOpen(false);
          fetchEvents();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWindowBadge = (windowName: string, windowData?: { status: string; isOpen: boolean }) => {
    if (!windowData) return null;
    const { status } = windowData;
    if (status === 'OPEN') {
      return (
        <Badge variant="green" size="sm" dot>
          {windowName} OPEN
        </Badge>
      );
    }
    if (status === 'NOT_STARTED') {
      return (
        <Badge variant="amber" size="sm">
          {windowName} UPCOMING
        </Badge>
      );
    }
    return (
      <Badge variant="gray" size="sm">
        {windowName} CLOSED
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events & Workshops"
        description="Configure activities, capacities, and server-synced time-window intervals."
        badge={
          serverTimeIST ? (
            <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
              Server Clock (IST): {serverTimeIST}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open('/api/events/export', '_blank')}
              leftIcon={<Download className="w-4 h-4 text-emerald-600" />}
              title="Download events catalog as Excel spreadsheet"
            >
              Export Events (.xlsx)
            </Button>
            {user?.role === 'ADMIN' && (
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create Workshop
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Search Event ID, Name, Venue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
            <Select
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <Select
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'OPEN', label: 'OPEN' },
                { value: 'DRAFT', label: 'DRAFT' },
                { value: 'ONGOING', label: 'ONGOING' },
                { value: 'COMPLETED', label: 'COMPLETED' },
                { value: 'ARCHIVED', label: 'ARCHIVED' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="mt-3 text-xs text-gray-500">Querying events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Calendar className="w-6 h-6 text-gray-400" />}
                title="No events found"
                description="No events found matching your criteria. Create an event to begin."
                action={
                  <Button size="sm" onClick={openCreateModal}>
                    Create First Event
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event ID & Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date & Time (IST)</TableHead>
                  <TableHead>Venue & Spots</TableHead>
                  <TableHead>Live Window Statuses (Server-Synced)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const catName =
                    typeof event.categoryId === 'string'
                      ? 'Category'
                      : event.categoryId?.name || 'General';

                  return (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer hover:bg-gray-50/80"
                      onClick={() => navigate(`/admin/events/${event.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-mono text-xs font-semibold text-brand-700">
                            {event.eventId}
                          </div>
                          <div className="font-medium text-gray-900 mt-0.5">{event.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="gray" size="sm">
                          {catName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-900 font-medium">
                          {formatDateIST(event.date)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {event.startTime} - {event.endTime}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-900">{event.venue}</div>
                        <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                          {event.registeredCount} / {event.capacity} registered
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getWindowBadge('Reg:', event.windowStatuses?.registration)}
                          {getWindowBadge('Att:', event.windowStatuses?.attendance)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {user?.role === 'ADMIN' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => openEditModal(event, e)}
                              className="text-gray-500 hover:text-brand-600 py-1 px-2 h-7"
                              title="Edit Event & Windows"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/events/${event.id}`)}
                            className="text-gray-500 hover:text-brand-600 py-1 px-2 h-7"
                            title="View Event Details & Manage"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Event Modal with Window Configuration */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEvent ? `Edit Event — ${editingEvent.eventId}` : 'Create New Event'}
        description="Configure event parameters, capacities, and server-side evaluation windows."
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {formError}
            </div>
          )}

          {/* Section 1: Basic Event Metadata */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-1.5">
              1. Event Overview
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Event Name"
                  required
                  placeholder="e.g. Prompt Engineering Masterclass"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <Select
                label="Category"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              />
            </div>

            <Input
              label="Description"
              required
              placeholder="Detailed description of objectives, prerequisites, and agenda"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Input
                label="Event Date"
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
              <Input
                label="Start Time"
                placeholder="10:00 AM"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
              <Input
                label="End Time"
                placeholder="01:00 PM"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
              <Input
                label="Max Capacity"
                type="number"
                min="1"
                required
                value={String(formData.capacity)}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Venue / Hall"
                required
                placeholder="Auditorium Hall B / Lab 4"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              />
              <Select
                label="Event Status"
                options={[
                  { value: 'OPEN', label: 'OPEN (Active Registration)' },
                  { value: 'DRAFT', label: 'DRAFT (Unpublished)' },
                  { value: 'ONGOING', label: 'ONGOING (Event in Progress)' },
                  { value: 'COMPLETED', label: 'COMPLETED' },
                  { value: 'ARCHIVED', label: 'ARCHIVED' },
                ]}
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
              />
            </div>
          </div>

          {/* Section 2: Visual Time-Window Configuration */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                2. Server-Enforced Time Windows
              </h4>
              <span className="text-[11px] text-gray-400">Times evaluated strictly in Asia/Kolkata</span>
            </div>

            {/* Registration Window */}
            <div className="p-3.5 rounded-lg border border-gray-200 bg-surface/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-600" />
                  Registration Window
                </span>
                <span className="text-[11px] text-gray-500">Student self-registration allowed strictly between</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Registration Opens"
                  type="datetime-local"
                  required
                  value={formData.registrationStart}
                  onChange={(e) => setFormData({ ...formData, registrationStart: e.target.value })}
                />
                <Input
                  label="Registration Closes"
                  type="datetime-local"
                  required
                  value={formData.registrationEnd}
                  onChange={(e) => setFormData({ ...formData, registrationEnd: e.target.value })}
                />
              </div>
            </div>

            {/* Attendance Window */}
            <div className="p-3.5 rounded-lg border border-gray-200 bg-surface/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Attendance Window
                </span>
                <span className="text-[11px] text-gray-500">QR / Manual attendance check-in window (Phase 3)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Attendance Window Start"
                  type="datetime-local"
                  required
                  value={formData.attendanceWindowStart}
                  onChange={(e) => setFormData({ ...formData, attendanceWindowStart: e.target.value })}
                />
                <Input
                  label="Attendance Window End"
                  type="datetime-local"
                  required
                  value={formData.attendanceWindowEnd}
                  onChange={(e) => setFormData({ ...formData, attendanceWindowEnd: e.target.value })}
                />
              </div>
            </div>

            {/* Interaction / Credit Window */}
            <div className="p-3.5 rounded-lg border border-gray-200 bg-surface/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Interaction & Credit Marking Window
                </span>
                <span className="text-[11px] text-gray-500">Live variable interaction points and ledger award window</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Interaction Window Start"
                  type="datetime-local"
                  required
                  value={formData.creditWindowStart}
                  onChange={(e) => setFormData({ ...formData, creditWindowStart: e.target.value })}
                />
                <Input
                  label="Interaction Window End"
                  type="datetime-local"
                  required
                  value={formData.creditWindowEnd}
                  onChange={(e) => setFormData({ ...formData, creditWindowEnd: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingEvent ? 'Update Event & Windows' : 'Publish Event'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
