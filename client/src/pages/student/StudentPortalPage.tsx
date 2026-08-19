import React, { useState, useEffect } from 'react';
import {
  Award,
  Trophy,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Clock,
  Building2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Gift,
  RefreshCw,
  Zap,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { formatTime12hIST, formatDateIST } from '../../utils/date';

interface StudentPortalData {
  student: {
    id: string;
    fullName: string;
    influenceXId: string;
    collegeStudentId: string;
    branch: string;
    year: number;
    collegeEmail: string;
  };
  creditsSummary: {
    totalCredits: number;
    currentLevel: string;
    currentLevelNumber: number;
    nextLevel: string | null;
    nextThreshold: number;
    progressPercentage: number;
    creditsNeededForNext: number;
    goodieReward: string | null;
    goodieStatus?: 'PENDING' | 'ISSUED';
    goodieIssuedAt?: string | null;
  };
  leaderboard: {
    overallRank: number;
    totalStudents: number;
    categoryRank: number;
    categoryName: string;
    top10: Array<{
      rank: number;
      studentId: string;
      fullName: string;
      influenceXId: string;
      credits: number;
      currentLevel: string;
      isCurrentUser: boolean;
    }>;
    isUserInTop10: boolean;
    userLeaderboardRow: {
      rank: number;
      studentId: string;
      fullName: string;
      influenceXId: string;
      credits: number;
      currentLevel: string;
      isCurrentUser: boolean;
    };
  };
  registeredWorkshops: Array<{
    id: string;
    eventId: string;
    name: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    venue?: string;
    assignedHall?: string;
    assignedOrder?: number;
    statusCategory: 'Registered — hall pending' | 'Registered — hall assigned' | 'Attended' | 'Missed';
    creditBreakdown: {
      registration: number;
      attendance: number;
      participation: number;
      total: number;
    };
  }>;
  upcomingWorkshops: Array<{
    id: string;
    eventId: string;
    name: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    venue?: string;
    registrationFormUrl: string;
    notice: string;
  }>;
}

export const StudentPortalPage: React.FC = () => {
  const { user } = useAuth();
  const { error } = useToast();

  const [data, setData] = useState<StudentPortalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchPortalData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<StudentPortalData>('/student-portal/portal');
      setData(res.data);
    } catch (err: any) {
      error('Portal Error', err.response?.data?.error || 'Failed to load student portal');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 text-brand-600 animate-spin mb-3" />
        <p className="text-sm text-gray-500 font-medium">Loading your student portal...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900">Student Profile Not Found</h2>
        <p className="text-xs text-gray-500 mt-1">Unable to load your student record. Please contact the club administrator.</p>
      </div>
    );
  }

  const { student, creditsSummary, leaderboard, registeredWorkshops, upcomingWorkshops } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* 1. HERO HEADER & LIVE CREDIT SUMMARY */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800 text-white">
        {/* Subtle Glow Accent */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            {/* Badges Pill Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-brand-500/30 text-brand-300 border border-brand-400/40 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider">
                {student.influenceXId}
              </span>
              {student.collegeStudentId && (
                <span className="bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-full text-xs font-mono">
                  {student.collegeStudentId}
                </span>
              )}
              <span className="bg-slate-800/80 text-slate-300 px-3 py-1 rounded-full text-xs font-medium border border-slate-700">
                {student.branch} • Year {student.year}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {student.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              NIAT Influencers Club • Student Credit Ledger & Workshop Portal
            </p>
          </div>

          {/* Credits Big Highlight Box */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 flex items-center gap-4 min-w-[240px] shadow-lg">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                Total Credits
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight">
                {creditsSummary.totalCredits} <span className="text-sm font-semibold text-slate-300">pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level Progression Bar */}
        <div className="mt-8 pt-6 border-t border-slate-800/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-white bg-indigo-600/80 border border-indigo-500/50 px-3 py-1 rounded-lg text-xs">
                Level {creditsSummary.currentLevelNumber}: {creditsSummary.currentLevel}
              </span>
              {creditsSummary.goodieReward && (
                creditsSummary.goodieStatus === 'ISSUED' ? (
                  <span className="text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    🎁 Claimed & Distributed: {creditsSummary.goodieReward}
                  </span>
                ) : (
                  <span className="text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                    <Gift className="w-3.5 h-3.5 text-amber-400" />
                    🎁 Unlocked: {creditsSummary.goodieReward} (Pending Distribution)
                  </span>
                )
              )}
            </div>

            <div className="text-slate-300 font-medium">
              {creditsSummary.nextLevel ? (
                <span>
                  <strong className="text-amber-300">{creditsSummary.creditsNeededForNext} pts</strong> needed for{' '}
                  <strong className="text-white">{creditsSummary.nextLevel}</strong>
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Max Tier Reached!
                </span>
              )}
            </div>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${creditsSummary.progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. LEADERBOARD POSITION & RANKINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Overall & Category Rank Badges */}
        <div className="space-y-4">
          <Card className="border-gray-200/80 shadow-xs bg-white">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                Overall Rank
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-gray-900 font-mono">
                  #{leaderboard.overallRank}
                </span>
                <span className="text-xs text-gray-500 font-medium">out of {leaderboard.totalStudents} students</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200/80 shadow-xs bg-white">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-500" />
                Category Rank
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-indigo-700 font-mono">
                  #{leaderboard.categoryRank}
                </span>
                <span className="text-xs text-gray-500 font-medium">in {leaderboard.categoryName} category</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Top 10 Leaderboard Table */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">Leaderboard Rankings (Top 10)</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Real-time club standings based on verified event and workshop credits
                </CardDescription>
              </div>
              <Badge variant="gray">Global</Badge>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-gray-600 font-semibold border-b border-gray-100">
                    <th className="py-3 px-4 w-14 text-center">Rank</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">IXID</th>
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4 text-right">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.top10.map((row) => (
                    <tr
                      key={row.studentId}
                      className={
                        row.isCurrentUser
                          ? 'bg-brand-50/90 font-bold text-brand-950 border-l-4 border-l-brand-600'
                          : 'hover:bg-gray-50/60 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-4 text-center font-mono font-bold">
                        {row.rank === 1 ? '🥇 1' : row.rank === 2 ? '🥈 2' : row.rank === 3 ? '🥉 3' : `#${row.rank}`}
                      </td>
                      <td className="py-2.5 px-4">
                        {row.fullName} {row.isCurrentUser && <span className="text-[10px] text-brand-600 font-bold ml-1">(You)</span>}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-500">{row.influenceXId}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="brand" className="text-[10px]">
                          {row.currentLevel}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-gray-900">
                        {row.credits} pts
                      </td>
                    </tr>
                  ))}

                  {/* If user is outside Top 10, show their highlighted row at bottom */}
                  {!leaderboard.isUserInTop10 && leaderboard.userLeaderboardRow && (
                    <>
                      <tr>
                        <td colSpan={5} className="py-1 text-center text-gray-400 font-bold bg-gray-50 text-[10px]">
                          •••
                        </td>
                      </tr>
                      <tr className="bg-brand-50/90 font-bold text-brand-950 border-l-4 border-l-brand-600">
                        <td className="py-2.5 px-4 text-center font-mono">#{leaderboard.userLeaderboardRow.rank}</td>
                        <td className="py-2.5 px-4">
                          {leaderboard.userLeaderboardRow.fullName} <span className="text-[10px] text-brand-700 ml-1">(You)</span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-brand-800">{leaderboard.userLeaderboardRow.influenceXId}</td>
                        <td className="py-2.5 px-4">
                          <Badge variant="brand" className="text-[10px]">
                            {leaderboard.userLeaderboardRow.currentLevel}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-brand-900">
                          {leaderboard.userLeaderboardRow.credits} pts
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. REGISTERED WORKSHOPS (STATUS-AWARE) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Your Registered Workshops</h2>
          <p className="text-xs text-gray-500">Live roster assignments, halls, timings, and attendance status.</p>
        </div>

        {registeredWorkshops.length === 0 ? (
          <Card className="border-gray-200 p-8 text-center bg-white shadow-xs">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-800">No Workshop Registrations Yet</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Check out the upcoming sessions below and submit the registration form to join upcoming workshops.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registeredWorkshops.map((ws) => {
              const isHallAssigned = ws.statusCategory === 'Registered — hall assigned';
              const isAttended = ws.statusCategory === 'Attended';
              const isPending = ws.statusCategory === 'Registered — hall pending';
              const isMissed = ws.statusCategory === 'Missed';

              return (
                <Card key={ws.id} className="border-gray-200 shadow-xs hover:border-brand-300 transition-all bg-white">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-mono font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded border border-brand-200">
                        {ws.eventId}
                      </span>

                      {isAttended && <Badge variant="green">Attended (+{ws.creditBreakdown.total} pts)</Badge>}
                      {isHallAssigned && <Badge variant="brand">Registered — Hall Assigned</Badge>}
                      {isPending && <Badge variant="amber">Registered — Hall Pending</Badge>}
                      {isMissed && <Badge variant="gray">Missed</Badge>}
                    </div>

                    <CardTitle className="text-base font-bold text-gray-900">{ws.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2 text-gray-500 mt-1">
                      {ws.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-gray-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDateIST(ws.date)}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-gray-900">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {formatTime12hIST(ws.startTime)} — {formatTime12hIST(ws.endTime)} IST
                        </span>
                      </div>

                      {ws.assignedHall && (
                        <div className="flex items-center gap-1.5 font-bold text-indigo-800 pt-1.5 border-t border-gray-200/70">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                          Assigned Hall: {ws.assignedHall}
                        </div>
                      )}
                    </div>

                    {/* Credits Breakdown for Attended or Registered */}
                    <div className="flex items-center justify-between text-[11px] px-1 text-gray-600 pt-1 border-t border-gray-100">
                      <span>Reg: +{ws.creditBreakdown.registration}</span>
                      <span>Att: +{ws.creditBreakdown.attendance}</span>
                      <span>Part: +{ws.creditBreakdown.participation}</span>
                      <span className="font-bold text-gray-900">Total: {ws.creditBreakdown.total} pts</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. UPCOMING WORKSHOPS WITH REGISTRATION LINK */}
      {upcomingWorkshops.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Upcoming Workshops (Open Registration)</h2>
            <p className="text-xs text-gray-500">Apply for upcoming sessions. Rosters are confirmed after admin upload.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingWorkshops.map((ev) => (
              <Card key={ev.id} className="border-gray-200 shadow-xs hover:border-brand-300 transition-all bg-white">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                      {ev.eventId}
                    </span>
                    <Badge variant="brand">Open for Registration</Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-gray-900">{ev.name}</CardTitle>
                  <CardDescription className="text-xs text-gray-500 line-clamp-2 mt-1">
                    {ev.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 p-3 bg-slate-50 rounded-xl border border-gray-100">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatDateIST(ev.date)}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-gray-900">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {formatTime12hIST(ev.startTime)} — {formatTime12hIST(ev.endTime)} IST
                    </span>
                  </div>

                  <div className="pt-1">
                    <a
                      href={ev.registrationFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Register for Workshop (Google Form)
                    </a>
                  </div>

                  <p className="text-[11px] text-gray-400 text-center italic">
                    Registration submitted — you'll be confirmed once the organizing team finalizes the roster.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
