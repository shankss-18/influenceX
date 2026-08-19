import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Calendar, Users, Award, TrendingUp, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';

export const AdminReportsPage: React.FC = () => {
  const { success, error } = useToast();

  const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. 2026-08
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{
        success: boolean;
        month: string;
        summary: any;
        topRankings: any[];
      }>(`/reports/monthly?month=${selectedMonth}`);

      if (res.data.success) {
        setReportData(res.data);
      }
    } catch (err: any) {
      error('Report Load Failed', err.response?.data?.error || 'Unable to generate monthly report');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth]);

  const handleExportExcel = () => {
    window.open(`/api/reports/monthly/export?month=${selectedMonth}`, '_blank');
    success('Export Started', `Downloading multi-sheet Excel report for ${selectedMonth}...`);
  };

  const { summary, topRankings } = reportData || {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Monthly Reporting & Exports"
          description="Generate reproducible multi-sheet executive Excel workbooks covering all platform modules."
        />

        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              options={[
                { value: '2026-08', label: 'August 2026' },
                { value: '2026-07', label: 'July 2026' },
                { value: '2026-06', label: 'June 2026' },
                { value: '2026-05', label: 'May 2026' },
              ]}
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportExcel}
            leftIcon={<Download className="w-4 h-4 text-emerald-300" />}
            className="bg-emerald-700 hover:bg-emerald-800"
          >
            Export Multi-Sheet .xlsx
          </Button>
        </div>
      </div>

      {/* Overview Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3 text-xs text-emerald-900">
        <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-sm block">Comprehensive 7-Sheet Executive Workbook</span>
          The exported `.xlsx` workbook includes separate tabs for: <strong>1. Summary KPIs, 2. Students Directory, 3. Credit Ledger, 4. Attendance Roster, 5. Events Catalog, 6. Rewards & Claims, 7. Monthly Rankings</strong> — with frozen headers, styling, and filters.
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Aggregating monthly report for {selectedMonth}...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <span className="text-xs text-gray-500 font-semibold block">Events Held</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">{summary?.totalEvents || 0}</div>
              <span className="text-[11px] text-gray-400">In {selectedMonth}</span>
            </Card>

            <Card className="p-4">
              <span className="text-xs text-gray-500 font-semibold block">Credits Distributed</span>
              <div className="text-2xl font-bold text-brand-600 mt-1">
                {summary?.totalCreditsDistributed || 0} pts
              </div>
              <span className="text-[11px] text-gray-400">Approved transactions</span>
            </Card>

            <Card className="p-4">
              <span className="text-xs text-gray-500 font-semibold block">Attendance Rate</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {summary?.attendanceRate || '100%'}
              </div>
              <span className="text-[11px] text-gray-400">
                {summary?.presentCount} of {summary?.totalAttendanceMarked} present
              </span>
            </Card>

            <Card className="p-4">
              <span className="text-xs text-gray-500 font-semibold block">Goodies Claimed</span>
              <div className="text-2xl font-bold text-indigo-600 mt-1">{summary?.rewardsClaimed || 0}</div>
              <span className="text-[11px] text-gray-400">Redemption claims</span>
            </Card>
          </div>

          {/* Top Rankings in that Month */}
          <Card>
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-sm">Month-End Snapshot Standings: {selectedMonth}</CardTitle>
              <CardDescription>Verified rank snapshot taken at month-end for official club rewards</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topRankings?.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No snapshot recorded for {selectedMonth} yet. Use the Leaderboard page to trigger a snapshot.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Rank</TableHead>
                      <TableHead>InfluenceX ID</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Credits in {selectedMonth}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRankings?.map((snap: any) => (
                      <TableRow key={snap.student?.id || snap.rank}>
                        <TableCell className="text-center font-bold text-xs">
                          {snap.rank === 1 ? '🥇 1' : snap.rank === 2 ? '🥈 2' : snap.rank === 3 ? '🥉 3' : `#${snap.rank}`}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-brand-700">
                          {snap.student?.influenceXId || '—'}
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900 text-xs">
                          {snap.student?.fullName || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {snap.student?.branch || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="gray" size="sm">
                            {snap.student?.currentLevel || 'Explorer'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-xs text-gray-900">
                          {snap.creditsThisMonth} pts
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
    </div>
  );
};
