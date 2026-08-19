import React, { useState, useEffect } from 'react';
import {
  Award,
  Calendar,
  Building2,
  Gift,
  CheckCircle2,
  Clock,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { api } from '../../api/client';
import { formatDateIST, formatTime12hIST } from '../../utils/date';

interface WorkshopRecord {
  workshopId: string;
  eventId: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  assignedHall: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'NOT_MARKED';
  participationReason?: string;
  creditBreakdown: {
    registration: number;
    attendance: number;
    participation: number;
    total: number;
  };
}

interface GoodieRecord {
  id: string;
  levelName: string;
  goodieName: string;
  unlockedAt: string;
  status: 'PENDING' | 'ISSUED';
  issuedAt?: string | null;
  notes?: string;
}

interface StudentDetailsData {
  student: {
    id: string;
    fullName: string;
    influenceXId: string;
    collegeStudentId: string;
    branch: string;
    year: number;
    collegeEmail: string;
    totalCredits: number;
    currentLevel: string;
  };
  workshops: WorkshopRecord[];
  goodies: GoodieRecord[];
}

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  isOpen,
  onClose,
  studentId,
}) => {
  const [data, setData] = useState<StudentDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudentDetails(studentId);
    } else {
      setData(null);
      setErrorMsg(null);
    }
  }, [isOpen, studentId]);

  const fetchStudentDetails = async (id: string) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.get<{ success: boolean; student: any; workshops: any[]; goodies: any[] }>(
        `/leaderboard/students/${id}/details`
      );
      if (res.data.success) {
        setData(res.data as StudentDetailsData);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to load student details');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Inspection Ledger"
      size="xl"
    >
      <div className="space-y-6 pt-1">
        {isLoading ? (
          <div className="py-16 text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-3 text-xs text-gray-500 font-medium">Fetching comprehensive student ledger...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : data ? (
          <>
            {/* Student Profile Summary Strip */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-brand-500/30 text-brand-300 border border-brand-400/40 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">
                    {data.student.influenceXId}
                  </span>
                  {data.student.collegeStudentId && (
                    <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full text-xs font-mono border border-slate-700">
                      {data.student.collegeStudentId}
                    </span>
                  )}
                  <span className="text-xs text-slate-300">
                    {data.student.branch} • Year {data.student.year}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">{data.student.fullName}</h3>
                <div className="text-xs text-slate-400">{data.student.collegeEmail}</div>
              </div>

              {/* Credits & Tier Badge */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-800/90 border border-slate-700 px-4 py-3 rounded-xl text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cumulative Credits</div>
                  <div className="text-2xl font-black text-amber-300 font-mono">
                    {data.student.totalCredits} <span className="text-xs text-slate-300 font-normal">pts</span>
                  </div>
                </div>
                <div className="bg-indigo-600/30 border border-indigo-500/40 px-4 py-3 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Level Tier</div>
                  <div className="text-base font-bold text-white mt-0.5">{data.student.currentLevel}</div>
                </div>
              </div>
            </div>

            {/* Goodies Unlocked & Distribution Status */}
            {data.goodies.length > 0 && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-amber-600" />
                  Unlocked Goodies & Distribution Tracking
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {data.goodies.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-amber-200/80 text-xs shadow-2xs"
                    >
                      <div>
                        <span className="font-bold text-gray-900">{g.goodieName}</span>
                        <span className="text-[11px] text-gray-500 block">Tier: {g.levelName}</span>
                      </div>
                      <div>
                        {g.status === 'ISSUED' ? (
                          <Badge variant="green" size="sm">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Distributed
                          </Badge>
                        ) : (
                          <Badge variant="amber" size="sm">
                            Pending Handover
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participated Workshops Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  Workshop History & Hall Allocations ({data.workshops.length})
                </h4>
              </div>

              {data.workshops.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500">
                  No workshop registrations found for this student.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface text-gray-600 font-semibold border-b border-gray-200">
                        <th className="py-2.5 px-3">Workshop</th>
                        <th className="py-2.5 px-3">Assigned Hall</th>
                        <th className="py-2.5 px-3 text-center">Attendance</th>
                        <th className="py-2.5 px-3 text-center">Credit Breakdown</th>
                        <th className="py-2.5 px-3 text-right">Total Earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.workshops.map((ws) => (
                        <tr key={ws.workshopId} className="hover:bg-brand-50/20">
                          <td className="py-3 px-3">
                            <div className="font-bold text-gray-900">{ws.name}</div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-1 font-mono">
                              <span>{ws.eventId}</span> • <span>{formatDateIST(ws.date)}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              <Building2 className="w-3 h-3 text-indigo-500" />
                              {ws.assignedHall}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant={
                                ws.attendanceStatus === 'PRESENT'
                                  ? 'green'
                                  : ws.attendanceStatus === 'ABSENT'
                                  ? 'gray'
                                  : 'amber'
                              }
                              size="sm"
                            >
                              {ws.attendanceStatus}
                            </Badge>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="text-[11px] text-gray-600">
                              <span>Reg: <strong>+{ws.creditBreakdown.registration}</strong></span> |{' '}
                              <span>Att: <strong>+{ws.creditBreakdown.attendance}</strong></span> |{' '}
                              <span>Part: <strong>+{ws.creditBreakdown.participation}</strong></span>
                            </div>
                            {ws.participationReason && (
                              <div className="text-[10px] text-indigo-600 italic mt-0.5" title={ws.participationReason}>
                                Reason: {ws.participationReason}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                            +{ws.creditBreakdown.total} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="flex justify-end pt-3 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
