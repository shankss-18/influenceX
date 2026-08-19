import React, { useState, useEffect } from 'react';
import { Gift, Plus, Package, Check, X, Clock, AlertCircle, Sparkles, CheckCircle2, Search, Filter } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { Reward, RewardClaim, RankGoodie } from '../../types';
import { formatDateTimeIST } from '../../utils/date';

export const AdminRewardsPage: React.FC = () => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'rank_goodies' | 'catalog' | 'claims'>('rank_goodies');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [rankGoodies, setRankGoodies] = useState<RankGoodie[]>([]);
  const [goodiesStats, setGoodiesStats] = useState({ total: 0, pendingCount: 0, issuedCount: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters for Rank Goodies
  const [goodiesStatusFilter, setGoodiesStatusFilter] = useState<'ALL' | 'PENDING' | 'ISSUED'>('ALL');
  const [goodiesSearch, setGoodiesSearch] = useState<string>('');

  // Create/Edit Reward Modal
  const [isRewardModalOpen, setIsRewardModalOpen] = useState<boolean>(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    category: 'Goodies',
    requiredCredits: 100,
    totalQuantity: 10,
  });
  const [isSavingReward, setIsSavingReward] = useState<boolean>(false);

  // Distribute / Action State
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rewardsRes, claimsRes, rankGoodiesRes] = await Promise.all([
        api.get<{ success: boolean; rewards: Reward[] }>('/rewards'),
        api.get<{ success: boolean; claims: RewardClaim[] }>('/rewards/claims'),
        api.get<{ success: boolean; stats: any; goodies: RankGoodie[] }>('/rewards/rank-goodies'),
      ]);

      if (rewardsRes.data.success) setRewards(rewardsRes.data.rewards);
      if (claimsRes.data.success) setClaims(claimsRes.data.claims);
      if (rankGoodiesRes.data.success) {
        setRankGoodies(rankGoodiesRes.data.goodies);
        setGoodiesStats(rankGoodiesRes.data.stats || { total: 0, pendingCount: 0, issuedCount: 0 });
      }
    } catch (err: any) {
      error('Failed to load rewards data', err.response?.data?.error || 'Unable to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingReward(null);
    setRewardForm({
      name: '',
      description: '',
      category: 'Goodies',
      requiredCredits: 100,
      totalQuantity: 10,
    });
    setIsRewardModalOpen(true);
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingReward(true);
      if (editingReward) {
        await api.patch(`/rewards/${editingReward.id}`, rewardForm);
        success('Reward Updated', `'${rewardForm.name}' updated.`);
      } else {
        await api.post('/rewards', rewardForm);
        success('Reward Added', `'${rewardForm.name}' created in catalog.`);
      }
      setIsRewardModalOpen(false);
      fetchData();
    } catch (err: any) {
      error('Save Failed', err.response?.data?.error || 'Unable to save reward');
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleDistributeClaim = async (claimId: string) => {
    try {
      setActionInProgressId(claimId);
      const res = await api.post(`/rewards/claims/${claimId}/distribute`, {});
      if (res.data.success) {
        success('Goodies Distributed', res.data.message);
        fetchData();
      }
    } catch (err: any) {
      error('Distribution Failed', err.response?.data?.error || 'Unable to distribute claim');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleToggleRankGoodieStatus = async (goodieId: string, currentStatus: 'PENDING' | 'ISSUED') => {
    const nextStatus = currentStatus === 'PENDING' ? 'ISSUED' : 'PENDING';
    try {
      setActionInProgressId(goodieId);
      const res = await api.patch(`/rewards/rank-goodies/${goodieId}/status`, {
        status: nextStatus,
      });
      if (res.data.success) {
        success('Goodie Status Updated', `Status changed to ${nextStatus}.`);
        fetchData();
      }
    } catch (err: any) {
      error('Update Failed', err.response?.data?.error || 'Unable to update status');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Filtered Rank Goodies
  const filteredRankGoodies = rankGoodies.filter((g) => {
    if (goodiesStatusFilter !== 'ALL' && g.status !== goodiesStatusFilter) return false;
    if (goodiesSearch) {
      const q = goodiesSearch.toLowerCase();
      const st = g.studentId;
      return (
        st?.fullName?.toLowerCase().includes(q) ||
        st?.influenceXId?.toLowerCase().includes(q) ||
        st?.collegeStudentId?.toLowerCase().includes(q) ||
        g.goodieName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goodies & Rewards Management"
        description="Track level-unlocked student goodies (Pending vs Issued) and manage the official merchandise catalogue."
        actions={
          activeTab === 'catalog' && (
            <Button size="sm" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
              Add Catalog Item
            </Button>
          )
        }
      />

      {/* Primary Tab Navigation */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab('rank_goodies')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'rank_goodies'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Gift className="w-4 h-4" />
          Rank-Unlocked Goodies Tracker
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-brand-100 text-brand-800 font-bold">
            {goodiesStats.pendingCount} Pending
          </span>
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'claims'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          Student Point Claims
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">
            {claims.filter((c) => c.status === 'REQUESTED').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'catalog'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4" />
          Goodies Catalog ({rewards.length})
        </button>
      </div>

      {/* TAB 1: Rank-Unlocked Goodies Tracker */}
      {activeTab === 'rank_goodies' && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Total Rank Goodies Unlocked</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{goodiesStats.total}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-100 text-gray-700">
                  <Gift className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-700 font-medium">Pending Physical Handover</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">{goodiesStats.pendingCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
                  <Clock className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-700 font-medium">Successfully Issued / Given</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{goodiesStats.issuedCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-100 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setGoodiesStatusFilter('ALL')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    goodiesStatusFilter === 'ALL'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All ({goodiesStats.total})
                </button>
                <button
                  onClick={() => setGoodiesStatusFilter('PENDING')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    goodiesStatusFilter === 'PENDING'
                      ? 'bg-amber-100 text-amber-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Pending Collection ({goodiesStats.pendingCount})
                </button>
                <button
                  onClick={() => setGoodiesStatusFilter('ISSUED')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    goodiesStatusFilter === 'ISSUED'
                      ? 'bg-green-100 text-green-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Issued ({goodiesStats.issuedCount})
                </button>
              </div>

              <div className="w-full sm:w-72">
                <Input
                  placeholder="Search student name or IXID..."
                  value={goodiesSearch}
                  onChange={(e) => setGoodiesSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-gray-400" />}
                />
              </div>
            </CardContent>
          </Card>

          {/* Rank Goodies Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-16 text-center">
                  <LoadingSpinner size="lg" />
                  <p className="mt-3 text-xs text-gray-500">Loading student goodies unlocks...</p>
                </div>
              ) : filteredRankGoodies.length === 0 ? (
                <div className="p-12">
                  <EmptyState
                    icon={<Gift className="w-6 h-6 text-gray-400" />}
                    title="No goodies found"
                    description="No student goodies unlock records match your selected filter."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>InfluenceX ID</TableHead>
                      <TableHead>Unlocked Tier</TableHead>
                      <TableHead>Goodie / Swag Kit</TableHead>
                      <TableHead>Unlocked Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Admin Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRankGoodies.map((goodie) => {
                      const st = goodie.studentId;
                      const isPending = goodie.status === 'PENDING';
                      return (
                        <TableRow key={goodie.id}>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{st?.fullName}</p>
                              <p className="text-xs text-gray-500">
                                {st?.branch} • Year {st?.year}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-brand-700">
                            {st?.influenceXId}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                goodie.levelName === 'Icon'
                                  ? 'amber'
                                  : goodie.levelName === 'Leader'
                                  ? 'brand'
                                  : goodie.levelName === 'Creator'
                                  ? 'green'
                                  : 'gray'
                              }
                              size="sm"
                            >
                              {goodie.levelName === 'Icon' && '👑 '}
                              {goodie.levelName === 'Leader' && '💎 '}
                              {goodie.levelName === 'Creator' && '🔥 '}
                              {goodie.levelName === 'Rising' && '🚀 '}
                              {goodie.levelName === 'Explorer' && '🌱 '}
                              {goodie.levelName}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-sm text-gray-900">
                            {goodie.goodieName}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {formatDateTimeIST(goodie.unlockedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isPending ? 'amber' : 'green'} size="sm">
                              {isPending ? 'PENDING' : 'ISSUED'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending ? (
                              <Button
                                size="sm"
                                variant="primary"
                                isLoading={actionInProgressId === goodie.id}
                                onClick={() => handleToggleRankGoodieStatus(goodie.id, 'PENDING')}
                                leftIcon={<Check className="w-3.5 h-3.5" />}
                              >
                                Mark as Issued
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                isLoading={actionInProgressId === goodie.id}
                                onClick={() => handleToggleRankGoodieStatus(goodie.id, 'ISSUED')}
                              >
                                Revert to Pending
                              </Button>
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
        </div>
      )}

      {/* TAB 2: Student Point Claims */}
      {activeTab === 'claims' && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-16 text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-3 text-xs text-gray-500">Loading reward claims queue...</p>
              </div>
            ) : claims.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={<Gift className="w-6 h-6 text-gray-400" />}
                  title="No claims in queue"
                  description="Student point redemption requests will appear here."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Reward Item</TableHead>
                    <TableHead>Points Cost</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => {
                    const st = typeof claim.studentId === 'object' ? claim.studentId : null;
                    const rew = typeof claim.rewardId === 'object' ? claim.rewardId : null;

                    return (
                      <TableRow key={claim.id}>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{st?.fullName || 'Student'}</p>
                            <p className="font-mono text-xs text-brand-700">{st?.influenceXId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900 text-sm">
                          {rew?.name || 'Swag Item'}
                        </TableCell>
                        <TableCell className="font-bold text-gray-900 text-sm">
                          {rew?.requiredCredits || 0} pts
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {formatDateTimeIST(claim.requestedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              claim.status === 'DISTRIBUTED'
                                ? 'green'
                                : claim.status === 'APPROVED'
                                ? 'brand'
                                : claim.status === 'REQUESTED'
                                ? 'amber'
                                : 'red'
                            }
                            size="sm"
                          >
                            {claim.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {claim.status === 'REQUESTED' && (
                            <Button
                              size="sm"
                              variant="primary"
                              isLoading={actionInProgressId === claim.id}
                              onClick={() => handleDistributeClaim(claim.id)}
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                            >
                              Mark Handed Over
                            </Button>
                          )}
                          {claim.status === 'DISTRIBUTED' && (
                            <span className="text-xs text-green-700 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Handed Over
                            </span>
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

      {/* TAB 3: Catalog & Swag Store */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map((reward) => (
            <Card key={reward.id} className="flex flex-col justify-between">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{reward.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{reward.description || 'Official club swag item'}</p>
                  </div>
                  <Badge variant={reward.availableQuantity > 0 ? 'green' : 'red'} size="sm">
                    {reward.availableQuantity > 0 ? `${reward.availableQuantity} in stock` : 'Out of Stock'}
                  </Badge>
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Points Required</span>
                  <span className="text-base font-extrabold text-brand-700">{reward.requiredCredits} pts</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Reward Modal */}
      <Modal
        isOpen={isRewardModalOpen}
        onClose={() => setIsRewardModalOpen(false)}
        title={editingReward ? 'Edit Reward Item' : 'Add New Swag Catalog Item'}
      >
        <form onSubmit={handleSaveReward} className="space-y-4">
          <Input
            label="Item Name"
            required
            value={rewardForm.name}
            onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
            placeholder="e.g., InfluenceX Executive Hoodie"
          />
          <Input
            label="Description"
            value={rewardForm.description}
            onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
            placeholder="Item details..."
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Points Required"
              type="number"
              required
              min={0}
              value={rewardForm.requiredCredits}
              onChange={(e) => setRewardForm({ ...rewardForm, requiredCredits: parseInt(e.target.value, 10) || 0 })}
            />
            <Input
              label="Total Stock"
              type="number"
              required
              min={0}
              value={rewardForm.totalQuantity}
              onChange={(e) => setRewardForm({ ...rewardForm, totalQuantity: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setIsRewardModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSavingReward}>
              Save Item
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
