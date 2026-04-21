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
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';
import { VSMDashboardLayout } from './layouts/VSMDashboardLayout';
import { VSMDashboard } from './pages/VSMDashboard';
import { VentureManagerDashboard } from './pages/VentureManagerDashboard';
import { SelectionCommitteeDashboard } from './pages/SelectionCommitteeDashboard';
import { PanelFeedbackForm } from './pages/PanelFeedbackForm';
import { OpsManagerLayout } from './layouts/OpsManagerLayout';
import { OpsManagerDashboard } from './pages/OpsManagerDashboard';
import { ScheduledCallsPage } from './pages/ScheduledCallsPage';
import { PanelAvailability } from './pages/PanelAvailability';
import { PublicApplication } from './pages/PublicApplication';
import { VentureWorkbench } from './pages/VentureWorkbench';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminApplicationDetail } from './pages/AdminApplicationDetail';
import { VPVMLayout } from './layouts/VPVMLayout';
import { VPVMDashboard } from './pages/VPVMDashboard';
import { VPVMVentureDetail } from './pages/VPVMVentureDetail';
import { VPVMApplicationDetails } from './pages/VPVMApplicationDetails';
import { VPVMAvailability } from './pages/VPVMAvailability';
import { ExpertLayout } from './layouts/ExpertLayout';
import { ExpertDashboard } from './pages/ExpertDashboard';
import { ExpertProfile } from './pages/ExpertProfile';
import { ExpertSessions } from './pages/ExpertSessions';
import { ExpertVentureDetail } from './pages/ExpertVentureDetail';
import { ManageAvailabilityPage } from './modules/Availability';
import { LiveSessionPage } from './modules/LiveSession';
import { DiscoverExpertsPage } from './modules/ExpertMatching';
import { RequestListPage } from './modules/MeetingRequests';
import { UpcomingMeetingsPage } from './pages/UpcomingMeetingsPage';
import { VPVMRequestsPage } from './pages/VPVMRequestsPage';
import { VPVMRequestDetailPage } from './pages/VPVMRequestDetailPage';
import React from 'react';
// Dev-only: TestFrameworkPage is excluded from production builds
const TestFrameworkPage = import.meta.env.VITE_ENABLE_TEST_FRAMEWORK === 'true'
    ? React.lazy(() => import('./modules/TestFramework').then(m => ({ default: m.TestFrameworkPage })))
    : null;

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

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
    <ToastProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={
            <div className="min-h-screen pt-16 font-sans">
              <Header />
              <Welcome />
            </div>
          } />
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
          <Route path="/apply" element={<PublicApplication />} />

          {/* Entrepreneur Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['entrepreneur']}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<MyVentures />} />
            <Route path="new-application" element={<NewApplication />} />
            <Route path="venture/:id" element={<VentureDetails />} />
            <Route path="venture/:id/workbench" element={<VentureWorkbench />} />
            <Route path="venture/:id/plan" element={<VPVMVentureDetail readOnly hideKPIs backPath="/dashboard" backLabel="Back to my ventures" />} />
            <Route path="venture/:id/discover-experts" element={<DiscoverExpertsPage />} />
            <Route path="my-requests" element={<RequestListPage role="venture" />} />
            <Route path="my-meetings" element={<UpcomingMeetingsPage />} />
          </Route>

          {/* Success Manager Dashboard Routes */}
          <Route path="/vsm/dashboard" element={
            <ProtectedRoute allowedRoles={['success_mgr']}>
              <VSMDashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<VSMDashboard />} />
          </Route>

          {/* Panel (Prime) Dashboard Routes */}
          <Route path="/vmanager/dashboard" element={
            <ProtectedRoute allowedRoles={['venture_mgr']}>
              <VSMDashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<VentureManagerDashboard />} />
            <Route path="panel-feedback/:ventureId" element={<PanelFeedbackForm />} />
            <Route path="availability" element={<PanelAvailability />} />
          </Route>

          {/* Panel (Core/Select) Dashboard Routes */}
          <Route path="/committee/dashboard" element={
            <ProtectedRoute allowedRoles={['committee_member']}>
              <VSMDashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<SelectionCommitteeDashboard />} />
            <Route path="panel-feedback/:ventureId" element={<PanelFeedbackForm />} />
            <Route path="availability" element={<PanelAvailability />} />
          </Route>

          {/* Ops Manager Dashboard Routes */}
          <Route path="/ops/dashboard" element={
            <ProtectedRoute allowedRoles={['ops_manager']}>
              <OpsManagerLayout />
            </ProtectedRoute>
          }>
            <Route index element={<OpsManagerDashboard />} />
            <Route path="scheduled-calls" element={<ScheduledCallsPage />} />
          </Route>

          {/* VP/VM Dashboard Routes */}
          <Route path="/vpvm" element={
            <ProtectedRoute allowedRoles={['venture_mgr', 'committee_member']}>
              <VPVMLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<VPVMDashboard />} />
            <Route path="dashboard/venture/:id" element={<VPVMVentureDetail />} />
            <Route path="dashboard/venture/:id/details" element={<VPVMApplicationDetails />} />
            <Route path="dashboard/venture/:id/discover-experts" element={<DiscoverExpertsPage />} />
            <Route path="availability" element={<VPVMAvailability />} />
            <Route path="meetings" element={<UpcomingMeetingsPage />} />
            <Route path="requests" element={<VPVMRequestsPage />} />
            <Route path="requests/:requestId" element={<VPVMRequestDetailPage />} />
            <Route path="sessions/:requestId" element={<VPVMRequestDetailPage />} />
          </Route>

          {/* Expert Routes */}
          <Route path="/expert" element={
            <ProtectedRoute allowedRoles={['mentor']}>
              <ExpertLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<ExpertDashboard />} />
            <Route path="sessions" element={<ExpertSessions />} />
            <Route path="requests" element={<RequestListPage role="expert" />} />
            <Route path="profile" element={<ExpertProfile />} />
            <Route path="availability" element={<ManageAvailabilityPage />} />
            <Route path="venture/:id" element={<ExpertVentureDetail />} />
          </Route>

          {/* Live Meeting (embedded Zoom) — accessible by all roles that join meetings */}
          <Route path="/meeting/:sessionId" element={
            <ProtectedRoute allowedRoles={['mentor', 'entrepreneur', 'venture_mgr', 'committee_member']}>
              <LiveSessionPage />
            </ProtectedRoute>
          } />

          {/* Admin Dashboard Routes */}
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard tab="applications" />} />
            <Route path="application/:id" element={<AdminApplicationDetail />} />
            <Route path="ventures" element={<AdminDashboard tab="venture-dashboard" />} />
            <Route path="venture/:id" element={<VPVMVentureDetail readOnly backPath="/admin/dashboard/ventures" backLabel="Back to Venture Dashboard" />} />
            <Route path="screening-performance" element={<AdminDashboard tab="performance" />} />
            <Route path="users" element={<AdminDashboard tab="users" />} />
          </Route>

          {/* AI Test Framework — dev-only, no DB writes, excluded from prod build */}
          {import.meta.env.VITE_ENABLE_TEST_FRAMEWORK === 'true' && TestFrameworkPage && (
            <Route path="/admin/test-framework" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <React.Suspense fallback={null}>
                  <TestFrameworkPage />
                </React.Suspense>
              </ProtectedRoute>
            } />
          )}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>


      </Router>
    </ToastProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
