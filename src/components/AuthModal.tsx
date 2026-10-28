import React, { useState } from 'react';
import { X, LockKey, EnvelopeSimple, User, CheckCircle, WarningCircle, SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (accountEmail: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'register' | 'login'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const user = await register(email.trim(), password.trim(), name.trim());
      setSuccessMsg('Account created and logged in successfully!');
      setTimeout(() => {
        onSuccess(user.email);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const user = await login(email.trim(), password.trim());
      setSuccessMsg('Signed in successfully!');
      setTimeout(() => {
        onSuccess(user.email);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-neutral-900 border border-white/15 p-6 shadow-2xl text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-butterYellow/10 border border-butterYellow/30 mx-auto flex items-center justify-center text-butterYellow mb-3">
            <LockKey size={26} weight="fill" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            MadHouse Account
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {tab === 'register' ? 'Create an account to sync history & VIP access' : 'Sign in to access your saved watchlist & profile'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-white/5 p-1 rounded-xl mb-4 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'login'
                ? 'bg-butterYellow text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'register'
                ? 'bg-butterYellow text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
            <WarningCircle size={16} weight="bold" className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs flex items-center space-x-2">
            <CheckCircle size={16} weight="bold" className="flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        {tab === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Name Field */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Your Name
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-butterYellow transition-colors"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-butterYellow transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Password
              </label>
              <div className="relative">
                <LockKey
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-butterYellow transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 rounded-xl bg-butterYellow text-black font-bold text-xs flex items-center justify-center space-x-2 shadow-lg active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading && <SpinnerGap size={16} weight="bold" className="animate-spin" />}
              <span>Create MadHouse Account</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Email Field */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Email Address
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-butterYellow transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Password
              </label>
              <div className="relative">
                <LockKey
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-butterYellow transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 rounded-xl bg-butterYellow text-black font-bold text-xs flex items-center justify-center space-x-2 shadow-lg active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading && <SpinnerGap size={16} weight="bold" className="animate-spin" />}
              <span>Sign In</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
