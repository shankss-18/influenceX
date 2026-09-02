import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  Award,
  RefreshCw,
  Lock,
  Sparkles,
  Edit3,
  Check,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { formatTime12hIST, formatDateIST } from '../../utils/date';

interface VolunteerStudent {
  id: string;
  studentId: string;
  fullName: string;
  influenceXId: string;
  collegeStudentId: string;
  assignedOrder: number;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'NOT_MARKED';
  participationPoints: number;
  participationReason?: string;
  totalCreditsThisWorkshop: number;
  cumulativeTotalCredits: number;
  remainingCapHeadroom: number;
}

interface VolunteerSessionData {
  hasActiveSession: boolean;
  message?: string;
  workshop?: {
    id: string;
    eventId: string;
    name: string;
    date: string;
    startTime: string;
    endTime: string;
    creditCap: number;
    attendanceWindowStart: string;
    attendanceWindowEnd: string;
  };
  assignedHall?: {
    name: string;
    capacity: number;
    totalStudentsCount: number;
  };
  windowState?: {
    isOpen: boolean;
    isClosed: boolean;
    isUpcoming: boolean;
    isWorkshopEnded?: boolean;
    countdownSeconds: number;
    closeTime: string;
  };
  students?: VolunteerStudent[];
}

export const VolunteerPortalPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [session, setSession] = useState<VolunteerSessionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(0);
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);

  // Participation Score & Reason Modal / Inline State
  const [activeScoreStudent, setActiveScoreStudent] = useState<VolunteerStudent | null>(null);
  const [scorePointsInput, setScorePointsInput] = useState<number>(0);
  const [scoreReasonInput, setScoreReasonInput] = useState<string>('');
  const [isSavingScore, setIsSavingScore] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSession = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      const res = await api.get<VolunteerSessionData>('/volunteer/active-session');
      setSession(res.data);

      if (res.data.windowState) {
        setCountdown(res.data.windowState.countdownSeconds);
      }
    } catch (err: any) {
      error('Session Error', err.response?.data?.error || 'Failed to load volunteer session');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession(true);

    // Background polling every 10 seconds for real-time hall reassignment or admin window changes
    const interval = setInterval(() => {
      fetchSession(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Live countdown timer (server clock sync)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchSession(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatCountdown = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  };

  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleAttendanceToggle = async (student: VolunteerStudent, newStatus: 'PRESENT' | 'ABSENT') => {
    // Workshop ended by admin = permanently locked
    if (session?.windowState?.isWorkshopEnded) {
      error('Locked', 'Workshop has been ended by administrator — attendance is permanently frozen.');
      return;
    }

    try {
      setUpdatingStudentId(student.studentId);
      const res = await api.post<{
        success: boolean;
        message: string;
        attendanceStatus: 'PRESENT' | 'ABSENT';
        cumulativeTotalCredits?: number;
        totalCreditsThisWorkshop?: number;
      }>(
        '/volunteer/attendance',
        {
          studentId: student.studentId,
          status: newStatus,
        }
      );

      if (res.data.success) {
        success('Attendance Recorded', res.data.message);
        const serverCumulative = res.data.cumulativeTotalCredits;
        const serverWorkshopTotal = res.data.totalCreditsThisWorkshop;

        setSession((prev) => {
          if (!prev || !prev.students) return prev;
          const updatedStudents = prev.students.map((s) => {
            if (s.studentId === student.studentId) {
              const total = serverWorkshopTotal !== undefined ? serverWorkshopTotal : (10 + (newStatus === 'PRESENT' ? 20 : 0) + (newStatus === 'PRESENT' ? s.participationPoints : 0));
              const partPts = newStatus === 'PRESENT' ? s.participationPoints : 0;
              const cum = serverCumulative !== undefined ? serverCumulative : Math.max(0, s.cumulativeTotalCredits + ((newStatus === 'PRESENT' ? 20 : 0) - (s.attendanceStatus === 'PRESENT' ? 20 : 0)));
              const headroom = Math.max(0, (prev.workshop?.creditCap || 50) - total);
              return {
                ...s,
                attendanceStatus: newStatus,
                participationPoints: partPts,
                totalCreditsThisWorkshop: total,
                cumulativeTotalCredits: cum,
                remainingCapHeadroom: headroom,
              };
            }
            return s;
          });
          return { ...prev, students: updatedStudents };
        });
      }
    } catch (err: any) {
      error('Attendance Error', err.response?.data?.error || 'Failed to update attendance');
      fetchSession(false);
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleOpenScoreModal = (student: VolunteerStudent) => {
    setActiveScoreStudent(student);
    setScorePointsInput(student.participationPoints || 0);
    setScoreReasonInput(student.participationReason || '');
  };

  const handleSaveScoreModal = async () => {
    if (!activeScoreStudent || !session?.workshop) return;

    if (session?.windowState?.isWorkshopEnded) {
      error('Locked', 'Workshop has been ended by administrator — performance scoring is permanently locked.');
      return;
    }

    const points = Number(scorePointsInput) || 0;
    if (points < 0) {
      error('Invalid Score', 'Performance score cannot be negative.');
      return;
    }

    try {
      setIsSavingScore(true);
      const res = await api.post<{
        success: boolean;
        message: string;
        participationPoints: number;
        participationReason: string;
        totalCreditsThisWorkshop: number;
        cumulativeTotalCredits: number;
        remainingCapHeadroom: number;
      }>('/volunteer/credits', {
        studentId: activeScoreStudent.studentId,
        points,
        reason: scoreReasonInput.trim(),
      });

      if (res.data.success) {
        success('Score Saved', res.data.message);
        setSession((prev) => {
          if (!prev || !prev.students) return prev;
          const updatedStudents = prev.students.map((s) => {
            if (s.studentId === activeScoreStudent.studentId) {
              return {
                ...s,
                participationPoints: res.data.participationPoints,
                participationReason: res.data.participationReason,
                totalCreditsThisWorkshop: res.data.totalCreditsThisWorkshop,
                cumulativeTotalCredits: res.data.cumulativeTotalCredits,
                remainingCapHeadroom: res.data.remainingCapHeadroom,
              };
            }
            return s;
          });
          return { ...prev, students: updatedStudents };
        });
        setActiveScoreStudent(null);
      }
    } catch (err: any) {
      error('Scoring Error', err.response?.data?.error || 'Failed to save participation score');
    } finally {
      setIsSavingScore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-3" />
        <p className="text-sm text-gray-500 font-medium">Connecting to your assigned hall...</p>
      </div>
    );
  }

  if (!session || !session.hasActiveSession || !session.workshop || !session.assignedHall) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No Active Workshop Assignment</h2>
        <p className="text-sm text-gray-600 mb-6">
          {session?.message ||
            "You are currently not assigned to any active workshop hall. When an administrator assigns you to a hall in Workshop Setup, your hall's live roster will appear here automatically."}
        </p>
        <Button variant="secondary" onClick={() => fetchSession(true)} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Check For New Assignment
        </Button>
      </div>
    );
  }

  const { workshop, assignedHall, windowState, students = [] } = session;
  const isWindowOpen = !!windowState?.isOpen;
  const isWindowClosed = !!windowState?.isClosed;
  const isWindowUpcoming = !!windowState?.isUpcoming;
  const isWorkshopEnded = !!windowState?.isWorkshopEnded;

  const presentCount = students.filter((s) => s.attendanceStatus === 'PRESENT').length;
  const absentCount = students.filter((s) => s.attendanceStatus === 'ABSENT').length;

  return (
    <div className="space-y-6">
      {/* 1. STATUS HEADER */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                {workshop.eventId}
              </span>
              <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Assigned: {assignedHall.name} ({assignedHall.capacity} Seats)
              </span>
              <span className="text-xs text-gray-500 font-medium">
                Credit Cap: {workshop.creditCap} pts
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{workshop.name}</h1>
            <p className="text-xs text-gray-500 flex items-center gap-3">
              <span>📅 {formatDateIST(workshop.date)}</span>
              <span>•</span>
              <span>🕒 {formatTime12hIST(workshop.startTime)} — {formatTime12hIST(workshop.endTime)} IST</span>
            </p>
          </div>

          {/* Window State Badge & Countdown */}
          <div className="flex flex-col sm:items-end gap-2">
            {isWindowOpen && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-right">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  ATTENDANCE WINDOW OPEN
                </div>
                <div className="text-base font-mono font-bold text-emerald-950 mt-0.5">
                  {formatCountdown(countdown)}
                </div>
              </div>
            )}

            {isWindowClosed && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-right">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  ATTENDANCE WINDOW CLOSED
                </div>
                <div className="text-xs text-amber-700 font-medium mt-0.5">
                  Locked at {formatTime12hIST(windowState.closeTime)} IST
                </div>
              </div>
            )}

            {isWindowUpcoming && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-right">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  WINDOW OPENS IN
                </div>
                <div className="text-base font-mono font-bold text-blue-950 mt-0.5">
                  {formatCountdown(countdown)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Hall Statistics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100 text-xs">
          <div className="bg-surface/80 rounded-xl p-3 border border-gray-100">
            <div className="text-gray-500 font-medium">Students in Hall</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">{students.length} / {assignedHall.capacity}</div>
          </div>
          <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-100">
            <div className="text-emerald-700 font-medium">Marked Present (+20)</div>
            <div className="text-base font-bold text-emerald-900 mt-0.5">{presentCount}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-slate-600 font-medium">Marked Absent</div>
            <div className="text-base font-bold text-slate-800 mt-0.5">{absentCount}</div>
          </div>
          <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-100">
            <div className="text-amber-700 font-medium">Pending Marking</div>
            <div className="text-base font-bold text-amber-900 mt-0.5">{students.length - (presentCount + absentCount)}</div>
          </div>
        </div>
      </div>

      {/* 2. WINDOW CLOSED / WORKSHOP ENDED NOTICE BANNER */}
      {isWorkshopEnded ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 font-semibold">
            <Lock className="w-5 h-5 text-red-600 shrink-0" />
            <span>Workshop has been ended by administrator — attendance marking and performance scoring are permanently locked.</span>
          </div>
        </div>
      ) : isWindowClosed ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 font-semibold">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Attendance window closed — Attendance marking is locked. Volunteers can still evaluate and edit performance points for PRESENT students until the administrator ends the workshop.
            </span>
          </div>
        </div>
      ) : null}

      {/* 3. ROSTER TABLE — WITH CUMULATIVE CREDITS & REASON EVALUATION */}
      <Card className="border-gray-200/80 shadow-xs">
        <CardHeader className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                {assignedHall.name} Student Roster
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Mark attendance and evaluate performance scores. You can update anytime until the workshop is ended.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => fetchSession(true)} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Refresh
            </Button>
          </div>
          {/* Search Bar */}
          <div className="mt-3">
            <Input
              placeholder="Search by name, IXID or NIAT ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface/80 text-gray-600 font-semibold border-b border-gray-100">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">IXID / NIAT</th>
                <th className="py-3 px-4 text-center">Total Cumulative Credits</th>
                <th className="py-3 px-4 text-center">Attendance Status</th>
                <th className="py-3 px-4 text-center">Performance Points & Reason</th>
                <th className="py-3 px-4 text-right">This Workshop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No students currently registered for this workshop.
                  </td>
                </tr>
              ) : (() => {
                const q = searchQuery.toLowerCase().trim();
                const filtered = q
                  ? students.filter(
                      (s) =>
                        s.fullName.toLowerCase().includes(q) ||
                        s.influenceXId.toLowerCase().includes(q) ||
                        (s.collegeStudentId || '').toLowerCase().includes(q)
                    )
                  : students;

                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400">
                        No students match &quot;{searchQuery}&quot;.
                      </td>
                    </tr>
                  );
                }

                return filtered.map((student, idx) => {
                  const isUpdating = updatingStudentId === student.studentId;
                  const isPresent = student.attendanceStatus === 'PRESENT';
                  const isAbsent = student.attendanceStatus === 'ABSENT';

                  return (
                    <tr
                      key={student.studentId}
                      className={`hover:bg-brand-50/20 transition-colors ${
                        isPresent ? 'bg-emerald-50/20' : isAbsent ? 'bg-slate-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-mono text-gray-400">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">{student.fullName}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-gray-800">{student.influenceXId}</div>
                        {student.collegeStudentId && (
                          <div className="text-[10px] text-gray-400 font-mono">{student.collegeStudentId}</div>
                        )}
                      </td>

                      {/* Cumulative Total Credits Column */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          {student.cumulativeTotalCredits} pts
                        </span>
                      </td>

                      {/* Attendance Toggle Pill — always visible, disabled only when workshop ended */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center rounded-xl p-1 bg-gray-100 border border-gray-200">
                          <button
                            type="button"
                            disabled={isUpdating || isWorkshopEnded}
                            onClick={() => handleAttendanceToggle(student, 'PRESENT')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                              isWorkshopEnded
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                            } ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-gray-600 hover:text-emerald-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Present
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating || isWorkshopEnded}
                            onClick={() => handleAttendanceToggle(student, 'ABSENT')}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                              isWorkshopEnded
                                ? 'cursor-not-allowed opacity-50'
                                : 'cursor-pointer'
                            } ${
                              isAbsent
                                ? 'bg-slate-700 text-white shadow-xs'
                                : 'text-gray-600 hover:text-red-700'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Absent
                          </button>
                        </div>
                      </td>

                      {/* Performance Credit & Reason Trigger */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <button
                            type="button"
                            disabled={!isPresent || isWorkshopEnded}
                            onClick={() => handleOpenScoreModal(student)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                              !isPresent || isWorkshopEnded
                                ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60'
                                : student.participationPoints > 0
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer'
                                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 cursor-pointer'
                            }`}
                            title={
                              isWorkshopEnded
                                ? 'Workshop has been ended by administrator — performance scoring locked'
                                : !isPresent
                                ? 'Mark student as Present first to assign performance points'
                                : 'Click to assign or edit performance points & reason'
                            }
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{student.participationPoints} pts</span>
                          </button>

                          {student.participationReason && (
                            <span className="text-[10px] text-gray-500 max-w-[150px] truncate" title={student.participationReason}>
                              💬 {student.participationReason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Earned in Workshop */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                          {student.totalCreditsThisWorkshop} pts
                        </span>
                      </td>
                    </tr>
                  );
                })
              })()}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 4. ASSIGN / EDIT PERFORMANCE SCORE MODAL */}
      {activeScoreStudent && (
        <Modal
          isOpen={Boolean(activeScoreStudent)}
          onClose={() => setActiveScoreStudent(null)}
          title={`Evaluate Performance — ${activeScoreStudent.fullName}`}
          size="md"
        >
          <div className="space-y-4 pt-1">
            <div className="bg-slate-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Student IXID:</span>
                <span className="font-mono font-bold text-gray-900">{activeScoreStudent.influenceXId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cumulative Credits:</span>
                <span className="font-bold text-amber-700">{activeScoreStudent.cumulativeTotalCredits} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Max Headroom for Workshop:</span>
                <span className="font-bold text-indigo-700">
                  {workshop.creditCap - (10 + (activeScoreStudent.attendanceStatus === 'PRESENT' ? 20 : 0))} pts max
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Performance Points (0 – {workshop.creditCap - (10 + (activeScoreStudent.attendanceStatus === 'PRESENT' ? 20 : 0))})
              </label>
              <Input
                type="number"
                min={0}
                max={workshop.creditCap - (10 + (activeScoreStudent.attendanceStatus === 'PRESENT' ? 20 : 0))}
                value={scorePointsInput}
                onChange={(e) => setScorePointsInput(Number(e.target.value) || 0)}
                placeholder="Enter points, e.g. 15"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Evaluation Reason / Note
              </label>
              <textarea
                rows={3}
                value={scoreReasonInput}
                onChange={(e) => setScoreReasonInput(e.target.value)}
                placeholder="Why is this score awarded? (e.g. Outstanding project demo, active Q&A participant, team lead)"
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setActiveScoreStudent(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveScoreModal}
                isLoading={isSavingScore}
                leftIcon={<Check className="w-4 h-4" />}
              >
                Save Score & Reason
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
