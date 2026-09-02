import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Layers,
  CheckCircle2,
  AlertCircle,
  Upload,
  Download,
  FileSpreadsheet,
  Search,
  Check,
  X,
  AlertTriangle,
  FileText,
  HelpCircle,
  History,
  UserCheck,
  Award,
  Sparkles,
  Plus,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
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
import {
  EventItem,
  EventRosterItem,
  ExcelImport,
  ImportPreview,
  AttendanceStatus,
  CreditTransaction,
  CreditRule,
} from '../../types';
import { formatDateTimeIST, formatDateIST } from '../../utils/date';

type EventTabKey =
  | 'overview'
  | 'participants'
  | 'attendance'
  | 'participation'
  | 'credits'
  | 'rewards'
  | 'analytics'
  | 'export';

export const AdminEventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [roster, setRoster] = useState<EventRosterItem[]>([]);
  const [stats, setStats] = useState({
    totalRegistrants: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    excusedCount: 0,
    unmarkedCount: 0,
    correctionPendingCount: 0,
  });
  const [isAttendanceWindowOpen, setIsAttendanceWindowOpen] = useState<boolean>(false);
  const [imports, setImports] = useState<ExcelImport[]>([]);
  const [eventCredits, setEventCredits] = useState<CreditTransaction[]>([]);
  const [creditRules, setCreditRules] = useState<CreditRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<EventTabKey>('overview');

  // Search & Filter State in Attendance & Participation
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Excel Upload & Preview State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  // Attendance Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState<boolean>(false);
  const [selectedStudentForCorrection, setSelectedStudentForCorrection] = useState<any>(null);
  const [requestedStatus, setRequestedStatus] = useState<AttendanceStatus>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState<boolean>(false);

  // Bulk Credit Wizard State
  const [bulkCreditModalOpen, setBulkCreditModalOpen] = useState<boolean>(false);
  const [selectedCreditType, setSelectedCreditType] = useState<string>('PARTICIPATION');
  const [customCreditAmount, setCustomCreditAmount] = useState<number>(15);
  const [creditReason, setCreditReason] = useState<string>('Active engagement during workshop session');
  const [selectedStudentIdsForCredits, setSelectedStudentIdsForCredits] = useState<string[]>([]);
  const [isAwardingCredits, setIsAwardingCredits] = useState<boolean>(false);

  // Fetch Event Data, Roster & Credits
  const fetchEventData = async () => {
    try {
      setIsLoading(true);
      const [eventRes, attendanceRes, importsRes, creditsRes, rulesRes] = await Promise.all([
        api.get<{ success: boolean; event: EventItem }>(`/events/${id}`),
        api.get<{
          success: boolean;
          roster: EventRosterItem[];
          stats: any;
          event: any;
        }>(`/events/${id}/attendance`),
        api.get<{ success: boolean; imports: ExcelImport[] }>(`/events/${id}/imports`),
        api.get<{ success: boolean; transactions: CreditTransaction[] }>(`/events/${id}/credits`),
        api.get<{ success: boolean; rules: CreditRule[] }>('/credit-rules'),
      ]);

      if (eventRes.data.success) setEvent(eventRes.data.event);
      if (attendanceRes.data.success) {
        setRoster(attendanceRes.data.roster);
        setStats(attendanceRes.data.stats);
        setIsAttendanceWindowOpen(attendanceRes.data.event.isAttendanceWindowOpen);
      }
      if (importsRes.data.success) setImports(importsRes.data.imports);
      if (creditsRes.data.success) setEventCredits(creditsRes.data.transactions);
      if (rulesRes.data.success) setCreditRules(rulesRes.data.rules);
    } catch (err: any) {
      error('Failed to load event details', err.response?.data?.error || 'Event not found');
      navigate('/admin/events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [id]);

  // Excel File Upload for Dry-Run Preview
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const res = await api.post<{ success: boolean; preview: ImportPreview }>(
        `/events/${id}/import/preview`,
        formData
      );

      if (res.data.success) {
        setImportPreview(res.data.preview);
        info('Preview Ready', `Parsed ${res.data.preview.totalRows} rows. Review results below.`);
      }
    } catch (err: any) {
      error('Upload Failed', err.response?.data?.error || 'Failed to parse Excel file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Commit Valid Rows
  const handleCommitImport = async () => {
    if (!importPreview) return;

    try {
      setIsCommitting(true);
      const validStudentIds = importPreview.validRows.map((r) => r.studentId);

      const res = await api.post<{
        success: boolean;
        message: string;
        importRecord: ExcelImport;
      }>(`/events/${id}/import/commit`, {
        tempFilePath: importPreview.tempFilePath,
        originalFileName: importPreview.originalFileName,
        fileSize: importPreview.fileSize,
        totalRows: importPreview.totalRows,
        validStudentIds,
        errors: importPreview.errors,
      });

      if (res.data.success) {
        success('Import Complete', res.data.message);
        setImportPreview(null);
        fetchEventData();
      }
    } catch (err: any) {
      error('Import Commit Failed', err.response?.data?.error || 'Database write error');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDownloadErrors = (importId: string) => {
    window.open(`/api/events/${id}/imports/${importId}/errors`, '_blank');
  };

  // Mark Attendance
  const handleMarkAttendance = async (studentId: string, status: AttendanceStatus) => {
    try {
      const res = await api.post(`/events/${id}/attendance`, { studentId, status });
      if (res.data.success) {
        success('Attendance Recorded', res.data.message);
        setRoster((prev) =>
          prev.map((item) =>
            item.student.id === studentId
              ? {
                  ...item,
                  attendance: {
                    ...(item.attendance || ({} as any)),
                    status,
                    correctionStatus: 'NONE',
                  },
                }
              : item
          )
        );
        fetchEventData();
      }
    } catch (err: any) {
      error('Attendance Error', err.response?.data?.error || 'Window closed or unpermitted');
      fetchEventData();
    }
  };

  // Submit Correction Request
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForCorrection || !correctionReason.trim()) return;

    try {
      setIsSubmittingCorrection(true);
      const res = await api.post(`/events/${id}/attendance/correction-request`, {
        studentId: selectedStudentForCorrection.id,
        requestedStatus,
        reason: correctionReason,
      });

      if (res.data.success) {
        success('Correction Submitted', 'Your request has been logged for admin review.');
        setCorrectionModalOpen(false);
        setCorrectionReason('');
        fetchEventData();
      }
    } catch (err: any) {
      error('Submission Failed', err.response?.data?.error || 'Unable to submit correction');
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // Approve Attendance Correction
  const handleApproveCorrection = async (attendanceId: string, approved: boolean) => {
    try {
      const res = await api.post(`/events/${id}/attendance/${attendanceId}/approve-correction`, {
        approved,
        notes: approved ? 'Approved by Admin' : 'Rejected by Admin',
      });
      if (res.data.success) {
        success('Correction Handled', res.data.message);
        fetchEventData();
      }
    } catch (err: any) {
      error('Action Failed', err.response?.data?.error || 'Could not approve correction');
    }
  };

  // Toggle Participation
  const handleToggleParticipation = async (studentId: string, participated: boolean) => {
    try {
      const res = await api.post(`/events/${id}/participation`, {
        studentId,
        participated,
      });
      if (res.data.success) {
        setRoster((prev) =>
          prev.map((item) =>
            item.student.id === studentId
              ? {
                  ...item,
                  participation: {
                    ...(item.participation || ({} as any)),
                    participated,
                  },
                }
              : item
          )
        );
      }
    } catch (err: any) {
      error('Participation Error', err.response?.data?.error || 'Student must be marked PRESENT first.');
      fetchEventData();
    }
  };

  // Bulk Award Credits Action
  const handleBulkAwardCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIdsForCredits.length === 0) {
      error('Selection Required', 'Please select at least one student.');
      return;
    }

    try {
      setIsAwardingCredits(true);
      const res = await api.post<{
        success: boolean;
        message: string;
        count: number;
        totalCreditsAwarded: number;
      }>(`/events/${id}/credits/bulk`, {
        eventId: id,
        creditType: selectedCreditType,
        amount: customCreditAmount,
        reason: creditReason,
        studentIds: selectedStudentIdsForCredits,
      });

      if (res.data.success) {
        success('Credits Awarded', res.data.message);
        setBulkCreditModalOpen(false);
        setSelectedStudentIdsForCredits([]);
        fetchEventData();
      }
    } catch (err: any) {
      error('Awarding Failed', err.response?.data?.error || 'Unable to award credits');
    } finally {
      setIsAwardingCredits(false);
    }
  };

  const handleExportAttendance = () => {
    window.open(`/api/events/${id}/attendance/export`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-xs font-medium text-gray-500">Loading event and digital ledger engine...</p>
      </div>
    );
  }

  if (!event) return null;

  const catName =
    typeof event.categoryId === 'string'
      ? 'Category'
      : event.categoryId?.name || 'General';

  const filteredRoster = roster.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.student.fullName.toLowerCase().includes(q) ||
      item.student.collegeStudentId.toLowerCase().includes(q) ||
      item.student.influenceXId.toLowerCase().includes(q) ||
      item.student.collegeEmail.toLowerCase().includes(q)
    );
  });

  const presentStudents = roster.filter((item) => item.attendance?.status === 'PRESENT');

  const tabs: { key: EventTabKey; label: string }[] = [
    { key: 'overview', label: 'Overview & Windows' },
    { key: 'participants', label: `Participants & Excel (${roster.length})` },
    { key: 'attendance', label: `Attendance (${stats.presentCount}/${roster.length})` },
    { key: 'participation', label: `Participation (${presentStudents.length})` },
    { key: 'credits', label: `Credit Ledger (${eventCredits.length})` },
    { key: 'rewards', label: 'Rewards' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'export', label: 'Export' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/events')}
          className="text-gray-500 hover:text-gray-900 mb-3 -ml-2"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Events List
        </Button>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                {event.eventId}
              </span>
              <Badge variant="gray" size="sm">
                {catName}
              </Badge>
              <Badge variant={event.status === 'OPEN' ? 'green' : 'amber'} size="sm" dot>
                {event.status}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-2">{event.name}</h1>
            <p className="text-xs text-gray-500 mt-1 max-w-3xl leading-relaxed">
              {event.description}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportAttendance}
              leftIcon={<Download className="w-4 h-4 text-emerald-600" />}
              title="Download structured Excel sheet"
            >
              Export Attendance (.xlsx)
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Schedule & Venue Metadata</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100 p-0">
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Event Date</span>
                <span className="text-gray-900 font-medium">{formatDateIST(event.date)}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Timing</span>
                <span className="text-gray-900">{event.startTime} - {event.endTime}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Venue Location</span>
                <span className="text-gray-900">{event.venue}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Capacity</span>
                <span className="text-gray-900">{event.capacity} maximum attendees</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Server-Enforced Time Windows</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="p-3 rounded-lg bg-surface border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-900">Registration</span>
                    <Badge variant={event.windowStatuses?.registration?.isOpen ? 'green' : 'gray'} size="sm">
                      {event.windowStatuses?.registration?.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {formatDateTimeIST(event.registrationStart)} — {formatDateTimeIST(event.registrationEnd)}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-surface border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-900">Attendance</span>
                    <Badge variant={event.windowStatuses?.attendance?.isOpen ? 'green' : 'gray'} size="sm">
                      {event.windowStatuses?.attendance?.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {formatDateTimeIST(event.attendanceWindowStart)} — {formatDateTimeIST(event.attendanceWindowEnd)}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-surface border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-900">Credit Window</span>
                    <Badge variant={event.windowStatuses?.credit?.isOpen ? 'green' : 'gray'} size="sm">
                      {event.windowStatuses?.credit?.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {formatDateTimeIST(event.creditWindowStart)} — {formatDateTimeIST(event.creditWindowEnd)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: PARTICIPANTS & EXCEL IMPORT */}
      {activeTab === 'participants' && (
        <div className="space-y-6">
          {user?.role === 'ADMIN' ? (
            <Card>
              <CardHeader>
                <CardTitle>Batch Participant Upload (.xlsx)</CardTitle>
                <CardDescription>
                  Upload an Excel spreadsheet with Name, IXID, and Hall. Registered students will automatically receive +10 default registration credits.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Upload Participant List</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Accepts .xlsx files with columns: Name, IXID (e.g. IX-000001), Hall
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <a
                      href="/sample_participants_50_students.xlsx"
                      download="sample_participants_50_students.xlsx"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors shadow-2xs"
                      title="Download a pre-filled 50 students sample spreadsheet"
                    >
                      <Download className="w-3.5 h-3.5 text-brand-600" />
                      <span>Download Sample .xlsx</span>
                    </a>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      leftIcon={<Upload className="w-4 h-4" />}
                    >
                      Select Excel File
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Participant roster view for Volunteers. Spreadsheet batch uploads are reserved for Administrators.</span>
            </div>
          )}

          {/* DRY-RUN PREVIEW SCREEN */}
          {importPreview && (
            <Card className="border-brand-300 bg-brand-50/20 shadow-md">
              <CardHeader className="border-b border-brand-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-brand-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-brand-600" />
                      Excel Dry-Run Validation Preview
                    </CardTitle>
                    <CardDescription className="text-brand-700">
                      File: <span className="font-mono font-medium">{importPreview.originalFileName}</span> ({importPreview.totalRows} total rows)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Button variant="secondary" size="sm" onClick={() => setImportPreview(null)} disabled={isCommitting}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isCommitting}
                      disabled={importPreview.validCount === 0}
                      onClick={handleCommitImport}
                      leftIcon={<Check className="w-4 h-4" />}
                    >
                      Import {importPreview.validCount} Valid Records
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3.5 rounded-lg bg-white border border-gray-200 text-center">
                    <span className="text-xs text-gray-500 block">Total Rows</span>
                    <span className="text-xl font-bold text-gray-900 mt-1 block">{importPreview.totalRows}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                    <span className="text-xs text-emerald-700 font-semibold block">Valid to Import</span>
                    <span className="text-xl font-bold text-emerald-700 mt-1 block">{importPreview.validCount}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-center">
                    <span className="text-xs text-amber-700 font-semibold block">Duplicates</span>
                    <span className="text-xl font-bold text-amber-700 mt-1 block">{importPreview.duplicateCount}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-center">
                    <span className="text-xs text-red-700 font-semibold block">Unknown Students</span>
                    <span className="text-xl font-bold text-red-700 mt-1 block">{importPreview.unknownStudentCount}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-center">
                    <span className="text-xs text-gray-600 font-semibold block">Missing Fields</span>
                    <span className="text-xl font-bold text-gray-700 mt-1 block">{importPreview.missingFieldCount}</span>
                  </div>
                </div>

                {importPreview.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Rejected Rows Details ({importPreview.errors.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto border border-red-200 rounded-lg bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-red-50/50">
                            <TableHead className="w-16">Row #</TableHead>
                            <TableHead>Identifier / Roll No</TableHead>
                            <TableHead>Provided Name & Email</TableHead>
                            <TableHead>Rejection Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.errors.map((err, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{err.rowNumber}</TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-gray-900">
                                {err.collegeStudentId || '—'}
                              </TableCell>
                              <TableCell className="text-xs text-gray-600">
                                {err.fullName || '—'} {err.collegeEmail ? `(${err.collegeEmail})` : ''}
                              </TableCell>
                              <TableCell className="text-xs text-red-600 font-medium">{err.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Registrants Table */}
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Participants ({roster.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {roster.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={<Users className="w-6 h-6 text-gray-400" />}
                    title="No participants registered yet"
                    description="Upload an Excel participant sheet above or wait for students to self-register."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>InfluenceX ID</TableHead>
                      <TableHead>Student Name & Email</TableHead>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Branch & Year</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((item) => (
                      <TableRow key={item.registrationId}>
                        <TableCell className="font-mono text-xs font-semibold text-brand-700">
                          {item.student.influenceXId}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{item.student.fullName}</div>
                            <div className="text-xs text-gray-500">{item.student.collegeEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-600">
                          {item.student.collegeStudentId}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {item.student.branch} • Year {item.student.year} ({item.student.section})
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatDateTimeIST(item.registeredAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="gray" size="sm">
                            REGISTRATION
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-white border border-gray-200 text-center">
              <span className="text-xs text-gray-500 block">Registered</span>
              <span className="text-xl font-bold text-gray-900 mt-1 block">{stats.totalRegistrants}</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-xs text-emerald-700 font-semibold block">Present</span>
              <span className="text-xl font-bold text-emerald-700 mt-1 block">{stats.presentCount}</span>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
              <span className="text-xs text-red-700 font-semibold block">Absent</span>
              <span className="text-xl font-bold text-red-700 mt-1 block">{stats.absentCount}</span>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-center">
              <span className="text-xs text-amber-700 font-semibold block">Late</span>
              <span className="text-xl font-bold text-amber-700 mt-1 block">{stats.lateCount}</span>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <span className="text-xs text-blue-700 font-semibold block">Excused</span>
              <span className="text-xl font-bold text-blue-700 mt-1 block">{stats.excusedCount}</span>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-center">
              <span className="text-xs text-gray-500 font-semibold block">Unmarked</span>
              <span className="text-xl font-bold text-gray-700 mt-1 block">{stats.unmarkedCount}</span>
            </div>
          </div>

          <Card className="sticky top-20 z-20 shadow-sm">
            <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="Search student by Name, Roll No, or IX ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-gray-400" />}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={isAttendanceWindowOpen ? 'green' : 'gray'} size="md" dot>
                  {isAttendanceWindowOpen ? 'ATTENDANCE WINDOW OPEN' : 'ATTENDANCE WINDOW CLOSED'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {filteredRoster.map((item) => {
                  const currentStatus = item.attendance?.status;
                  const isPendingCorrection = item.attendance?.correctionStatus === 'PENDING_APPROVAL';

                  return (
                    <div
                      key={item.student.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">{item.student.fullName}</span>
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {item.student.influenceXId}
                          </span>
                          {currentStatus && (
                            <Badge
                              variant={
                                currentStatus === 'PRESENT'
                                  ? 'green'
                                  : currentStatus === 'ABSENT'
                                  ? 'red'
                                  : currentStatus === 'LATE'
                                  ? 'amber'
                                  : 'gray'
                              }
                              size="sm"
                            >
                              {currentStatus}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Roll: <span className="font-mono font-medium text-gray-700">{item.student.collegeStudentId}</span> • {item.student.branch} Year {item.student.year}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isAttendanceWindowOpen ? (
                          <>
                            <Button
                              variant={currentStatus === 'PRESENT' ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => handleMarkAttendance(item.student.id, 'PRESENT')}
                              className={`text-xs px-3.5 py-2 min-h-[38px] ${
                                currentStatus === 'PRESENT' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              Present
                            </Button>
                            <Button
                              variant={currentStatus === 'ABSENT' ? 'destructive' : 'secondary'}
                              size="sm"
                              onClick={() => handleMarkAttendance(item.student.id, 'ABSENT')}
                              className="text-xs px-3.5 py-2 min-h-[38px] hover:bg-red-50 hover:text-red-700"
                            >
                              Absent
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleMarkAttendance(item.student.id, 'LATE')}
                              className={`text-xs px-3.5 py-2 min-h-[38px] ${
                                currentStatus === 'LATE' ? 'bg-amber-600 text-white hover:bg-amber-700' : 'hover:bg-amber-50 hover:text-amber-700'
                              }`}
                            >
                              Late
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleMarkAttendance(item.student.id, 'EXCUSED')}
                              className={`text-xs px-3.5 py-2 min-h-[38px] ${
                                currentStatus === 'EXCUSED' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'hover:bg-blue-50 hover:text-blue-700'
                              }`}
                            >
                              Excused
                            </Button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isPendingCorrection ? (
                              <Badge variant="amber" size="md">
                                CORRECTION PENDING
                              </Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStudentForCorrection(item.student);
                                  setRequestedStatus(currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                                  setCorrectionModalOpen(true);
                                }}
                                className="text-xs text-gray-700 border-gray-300 hover:bg-gray-50 h-8"
                              >
                                Request Correction
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: PARTICIPATION */}
      {activeTab === 'participation' && (
        <Card>
          <CardHeader>
            <CardTitle>Active Participation Records</CardTitle>
            <CardDescription>
              Only students marked as PRESENT are eligible for active interaction & hackathon participation credits.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {presentStudents.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users className="w-6 h-6 text-gray-400" />}
                  title="No PRESENT students recorded"
                  description="Mark students as PRESENT in the Attendance tab first to track their active workshop participation."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>InfluenceX ID</TableHead>
                    <TableHead>Student Name & Email</TableHead>
                    <TableHead>Branch & Roll</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Active Participation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presentStudents.map((item) => {
                    const isParticipated = item.participation?.participated ?? true;
                    return (
                      <TableRow key={item.student.id}>
                        <TableCell className="font-mono text-xs font-semibold text-brand-700">
                          {item.student.influenceXId}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{item.student.fullName}</div>
                            <div className="text-xs text-gray-500">{item.student.collegeEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {item.student.branch} • {item.student.collegeStudentId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="green" size="sm" dot>
                            PRESENT
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={isParticipated ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => handleToggleParticipation(item.student.id, true)}
                              className={`text-xs h-7 px-2.5 ${isParticipated ? 'bg-emerald-600 text-white' : ''}`}
                            >
                              YES
                            </Button>
                            <Button
                              variant={!isParticipated ? 'destructive' : 'secondary'}
                              size="sm"
                              onClick={() => handleToggleParticipation(item.student.id, false)}
                              className="text-xs h-7 px-2.5"
                            >
                              NO
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
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CREDITS LEDGER & BULK AWARDING WIZARD                               */}
      {/* ========================================================================= */}
      {activeTab === 'credits' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-50 border border-brand-200 rounded-lg p-5">
            <div>
              <h3 className="text-sm font-bold text-brand-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-brand-600" />
                Event Engagement Credits Ledger
              </h3>
              <p className="text-xs text-brand-700 mt-1 max-w-2xl">
                Award points for verified Attendance (+20), Workshop Interaction (+15), Competition Winners (+50), or custom contributions. Credits are recorded as immutable individual transactions on the digital ledger.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedStudentIdsForCredits(roster.map((r) => r.student.id));
                setBulkCreditModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Bulk Award Credits
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Event Credit Transactions ({eventCredits.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {eventCredits.length === 0 ? (
                <div className="p-12 text-center">
                  <EmptyState
                    icon={<Award className="w-6 h-6 text-gray-400" />}
                    title="No credits awarded for this event yet"
                    description="Click 'Bulk Award Credits' above to issue engagement points to participants."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Credit Type</TableHead>
                      <TableHead>Points Awarded</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Awarded By</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventCredits.map((tx) => {
                      const student = tx.studentId as any;
                      const awardedBy = tx.awardedBy as any;

                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs font-bold text-brand-700">
                            {tx.transactionId}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-gray-900 text-xs">{student?.fullName}</div>
                              <div className="font-mono text-[11px] text-gray-500">{student?.influenceXId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="gray" size="sm">
                              {tx.creditType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-extrabold text-xs text-emerald-700">+{tx.amount} pts</span>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                            {tx.reason}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-700">{awardedBy?.name || 'Admin'}</div>
                            <div className="text-[11px] text-gray-400">{formatDateTimeIST(tx.createdAt)}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                tx.status === 'APPROVED'
                                  ? 'green'
                                  : tx.status === 'PENDING_APPROVAL'
                                  ? 'amber'
                                  : 'red'
                              }
                              size="sm"
                              dot
                            >
                              {tx.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* BULK AWARD CREDITS WIZARD MODAL */}
          {bulkCreditModalOpen && (
            <Modal
              isOpen={true}
              onClose={() => setBulkCreditModalOpen(false)}
              title="Bulk Award Engagement Credits"
              description="Award verified points to multiple event participants. Each student will receive an individual atomic ledger entry."
            >
              <form onSubmit={handleBulkAwardCredits} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Credit Activity Rule</label>
                  <Select
                    value={selectedCreditType}
                    onChange={(e) => {
                      setSelectedCreditType(e.target.value);
                      const rule = creditRules.find((r) => r.type === e.target.value);
                      if (rule) setCustomCreditAmount(rule.defaultAmount);
                    }}
                    options={creditRules.map((r) => ({
                      value: r.type,
                      label: `${r.name} (+${r.defaultAmount} pts)`,
                    }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Points per Student"
                    type="number"
                    required
                    min={1}
                    value={customCreditAmount}
                    onChange={(e) => setCustomCreditAmount(parseInt(e.target.value, 10) || 0)}
                  />
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Target Roster</label>
                    <div className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center text-xs font-medium text-gray-700">
                      {selectedStudentIdsForCredits.length} of {roster.length} students selected
                    </div>
                  </div>
                </div>

                <Input
                  label="Mandatory Ledger Reason"
                  required
                  placeholder="e.g. Completed hands-on hackathon project challenge"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                />

                {/* Review & Calculations Box */}
                <div className="p-4 bg-brand-50 border border-brand-200 rounded-lg space-y-2 text-xs">
                  <div className="font-semibold text-brand-900">Ledger Impact Summary:</div>
                  <div className="flex justify-between text-brand-800">
                    <span>Recipients:</span>
                    <span className="font-bold">{selectedStudentIdsForCredits.length} Students</span>
                  </div>
                  <div className="flex justify-between text-brand-800">
                    <span>Per-Student Allocation:</span>
                    <span className="font-bold">+{customCreditAmount} Credits</span>
                  </div>
                  <div className="flex justify-between text-brand-900 border-t border-brand-200 pt-2 font-extrabold">
                    <span>Total Points to Issue:</span>
                    <span>+{customCreditAmount * selectedStudentIdsForCredits.length} Credits</span>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBulkCreditModalOpen(false)}
                    disabled={isAwardingCredits}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isAwardingCredits}>
                    Confirm & Issue {customCreditAmount * selectedStudentIdsForCredits.length} Points
                  </Button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}

      {/* OTHER TABS */}
      {activeTab !== 'overview' &&
        activeTab !== 'participants' &&
        activeTab !== 'attendance' &&
        activeTab !== 'participation' &&
        activeTab !== 'credits' && (
          <EmptyState
            icon={<Layers className="w-6 h-6 text-gray-400" />}
            title={`${activeTab.toUpperCase()} Engine — Phase 5`}
            description={`The event ${activeTab} computation will be activated in upcoming development phases.`}
            action={
              <div className="text-xs font-medium text-gray-500 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200">
                Phase 4 Credit Ledger Live
              </div>
            }
          />
        )}
    </div>
  );
};
