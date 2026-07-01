import { Request, Response } from 'express';
import { prisma } from '../database/prisma';

export class DashboardController {
  static async getStats(req: Request, res: Response) {
    try {
      const [
        totalClients,
        activeClients,
        totalRequestsResult,
        allowedRequestsResult,
        deniedRequestsResult
      ] = await Promise.all([
        prisma.client.count(),
        prisma.client.count({ where: { isActive: true } }),
        prisma.clientStatistics.aggregate({ _sum: { totalRequests: true } }),
        prisma.clientStatistics.aggregate({ _sum: { allowedRequests: true } }),
        prisma.clientStatistics.aggregate({ _sum: { deniedRequests: true } }),
      ]);

      res.json({
        totalClients,
        activeClients,
        totalRequests: totalRequestsResult._sum.totalRequests?.toString() || "0",
        allowedRequests: allowedRequestsResult._sum.allowedRequests?.toString() || "0",
        deniedRequests: deniedRequestsResult._sum.deniedRequests?.toString() || "0",
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve dashboard stats', details: error.message });
    }
  }
}
