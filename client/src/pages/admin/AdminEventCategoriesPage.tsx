import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';
import { EventCategory } from '../../types';

export const AdminEventCategoriesPage: React.FC = () => {
  const { success, error } = useToast();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ success: boolean; categories: EventCategory[] }>('/event-categories?all=true');
      if (res.data.success) {
        setCategories(res.data.categories);
      }
    } catch (err: any) {
      error('Failed to load categories', err.response?.data?.error || 'Server error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: EventCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description);
    setIsActive(cat.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingCategory) {
        const res = await api.patch<{ success: boolean; category: EventCategory }>(
          `/event-categories/${editingCategory.id}`,
          { name, description, isActive }
        );
        if (res.data.success) {
          success('Category Updated', `Category '${name}' was updated.`);
          setIsModalOpen(false);
          fetchCategories();
        }
      } else {
        const res = await api.post<{ success: boolean; category: EventCategory }>('/event-categories', {
          name,
          description,
          isActive,
        });
        if (res.data.success) {
          success('Category Created', `Category '${name}' was added.`);
          setIsModalOpen(false);
          fetchCategories();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat: EventCategory) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      const res = await api.delete<{ success: boolean; message?: string }>(`/event-categories/${cat.id}`);
      if (res.data.success) {
        success('Category Deleted', `Category '${cat.name}' removed.`);
        fetchCategories();
      }
    } catch (err: any) {
      error('Delete Failed', err.response?.data?.error || 'Could not delete category in use');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Categories"
        description="Organize club events and workshops by activity taxonomy."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Category
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="mt-3 text-xs text-gray-500">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Tag className="w-6 h-6 text-gray-400" />}
                title="No categories found"
                description="Create initial categories to organize events."
                action={
                  <Button size="sm" onClick={openCreateModal}>
                    Add First Category
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-semibold text-gray-900">{cat.name}</TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-md truncate">
                      {cat.description || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cat.isActive ? 'green' : 'gray'} size="sm" dot>
                        {cat.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(cat)}
                          className="text-gray-500 hover:text-brand-600 py-1 px-2 h-7"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cat)}
                          className="text-gray-400 hover:text-red-600 py-1 px-2 h-7"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create Event Category'}
        description="Event categories classify activities across attendance, credits, and analytics."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {formError}
            </div>
          )}

          <Input
            label="Category Name"
            required
            placeholder="e.g. Workshop, Hackathon, Networking"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Description (Optional)"
            placeholder="Brief scope of activities in this category"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="cat-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="cat-active" className="text-xs font-medium text-gray-700">
              Category is active for new events
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
