import React, { useState, useEffect } from 'react';
import { Gift, Package, CheckCircle2, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { Reward, RewardClaim } from '../../types';
import { formatDateTimeIST } from '../../utils/date';

export const StudentRewardsPage: React.FC = () => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'catalog' | 'my-claims'>('catalog');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [myClaims, setMyClaims] = useState<RewardClaim[]>([]);
  const [myCredits, setMyCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rewardsRes, claimsRes, profileRes] = await Promise.all([
        api.get<{ success: boolean; rewards: Reward[] }>('/rewards'),
        api.get<{ success: boolean; claims: RewardClaim[] }>('/rewards/my-claims'),
        api.get<{ success: boolean; student: any }>('/students/me/credits'),
      ]);

      if (rewardsRes.data.success) setRewards(rewardsRes.data.rewards);
      if (claimsRes.data.success) setMyClaims(claimsRes.data.claims);
      if (profileRes.data.success) setMyCredits(profileRes.data.student.liveTotalCredits || 0);
    } catch (err: any) {
      error('Failed to load rewards', err.response?.data?.error || 'Unable to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleClaim = async (reward: Reward) => {
    try {
      setClaimingId(reward.id);
      const res = await api.post<{ success: boolean; message: string }>(`/rewards/${reward.id}/claim`, {});
      if (res.data.success) {
        success('Claim Submitted', res.data.message);
        fetchData();
        setActiveTab('my-claims');
      }
    } catch (err: any) {
      error('Claim Failed', err.response?.data?.error || 'Unable to claim reward');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Rewards & Goodies Store"
        description="Redeem your verified engagement points for exclusive club gear, tech goodies, and summit passes."
        badge={
          <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
            Available: {myCredits} Credits
          </span>
        }
      />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-colors ${
              activeTab === 'catalog'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Goodies Catalog ({rewards.length})
          </button>
          <button
            onClick={() => setActiveTab('my-claims')}
            className={`py-3 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 ${
              activeTab === 'my-claims'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>My Claim History</span>
            {myClaims.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                {myClaims.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {isLoading ? (
        <div className="p-16 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs text-gray-500">Loading catalog items...</p>
        </div>
      ) : activeTab === 'catalog' ? (
        /* CATALOG GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {rewards.map((reward) => {
            const hasEnoughCredits = myCredits >= reward.requiredCredits;
            const inStock = reward.availableQuantity > 0;
            const alreadyClaimed = myClaims.some(
              (c) => (c.rewardId as any)?.id === reward.id && (c.status === 'REQUESTED' || c.status === 'APPROVED')
            );

            return (
              <Card key={reward.id} className="flex flex-col justify-between hover:border-gray-300 transition-colors">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="gray" size="sm">
                      {reward.category}
                    </Badge>
                    <Badge variant={inStock ? 'green' : 'red'} size="sm">
                      {inStock ? `${reward.availableQuantity} in stock` : 'Out of Stock'}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{reward.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                      {reward.description}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-surface border border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Required Points:</span>
                    <span className="font-extrabold text-brand-700 text-sm">{reward.requiredCredits} pts</span>
                  </div>
                </CardContent>

                <div className="p-4 bg-gray-50/75 border-t border-gray-100 rounded-b-lg flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {alreadyClaimed
                      ? 'Claim In Review'
                      : !inStock
                      ? 'Stock Depleted'
                      : hasEnoughCredits
                      ? 'Unlocked!'
                      : `Need ${reward.requiredCredits - myCredits} more pts`}
                  </span>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!hasEnoughCredits || !inStock || alreadyClaimed || claimingId === reward.id}
                    isLoading={claimingId === reward.id}
                    onClick={() => handleClaim(reward)}
                    className="text-xs"
                  >
                    {alreadyClaimed ? 'Requested' : !inStock ? 'Out of Stock' : 'Redeem Goodie'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* MY CLAIMS TABLE */
        <Card>
          <CardContent className="p-0">
            {myClaims.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={<Gift className="w-6 h-6 text-gray-400" />}
                  title="No items claimed yet"
                  description="Browse the goodies catalog and redeem your points once you reach the required threshold."
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
                    <TableHead>Collection Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myClaims.map((claim) => {
                    const reward = claim.rewardId as any;

                    return (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <div className="font-bold text-gray-900 text-xs sm:text-sm">{reward?.name}</div>
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
                        <TableCell className="text-xs text-gray-600">
                          {claim.status === 'DISTRIBUTED' ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Collected / Fulfilled
                            </span>
                          ) : claim.status === 'REQUESTED' ? (
                            <span className="text-amber-700 font-medium flex items-center gap-1">
                              <Clock className="w-4 h-4 text-amber-600" />
                              Ready for desk pickup
                            </span>
                          ) : (
                            <span className="text-gray-400">Resolved</span>
                          )}
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
    </div>
  );
};
