import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleReturn = () => {
    if (user?.role === 'STUDENT') {
      navigate('/student/portal', { replace: true });
    } else if (user?.role === 'VOLUNTEER') {
      navigate('/volunteer/portal', { replace: true });
    } else {
      navigate('/admin/workshops', { replace: true });
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <EmptyState
        icon={<ShieldAlert className="w-6 h-6 text-red-500" />}
        title="403 — Access Forbidden"
        description="You do not have the required role permissions to view or interact with this resource. This unauthorized attempt has been recorded in the audit log."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={handleReturn}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Return to Dashboard
          </Button>
        }
      />
    </div>
  );
};
