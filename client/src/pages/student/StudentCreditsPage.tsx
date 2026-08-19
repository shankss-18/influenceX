import React, { useState, useEffect } from 'react';
import { Award, Sparkles, TrendingUp, History, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { CreditTransaction } from '../../types';
import { formatDateTimeIST } from '../../utils/date';

export const StudentCreditsPage: React.FC = () => {
  const { error } = useToast();

  const [studentInfo, setStudentInfo] = useState<{
    fullName: string;
    influenceXId: string;
    currentLevel: string;
    liveTotalCredits: number;
  } | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCredits = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{
        success: boolean;
        student: any;
        count: number;
        transactions: CreditTransaction[];
      }>('/students/me/credits');

      if (res.data.success) {
        setStudentInfo(res.data.student);
        setTransactions(res.data.transactions);
      }
    } catch (err: any) {
      error('Failed to load credits', err.response?.data?.error || 'Unable to fetch credit statement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-xs font-medium text-gray-500">Querying your digital credit ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="My Engagement Credits"
        description="Official verified point statement and immutable activity ledger history."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-brand-600 to-indigo-700 text-white border-0 shadow-md">
          <CardContent className="p-6">
            <span className="text-xs uppercase font-bold tracking-wider text-brand-200 block">
              Verified Credit Balance
            </span>
            <div className="text-3xl font-extrabold mt-2 flex items-baseline gap-2">
              {studentInfo?.liveTotalCredits || 0}
              <span className="text-sm font-normal text-brand-200">Points</span>
            </div>
            <p className="text-xs text-brand-200 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Live sum calculated from ledger
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <span className="text-xs uppercase font-semibold text-gray-500 tracking-wider block">
              Current Member Tier
            </span>
            <div className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {studentInfo?.currentLevel || 'Explorer'}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              InfluenceX ID: <span className="font-mono font-medium text-brand-700">{studentInfo?.influenceXId}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <span className="text-xs uppercase font-semibold text-gray-500 tracking-wider block">
              Total Transactions
            </span>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {transactions.length}
            </div>
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              All records verified on-chain ledger
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activity Statement & Points Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Award className="w-6 h-6 text-gray-400" />}
                title="No credits awarded yet"
                description="Participate in workshops, hackathons, and campus initiatives to earn verified InfluenceX points."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Activity Type</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Reason / Notes</TableHead>
                  <TableHead>Awarded Date (IST)</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const event = tx.eventId as any;
                  const isPositive = tx.amount > 0;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs font-semibold text-brand-700">
                        {tx.transactionId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="gray" size="sm">
                          {tx.creditType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-700">
                        {event?.name ? (
                          <span className="font-medium">{event.name}</span>
                        ) : (
                          <span className="text-gray-400">Campus General</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 max-w-xs truncate">
                        {tx.reason}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {formatDateTimeIST(tx.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-extrabold text-sm ${
                            isPositive ? 'text-emerald-600' : 'text-red-600'
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
    </div>
  );
};
