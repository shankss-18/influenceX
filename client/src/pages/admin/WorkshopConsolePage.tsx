import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  GraduationCap,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Lock,
  Download,
  Key,
  Shield,
  Layers,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EditWorkshopModal } from '../../components/workshop/EditWorkshopModal';
import { StudentDetailModal } from '../../components/student/StudentDetailModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { WorkshopSummary, WorkshopHall, ConsoleStudentRow } from '../../types/workshop';
import { formatDateTimeIST, formatDateIST } from '../../utils/date';

export const WorkshopConsolePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'volunteers' | 'students' | 'credits'>('overview');
  const [workshop, setWorkshop] = useState<WorkshopSummary | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [halls, setHalls] = useState<WorkshopHall[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [studentRoster, setStudentRoster] = useState<ConsoleStudentRow[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inspectStudentId, setInspectStudentId] = useState<string | null>(null);
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);

  // Search & Filters
  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Action Modals
  const [participationModalStudent, setParticipationModalStudent] = useState<ConsoleStudentRow | null>(null);
  const [participationAmount, setParticipationAmount] = useState<number>(10);
  const [participationReason, setParticipationReason] = useState<string>('Live interactive contribution');
  const [isAwardingPoints, setIsAwardingPoints] = useState<boolean>(false);

  const [transferModalStudent, setTransferModalStudent] = useState<ConsoleStudentRow | null>(null);
  const [targetTransferHall, setTargetTransferHall] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  const [endWorkshopModalOpen, setEndWorkshopModalOpen] = useState<boolean>(false);
  const [isEndingWorkshop, setIsEndingWorkshop] = useState<boolean>(false);

  // Edit / Delete / Revoke Workshop States
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeletingWorkshop, setIsDeletingWorkshop] = useState<boolean>(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState<boolean>(false);
  const [isRevokingRegCredits, setIsRevokingRegCredits] = useState<boolean>(false);

  const handleRevokeRegistrationCredits = async () => {
    try {
      setIsRevokingRegCredits(true);
      const res = await api.post<{ success: boolean; message: string }>(
        `/workshops/${id}/revoke-registration-credits`
      );
      if (res.data.success) {
        success('Credits Revoked', res.data.message);
        setRevokeModalOpen(false);
        fetchConsoleData(false);
      }
    } catch (err: any) {
      error('Revoke Error', err.response?.data?.error || 'Failed to revoke registration credits');
    } finally {
      setIsRevokingRegCredits(false);
    }
  };

  const fetchConsoleData = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      const res = await api.get<{
        success: boolean;
        workshop: WorkshopSummary;
        stats: any;
        halls: WorkshopHall[];
        volunteers: any[];
        studentRoster: ConsoleStudentRow[];
        ledger: any[];
      }>(`/workshops/${id}/console`);

      if (res.data.success) {
        setWorkshop(res.data.workshop);
        setStats(res.data.stats);
        setHalls(res.data.halls);
        setVolunteers(res.data.volunteers);
        setStudentRoster(res.data.studentRoster);
        setLedger(res.data.ledger);
      }
    } catch (err: any) {
      error('Console Load Error', err.response?.data?.error || 'Failed to load workshop console');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConsoleData(true);
  }, [id]);

  const handleMarkAttendance = async (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    const prevRoster = [...studentRoster];
    const prevStats = stats ? { ...stats } : null;

    // Optimistic UI update — instant response without page reload
    setStudentRoster((prev) =>
      prev.map((s) => {
        if (s.studentId === studentId) {
          const attCredit = status === 'PRESENT' ? 20 : 0;
          const partCredit = status === 'PRESENT' ? s.participationCredit : 0;
          const total = s.registrationCredit + attCredit + partCredit;
          return {
            ...s,
            attendanceStatus: status,
            attendanceCredit: attCredit,
            participationCredit: partCredit,
            totalWorkshopCredits: total,
            capRemaining: Math.max(0, (workshop?.creditCap || 50) - total),
          };
        }
        return s;
      })
    );

    // Optimistically update attendance statistics
    if (stats) {
      const target = studentRoster.find((s) => s.studentId === studentId);
      const wasPresent = target?.attendanceStatus === 'PRESENT';
      const isNowPresent = status === 'PRESENT';
      let newAttended = stats.attendedCount || 0;
      if (!wasPresent && isNowPresent) newAttended += 1;
      if (wasPresent && !isNowPresent) newAttended = Math.max(0, newAttended - 1);
      const totalStudents = studentRoster.length || 1;
      setStats({
        ...stats,
        attendedCount: newAttended,
        attendanceRate: Math.round((newAttended / totalStudents) * 100),
      });
    }

    try {
      setUpdatingStudentId(studentId);
      const res = await api.post<{ success: boolean; message: string }>(
        `/workshops/${id}/console/attendance`,
        { studentId, status }
      );
      if (res.data.success) {
        success('Attendance Recorded', res.data.message);
        // Silent background sync
        fetchConsoleData(false);
      }
    } catch (err: any) {
      // Revert on failure
      setStudentRoster(prevRoster);
      if (prevStats) setStats(prevStats);
      error('Attendance Error', err.response?.data?.error || 'Action failed');
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleAwardParticipation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participationModalStudent) return;

    try {
      setIsAwardingPoints(true);
      const res = await api.post<{ success: boolean; message: string }>(
        `/workshops/${id}/console/credits`,
        {
          studentId: participationModalStudent.studentId,
          amount: Number(participationAmount),
          reason: participationReason,
        }
      );
      if (res.data.success) {
        success('Credits Awarded', res.data.message);
        setParticipationModalStudent(null);
        fetchConsoleData();
      }
    } catch (err: any) {
      error('Award Error', err.response?.data?.error || 'Credit award failed');
    } finally {
      setIsAwardingPoints(false);
    }
  };

  const handleTransferStudent = async () => {
    if (!transferModalStudent || !targetTransferHall) return;

    try {
      setIsTransferring(true);
      const res = await api.post<{ success: boolean; message: string }>(
        `/workshops/${id}/console/reassign-student`,
        {
          studentId: transferModalStudent.studentId,
          targetHallName: targetTransferHall,
        }
      );
      if (res.data.success) {
        success('Transfer Complete', res.data.message);
        setTransferModalStudent(null);
        fetchConsoleData();
      }
    } catch (err: any) {
      error('Transfer Error', err.response?.data?.error || 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleReassignVolunteer = async (ixId: string, targetHallName: string) => {
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        `/workshops/${id}/console/reassign-volunteer`,
        { ixId, targetHallName }
      );
      if (res.data.success) {
        success('Volunteer Transferred', res.data.message);
        fetchConsoleData();
      }
    } catch (err: any) {
      error('Transfer Error', err.response?.data?.error || 'Failed to transfer volunteer');
    }
  };

  const handleEndWorkshop = async () => {
    try {
      setIsEndingWorkshop(true);
      const res = await api.post<{ success: boolean; message: string }>(
        `/workshops/${id}/console/end`
      );
      if (res.data.success) {
        success('Workshop Ended', res.data.message);
        setEndWorkshopModalOpen(false);
        fetchConsoleData();
      }
    } catch (err: any) {
      error('End Error', err.response?.data?.error || 'Failed to end workshop');
    } finally {
      setIsEndingWorkshop(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-3 text-xs text-gray-500">Loading Workshop Console...</p>
      </div>
    );
  }

  if (!workshop) return null;

  const isEnded = workshop.status === 'Ended' || workshop.rawStatus === 'Ended';
  const filteredStudents = studentRoster.filter((s) => {
    const matchesHall = selectedHallFilter === 'ALL' || s.hallName === selectedHallFilter;
    const matchesSearch =
      !searchQuery ||
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.influenceXId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.collegeStudentId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesHall && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Console Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/workshops')}
            className="text-gray-500 hover:text-gray-900 -ml-2 mb-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Workshops List
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{workshop.name}</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {workshop.eventId}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Live Console • Date: {formatDateIST(workshop.date)} ({workshop.startTime} — {workshop.endTime})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isEnded ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              <Lock className="w-3.5 h-3.5" />
              Workshop Ended &amp; Frozen
            </span>
          ) : stats?.windowOpen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Attendance Window Live
            </span>
          ) : stats?.windowClosed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              <Lock className="w-3.5 h-3.5" />
              Window Closed (Volunteers Locked)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              <Clock className="w-3.5 h-3.5" />
              Window Upcoming
            </span>
          )}

          {user?.role === 'ADMIN' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(true)}
                leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              >
                Edit Workshop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevokeModalOpen(true)}
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                leftIcon={<AlertCircle className="w-3.5 h-3.5" />}
              >
                Revoke Reg Credits (+10)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete
              </Button>
            </>
          )}

          {user?.role === 'ADMIN' && !isEnded && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEndWorkshopModalOpen(true)}
            >
              End Workshop
            </Button>
          )}

          {isEnded && (
            <Badge variant="gray" size="md">
              Workshop Ended & Frozen
            </Badge>
          )}
        </div>
      </div>

      {/* 4 Console Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview & Stats</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('volunteers')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'volunteers'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Halls & Volunteers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'students'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Students & Attendance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credits')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'credits'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Credits Ledger</span>
        </button>
      </div>

      {/* ================= TAB 1: OVERVIEW ================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-xs border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Students Attended</span>
                  <Users className="w-4 h-4 text-brand-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {stats?.attendedCount} <span className="text-xs font-normal text-gray-400">/ {stats?.totalStudents}</span>
                </div>
                <div className="text-xs text-emerald-600 font-semibold mt-1">
                  {stats?.attendanceRate}% Attendance Rate
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Credits Issued</span>
                  <Award className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold text-indigo-900 mt-2">
                  {stats?.creditsIssuedTotal} pts
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Cap: {stats?.creditCap} pts per student
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Halls Configured</span>
                  <Layers className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {halls.length} Halls
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Total Capacity: {workshop.capacity || workshop.totalCapacity} seats
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Volunteer Staff</span>
                  <Shield className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {volunteers.length} Active
                </div>
                <div className="text-xs text-emerald-700 font-semibold mt-1">
                  Scoped per hall
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Volunteer Login Activity Card */}
          <Card className="shadow-xs border-gray-200">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-sm font-bold">Volunteer Staff & Login Activity</CardTitle>
              <CardDescription className="text-xs">
                Real-time active volunteer monitoring across halls.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Volunteer</TableHead>
                    <TableHead>IXID</TableHead>
                    <TableHead>Assigned Hall</TableHead>
                    <TableHead>Last Active / Login</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volunteers.map((v) => (
                    <TableRow key={v.ixId || v.email}>
                      <TableCell className="font-semibold text-xs text-gray-900">{v.name}</TableCell>
                      <TableCell className="text-xs font-mono text-brand-700">{v.ixId}</TableCell>
                      <TableCell className="text-xs font-medium text-gray-700">{v.assignedHallName}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {v.lastLoginAt ? formatDateTimeIST(v.lastLoginAt) : 'Not logged in yet'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="green" size="sm">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= TAB 2: HALLS & VOLUNTEERS ================= */}
      {activeTab === 'volunteers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {halls.map((hall) => (
              <Card key={hall.name} className="shadow-xs border-gray-200">
                <CardHeader className="border-b border-gray-100 bg-surface/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold">{hall.name}</CardTitle>
                      <CardDescription className="text-xs">Capacity: {hall.capacity} seats</CardDescription>
                    </div>
                    <Badge variant="brand" size="sm">
                      {hall.assignedVolunteers?.length || 0} Volunteers
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {hall.assignedVolunteers && hall.assignedVolunteers.length > 0 ? (
                    hall.assignedVolunteers.map((vol) => (
                      <div
                        key={vol.ixId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 bg-white"
                      >
                        <div>
                          <div className="font-semibold text-xs text-gray-900">{vol.name}</div>
                          <div className="text-[11px] font-mono text-gray-500">{vol.ixId} • {vol.niatId || 'N/A'}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          {user?.role === 'ADMIN' && !isEnded && (
                            <select
                              value={hall.name}
                              onChange={(e) => handleReassignVolunteer(vol.ixId, e.target.value)}
                              className="text-xs rounded border border-gray-300 px-2 py-1 bg-white font-medium text-gray-800 focus:ring-1 focus:ring-brand-500"
                              title="Transfer volunteer to another hall in real-time"
                            >
                              {halls.map((h) => (
                                <option key={h.name} value={h.name}>
                                  {h.name === hall.name ? `Current: ${h.name}` : `Move to ${h.name}`}
                                </option>
                              ))}
                            </select>
                          )}
                          <Badge variant="green" size="sm">Staffing</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic">No volunteers assigned.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: STUDENTS & ATTENDANCE ================= */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-gray-200">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-64">
                <Input
                  placeholder="Search student name, IXID, Roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <select
                value={selectedHallFilter}
                onChange={(e) => setSelectedHallFilter(e.target.value)}
                className="text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white font-semibold text-gray-800"
              >
                <option value="ALL">All Halls ({studentRoster.length})</option>
                {halls.map((h) => (
                  <option key={h.name} value={h.name}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-gray-500 font-medium">
              Showing {filteredStudents.length} of {studentRoster.length} students
            </span>
          </div>

          {/* Students Table */}
          <Card className="shadow-xs border-gray-200 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>IXID</TableHead>
                    <TableHead>Hall</TableHead>
                    <TableHead>Attendance (+20)</TableHead>
                    <TableHead>Interaction Pts</TableHead>
                    <TableHead>Total / Cap (50)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((s) => (
                    <TableRow key={s.studentId || s.id}>
                      <TableCell>
                        <div className="font-semibold text-xs text-gray-900">{s.fullName}</div>
                        <div className="text-[10px] text-gray-400">{s.branch}</div>
                      </TableCell>

                      <TableCell className="text-xs font-mono">{s.influenceXId}</TableCell>

                      <TableCell>
                        <span className="font-bold text-xs text-brand-700">{s.hallName}</span>
                      </TableCell>

                      <TableCell>
                        <div className="inline-flex items-center rounded-xl p-1 bg-gray-100 border border-gray-200">
                          <button
                            type="button"
                            disabled={updatingStudentId === s.studentId || isEnded}
                            onClick={() => handleMarkAttendance(s.studentId, 'PRESENT')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                              isEnded
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                            } ${
                              s.attendanceStatus === 'PRESENT'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-gray-600 hover:text-emerald-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Present
                          </button>
                          <button
                            type="button"
                            disabled={updatingStudentId === s.studentId || isEnded}
                            onClick={() => handleMarkAttendance(s.studentId, 'ABSENT')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                              isEnded
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                            } ${
                              s.attendanceStatus === 'ABSENT'
                                ? 'bg-slate-700 text-white shadow-xs'
                                : 'text-gray-600 hover:text-red-700'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Absent
                          </button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs font-bold text-indigo-700">
                          +{s.participationCredit} pts
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs">
                          <span className="font-bold text-gray-900">
                            {s.totalWorkshopCredits} / {workshop.creditCap || 50} pts
                          </span>
                          <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-indigo-600 h-full"
                              style={{
                                width: `${Math.min(100, (s.totalWorkshopCredits / (workshop.creditCap || 50)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectStudentId(s.studentId || s.id)}
                            className="text-brand-600 hover:text-brand-800 hover:bg-brand-50 text-xs py-1 px-2 h-7"
                            title="Inspect complete history and credits breakdown"
                          >
                            Inspect
                          </Button>

                          {!isEnded && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={s.capRemaining <= 0}
                                onClick={() => setParticipationModalStudent(s)}
                                className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 text-xs py-1 px-2 h-7"
                              >
                                + Points
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTransferModalStudent(s);
                                  setTargetTransferHall(halls.find((h) => h.name !== s.hallName)?.name || halls[0]?.name || '');
                                }}
                                className="text-gray-500 hover:text-gray-900 text-xs py-1 px-2 h-7"
                              >
                                Transfer
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ================= TAB 4: CREDITS LEDGER ================= */}
      {activeTab === 'credits' && (
        <div className="space-y-6">
          <Card className="shadow-xs border-gray-200 overflow-hidden">
            <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Workshop Digital Ledger Entries</CardTitle>
                <CardDescription className="text-xs">
                  Immutable credit log scoped to this workshop with verified auditor tags.
                </CardDescription>
              </div>
              <Badge variant="brand" size="md">
                Total Credits Issued: {stats?.creditsIssuedTotal} pts
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Credit Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason / Notes</TableHead>
                    <TableHead>Verified By</TableHead>
                    <TableHead>Timestamp (IST)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((tx) => (
                    <TableRow key={tx.id || tx.transactionId}>
                      <TableCell className="text-xs font-mono font-bold text-gray-900">
                        {tx.transactionId}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs text-gray-900">
                          {tx.studentId?.fullName}
                        </div>
                        <div className="text-[10px] font-mono text-gray-500">
                          {tx.studentId?.influenceXId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="brand" size="sm">
                          {tx.creditType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-700">
                        +{tx.amount} pts
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                        {tx.reason}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {tx.awardedBy?.name || 'System Auto'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">
                        {formatDateTimeIST(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AWARD PARTICIPATION POINTS MODAL */}
      <Modal
        isOpen={!!participationModalStudent}
        onClose={() => setParticipationModalStudent(null)}
        title={`Award Participation Points — ${participationModalStudent?.fullName}`}
        description={`Remaining cap allowance: ${participationModalStudent?.capRemaining} pts (Max ${workshop.creditCap || 50} pts total)`}
        size="md"
      >
        <form onSubmit={handleAwardParticipation} className="space-y-4">
          <Input
            label="Points to Award"
            type="number"
            min={1}
            max={participationModalStudent?.capRemaining || 50}
            required
            value={participationAmount}
            onChange={(e) => setParticipationAmount(Number(e.target.value))}
          />

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Reason / Contribution Notes
            </label>
            <textarea
              rows={2}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-brand-500 outline-none"
              value={participationReason}
              onChange={(e) => setParticipationReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setParticipationModalStudent(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isAwardingPoints}
            >
              Award Points
            </Button>
          </div>
        </form>
      </Modal>

      {/* TRANSFER STUDENT HALL MODAL */}
      <Modal
        isOpen={!!transferModalStudent}
        onClose={() => setTransferModalStudent(null)}
        title={`Transfer Student — ${transferModalStudent?.fullName}`}
        description={`Current Hall: ${transferModalStudent?.hallName}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Target Hall
            </label>
            <select
              value={targetTransferHall}
              onChange={(e) => setTargetTransferHall(e.target.value)}
              className="w-full text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white font-medium text-gray-800 focus:ring-2 focus:ring-brand-500"
            >
              {halls.map((h) => (
                <option key={h.name} value={h.name}>
                  {h.name} (Capacity: {h.capacity})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setTransferModalStudent(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isTransferring}
              onClick={handleTransferStudent}
            >
              Confirm Transfer
            </Button>
          </div>
        </div>
      </Modal>

      {/* END WORKSHOP CONFIRMATION MODAL */}
      <Modal
        isOpen={endWorkshopModalOpen}
        onClose={() => setEndWorkshopModalOpen(false)}
        title="⚠️ End and Freeze Workshop"
        description="Are you sure you want to end this workshop? This action permanently freezes all further attendance marking and credit awards."
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Once ended, the digital ledger will be locked and finalized into the member statements.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEndWorkshopModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              isLoading={isEndingWorkshop}
              onClick={handleEndWorkshop}
            >
              Yes, End & Freeze Workshop
            </Button>
          </div>
        </div>
      </Modal>

      {/* EDIT WORKSHOP MODAL */}
      {isEditModalOpen && workshop && (
        <EditWorkshopModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          workshop={workshop}
          onUpdated={fetchConsoleData}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Workshop"
        description="Are you sure you want to permanently delete this workshop?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Deleting <span className="font-bold text-gray-900">{workshop?.name}</span> ({workshop?.eventId}) will remove all associated hall rosters and reset volunteer assignments.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white"
              isLoading={isDeletingWorkshop}
              onClick={async () => {
                try {
                  setIsDeletingWorkshop(true);
                  const res = await api.delete<{ success: boolean; message: string }>(
                    `/workshops/${id}`
                  );
                  if (res.data.success) {
                    success('Workshop Deleted', res.data.message);
                    navigate('/admin/workshops');
                  }
                } catch (err: any) {
                  error('Delete Error', err.response?.data?.error || 'Failed to delete workshop');
                } finally {
                  setIsDeletingWorkshop(false);
                }
              }}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* REVOKE REGISTRATION CREDITS CONFIRMATION MODAL */}
      <Modal
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
        title="Revoke Registration Credits (+10)"
        description="Remove auto-awarded +10 registration credits for all students placed in this workshop."
      >
        <div className="space-y-4 text-xs text-gray-700">
          <p className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-medium">
            ⚠️ This will delete all auto-awarded +10 registration credit transactions for this workshop and automatically recalculate total cumulative credit balances for affected students.
          </p>
          <div className="flex items-center justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setRevokeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              isLoading={isRevokingRegCredits}
              onClick={handleRevokeRegistrationCredits}
            >
              Confirm & Revoke Credits
            </Button>
          </div>
        </div>
      </Modal>

      {/* Student Inspection Modal */}
      <StudentDetailModal
        isOpen={Boolean(inspectStudentId)}
        studentId={inspectStudentId}
        onClose={() => setInspectStudentId(null)}
      />
    </div>
  );
};
