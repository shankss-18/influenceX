import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, CheckCircle2, ChevronLeft, ChevronRight, UserCheck, Eye, Download } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
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
import { Student, Pagination } from '../../types';

export const AdminStudentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    fullName: '',
    collegeEmail: '',
    password: 'Student@123456',
    collegeStudentId: '',
    phone: '',
    branch: 'CSE',
    year: 1,
    section: 'A',
    status: 'APPROVED',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchStudents = useCallback(async (pageToFetch = 1) => {
    try {
      setIsLoading(true);
      const params: any = { page: pageToFetch, limit: 10 };
      if (search) params.search = search;
      if (branch) params.branch = branch;
      if (year) params.year = year;
      if (status) params.status = status;

      const res = await api.get<{ success: boolean; students: Student[]; pagination: Pagination }>('/students', {
        params,
      });

      if (res.data.success) {
        setStudents(res.data.students);
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      error('Failed to load students', err.response?.data?.error || 'Server error');
    } finally {
      setIsLoading(false);
    }
  }, [search, branch, year, status, error]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  const handleApprove = async (e: React.MouseEvent, studentId: string, studentName: string) => {
    e.stopPropagation();
    try {
      const res = await api.patch<{ success: boolean; student: Student }>(`/students/${studentId}/status`, {
        status: 'APPROVED',
        reason: 'Approved via Quick Action in Students table',
      });
      if (res.data.success) {
        success('Student Approved', `${studentName} has been approved.`);
        fetchStudents(pagination.page);
      }
    } catch (err: any) {
      error('Approval failed', err.response?.data?.error || 'Unable to update status');
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      setIsSubmitting(true);
      const res = await api.post<{ success: boolean; student: Student }>('/students', formData);
      if (res.data.success) {
        success('Student Provisioned', `${res.data.student.fullName} assigned ID ${res.data.student.influenceXId}`);
        setIsModalOpen(false);
        setFormData({
          fullName: '',
          collegeEmail: '',
          password: 'Student@123456',
          collegeStudentId: '',
          phone: '',
          branch: 'CSE',
          year: 1,
          section: 'A',
          status: 'APPROVED',
        });
        fetchStudents(1);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to provision student');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'APPROVED':
        return <Badge variant="green" size="sm" dot>APPROVED</Badge>;
      case 'PENDING':
        return <Badge variant="amber" size="sm" dot>PENDING</Badge>;
      case 'DISABLED':
        return <Badge variant="red" size="sm" dot>DISABLED</Badge>;
      default:
        return <Badge variant="gray" size="sm">{st}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students Directory"
        description="Comprehensive member roster, enrollment status, and InfluenceX ID records."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open('/api/students/export', '_blank')}
              leftIcon={<Download className="w-4 h-4 text-emerald-600" />}
              title="Download full student directory as Excel spreadsheet"
            >
              Export Directory (.xlsx)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Provision Student
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              placeholder="Search Name, Email, IX ID, Roll..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
            <Select
              options={[
                { value: '', label: 'All Branches' },
                { value: 'CSE', label: 'CSE' },
                { value: 'ECE', label: 'ECE' },
                { value: 'IT', label: 'IT' },
                { value: 'ME', label: 'ME' },
                { value: 'CE', label: 'CE' },
                { value: 'AIDS', label: 'AI & Data Science' },
              ]}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
            <Select
              options={[
                { value: '', label: 'All Academic Years' },
                { value: '1', label: '1st Year' },
                { value: '2', label: '2nd Year' },
                { value: '3', label: '3rd Year' },
                { value: '4', label: '4th Year' },
              ]}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
            <Select
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'APPROVED', label: 'APPROVED' },
                { value: 'PENDING', label: 'PENDING' },
                { value: 'DISABLED', label: 'DISABLED' },
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Paginated Students Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <LoadingSpinner size="md" />
              <p className="mt-3 text-xs text-gray-500">Querying student records...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Filter className="w-6 h-6 text-gray-400" />}
                title="No students found"
                description="No student profiles matched your search and filter criteria."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setBranch('');
                      setYear('');
                      setStatus('');
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>InfluenceX ID</TableHead>
                    <TableHead>Student Name & Email</TableHead>
                    <TableHead>College Roll</TableHead>
                    <TableHead>Branch & Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer hover:bg-gray-50/80"
                      onClick={() => navigate(`/admin/students/${student.id}`)}
                    >
                      <TableCell className="font-mono text-xs font-semibold text-brand-700">
                        {student.influenceXId}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{student.fullName}</div>
                          <div className="text-xs text-gray-500">{student.collegeEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-600">
                        {student.collegeStudentId}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-gray-700">
                          {student.branch} • Year {student.year} ({student.section})
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(student.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {student.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleApprove(e, student.id, student.fullName)}
                              className="text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 py-1 px-2 h-7"
                              leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                            >
                              Approve
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/students/${student.id}`)}
                            className="text-xs text-gray-500 hover:text-brand-600 py-1 px-2 h-7"
                            title="View Full Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Showing <span className="font-medium text-gray-900">{students.length}</span> of{' '}
                  <span className="font-medium text-gray-900">{pagination.total}</span> records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchStudents(pagination.page - 1)}
                    className="py-1 px-2 h-7 text-xs"
                    leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                  >
                    Previous
                  </Button>
                  <span className="px-2 font-medium text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchStudents(pagination.page + 1)}
                    className="py-1 px-2 h-7 text-xs"
                    rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Provision Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision Student Record"
        description="Generates an atomic sequential InfluenceX ID (IX-XXXXXX) and initializes auth credentials."
        size="lg"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              placeholder="e.g. Rahul Sharma"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
            <Input
              label="College Email"
              type="email"
              required
              placeholder="rahul@influencex.niat.edu"
              value={formData.collegeEmail}
              onChange={(e) => setFormData({ ...formData, collegeEmail: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="College Roll / Student ID"
              required
              placeholder="e.g. 22NIAT102"
              value={formData.collegeStudentId}
              onChange={(e) => setFormData({ ...formData, collegeStudentId: e.target.value })}
            />
            <Input
              label="Contact Phone"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Branch"
              options={[
                { value: 'CSE', label: 'CSE' },
                { value: 'ECE', label: 'ECE' },
                { value: 'IT', label: 'IT' },
                { value: 'ME', label: 'ME' },
                { value: 'CE', label: 'CE' },
                { value: 'AIDS', label: 'AI & Data Science' },
              ]}
              value={formData.branch}
              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
            />
            <Select
              label="Academic Year"
              options={[
                { value: '1', label: '1st Year' },
                { value: '2', label: '2nd Year' },
                { value: '3', label: '3rd Year' },
                { value: '4', label: '4th Year' },
              ]}
              value={String(formData.year)}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value, 10) })}
            />
            <Input
              label="Section"
              required
              placeholder="A, B, C"
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Initial Password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <Select
              label="Initial Status"
              options={[
                { value: 'APPROVED', label: 'APPROVED (Immediate Access)' },
                { value: 'PENDING', label: 'PENDING (Requires Approval)' },
                { value: 'DISABLED', label: 'DISABLED' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            />
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
              Provision Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
