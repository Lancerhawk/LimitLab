import api from './axios';

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalRequests: string;
  allowedRequests: string;
  deniedRequests: string;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await api.get('/stats/dashboard');
  return response.data;
};
