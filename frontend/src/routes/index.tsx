import { Routes, Route, Navigate } from 'react-router-dom';

// Layout
import { AppLayout } from '../layouts/AppLayout';

// Pages
import DashboardPage from '../pages/DashboardPage';
import ClientsPage from '../pages/ClientsPage';
import ClientDetailsPage from '../pages/ClientDetailsPage';
import SimulatorPage from '../pages/SimulatorPage';
import SettingsPage from '../pages/SettingsPage';
import NotFoundPage from '../pages/NotFoundPage';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Core feature routes */}
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailsPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
