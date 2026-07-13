import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import logo from '../assets/logo.png';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password states
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (error) throw error;
    } catch (err: unknown) {
      console.error("Login error:", err);
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) return;

    // Validate email limit to robotics@ioepc.edu.np
    if (trimmedEmail !== 'robotics@ioepc.edu.np') {
      setForgotError("This email is not authorized to access this application.");
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError(null);
      setForgotSuccess(null);

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setForgotSuccess("Password reset instructions have been sent to your email.");
      setForgotEmail('');
    } catch (err: unknown) {
      console.error("Forgot password error:", err);
      const msg = err instanceof Error ? err.message : 'Failed to send password reset email.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotEmail('');
    setForgotError(null);
    setForgotSuccess(null);
    setForgotOpen(true);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6 antialiased font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 flex flex-col items-center">

        {/* LOGO & HEADINGS */}
        <div className="flex flex-col items-center text-center mb-8">
          <img src={logo} alt="Robotics Club Logo" className="w-36 h-36 mb-4 object-contain drop-shadow-md" />
          <h1 className="font-heading font-extrabold text-3xl text-slate-900 mt-3 tracking-tight">Robotics Club</h1>
          <p className="font-heading font-bold text-xl text-slate-800 mt-1">IOE Purwanchal Campus</p>
          <p className="font-sans font-medium text-sm text-slate-500 mt-2">Institute of Engineering, Purwanchal Campus</p>
          <span className="font-sans text-[11px] text-slate-500 mt-3.5 px-3.5 py-1.5 bg-slate-100 rounded-full font-semibold uppercase tracking-wider">Store Management System</span>
        </div>

        {/* ERROR STATE */}
        {errorMessage && (
          <div className="w-full mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm flex items-start gap-3 shadow-sm">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span className="font-medium leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="w-full space-y-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="name@student.ioe.edu.np"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="password">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-11 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 font-semibold py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow active:scale-98 disabled:bg-blue-400 disabled:cursor-not-allowed disabled:scale-100 transition-all duration-150"
          >
            {isLoading && (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            Sign In
          </button>
        </form>

        {/* FORGOT PASSWORD */}
        <button
          onClick={openForgotModal}
          className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors mt-6 uppercase tracking-wider"
        >
          Forgot your password?
        </button>

      </div>

      {/* FORGOT PASSWORD MODAL */}
      <Modal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleForgotPassword}>
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500 leading-relaxed">
              Enter your email address below, and we will send you instructions to reset your account password.
            </p>

            {forgotError && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>{forgotSuccess}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-900" htmlFor="forgot-email">Email Address *</label>
              <input
                type="email"
                id="forgot-email"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all text-slate-800"
                placeholder="name@student.ioe.edu.np"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="inline-flex items-center justify-center text-sm font-semibold px-4 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 active:scale-97 transition-all duration-155"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={forgotLoading}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-97 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-150"
            >
              {forgotLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              Send Instructions
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
