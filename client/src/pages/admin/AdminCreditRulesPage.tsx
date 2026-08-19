import React, { useState, useEffect } from 'react';
import { Award, ShieldAlert, CheckCircle2, Edit2, Info } from 'lucide-react';
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
import { CreditRule } from '../../types';

export const AdminCreditRulesPage: React.FC = () => {
  const { success, error } = useToast();
  const [rules, setRules] = useState<CreditRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit Modal State
  const [editingRule, setEditingRule] = useState<CreditRule | null>(null);
  const [defaultAmount, setDefaultAmount] = useState<number>(10);
  const [requiresSecondApproval, setRequiresSecondApproval] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; rules: CreditRule[] }>('/credit-rules');
      if (res.data.success) {
        setRules(res.data.rules);
      }
    } catch (err: any) {
      error('Failed to load rules', err.response?.data?.error || 'Unable to fetch credit rules');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const openEditModal = (rule: CreditRule) => {
    setEditingRule(rule);
    setDefaultAmount(rule.defaultAmount);
    setRequiresSecondApproval(rule.requiresSecondApproval);
    setIsActive(rule.isActive);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    try {
      setIsSaving(true);
      const res = await api.patch(`/credit-rules/${editingRule.id}`, {
        defaultAmount,
        requiresSecondApproval,
        isActive,
      });

      if (res.data.success) {
        success('Credit Rule Updated', `Rule '${editingRule.type}' configured.`);
        setEditingRule(null);
        fetchRules();
      }
    } catch (err: any) {
      error('Save Failed', err.response?.data?.error || 'Unable to update credit rule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Rules Configuration"
        description="Configure standard point weights and multi-step approval requirements across all activity types."
      />

      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 flex items-start gap-3 text-xs text-brand-800">
        <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">Append-Only Digital Ledger Protection</span>
          Credit rules determine default point allocations. Once a transaction is approved and written to the ledger, historical records cannot be modified in place. Adjustments require explicit reversal or correction entries.
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-3 text-xs text-gray-500">Loading credit rules taxonomy...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Key & Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Default Points</TableHead>
                  <TableHead>2-Step Approval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold text-brand-700">{rule.type}</div>
                      <div className="font-medium text-gray-900 text-xs mt-0.5">{rule.name}</div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 max-w-sm">
                      {rule.description || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-sm text-gray-900">+{rule.defaultAmount} pts</span>
                    </TableCell>
                    <TableCell>
                      {rule.requiresSecondApproval ? (
                        <Badge variant="amber" size="sm">
                          REQUIRED
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">Direct Award</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? 'green' : 'gray'} size="sm" dot>
                        {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(rule)}
                        className="h-8 px-2 text-gray-600 hover:text-brand-600"
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Rule Modal */}
      {editingRule && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRule(null)}
          title={`Configure Rule: ${editingRule.name}`}
          description={`Customize point weight and second-approval requirement for ${editingRule.type}.`}
        >
          <form onSubmit={handleSaveRule} className="space-y-4">
            <Input
              label="Default Points Allocation"
              type="number"
              required
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(parseInt(e.target.value, 10) || 0)}
              helperText="Points awarded per occurrence of this activity"
            />

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresSecondApproval}
                  onChange={(e) => setRequiresSecondApproval(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-semibold text-gray-900 block">Require 2nd Admin Approval</span>
                  <span className="text-[11px] text-gray-500 block">
                    Transactions will be created as PENDING_APPROVAL until verified by another administrator.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer pt-2 border-t border-gray-200">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <div>
                  <span className="text-xs font-semibold text-gray-900 block">Active Status</span>
                  <span className="text-[11px] text-gray-500 block">Allow awarding this credit type across the platform.</span>
                </div>
              </label>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingRule(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                Save Rule Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
