import api from './axios';

export interface Client {
  id: string;
  name: string;
  apiKey: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  configuration?: {
    algorithm: string;
    requestsPerSecond: number;
    burstSize: number;
    refillRate: number;
    windowDurationMs?: number;
    isEnabled: boolean;
  };
  bucketState?: {
    remainingTokens: number;
    currentCapacity: number;
    lastRefillTime: string;
  };
  windowState?: {
    currentWindow: string;
    requestCount: number;
    resetTime: string;
  };
  slidingWindowState?: {
    currentWindow: string;
    requestCount: number;
    previousWindow: string;
    previousCount: number;
    resetTime: string;
  };
  statistics?: {
    totalRequests: string;
    allowedRequests: string;
    deniedRequests: string;
    lastRequestTime?: string;
  };
}

export const getClients = async (): Promise<Client[]> => {
  const response = await api.get('/clients');
  return response.data;
};

export const getClientById = async (id: string): Promise<Client> => {
  const response = await api.get(`/clients/${id}`);
  return response.data;
};

export const createClient = async (data: {
  name: string;
  description?: string;
  algorithm?: string;
  capacity?: number;
  refillRate?: number;
  windowDurationMs?: number;
  requestLimit?: number;
}): Promise<Client> => {
  const response = await api.post('/clients', data);
  return response.data;
};

export const updateClient = async (id: string, data: {
  name?: string;
  description?: string;
  capacity?: number;
  refillRate?: number;
  windowDurationMs?: number;
  requestLimit?: number;
  isActive?: boolean;
}): Promise<Client> => {
  const response = await api.put(`/clients/${id}`, data);
  return response.data;
};

export const deleteClient = async (id: string): Promise<void> => {
  await api.delete(`/clients/${id}`);
};

