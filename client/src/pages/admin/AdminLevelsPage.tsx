import React, { useState, useEffect } from 'react';
import { Layers, Edit2, Info, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { LevelThreshold } from '../../types';

export const AdminLevelsPage: React.FC = () => {
  const { success, error } = useToast();
  const [levels, setLevels] = useState<LevelThreshold[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit Modal State
  const [editingLevel, setEditingLevel] = useState<LevelThreshold | null>(null);
  const [minCredits, setMinCredits] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchLevels = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; levels: LevelThreshold[] }>('/levels');
      if (res.data.success) {
        setLevels(res.data.levels);
      }
    } catch (err: any) {
      error('Failed to load levels', err.response?.data?.error || 'Unable to fetch tier levels');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLevel) return;

    try {
      setIsSaving(true);
      const res = await api.patch(`/levels/${editingLevel.id}`, { minCredits });
      if (res.data.success) {
        success('Level Updated', `Tier '${editingLevel.name}' threshold set to ${minCredits} credits.`);
        setEditingLevel(null);
        fetchLevels();
      }
    } catch (err: any) {
      error('Save Failed', err.response?.data?.error || 'Unable to update level threshold');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Member Tier Thresholds"
        description="Dynamic engagement tiers calculated automatically from students' live verified digital ledger totals."
      />

      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 flex items-start gap-3 text-xs text-brand-800">
        <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">Automatic Recalculation Engine</span>
          When credits are awarded or approved, student tiers are recalculated live from the digital ledger sum, keeping tiers in sync without batch lag.
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-3 text-xs text-gray-500">Loading engagement levels...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank Order</TableHead>
                  <TableHead>Tier Name & Badge</TableHead>
                  <TableHead>Minimum Required Credits</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((lvl) => (
                  <TableRow key={lvl.id}>
                    <TableCell className="font-mono text-xs font-bold text-gray-500">#{lvl.order}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: lvl.badgeColor || '#4F46E5' }}
                        />
                        <span className="font-bold text-gray-900 text-sm">{lvl.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-sm text-gray-900">{lvl.minCredits} credits</span>
                      <span className="text-xs text-gray-500 ml-1.5">(Verified)</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingLevel(lvl);
                          setMinCredits(lvl.minCredits);
                        }}
                        className="h-8 px-2 text-gray-600 hover:text-brand-600"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit Points
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Level Modal */}
      {editingLevel && (
        <Modal
          isOpen={true}
          onClose={() => setEditingLevel(null)}
          title={`Configure Tier: ${editingLevel.name}`}
          description={`Set the minimum verified credits required to unlock the ${editingLevel.name} tier.`}
        >
          <form onSubmit={handleSaveLevel} className="space-y-4">
            <Input
              label="Minimum Required Credits"
              type="number"
              required
              min={0}
              value={minCredits}
              onChange={(e) => setMinCredits(parseInt(e.target.value, 10) || 0)}
              helperText="Students reaching this verified balance are immediately promoted."
            />

            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingLevel(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                Save Tier Threshold
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
