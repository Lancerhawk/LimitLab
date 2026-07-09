import { Request, Response } from 'express';
import { ClientService } from '../services/client.service';
import { z } from 'zod';

const CreateClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  algorithm: z.enum(['TOKEN_BUCKET', 'FIXED_WINDOW', 'SLIDING_WINDOW', 'SLIDING_LOG']).default('TOKEN_BUCKET'),
  capacity: z.number().int().positive('Capacity must be positive').optional(),
  refillRate: z.number().positive('Refill rate must be positive').optional(),
  windowDurationMs: z.number().int().positive('Window duration must be positive').optional(),
  requestLimit: z.number().int().positive('Request limit must be positive').optional(),
}).refine((data) => {
  if (data.algorithm === 'TOKEN_BUCKET') {
    return (data.capacity ?? 10) > 0 && (data.refillRate ?? 1) > 0;
  }
  if (data.algorithm === 'FIXED_WINDOW' || data.algorithm === 'SLIDING_WINDOW' || data.algorithm === 'SLIDING_LOG') {
    return (data.windowDurationMs ?? 60000) > 0 && (data.requestLimit ?? 10) > 0;
  }
  return true;
}, { message: 'Invalid algorithm configuration' });

const UpdateClientSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  refillRate: z.number().positive().optional(),
  windowDurationMs: z.number().int().positive().optional(),
  requestLimit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export class ClientController {
  static async getAll(req: Request, res: Response) {
    try {
      const clients = await ClientService.getAllClients();
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve clients', details: error.message });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const client = await ClientService.getClientById(req.params.id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve client', details: error.message });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const validatedData = CreateClientSchema.parse(req.body);
      const client = await ClientService.createClient(validatedData);
      res.status(201).json(client);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create client', details: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const validatedData = UpdateClientSchema.parse(req.body);
      const client = await ClientService.updateClient(req.params.id, validatedData);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      res.json(client);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update client', details: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await ClientService.deleteClient(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete client', details: error.message });
    }
  }
}

