import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Award,
  Calendar,
  Layers,
  Search,
  Gift,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { StudentDetailModal } from '../../components/student/StudentDetailModal';
import { api } from '../../api/client';

const TIERS = [
  { name: 'Explorer', color: 'text-blue-700 bg-blue-50 border-blue-200', badge: 'brand', icon: '🌱', range: '0–99 pts' },
  { name: 'Rising', color: 'text-purple-700 bg-purple-50 border-purple-200', badge: 'brand', icon: '🚀', range: '100–249 pts' },
  { name: 'Creator', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', badge: 'green', icon: '🎨', range: '250–499 pts' },
  { name: 'Leader', color: 'text-amber-700 bg-amber-50 border-amber-200', badge: 'amber', icon: '⭐', range: '500–999 pts' },
  { name: 'Icon', color: 'text-rose-700 bg-rose-50 border-rose-200', badge: 'red', icon: '👑', range: '1000+ pts' },
];

export const AdminLeaderboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [scope, setScope] = useState<'all-time' | 'monthly' | 'workshop'>('all-time');
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectStudentId, setInspectStudentId] = useState<string | null>(null);

  const [workshops, setWorkshops] = useState<Array<{ id: string; eventId: string; name: string; date: string }>>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({
    Explorer: 0,
    Rising: 0,
    Creator: 0,
    Leader: 0,
    Icon: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('scope', scope);
      if (scope === 'workshop' && selectedWorkshopId) {
        params.append('workshopId', selectedWorkshopId);
      }
      if (selectedTier !== 'ALL') {
        params.append('tier', selectedTier);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await api.get<{
        success: boolean;
        scope: string;
        workshops: Array<{ id: string; eventId: string; name: string; date: string }>;
        tierCounts: Record<string, number>;
        totalStudents: number;
        rankings: any[];
      }>(`/leaderboard?${params.toString()}`);

      if (res.data.success) {
        setRankings(res.data.rankings);
        setTierCounts(res.data.tierCounts);
        setWorkshops(res.data.workshops);
        if (!selectedWorkshopId && res.data.workshops.length > 0) {
          setSelectedWorkshopId(res.data.workshops[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [scope, selectedWorkshopId, selectedTier]);

  const getTierBadge = (level: string) => {
    switch (level) {
      case 'Icon':
        return <Badge variant="red" size="sm">👑 Icon (1000+)</Badge>;
      case 'Leader':
        return <Badge variant="amber" size="sm">⭐ Leader (500+)</Badge>;
      case 'Creator':
        return <Badge variant="green" size="sm">🎨 Creator (250+)</Badge>;
      case 'Rising':
        return <Badge variant="brand" size="sm">🚀 Rising (100+)</Badge>;
      default:
        return <Badge variant="gray" size="sm">🌱 Explorer (0–99)</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span>Leaderboards & Rankings</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            View student rank distributions, overall standing, and category breakdowns across scopes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/goodies')}
            leftIcon={<Gift className="w-3.5 h-3.5 text-brand-600" />}
          >
            Track Level Goodies →
          </Button>
        </div>
      </div>

      {/* 5-Level Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            onClick={() => setSelectedTier(selectedTier === tier.name ? 'ALL' : tier.name)}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              selectedTier === tier.name
                ? 'ring-2 ring-brand-500 bg-white shadow-sm'
                : 'bg-surface hover:bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">{tier.name}</span>
              <span className="text-sm">{tier.icon}</span>
            </div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              {tierCounts[tier.name] || 0}
            </div>
            <span className="text-[10px] text-gray-400 block mt-0.5">{tier.range}</span>
          </div>
        ))}
      </div>

      {/* Scope Controls & Search Bar */}
      <Card className="shadow-xs border-gray-200">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Scope Buttons */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setScope('all-time')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                scope === 'all-time' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All-Time
            </button>
            <button
              type="button"
              onClick={() => setScope('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                scope === 'monthly' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setScope('workshop')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                scope === 'workshop' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              This Workshop
            </button>
          </div>

          {/* Workshop dropdown if workshop scope */}
          {scope === 'workshop' && (
            <select
              value={selectedWorkshopId}
              onChange={(e) => setSelectedWorkshopId(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white font-medium text-gray-900 focus:ring-1 focus:ring-brand-500"
            >
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.eventId})
                </option>
              ))}
            </select>
          )}

          {/* Search Input */}
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search student, IXID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLeaderboard()}
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Segmented Filter Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-4">
        <button
          type="button"
          onClick={() => setSelectedTier('ALL')}
          className={`pb-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            selectedTier === 'ALL'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <span>All Categories</span>
          <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]">
            {Object.values(tierCounts).reduce((a, b) => a + b, 0)}
          </span>
        </button>

        {TIERS.map((tier) => (
          <button
            key={tier.name}
            type="button"
            onClick={() => setSelectedTier(tier.name)}
            className={`pb-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              selectedTier === tier.name
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>{tier.icon} {tier.name}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]">
              {tierCounts[tier.name] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Ranked Table */}
      <Card className="shadow-xs border-gray-200 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="mt-3 text-xs text-gray-500">Loading standings...</p>
            </div>
          ) : rankings.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-500">
              No students found for this scope / filter criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>IXID</TableHead>
                  <TableHead>College ID</TableHead>
                  <TableHead>Branch & Year</TableHead>
                  <TableHead>Total Credits</TableHead>
                  <TableHead>Level Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((s, idx) => (
                  <TableRow
                    key={s.id || s.studentId || idx}
                    onClick={() => setInspectStudentId(s.studentId || s.id)}
                    className="hover:bg-brand-50/40 cursor-pointer transition-colors"
                    title="Click to inspect complete student ledger breakdown"
                  >
                    <TableCell className="text-center font-bold text-xs">
                      {s.rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold">
                          🥇
                        </span>
                      ) : s.rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold">
                          🥈
                        </span>
                      ) : s.rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-900 font-bold">
                          🥉
                        </span>
                      ) : (
                        <span className="text-gray-500 font-mono">#{s.rank}</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                        <span>{s.fullName}</span>
                        <span className="text-[10px] text-brand-600 font-normal underline">Inspect</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-mono text-brand-700">{s.influenceXId}</TableCell>

                    <TableCell className="text-xs font-mono text-gray-500">{s.collegeStudentId || '—'}</TableCell>

                    <TableCell className="text-xs text-gray-600">
                      {s.branch} (Year {s.year})
                    </TableCell>

                    <TableCell>
                      <div className="font-bold text-xs text-indigo-700 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{s.totalCredits} pts</span>
                      </div>
                    </TableCell>

                    <TableCell>{getTierBadge(s.currentLevel)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Student Comprehensive Inspection Modal */}
      <StudentDetailModal
        isOpen={Boolean(inspectStudentId)}
        studentId={inspectStudentId}
        onClose={() => setInspectStudentId(null)}
      />
    </div>
  );
};
