import React, { useState, useEffect } from 'react';
import { KeyRound, Check, AlertCircle, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api/client';

interface ChangePasswordModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen: propsIsOpen,
  onClose: propsOnClose,
}) => {
  const { user, setUser } = useAuth();
  const { success, error } = useToast();

  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isForced = Boolean(user?.mustChangePassword) && user?.role !== 'VOLUNTEER';
  const isVisible = isForced || Boolean(propsIsOpen);

  if (!user || !isVisible) {
    return null;
  }

  const handleClose = () => {
    if (isForced) return; // Cannot cancel forced first-login reset
    setFormError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    propsOnClose?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      const endpoint = isForced ? '/auth/change-password-first-login' : '/auth/change-password';
      const payload = isForced
        ? { newPassword }
        : { currentPassword, newPassword };

      const res = await api.post<{ success: boolean; message: string; user: any }>(
        endpoint,
        payload
      );

      if (res.data.success) {
        success('Password Updated', res.data.message || 'Your password has been successfully updated.');
        if (setUser) {
          setUser({ ...user, mustChangePassword: false });
        }
        handleClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to update password';
      setFormError(msg);
      error('Password Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in fade-in zoom-in-95 relative">
        {!isForced && (
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {isForced ? 'Set Your New Password' : 'Change Account Password'}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          {isForced
            ? `Welcome to InfluenceX, ${user.name} (${user.ixId || user.role})! Please set your own password to secure your account.`
            : `Update your password for ${user.name} (${user.ixId || user.email}).`}
        </p>

        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isForced && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Current Password / Default IXID</label>
              <Input
                type="password"
                placeholder="Enter current password or IXID"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
            <Input
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
            <Input
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            {!isForced && (
              <Button type="button" variant="secondary" onClick={handleClose} className="w-1/3 justify-center">
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              className={isForced ? 'w-full justify-center' : 'flex-1 justify-center'}
              isLoading={isLoading}
              leftIcon={<Check className="w-4 h-4" />}
            >
              {isForced ? 'Save Password & Enter Portal' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
