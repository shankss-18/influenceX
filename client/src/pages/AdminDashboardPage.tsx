import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Calendar,
  Award,
  Gift,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  BarChart3,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { formatDateTimeIST } from '../utils/date';

const TIER_COLORS: Record<string, string> = {
  Explorer: '#6B7280',
  Rising: '#3B82F6',
  Creator: '#10B981',
  Leader: '#8B5CF6',
  Icon: '#F59E0B',
};

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { error } = useToast();

  const [rangeMonths, setRangeMonths] = useState<number>(6);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchAnalytics = async (showRefreshSpinner = false) => {
    try {
      if (showRefreshSpinner) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await api.get<{
        success: boolean;
        kpis: any;
        actionQueues: any;
        studentsByLevel: any[];
        monthlyTrends: any[];
        categoryBreakdown: any[];
        topStudents: any[];
        insights: any;
        serverTimeIST: string;
        isCached: boolean;
        cachedAt: string;
      }>(`/analytics/dashboard?rangeMonths=${rangeMonths}`);

      if (res.data.success) {
        setAnalytics(res.data);
      }
    } catch (err: any) {
      error('Failed to load analytics', err.response?.data?.error || 'Unable to fetch analytics dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [rangeMonths]);

  if (isLoading && !analytics) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-xs font-medium text-gray-500">Aggregating platform metrics & digital ledger data...</p>
      </div>
    );
  }

  const { kpis, actionQueues, studentsByLevel, monthlyTrends, categoryBreakdown, topStudents, insights } =
    analytics || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Analytics & Platform Overview"
            description="Real-time performance metrics, digital credit ledger analytics, and operational action queues."
          />
        </div>

        <div className="flex items-center gap-3">
          {analytics?.isCached && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Cached (60s TTL)
            </span>
          )}

          <div className="w-36">
            <Select
              value={rangeMonths.toString()}
              onChange={(e) => setRangeMonths(parseInt(e.target.value, 10))}
              options={[
                { value: '3', label: 'Last 3 Months' },
                { value: '6', label: 'Last 6 Months' },
                { value: '12', label: 'Last 12 Months' },
              ]}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAnalytics(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ACTION QUEUES / INSIGHTS BANNER */}
      {actionQueues && (actionQueues.pendingCreditApprovalsCount > 0 || actionQueues.pendingRewardClaimsCount > 0 || actionQueues.pendingAttendanceCorrectionsCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-amber-900 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block text-sm">Action Items Pending Administrator Review</span>
              <span className="text-amber-700">
                {actionQueues.pendingCreditApprovalsCount} credit approvals, {actionQueues.pendingRewardClaimsCount} reward claims, and {actionQueues.pendingAttendanceCorrectionsCount} attendance corrections awaiting review.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {actionQueues.pendingRewardClaimsCount > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/admin/rewards')}
                className="text-xs bg-amber-600 hover:bg-amber-700 h-8"
              >
                Review Claims ({actionQueues.pendingRewardClaimsCount})
              </Button>
            )}
            {actionQueues.pendingCreditApprovalsCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/admin/events')}
                className="text-xs h-8"
              >
                Credit Approvals ({actionQueues.pendingCreditApprovalsCount})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500">Total Students</span>
          <div className="text-2xl font-bold text-gray-900 mt-2">{kpis?.totalStudents || 0}</div>
          <span className="text-[11px] text-gray-400 mt-1">Verified members</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500">Active This Month</span>
          <div className="text-2xl font-bold text-brand-600 mt-2">{kpis?.activeThisMonth || 0}</div>
          <span className="text-[11px] text-emerald-600 mt-1 font-medium">Attended / Active</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500">Events Organized</span>
          <div className="text-2xl font-bold text-gray-900 mt-2">{kpis?.totalEvents || 0}</div>
          <span className="text-[11px] text-gray-400 mt-1">All categories</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500">Total Participation</span>
          <div className="text-2xl font-bold text-gray-900 mt-2">{kpis?.totalParticipation || 0}</div>
          <span className="text-[11px] text-gray-400 mt-1">Active workshop logs</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500">Credits Awarded</span>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {(kpis?.totalCreditsAwarded || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-gray-400 mt-1">On digital ledger</span>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500">Goodies Distributed</span>
          <div className="text-2xl font-bold text-indigo-600 mt-2">{kpis?.rewardsDistributed || 0}</div>
          <span className="text-[11px] text-gray-400 mt-1">Claimed & fulfilled</span>
        </Card>
      </div>

      {/* CHARTS ROW 1: Monthly Engagement & Credits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Attendance vs Active Participation</h3>
              <p className="text-xs text-gray-500">Monthly student engagement across club events</p>
            </div>
            <Activity className="w-4 h-4 text-brand-600" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrends}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPart" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="presentCount"
                  name="Attended Students"
                  stroke="#4F46E5"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPresent)"
                />
                <Area
                  type="monotone"
                  dataKey="participatedCount"
                  name="Active Interaction"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPart)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-gray-900">Engagement Credits Distributed</h3>
              <p className="text-xs text-gray-500">Points issued on the digital ledger per month</p>
            </div>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="creditsDistributed"
                  name="Points Awarded"
                  fill="#4F46E5"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* CHARTS ROW 2: Tier Breakdown & Top 10 Students */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-gray-900">Member Tier Distribution</h3>
            <p className="text-xs text-gray-500 mt-0.5">Students unlocked by verified credit threshold</p>
          </div>
          <div className="h-56 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={studentsByLevel}
                  dataKey="count"
                  nameKey="tier"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {studentsByLevel?.map((entry: any) => (
                    <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || '#6B7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap text-xs">
            {studentsByLevel?.map((entry: any) => (
              <div key={entry.tier} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: TIER_COLORS[entry.tier] }}
                />
                <span className="text-gray-700 font-medium">
                  {entry.tier}: {entry.count}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top 10 Students Leaderboard */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100">
            <div>
              <CardTitle className="text-sm">Top 10 High-Performing Students</CardTitle>
              <CardDescription>Official verified standings from digital credit ledger</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/leaderboard')}
              className="text-xs text-brand-600 hover:text-brand-700"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Full Standings
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <TableHead>InfluenceX ID</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topStudents?.slice(0, 5).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-center font-bold text-xs">
                      {s.rank === 1 ? '🥇 1' : s.rank === 2 ? '🥈 2' : s.rank === 3 ? '🥉 3' : `#${s.rank}`}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-brand-700">
                      {s.influenceXId}
                    </TableCell>
                    <TableCell className="font-semibold text-gray-900 text-xs">{s.fullName}</TableCell>
                    <TableCell className="text-xs text-gray-600">{s.branch} • Y{s.year}</TableCell>
                    <TableCell>
                      <Badge variant={s.currentLevel === 'Icon' ? 'amber' : s.currentLevel === 'Leader' ? 'brand' : 'gray'} size="sm">
                        {s.currentLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-extrabold text-xs text-gray-900">
                      {s.credits} pts
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
