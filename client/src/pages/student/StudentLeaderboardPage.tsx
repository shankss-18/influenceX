import React, { useState, useEffect } from 'react';
import { Trophy, Award, TrendingUp, Sparkles, Filter } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { LeaderboardEntry } from '../../types';

export const StudentLeaderboardPage: React.FC = () => {
  const { error } = useToast();

  const [timeframe, setTimeframe] = useState<'overall' | 'monthly'>('overall');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [myInfo, setMyInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('timeframe', timeframe);
      if (branchFilter) params.append('branch', branchFilter);

      const [leadRes, profileRes] = await Promise.all([
        api.get<{
          success: boolean;
          timeframe: string;
          currentMonth?: string;
          leaderboard: LeaderboardEntry[];
        }>(`/leaderboard?${params.toString()}`),
        api.get<{ success: boolean; student: any }>('/students/me/credits'),
      ]);

      if (leadRes.data.success) {
        setLeaderboard(leadRes.data.leaderboard);
        if (leadRes.data.currentMonth) setCurrentMonth(leadRes.data.currentMonth);
      }
      if (profileRes.data.success) setMyInfo(profileRes.data.student);
    } catch (err: any) {
      error('Failed to load rankings', err.response?.data?.error || 'Unable to fetch standings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe, branchFilter]);

  const myRankEntry = leaderboard.find((item) => item.influenceXId === myInfo?.influenceXId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Club Standings & Leaderboard"
        description="Official student rankings computed directly from the verified digital credit ledger."
      />

      {/* Personal Rank Banner */}
      {myInfo && (
        <div className="bg-gradient-to-r from-brand-600 to-indigo-700 rounded-lg p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-brand-200 block">
              Your Current Standing
            </span>
            <h2 className="text-xl font-bold mt-1">{myInfo.fullName}</h2>
            <p className="text-xs text-brand-200 mt-0.5">
              InfluenceX ID: <span className="font-mono font-medium text-white">{myInfo.influenceXId}</span> • Tier: {myInfo.currentLevel}
            </p>
          </div>

          <div className="flex items-center gap-6 border-t sm:border-t-0 sm:border-l border-brand-500/50 pt-3 sm:pt-0 sm:pl-6">
            <div>
              <span className="text-xs text-brand-200 block">Your Rank</span>
              <span className="text-3xl font-extrabold block mt-0.5">
                {myRankEntry ? `#${myRankEntry.rank}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-brand-200 block">Verified Points</span>
              <span className="text-3xl font-extrabold block mt-0.5">
                {myInfo.liveTotalCredits}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Tab Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setTimeframe('overall')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                timeframe === 'overall'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overall All-Time
            </button>
            <button
              onClick={() => setTimeframe('monthly')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                timeframe === 'monthly'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly Standings {currentMonth ? `(${currentMonth})` : ''}
            </button>
          </div>

          <div className="w-44">
            <Select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              options={[
                { value: '', label: 'All Branches' },
                { value: 'CSE', label: 'Computer Science' },
                { value: 'ECE', label: 'Electronics (ECE)' },
                { value: 'MECH', label: 'Mechanical' },
                { value: 'CIVIL', label: 'Civil' },
                { value: 'IT', label: 'Information Tech' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-16 text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-3 text-xs text-gray-500">Loading standings...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Trophy className="w-6 h-6 text-gray-400" />}
                title="No rankings found"
                description="Standings will appear once points are awarded across club events."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>InfluenceX ID</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Branch & Year</TableHead>
                  <TableHead>Tier Level</TableHead>
                  <TableHead className="text-right">
                    {timeframe === 'monthly' ? 'Monthly Points' : 'Verified Points'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry) => {
                  const isMe = entry.influenceXId === myInfo?.influenceXId;
                  const isPodium = entry.rank <= 3;

                  return (
                    <TableRow
                      key={entry.studentId}
                      className={
                        isMe
                          ? 'bg-brand-50/50 font-semibold border-l-4 border-l-brand-600'
                          : isPodium
                          ? 'bg-amber-50/20'
                          : ''
                      }
                    >
                      <TableCell className="text-center font-bold text-sm">
                        {entry.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs shadow-xs font-bold">
                            🥇 1
                          </span>
                        ) : entry.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-800 text-xs shadow-xs font-bold">
                            🥈 2
                          </span>
                        ) : entry.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 text-xs shadow-xs font-bold">
                            🥉 3
                          </span>
                        ) : (
                          <span className="font-mono text-gray-500">#{entry.rank}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-brand-700">
                        {entry.influenceXId}
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900 text-sm">
                        {entry.fullName} {isMe && <span className="text-brand-600 font-normal ml-1">(You)</span>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {entry.branch} • Year {entry.year}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.currentLevel === 'Icon'
                              ? 'amber'
                              : entry.currentLevel === 'Leader'
                              ? 'brand'
                              : entry.currentLevel === 'Creator'
                              ? 'green'
                              : 'gray'
                          }
                          size="sm"
                        >
                          {entry.currentLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-extrabold text-sm text-gray-900">
                          {entry.credits.toLocaleString()} pts
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
    </div>
  );
};
