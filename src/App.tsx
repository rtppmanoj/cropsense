import React, { Suspense, lazy, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Homepage from './pages/Homepage';
const RecommendationResult = lazy(() => import('./pages/RecommendationResult'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
import NotFound from './pages/NotFound';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage, FarmerRegistrationPage, RequireAuth } from './pages/AuthPages';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminAuditPage = lazy(() => import('./pages/AdminAuditPage'));
const AdminActivityPage = lazy(() => import('./pages/AdminActivityPage'));
const AdminAccountsPage = lazy(() => import('./pages/AdminAccountsPage'));
const AdminPlansPage = lazy(() => import('./pages/AdminPlansPage'));
const FarmerDashboard = lazy(() => import('./pages/FarmerDashboard'));
const FarmerProfile = lazy(() => import('./pages/FarmerProfile'));
const FarmerHistory = lazy(() => import('./pages/FarmerHistory'));
const FarmerSchemes = lazy(() => import('./pages/FarmerSchemes'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const PricingPlans = lazy(() => import('./pages/PricingPlans'));
import { useAuth } from './auth/useAuth';

function PublicPage({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (!loading && user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function ScrollToRouteStart() {
  const location = useLocation();
  useLayoutEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.key, location.pathname, location.hash]);
  return null;
}

function App() {
  return (
    <Router>
      <AuthProvider>
      <ScrollToRouteStart />
      <Suspense fallback={<div role="status" className="min-h-[65vh]" aria-label="Loading page" />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PublicPage><Homepage /></PublicPage>} />
          <Route path="result" element={<Navigate to="/login" replace />} />
          <Route path="how-it-works" element={<PublicPage><HowItWorksPage /></PublicPage>} />
          <Route path="about" element={<PublicPage><AboutPage /></PublicPage>} />
          <Route path="pricing" element={<PublicPage><PricingPlans /></PublicPage>} />
          <Route path="login" element={<LoginPage />} />
          <Route path="admin/login" element={<LoginPage adminPortal />} />
          <Route path="farmer/login" element={<Navigate to="/login" replace />} />
          <Route path="farmer/register" element={<FarmerRegistrationPage />} />
          <Route path="admin/dashboard" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
          <Route path="admin/audit" element={<RequireAuth role="admin"><AdminAuditPage /></RequireAuth>} />
          <Route path="admin/activity" element={<RequireAuth role="admin"><AdminActivityPage /></RequireAuth>} />
          <Route path="admin/accounts" element={<RequireAuth role="admin"><AdminAccountsPage /></RequireAuth>} />
          <Route path="admin/plans" element={<RequireAuth role="admin"><AdminPlansPage /></RequireAuth>} />
          <Route path="farmer/dashboard" element={<RequireAuth role="farmer"><FarmerDashboard /></RequireAuth>} />
          <Route path="farmer/profile" element={<RequireAuth role="farmer"><FarmerProfile /></RequireAuth>} />
          <Route path="farmer/history" element={<RequireAuth role="farmer"><FarmerHistory /></RequireAuth>} />
          <Route path="farmer/schemes" element={<RequireAuth role="farmer"><FarmerSchemes /></RequireAuth>} />
          <Route path="farmer/result" element={<RequireAuth role="farmer"><RecommendationResult /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;
