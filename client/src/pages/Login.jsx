import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Sparkles, User, Shield, Headset, UserCheck } from 'lucide-react';

const DEMO_PRESETS = [
  { label: 'Customer', name: 'Alex Rivera', email: 'customer@resolveiq.test', pass: 'Customer@12345', icon: <User className="w-3 h-3 text-slate-500" /> },
  { label: 'Agent', name: 'Sarah Connor', email: 'agent@resolveiq.test', pass: 'Agent@12345', icon: <Headset className="w-3 h-3 text-teal-600" /> },
  { label: 'Manager', name: 'Marcus Chen', email: 'manager@resolveiq.test', pass: 'Manager@12345', icon: <UserCheck className="w-3 h-3 text-blue-600" /> },
  { label: 'Admin', name: 'Eleanor Vance', email: 'admin@resolveiq.test', pass: 'Admin@12345', icon: <Shield className="w-3 h-3 text-purple-600" /> },
];

const Login = () => {
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const handleChange = (e) => {
    clearError();
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (formErrors[e.target.name]) {
      setFormErrors({ ...formErrors, [e.target.name]: null });
    }
  };

  const handleApplyPreset = (preset) => {
    clearError();
    setFormData({
      email: preset.email,
      password: preset.pass,
    });
    setFormErrors({});
  };

  const validate = () => {
    const errors = {};
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const result = await login({
      email: formData.email.trim(),
      password: formData.password,
    });

    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-sm mb-3">
            R
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-xs text-slate-500 mt-1">Sign in to your ResolveIQ Helpdesk account</p>
        </div>

        {/* Quick Demo Pre-fills for Evaluation */}
        <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-700 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>1-Click Demo Logins for Evaluation:</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="flex items-center space-x-1.5 px-2 py-1 text-[11px] rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 transition-colors text-left"
              >
                {p.icon}
                <span className="font-semibold">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Authentication Error</p>
              <p className="mt-0.5 text-rose-600">{error}</p>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="text-rose-400 hover:text-rose-600 font-bold text-sm leading-none ml-1"
            >
              &times;
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@company.com"
                className={`w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border ${
                  formErrors.email ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                } focus:outline-none focus:ring-1 transition-colors`}
              />
            </div>
            {formErrors.email && (
              <p className="mt-1 text-[11px] text-rose-600">{formErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border ${
                  formErrors.password ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-300 focus:ring-indigo-500'
                } focus:outline-none focus:ring-1 transition-colors`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formErrors.password && (
              <p className="mt-1 text-[11px] text-rose-600">{formErrors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Need a customer account?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700 underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
