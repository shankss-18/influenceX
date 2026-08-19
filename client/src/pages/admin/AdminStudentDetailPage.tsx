import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  BookOpen,
  Award,
  Shield,
  Layers,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserCheck,
  Gift,
  Trophy,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { Student, CreditTransaction, RewardClaim } from '../../types';
import { formatDateIST, formatDateTimeIST } from '../../utils/date';

type TabKey =
  | 'overview'
  | 'events'
  | 'attendance'
  | 'credits'
  | 'ranks'
  | 'badges'
  | 'rewards'
  | 'activity'
  | 'audit';

export const AdminStudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [student, setStudent] = useState<Student | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [liveCredits, setLiveCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const fetchStudentData = async () => {
    try {
      setIsLoading(true);
      const [studentRes, creditsRes, claimsRes] = await Promise.all([
        api.get<{ success: boolean; student: Student }>(`/students/${id}`),
        api.get<{ success: boolean; student: any; transactions: CreditTransaction[] }>(`/students/${id}/credits`),
        api.get<{ success: boolean; claims: RewardClaim[] }>(`/rewards/claims?studentId=${id}`),
      ]);

      if (studentRes.data.success) {
        setStudent(studentRes.data.student);
      }
      if (creditsRes.data.success) {
        setTransactions(creditsRes.data.transactions);
        setLiveCredits(creditsRes.data.student.liveTotalCredits || 0);
      }
      if (claimsRes.data.success) {
        setClaims(claimsRes.data.claims);
      }
    } catch (err: any) {
      error('Failed to load student', err.response?.data?.error || 'Student not found');
      navigate('/admin/students');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  const handleStatusUpdate = async (newStatus: 'APPROVED' | 'DISABLED' | 'PENDING') => {
    if (!student) return;
    try {
      setIsUpdatingStatus(true);
      const res = await api.patch<{ success: boolean; student: Student }>(`/students/${student.id}/status`, {
        status: newStatus,
        reason: `Status changed to ${newStatus} from student detail page`,
      });
      if (res.data.success) {
        success('Status Updated', `Student status set to ${newStatus}`);
        setStudent(res.data.student);
      }
    } catch (err: any) {
      error('Update failed', err.response?.data?.error || 'Unable to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-xs font-medium text-gray-500">Loading student profile...</p>
      </div>
    );
  }

  if (!student) return null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'credits', label: `Credits Ledger (${transactions.length})` },
    { key: 'ranks', label: 'Ranks & Standing' },
    { key: 'rewards', label: `Goodies & Rewards (${claims.length})` },
    { key: 'events', label: 'Events' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'badges', label: 'Badges' },
    { key: 'activity', label: 'Activity' },
    { key: 'audit', label: 'Audit' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back Button & Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/students')}
          className="text-gray-500 hover:text-gray-900 mb-3 -ml-2"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Students Directory
        </Button>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-bold text-xl shrink-0">
              {student.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                  {student.influenceXId}
                </span>
                <Badge
                  variant={
                    student.status === 'APPROVED'
                      ? 'green'
                      : student.status === 'PENDING'
                      ? 'amber'
                      : 'red'
                  }
                  size="sm"
                  dot
                >
                  {student.status}
                </Badge>
                <Badge variant="gray" size="sm">
                  {student.currentLevel}
                </Badge>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mt-1.5">{student.fullName}</h1>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Roll No: {student.collegeStudentId} • {student.branch} Year {student.year} ({student.section})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
            {student.status === 'PENDING' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStatusUpdate('APPROVED')}
                isLoading={isUpdatingStatus}
                leftIcon={<UserCheck className="w-4 h-4" />}
              >
                Approve Student
              </Button>
            )}
            {student.status === 'APPROVED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusUpdate('DISABLED')}
                isLoading={isUpdatingStatus}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Disable Profile
              </Button>
            )}
            {student.status === 'DISABLED' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleStatusUpdate('APPROVED')}
                isLoading={isUpdatingStatus}
              >
                Re-enable Profile
              </Button>
            )}
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

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Academic & Contact Records</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100 p-0">
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Full Legal Name</span>
                <span className="text-gray-900 font-medium">{student.fullName}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">InfluenceX Permanent ID</span>
                <span className="font-mono font-semibold text-brand-700">{student.influenceXId}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">College Student ID (Roll No)</span>
                <span className="font-mono text-gray-900">{student.collegeStudentId}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Official College Email</span>
                <span className="text-gray-900">{student.collegeEmail}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Phone Number</span>
                <span className="text-gray-900">{student.phone || '—'}</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Academic Department</span>
                <span className="text-gray-900">{student.branch} Department</span>
              </div>
              <div className="px-6 py-3.5 flex justify-between text-xs sm:text-sm">
                <span className="text-gray-500 font-medium">Enrolled Joining Date</span>
                <span className="text-gray-900">{formatDateIST(student.joiningDate)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Engagement Points Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <span className="text-xs text-gray-500 block">Verified Ledger Balance</span>
                  <span className="text-2xl font-bold text-gray-900 mt-1 block">
                    {liveCredits} Credits
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500 block">Current Club Tier</span>
                  <span className="text-base font-bold text-brand-700 mt-0.5 block">
                    {student.currentLevel}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Credits Ledger */}
      {activeTab === 'credits' && (
        <Card>
          <CardHeader>
            <CardTitle>Digital Credit Ledger ({transactions.length} Transactions)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Award className="w-6 h-6 text-gray-400" />}
                  title="No credit transactions on record"
                  description="Transactions will appear here when points are awarded."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Rule Type</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Awarded By</TableHead>
                    <TableHead>Date (IST)</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const event = tx.eventId as any;
                    const awardedBy = tx.awardedBy as any;
                    const isPositive = tx.amount > 0;

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs font-bold text-brand-700">
                          {tx.transactionId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="gray" size="sm">
                            {tx.creditType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {event?.name || 'General Platform'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                          {tx.reason}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {awardedBy?.name || 'Admin'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatDateTimeIST(tx.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-extrabold text-xs ${
                              isPositive ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {isPositive ? `+${tx.amount}` : tx.amount} pts
                          </span>
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

      {/* Tab: Ranks & Standing */}
      {activeTab === 'ranks' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="p-6 text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Verified Credit Balance</span>
            <div className="text-3xl font-extrabold text-gray-900">{liveCredits} pts</div>
            <p className="text-xs text-gray-500">Total verified points calculated live from ledger</p>
          </Card>
          <Card className="p-6 text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Current Member Tier</span>
            <div className="text-3xl font-extrabold text-brand-700">{student.currentLevel}</div>
            <p className="text-xs text-gray-500">Calculated automatically from active tier thresholds</p>
          </Card>
        </div>
      )}

      {/* Tab: Rewards & Goodies */}
      {activeTab === 'rewards' && (
        <Card>
          <CardHeader>
            <CardTitle>Claimed Goodies & Swag ({claims.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {claims.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Gift className="w-6 h-6 text-gray-400" />}
                  title="No goodies claimed by this student"
                  description="Redemption claims submitted by this student will appear here."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reward Item</TableHead>
                    <TableHead>Points Redeemed</TableHead>
                    <TableHead>Claim Date (IST)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => {
                    const reward = claim.rewardId as any;
                    return (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <div className="font-bold text-gray-900 text-xs">{reward?.name}</div>
                          <div className="text-[11px] text-gray-500">{reward?.category}</div>
                        </TableCell>
                        <TableCell className="font-bold text-xs text-gray-900">
                          {reward?.requiredCredits} pts
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatDateTimeIST(claim.requestedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              claim.status === 'DISTRIBUTED'
                                ? 'green'
                                : claim.status === 'REQUESTED'
                                ? 'amber'
                                : 'red'
                            }
                            size="sm"
                            dot
                          >
                            {claim.status}
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
      )}

      {/* Other Placeholder Tabs */}
      {activeTab !== 'overview' &&
        activeTab !== 'credits' &&
        activeTab !== 'ranks' &&
        activeTab !== 'rewards' && (
          <EmptyState
            icon={<Layers className="w-6 h-6 text-gray-400" />}
            title={`${activeTab.toUpperCase()} Module — Phase 5`}
            description={`The student ${activeTab} data will be activated in upcoming development phases.`}
            action={
              <div className="text-xs font-medium text-gray-500 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-200">
                Phase 4 Credit Ledger & Rewards Live
              </div>
            }
          />
        )}
    </div>
  );
};
