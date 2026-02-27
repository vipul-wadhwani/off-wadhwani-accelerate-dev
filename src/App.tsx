import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Welcome } from './pages/Welcome';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { DashboardLayout } from './layouts/DashboardLayout';
import { MyVentures } from './pages/MyVentures';
import { NewApplication } from './pages/NewApplication';
import { VentureDetails } from './pages/VentureDetails';
import { Monitor, RefreshCcw, Maximize2 } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { VSMDashboardLayout } from './layouts/VSMDashboardLayout';
import { VSMDashboard } from './pages/VSMDashboard';
import { VentureManagerDashboard } from './pages/VentureManagerDashboard';
import { SelectionCommitteeDashboard } from './pages/SelectionCommitteeDashboard';
import { PanelFeedbackForm } from './pages/PanelFeedbackForm';

import { VentureWorkbench } from './pages/VentureWorkbench';

/**
 * Header Component
 * 
 * Displays the application branding and device layout controls (mocked).
 * Visible on all protected pages.
 */
const Header = () => (
  <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 fixed top-0 w-full z-50">
    <div className="font-bold text-red-700 text-lg">Assisted Growth Platform</div>
    <div className="flex items-center gap-4 text-gray-600">
      <div className="flex items-center gap-2">
        <Monitor className="w-5 h-5" />
        <span>Device</span>
      </div>
      <RefreshCcw className="w-5 h-5 cursor-pointer hover:text-gray-900" />
      <Maximize2 className="w-5 h-5 cursor-pointer hover:text-gray-900" />
    </div>
  </header>
);

/**
 * Main Application Component
 * 
 * Configures the global providers (AuthProvider, Router) and defines the route hierarchy.
 * 
 * Routes:
 * - Public: /, /login, /signup
 * - Entrepreneur: /dashboard/* (Guarded by DashboardLayout)
 * - Success Manager: /vsm/dashboard/* (Guarded by VSMDashboardLayout)
 * - Committee: /committee/dashboard/*
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}

          <Route path="/" element={
            <div className="min-h-screen pt-16 font-sans">
              <Header />
              <Welcome />
            </div>
          } />
          {/* ... existing public routes ... */}


          <Route path="/login" element={
            <div className="min-h-screen pt-16 font-sans">
              <Header />
              <Login />
            </div>
          } />
          <Route path="/signup" element={
            <div className="min-h-screen pt-16 font-sans">
              <Header />
              <Signup />
            </div>
          } />

          {/* Entrepreneur Dashboard Routes */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<MyVentures />} />
            <Route path="new-application" element={<NewApplication />} />
            <Route path="venture/:id" element={<VentureDetails />} />
            <Route path="venture/:id/workbench" element={<VentureWorkbench />} />
          </Route>

          {/* Success Manager Dashboard Routes */}
          <Route path="/vsm/dashboard" element={<VSMDashboardLayout />}>
            <Route index element={<VSMDashboard />} />
          </Route>

          {/* Panel (Prime) Dashboard Routes */}
          <Route path="/vmanager/dashboard" element={<VSMDashboardLayout />}>
            <Route index element={<VentureManagerDashboard />} />
            <Route path="panel-feedback/:ventureId" element={<PanelFeedbackForm />} />
          </Route>

          {/* Panel (Core, Select) Dashboard Routes */}
          <Route path="/committee/dashboard" element={<VSMDashboardLayout />}>
            <Route index element={<SelectionCommitteeDashboard />} />
            <Route path="panel-feedback/:ventureId" element={<PanelFeedbackForm />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Development Badge */}
        <div className="fixed bottom-4 right-4 bg-red-600 border border-red-700 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg z-[9999] opacity-75 hover:opacity-100 transition-opacity select-none flex items-center gap-2 cursor-default">
          <span>🚧</span>
          <span>Development Build</span>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
