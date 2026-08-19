import React, { useState, useEffect } from 'react';
import {
  Gift,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Plus,
  RefreshCw,
  Check,
  X,
  Edit2,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { formatDateTimeIST } from '../../utils/date';

interface GoodieInventoryItem {
  id: string;
  levelName: string;
  order: number;
  minCredits: number;
  icon: string;
  goodieName: string;
  totalStock: number;
  issuedCount: number;
  pendingCount: number;
  remainingStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

interface RankGoodieItem {
  id: string;
  studentId: {
    _id: string;
    fullName: string;
    influenceXId: string;
    collegeStudentId: string;
    branch: string;
    year: number;
    currentLevel: string;
    cachedTotalCredits: number;
  };
  levelName: string;
  goodieName: string;
  unlockedAt: string;
  status: 'PENDING' | 'ISSUED';
  issuedAt?: string;
  issuedBy?: {
    name: string;
    email: string;
  };
  notes?: string;
}

export const GoodieTrackingPage: React.FC = () => {
  const { success, error } = useToast();

  const [inventory, setInventory] = useState<GoodieInventoryItem[]>([]);
  const [goodies, setGoodies] = useState<RankGoodieItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'issued'>('pending');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit / Restock Modal State
  const [editInventoryItem, setEditInventoryItem] = useState<GoodieInventoryItem | null>(null);
  const [editGoodieName, setEditGoodieName] = useState<string>('');
  const [editTotalStock, setEditTotalStock] = useState<number>(50);
  const [editLowThreshold, setEditLowThreshold] = useState<number>(5);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Issue Goodie Modal State
  const [issueTargetItem, setIssueTargetItem] = useState<RankGoodieItem | null>(null);
  const [issueNotes, setIssueNotes] = useState<string>('');
  const [isIssuing, setIsIssuing] = useState<boolean>(false);
  const [isBulkIssuing, setIsBulkIssuing] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Inventory
      const invRes = await api.get<{ success: boolean; inventory: GoodieInventoryItem[] }>(
        '/rewards/goodie-inventory'
      );
      if (invRes.data.success) {
        setInventory(invRes.data.inventory);
      }

      // 2. Fetch Goodies Entitlement List
      const params = new URLSearchParams();
      params.append('status', activeTab.toUpperCase());
      if (selectedTier !== 'ALL') params.append('levelName', selectedTier);
      if (searchQuery) params.append('search', searchQuery);

      const goodieRes = await api.get<{
        success: boolean;
        goodies: RankGoodieItem[];
      }>(`/rewards/rank-goodies?${params.toString()}`);

      if (goodieRes.data.success) {
        setGoodies(goodieRes.data.goodies);
      }
    } catch (err) {
      console.error('Failed to load goodie tracking data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedTier]);

  const handleOpenEditModal = (item: GoodieInventoryItem) => {
    setEditInventoryItem(item);
    setEditGoodieName(item.goodieName);
    setEditTotalStock(item.totalStock);
    setEditLowThreshold(item.lowStockThreshold || 5);
  };

  const handleSaveGoodieConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInventoryItem) return;

    try {
      setIsSavingConfig(true);
      const res = await api.patch<{ success: boolean; message: string }>(
        `/rewards/goodie-inventory/${editInventoryItem.levelName}`,
        {
          goodieName: editGoodieName,
          totalStock: Number(editTotalStock),
          lowStockThreshold: Number(editLowThreshold),
        }
      );

      if (res.data.success) {
        success('Inventory Updated', res.data.message);
        setEditInventoryItem(null);
        fetchData();
      }
    } catch (err: any) {
      error('Update Error', err.response?.data?.error || 'Failed to update goodie config');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleIssueSingle = async () => {
    if (!issueTargetItem) return;

    try {
      setIsIssuing(true);
      const res = await api.post<{ success: boolean; message: string }>(
        `/rewards/rank-goodies/${issueTargetItem.id}/issue`,
        { notes: issueNotes }
      );

      if (res.data.success) {
        success('Goodie Issued', res.data.message);
        setIssueTargetItem(null);
        setIssueNotes('');
        fetchData();
      }
    } catch (err: any) {
      error('Issue Error', err.response?.data?.error || 'Failed to issue goodie');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleBulkIssue = async () => {
    if (selectedIds.length === 0) return;

    try {
      setIsBulkIssuing(true);
      const res = await api.post<{ success: boolean; message: string; issuedCount: number }>(
        '/rewards/rank-goodies/bulk-issue',
        { goodieIds: selectedIds }
      );

      if (res.data.success) {
        success('Bulk Issue Complete', res.data.message);
        setSelectedIds([]);
        fetchData();
      }
    } catch (err: any) {
      error('Bulk Issue Error', err.response?.data?.error || 'Bulk issue failed');
    } finally {
      setIsBulkIssuing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === goodies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(goodies.map((g) => g.id));
    }
  };

  const toggleSelectId = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Gift className="w-6 h-6 text-brand-600" />
            <span>Goodie Tracking & Distribution</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage level-up physical swag supply, pending student entitlements, and verified issued logs.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchData}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Data
        </Button>
      </div>

      {/* SECTION 1: Goodie Configuration & Stock Tracking */}
      <Card className="shadow-xs border-gray-200">
        <CardHeader className="border-b border-gray-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-600" />
              1. Level Goodie Configuration & Supply Tracking
            </CardTitle>
            <CardDescription className="text-xs">
              Physical inventory stock per category tier. Click &apos;Restock / Edit&apos; to top-up inventory.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level Category</TableHead>
                <TableHead>Goodie Item Name</TableHead>
                <TableHead className="text-center">Total Stock</TableHead>
                <TableHead className="text-center">Issued</TableHead>
                <TableHead className="text-center">Pending Claims</TableHead>
                <TableHead className="text-center">Remaining Stock</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((item) => (
                <TableRow key={item.levelName} className="hover:bg-surface/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <div className="font-bold text-xs text-gray-900">{item.levelName}</div>
                        <span className="text-[10px] text-gray-400">{item.minCredits}+ credits</span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs font-semibold text-gray-800">
                    {item.goodieName}
                  </TableCell>

                  <TableCell className="text-center text-xs font-bold text-gray-700">
                    {item.totalStock}
                  </TableCell>

                  <TableCell className="text-center text-xs font-semibold text-emerald-700">
                    {item.issuedCount}
                  </TableCell>

                  <TableCell className="text-center text-xs font-semibold text-amber-700">
                    {item.pendingCount}
                  </TableCell>

                  <TableCell className="text-center">
                    {item.isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3" />
                        0 (Out of Stock)
                      </span>
                    ) : item.isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3" />
                        {item.remainingStock} (Low Stock)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800">
                        <Check className="w-3 h-3" />
                        {item.remainingStock} available
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(item)}
                      className="text-xs text-brand-600 hover:text-brand-800 py-1 px-2 h-7"
                      leftIcon={<Edit2 className="w-3 h-3" />}
                    >
                      Restock / Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SECTION 2: Entitlement Queue & Issued Log */}
      <Card className="shadow-xs border-gray-200">
        <CardHeader className="border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Gift className="w-4 h-4 text-indigo-600" />
              2. Student Entitlement Queue & Issued History
            </CardTitle>
            <CardDescription className="text-xs">
              Students who earned a level goodie and pending distribution confirmation.
            </CardDescription>
          </div>

          {/* Pending vs Issued Tabs */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'pending' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending Distribution
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('issued')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'issued' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Issued History
            </button>
          </div>
        </CardHeader>

        {/* Filter Bar */}
        <CardContent className="p-4 bg-surface/50 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search student, IXID, goodie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
                leftIcon={<Search className="w-3.5 h-3.5" />}
              />
            </div>

            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 px-3 py-2 bg-white font-medium text-gray-900 focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Explorer">Explorer</option>
              <option value="Rising">Rising</option>
              <option value="Creator">Creator</option>
              <option value="Leader">Leader</option>
              <option value="Icon">Icon</option>
            </select>
          </div>

          {activeTab === 'pending' && selectedIds.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              isLoading={isBulkIssuing}
              onClick={handleBulkIssue}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Issue Selected ({selectedIds.length})
            </Button>
          )}
        </CardContent>

        {/* Entitlement Table */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="mt-3 text-xs text-gray-500">Loading goodie entitlements...</p>
            </div>
          ) : goodies.length === 0 ? (
            <div className="p-12 text-center text-xs text-gray-500">
              No {activeTab} goodies found for current filter.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {activeTab === 'pending' && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === goodies.length && goodies.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    </TableHead>
                  )}
                  <TableHead>Student</TableHead>
                  <TableHead>IXID</TableHead>
                  <TableHead>Level Reached</TableHead>
                  <TableHead>Goodie Item</TableHead>
                  <TableHead>Unlocked At</TableHead>
                  {activeTab === 'issued' && <TableHead>Issued By & Date</TableHead>}
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goodies.map((g) => {
                  const currentInv = inventory.find((inv) => inv.levelName === g.levelName);
                  const isStockAvailable = currentInv ? currentInv.remainingStock > 0 : true;

                  return (
                    <TableRow key={g.id} className="hover:bg-brand-50/20">
                      {activeTab === 'pending' && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(g.id)}
                            onChange={() => toggleSelectId(g.id)}
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                        </TableCell>
                      )}

                      <TableCell>
                        <div className="font-semibold text-xs text-gray-900">{g.studentId?.fullName}</div>
                        <div className="text-[10px] text-gray-400">{g.studentId?.branch}</div>
                      </TableCell>

                      <TableCell className="text-xs font-mono text-brand-700">
                        {g.studentId?.influenceXId}
                      </TableCell>

                      <TableCell>
                        <Badge variant="brand" size="sm">
                          {g.levelName}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs font-semibold text-gray-800">
                        {g.goodieName}
                      </TableCell>

                      <TableCell className="text-xs text-gray-500">
                        {formatDateTimeIST(g.unlockedAt)}
                      </TableCell>

                      {activeTab === 'issued' && (
                        <TableCell className="text-xs text-gray-600">
                          <div className="font-medium">{g.issuedBy?.name || 'Admin'}</div>
                          <div className="text-[10px] text-gray-400">
                            {g.issuedAt ? formatDateTimeIST(g.issuedAt) : '—'}
                          </div>
                        </TableCell>
                      )}

                      <TableCell className="text-right">
                        {activeTab === 'pending' ? (
                          isStockAvailable ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setIssueTargetItem(g)}
                              className="text-xs py-1 px-2.5 h-7"
                              leftIcon={<Check className="w-3 h-3" />}
                            >
                              Issue Goodie
                            </Button>
                          ) : (
                            <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                              Out of Stock
                            </span>
                          )
                        ) : (
                          <Badge variant="green" size="sm">
                            ✓ Confirmed
                          </Badge>
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

      {/* RESTOCK / EDIT GOODIE CONFIG MODAL */}
      <Modal
        isOpen={!!editInventoryItem}
        onClose={() => setEditInventoryItem(null)}
        title={`Restock & Edit Goodie — ${editInventoryItem?.levelName} Tier`}
        description="Update goodie item title and top-up stock quantity."
        size="md"
      >
        <form onSubmit={handleSaveGoodieConfig} className="space-y-4">
          <Input
            label="Goodie Item Name"
            required
            value={editGoodieName}
            onChange={(e) => setEditGoodieName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total Stock Quantity"
              type="number"
              min={0}
              required
              value={editTotalStock}
              onChange={(e) => setEditTotalStock(Number(e.target.value))}
              helperText={`Currently issued: ${editInventoryItem?.issuedCount || 0} units`}
            />

            <Input
              label="Low-Stock Alert Threshold"
              type="number"
              min={1}
              required
              value={editLowThreshold}
              onChange={(e) => setEditLowThreshold(Number(e.target.value))}
              helperText="Alert when remaining stock falls below this"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditInventoryItem(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingConfig}
            >
              Save Configuration
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM SINGLE GOODIE ISSUE MODAL */}
      <Modal
        isOpen={!!issueTargetItem}
        onClose={() => setIssueTargetItem(null)}
        title={`Issue Goodie — ${issueTargetItem?.studentId?.fullName}`}
        description={`Item: ${issueTargetItem?.goodieName} (${issueTargetItem?.levelName} Tier)`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Confirm physical handoff of this reward to student{' '}
            <span className="font-bold text-gray-900">{issueTargetItem?.studentId?.influenceXId}</span>.
            This will decrement inventory stock by 1 and log your admin confirmation.
          </p>

          <Input
            label="Handover Notes / Verification (Optional)"
            placeholder="e.g. Handed over at Hall A front desk"
            value={issueNotes}
            onChange={(e) => setIssueNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIssueTargetItem(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isIssuing}
              onClick={handleIssueSingle}
            >
              Confirm Handover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
