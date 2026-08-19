import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  Check,
  CheckCircle2,
  AlertCircle,
  Key,
  Users,
  Download,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  Shield,
  Layers,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EditWorkshopModal } from '../../components/workshop/EditWorkshopModal';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { WorkshopSummary, WorkshopHall, VolunteerRosterItem, StudentRosterItem } from '../../types/workshop';
import ExcelJS from 'exceljs';

export const WorkshopSetupPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'volunteers' | 'students'>('volunteers');
  const [workshop, setWorkshop] = useState<WorkshopSummary | null>(null);
  const [halls, setHalls] = useState<WorkshopHall[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
        fetchSetupData();
      }
    } catch (err: any) {
      error('Revoke Error', err.response?.data?.error || 'Failed to revoke registration credits');
    } finally {
      setIsRevokingRegCredits(false);
    }
  };

  // Volunteers Setup State
  const [uploadedVolunteers, setUploadedVolunteers] = useState<VolunteerRosterItem[]>([]);
  const [volunteerAssignments, setVolunteerAssignments] = useState<Record<string, string>>({}); // ixId -> hallName
  const [isUploadingVolunteers, setIsUploadingVolunteers] = useState<boolean>(false);
  const [isAssigningVolunteers, setIsAssigningVolunteers] = useState<boolean>(false);
  const [isGeneratingCredentials, setIsGeneratingCredentials] = useState<boolean>(false);
  const [revealCredentials, setRevealCredentials] = useState<Array<{
    name: string;
    ixId: string;
    niatId: string;
    hallName: string;
    username: string;
    tempPassword: string;
  }> | null>(null);

  // Students Setup State
  const [studentRoster, setStudentRoster] = useState<StudentRosterItem[]>([]);
  const [overflowCount, setOverflowCount] = useState<number>(0);
  const [ignoredOverflowCount, setIgnoredOverflowCount] = useState<number>(0);
  const [placedCount, setPlacedCount] = useState<number>(0);
  const [totalCapacity, setTotalCapacity] = useState<number>(0);
  const [isUploadingStudents, setIsUploadingStudents] = useState<boolean>(false);
  const [isCommittingStudents, setIsCommittingStudents] = useState<boolean>(false);

  const volFileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  const fetchSetupData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{
        success: boolean;
        workshop: WorkshopSummary;
        halls: WorkshopHall[];
        totalCapacity: number;
        totalAssignedStudents: number;
        placedStudents: StudentRosterItem[];
      }>(`/workshops/${id}/setup`);

      if (res.data.success) {
        setWorkshop(res.data.workshop);
        setHalls(res.data.halls);
        setTotalCapacity(res.data.totalCapacity);

        // Reconstruct volunteers table from assigned halls
        if (res.data.halls && res.data.halls.length > 0) {
          const loadedVols: VolunteerRosterItem[] = [];
          const initialMap: Record<string, string> = {};
          let rowNum = 1;

          res.data.halls.forEach((hall) => {
            (hall.assignedVolunteers || []).forEach((v) => {
              loadedVols.push({
                rowNumber: rowNum++,
                name: v.name,
                ixId: v.ixId,
                niatId: v.niatId || '',
                workshopName: res.data.workshop.name,
                isValid: true,
              });
              initialMap[v.ixId] = hall.name;
            });
          });

          if (loadedVols.length > 0) {
            setUploadedVolunteers(loadedVols);
            setVolunteerAssignments(initialMap);
          }
        }

        if (res.data.placedStudents.length > 0) {
          setStudentRoster(res.data.placedStudents);
          setPlacedCount(res.data.placedStudents.filter((s) => !s.isWaitlisted).length);
          setOverflowCount(res.data.placedStudents.filter((s) => s.isWaitlisted).length);
        }
      }
    } catch (err: any) {
      error('Load Error', err.response?.data?.error || 'Unable to load workshop setup');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSetupData();
  }, [id]);

  // ----------------- VOLUNTEERS FLOW -----------------
  const handleVolunteersUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploadingVolunteers(true);
      const res = await api.post<{
        success: boolean;
        totalRows: number;
        validCount: number;
        volunteers: VolunteerRosterItem[];
      }>(`/workshops/${id}/setup/volunteers/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setUploadedVolunteers(res.data.volunteers);
        // Pre-fill default assignments
        const initialMap: Record<string, string> = {};
        const validVols = res.data.volunteers.filter((v) => v.isValid);
        validVols.forEach((v, idx) => {
          if (halls.length > 0) {
            initialMap[v.ixId] = halls[idx % halls.length].name;
          }
        });
        setVolunteerAssignments(initialMap);
        success('Volunteers Parsed', `Parsed ${res.data.totalRows} rows (${res.data.validCount} valid).`);
      }
    } catch (err: any) {
      error('Upload Failed', err.response?.data?.error || 'Failed to parse volunteers spreadsheet');
    } finally {
      setIsUploadingVolunteers(false);
      if (volFileInputRef.current) volFileInputRef.current.value = '';
    }
  };

  const hallCounts = halls.reduce((acc, hall) => {
    acc[hall.name] = Object.values(volunteerAssignments).filter((h) => h === hall.name).length;
    return acc;
  }, {} as Record<string, number>);

  const allHallsStaffedProperly =
    halls.length > 0 && Object.keys(volunteerAssignments).length > 0;

  const handleSaveVolunteerAssignments = async () => {
    const assignmentsList = uploadedVolunteers
      .filter((v) => v.isValid)
      .map((v) => ({
        name: v.name,
        ixId: v.ixId,
        niatId: v.niatId,
        hallName: volunteerAssignments[v.ixId],
      }));

    try {
      setIsAssigningVolunteers(true);
      const res = await api.post<{ success: boolean; message: string; halls: WorkshopHall[] }>(
        `/workshops/${id}/setup/volunteers/assign`,
        { assignments: assignmentsList }
      );

      if (res.data.success) {
        setHalls(res.data.halls);
        success('Staffing Verified', res.data.message);
        fetchSetupData();
      }
    } catch (err: any) {
      error('Assignment Failed', err.response?.data?.error || 'Hall assignment rule check failed');
    } finally {
      setIsAssigningVolunteers(false);
    }
  };

  const handleGenerateCredentials = async () => {
    try {
      setIsGeneratingCredentials(true);
      const res = await api.post<{
        success: boolean;
        message: string;
        credentials: Array<{
          name: string;
          ixId: string;
          niatId: string;
          hallName: string;
          username: string;
          tempPassword: string;
        }>;
      }>(`/workshops/${id}/setup/volunteers/credentials`);

      if (res.data.success) {
        setRevealCredentials(res.data.credentials);
        success('Credentials Generated', res.data.message);
        fetchSetupData();
      }
    } catch (err: any) {
      error('Credential Error', err.response?.data?.error || 'Failed to generate volunteer credentials');
    } finally {
      setIsGeneratingCredentials(false);
    }
  };

  const downloadCredentialsExcel = async () => {
    if (!revealCredentials) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Volunteer_Credentials');
    worksheet.columns = [
      { header: 'Volunteer Name', key: 'name', width: 24 },
      { header: 'IXID', key: 'ixId', width: 16 },
      { header: 'NIAT ID', key: 'niatId', width: 16 },
      { header: 'Assigned Hall', key: 'hallName', width: 24 },
      { header: 'Username / Email', key: 'username', width: 30 },
      { header: 'Temporary Password / PIN', key: 'tempPassword', width: 26 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    revealCredentials.forEach((c) => worksheet.addRow(c));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Volunteer_Credentials_${workshop?.eventId || 'Workshop'}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ----------------- STUDENTS FLOW -----------------
  const handleStudentsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploadingStudents(true);
      const res = await api.post<{
        success: boolean;
        totalUploaded: number;
        totalCapacity: number;
        placedCount: number;
        overflowCount: number;
        ignoredOverflowCount: number;
        hasOverflow: boolean;
        message: string;
        assignedRoster: StudentRosterItem[];
      }>(`/workshops/${id}/setup/students/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        setStudentRoster(res.data.assignedRoster);
        setPlacedCount(res.data.placedCount);
        setOverflowCount(res.data.overflowCount || 0);
        setIgnoredOverflowCount(res.data.ignoredOverflowCount || 0);
        success(
          'Students Auto-Assigned',
          res.data.message || `Placed ${res.data.placedCount} students across halls.`
        );
      }
    } catch (err: any) {
      error('Upload Error', err.response?.data?.error || 'Failed to auto-assign students');
    } finally {
      setIsUploadingStudents(false);
      if (studentFileInputRef.current) studentFileInputRef.current.value = '';
    }
  };

  const handleCommitStudents = async () => {
    if (studentRoster.length === 0) {
      error('Empty Roster', 'Please upload and preview students before committing.');
      return;
    }

    try {
      setIsCommittingStudents(true);
      const res = await api.post<{
        success: boolean;
        message: string;
        workshopStatus: string;
      }>(`/workshops/${id}/setup/students/commit`, {
        roster: studentRoster.map((s) => ({
          name: s.name || s.fullName || 'Student',
          ixId: s.ixId || s.influenceXId || '',
          niatId: s.niatId || s.collegeStudentId || '',
          collegeEmail: s.collegeEmail || '',
          hallName: s.hallName,
          assignedOrder: s.assignedOrder,
          isWaitlisted: s.isWaitlisted,
        })),
      });

      if (res.data.success) {
        success('Students Placed', res.data.message);
        fetchSetupData();
      }
    } catch (err: any) {
      error('Commit Error', err.response?.data?.error || 'Failed to commit student placements');
    } finally {
      setIsCommittingStudents(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-3 text-xs text-gray-500">Loading workshop setup details...</p>
      </div>
    );
  }

  if (!workshop) return null;

  const isReadyToUnlock = workshop.volunteersSetupCompleted && workshop.studentsSetupCompleted;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/workshops')}
            className="text-gray-500 hover:text-gray-900 -ml-2 mb-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Workshops
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span>{workshop.name}</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {workshop.eventId}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Setup Step: Staff halls with volunteers, place students, and unlock the live Console.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          {isReadyToUnlock ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/admin/workshops/${workshop.id}/console`)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Enter Workshop Console
            </Button>
          ) : (
            <Badge variant="amber" size="md">
              Setup Pending (Complete Steps Below)
            </Badge>
          )}
        </div>
      </div>

      {/* 2 Sub-Tabs Header */}
      <div className="flex border-b border-gray-200 gap-6">
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
          <span>1. Volunteers & Hall Staffing</span>
          {workshop.volunteersSetupCompleted && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          )}
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
          <span>2. Students & Hall Placement</span>
          {workshop.studentsSetupCompleted && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          )}
        </button>
      </div>

      {/* ================= SUB-TAB 1: VOLUNTEERS ================= */}
      {activeTab === 'volunteers' && (
        <div className="space-y-6">
          {/* Step 1: Upload Card */}
          <Card className="shadow-xs border-gray-200">
            <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Step 1 — Upload Volunteers Spreadsheet (.xlsx)</CardTitle>
                <CardDescription className="text-xs">
                  Expected columns: <span className="font-mono text-gray-700">Name, NIAT ID (e.g. N25HO1A0451), IXID (e.g. IX0451), Workshop Name</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={volFileInputRef}
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleVolunteersUpload}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isUploadingVolunteers}
                  onClick={() => volFileInputRef.current?.click()}
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                >
                  Upload Volunteers .xlsx
                </Button>
              </div>
            </CardHeader>

            {/* Hall Staffing Live Counters */}
            <CardContent className="p-4 bg-surface/50 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-gray-900">Hall Staffing Status:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {halls.map((hall) => {
                  const count = hallCounts[hall.name] || 0;
                  return (
                    <div
                      key={hall.name}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        count > 0 ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      <span className="font-semibold">{hall.name}</span>
                      <span className="font-bold">
                        {count} Assigned {count > 0 ? '✓' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>

            {/* Uploaded Volunteers Table */}
            {uploadedVolunteers.length > 0 && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Volunteer Name</TableHead>
                      <TableHead>IXID</TableHead>
                      <TableHead>NIAT ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Hall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadedVolunteers.map((vol) => (
                      <TableRow key={vol.ixId || vol.rowNumber}>
                        <TableCell className="text-xs text-gray-400">#{vol.rowNumber}</TableCell>
                        <TableCell className="font-semibold text-xs text-gray-900">{vol.name}</TableCell>
                        <TableCell className="text-xs font-mono">{vol.ixId}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{vol.niatId || '—'}</TableCell>
                        <TableCell>
                          {vol.isValid ? (
                            <Badge variant="green" size="sm">✓ Valid</Badge>
                          ) : (
                            <Badge variant="red" size="sm">⚠ {vol.issue}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {vol.isValid && (
                            <select
                              value={volunteerAssignments[vol.ixId] || ''}
                              onChange={(e) =>
                                setVolunteerAssignments({
                                  ...volunteerAssignments,
                                  [vol.ixId]: e.target.value,
                                })
                              }
                              className="text-xs rounded border border-gray-300 px-2 py-1 bg-white font-medium text-gray-800 focus:ring-1 focus:ring-brand-500"
                            >
                              {halls.map((h) => (
                                <option key={h.name} value={h.name}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <span className="text-xs text-gray-500">
                    {uploadedVolunteers.filter((v) => v.isValid).length} volunteer(s) assigned across halls.
                  </span>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSaveVolunteerAssignments}
                      isLoading={isAssigningVolunteers}
                    >
                      Save Hall Assignments
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!allHallsStaffedProperly}
                      isLoading={isGeneratingCredentials}
                      onClick={handleGenerateCredentials}
                      leftIcon={<Key className="w-3.5 h-3.5" />}
                    >
                      {workshop?.volunteersSetupCompleted
                        ? 'Regenerate Volunteer Credentials'
                        : 'Generate Volunteer Credentials'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* ================= SUB-TAB 2: STUDENTS ================= */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <Card className="shadow-xs border-gray-200">
            <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Step 1 & 2 — Upload & Auto-Assign Students</CardTitle>
                <CardDescription className="text-xs">
                  Expected columns: <span className="font-mono text-gray-700">Name, Halls, NIAT ID (e.g. N25HO1A0451), IXID (e.g. IX0451)</span> (Places row-by-row sequentially into halls).
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={studentFileInputRef}
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleStudentsUpload}
                />
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isUploadingStudents}
                  onClick={() => studentFileInputRef.current?.click()}
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                >
                  Upload & Auto-Assign Students
                </Button>
              </div>
            </CardHeader>

            {/* Overflow / Capacity Indicator */}
            {studentRoster.length > 0 && (
              <CardContent className="p-4 bg-surface/50 border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">Total Capacity: {totalCapacity}</span>
                    <span className="text-gray-400">•</span>
                    <span className="font-semibold text-emerald-700">Accepted & Placed: {placedCount}</span>
                    {ignoredOverflowCount > 0 && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Extra Omitted: {ignoredOverflowCount} (Capped to capacity)
                        </span>
                      </>
                    )}
                    {overflowCount > 0 && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          Overflow / Waitlisted: {overflowCount}
                        </span>
                      </>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isCommittingStudents}
                    onClick={handleCommitStudents}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    {workshop?.studentsSetupCompleted
                      ? '✓ Placed & Credited (Re-Sync Placements)'
                      : 'Commit Student Placements (+10 Credits)'}
                  </Button>
                </div>
              </CardContent>
            )}

            {/* Placed Students Table */}
            {studentRoster.length > 0 && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>IXID</TableHead>
                      <TableHead>College ID</TableHead>
                      <TableHead>Assigned Hall</TableHead>
                      <TableHead>Placement Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentRoster.map((s) => (
                      <TableRow key={s.ixId || s.influenceXId || s.assignedOrder}>
                        <TableCell className="text-xs text-gray-400 font-mono">#{s.assignedOrder}</TableCell>
                        <TableCell className="font-semibold text-xs text-gray-900">{s.name || s.fullName}</TableCell>
                        <TableCell className="text-xs font-mono">{s.ixId || s.influenceXId}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-500">{s.niatId || s.collegeStudentId || '—'}</TableCell>
                        <TableCell>
                          <span className="font-bold text-xs text-brand-700">{s.hallName}</span>
                        </TableCell>
                        <TableCell>
                          {s.isWaitlisted ? (
                            <Badge variant="red" size="sm">Waitlisted (Overflow)</Badge>
                          ) : (
                            <Badge variant="green" size="sm">✓ Placed (+10 pts)</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* ONE-TIME CREDENTIALS REVEAL MODAL */}
      <Modal
        isOpen={!!revealCredentials}
        onClose={() => setRevealCredentials(null)}
        title="⚠️ One-Time Volunteer Credentials Reveal"
        description="These temporary PINs/passwords are revealed ONLY ONCE right now and are never stored in plaintext."
        size="xl"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Download the credentials spreadsheet immediately. Once you close this modal or navigate away, plain passwords cannot be retrieved.
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>IXID / Username</TableHead>
                  <TableHead>Hall</TableHead>
                  <TableHead>Temporary Password</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revealCredentials?.map((c) => (
                  <TableRow key={c.ixId}>
                    <TableCell className="text-xs font-semibold text-gray-900">{c.name}</TableCell>
                    <TableCell className="text-xs font-mono text-brand-700">{c.username}</TableCell>
                    <TableCell className="text-xs font-medium text-gray-700">{c.hallName}</TableCell>
                    <TableCell className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50/50 px-2 py-1 rounded">
                      {c.tempPassword}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadCredentialsExcel}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Download Credentials Sheet (.xlsx)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setRevealCredentials(null)}
            >
              I Have Saved These Credentials
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
          onUpdated={fetchSetupData}
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
              variant="destructive"
              size="sm"
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
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
    </div>
  );
};
