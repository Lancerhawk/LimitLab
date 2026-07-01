import { prisma } from '../database/prisma';
import { RateLimitAlgorithm } from '@prisma/client';
import { randomBytes } from 'crypto';

export class ClientService {
  static async getAllClients() {
    return prisma.client.findMany({
      include: {
        configuration: true,
        bucketState: true,
        statistics: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getClientById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        configuration: true,
        bucketState: true,
        statistics: true,
      }
    });
  }

  static async createClient(data: { name: string, description?: string, capacity: number, refillRate: number }) {
    const apiKey = 'pk_test_' + randomBytes(16).toString('hex');
    
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: data.name,
          description: data.description,
          apiKey,
        }
      });

      await tx.rateLimitConfiguration.create({
        data: {
          clientId: client.id,
          algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
          burstSize: data.capacity,
          refillRate: data.refillRate,
        }
      });

      await tx.bucketState.create({
        data: {
          clientId: client.id,
          remainingTokens: data.capacity,
          currentCapacity: data.capacity,
        }
      });

      await tx.clientStatistics.create({
        data: {
          clientId: client.id,
        }
      });

      return client;
    });
  }

  static async updateClient(id: string, data: { name?: string, description?: string, capacity?: number, refillRate?: number, isActive?: boolean }) {
    return prisma.$transaction(async (tx) => {
      if (data.name !== undefined || data.description !== undefined || data.isActive !== undefined) {
        await tx.client.update({
          where: { id },
          data: {
            name: data.name,
            description: data.description,
            isActive: data.isActive,
          }
        });
      }

      if (data.capacity !== undefined || data.refillRate !== undefined) {
        const config = await tx.rateLimitConfiguration.update({
          where: { clientId: id },
          data: {
            burstSize: data.capacity,
            refillRate: data.refillRate,
          }
        });
        
        if (data.capacity !== undefined) {
          const state = await tx.bucketState.findUnique({ where: { clientId: id } });
          if (state) {
            await tx.bucketState.update({
              where: { clientId: id },
              data: {
                currentCapacity: data.capacity,
                remainingTokens: Math.min(state.remainingTokens, data.capacity)
              }
            });
          }
        }
      }

      return tx.client.findUnique({
        where: { id },
        include: { configuration: true, bucketState: true }
      });
    });
  }

  static async deleteClient(id: string) {
    return prisma.client.delete({
      where: { id }
    });
  }
}
