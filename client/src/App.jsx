import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

// Helper component to redirect root to dashboard or login based on auth state
const HomeRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
};

// 404 Not Found Page
const NotFound = () => (
  <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
    <div className="text-6xl font-black text-indigo-200 mb-2">404</div>
    <h1 className="text-xl font-bold text-slate-800 mb-1">Page Not Found</h1>
    <p className="text-xs text-slate-500 mb-6">The page you are looking for does not exist.</p>
    <Link
      to="/"
      className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
    >
      Return Home
    </Link>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="py-4 border-t border-slate-200 text-center text-[11px] text-slate-400 bg-white">
            ResolveIQ Intelligent Customer Helpdesk &bull; Phase 1 Authentication
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
