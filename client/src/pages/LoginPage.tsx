import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, User, AlertCircle, Sparkles, UserCheck, GraduationCap, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();

  const [identifier, setIdentifier] = useState<string>('admin@influencex.niat.edu');
  const [password, setPassword] = useState<string>('Admin@123456');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeRoleLoading, setActiveRoleLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect to appropriate single-page portal or admin panel on login
  useEffect(() => {
    if (isAuthenticated && user) {
      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login' && from !== '/403') {
        if (user.role === 'VOLUNTEER' && from.startsWith('/volunteer')) {
          navigate(from, { replace: true });
          return;
        }
        if (user.role === 'STUDENT' && from.startsWith('/student')) {
          navigate(from, { replace: true });
          return;
        }
        if (user.role === 'ADMIN' && from.startsWith('/admin')) {
          navigate(from, { replace: true });
          return;
        }
      }

      if (user.role === 'VOLUNTEER') {
        navigate('/volunteer/portal', { replace: true });
      } else if (user.role === 'STUDENT') {
        navigate('/student/portal', { replace: true });
      } else {
        navigate('/admin/workshops', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate, location]);

  const handleQuickLogin = async (roleIdentifier: string, rolePass: string, roleName: string) => {
    setErrorMsg(null);
    setIdentifier(roleIdentifier);
    setPassword(rolePass);
    setActiveRoleLoading(roleName);
    setIsLoading(true);

    const res = await login(roleIdentifier, rolePass);
    setIsLoading(false);
    setActiveRoleLoading(null);

    if (!res.success) {
      setErrorMsg(res.error || `Failed to sign in as ${roleName}.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter both your Username/IXID and password.');
      return;
    }

    setIsLoading(true);
    const res = await login(identifier.trim(), password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials or account inactive.');
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-surface to-gray-100/70 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-600 items-center justify-center text-white font-bold text-2xl shadow-md mb-3 ring-4 ring-brand-100">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Influence<span className="text-brand-600">X</span>
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700 mt-1">
            NIAT Influencers Club • Event & Credit Ledger
          </p>
        </div>

        {/* Main Login Card */}
        <Card className="shadow-xl border-gray-200/80 backdrop-blur-xs overflow-hidden bg-white">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Sign In to Your Account</h2>
              <p className="text-xs text-gray-500 mt-1">
                Enter your IXID (e.g. <span className="font-semibold text-gray-700">IX0451</span>) or registered email address.
              </p>
            </div>

            {errorMsg && (
              <div
                className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 shadow-2xs animate-in fade-in"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Standard Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Username / IXID or Email
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. IX0451 or admin@influencex.niat.edu"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  leftIcon={<User className="w-4 h-4 text-gray-400" />}
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Password / PIN
                </label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-gray-400" />}
                  disabled={isLoading}
                />
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isLoading && !activeRoleLoading}
                  className="w-full justify-center text-sm font-semibold"
                >
                  Sign in with Credentials
                </Button>
              </div>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400 font-semibold tracking-wider">
                  Or 1-Click Test Login
                </span>
              </div>
            </div>

            {/* Quick 1-Click Role Login Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Admin Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  handleQuickLogin('admin@influencex.niat.edu', 'Admin@123456', 'Administrator')
                }
                className="p-3 rounded-xl border border-brand-200 bg-brand-50/50 hover:bg-brand-100 hover:border-brand-400 transition-all text-center cursor-pointer disabled:opacity-60"
              >
                <div className="text-xs font-bold text-brand-900 flex items-center justify-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-brand-600" />
                  Admin
                </div>
                <div className="text-[10px] text-brand-700 mt-0.5">
                  {activeRoleLoading === 'Administrator' ? 'Signing in...' : '1-Click Login'}
                </div>
              </button>

              {/* 2. Volunteer Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  handleQuickLogin('volunteer@influencex.niat.edu', 'Volunteer@123456', 'Volunteer')
                }
                className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 hover:border-emerald-400 transition-all text-center cursor-pointer disabled:opacity-60"
              >
                <div className="text-xs font-bold text-emerald-900 flex items-center justify-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Volunteer
                </div>
                <div className="text-[10px] text-emerald-700 mt-0.5">
                  {activeRoleLoading === 'Volunteer' ? 'Signing in...' : '1-Click Login'}
                </div>
              </button>

              {/* 3. Student Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  handleQuickLogin('student@influencex.niat.edu', 'Student@123456', 'Student')
                }
                className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-400 transition-all text-center cursor-pointer disabled:opacity-60"
              >
                <div className="text-xs font-bold text-amber-900 flex items-center justify-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                  Student
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  {activeRoleLoading === 'Student' ? 'Signing in...' : '1-Click Login'}
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-gray-400">
          NIAT Influencers Club • InfluenceX Production Ledger
        </div>
      </div>
    </div>
  );
};
