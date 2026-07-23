import { Routes, Route, Navigate } from 'react-router-dom';


import { AppLayout } from '../layouts/AppLayout';


import HomePage from '../pages/HomePage';
import ClientsPage from '../pages/ClientsPage';
import ClientDetailsPage from '../pages/ClientDetailsPage';
import SimulatorPage from '../pages/SimulatorPage';
import SettingsPage from '../pages/SettingsPage';
import NotFoundPage from '../pages/NotFoundPage';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/homepage" replace />} />


        <Route path="/homepage" element={<HomePage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailsPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/settings" element={<SettingsPage />} />


        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
