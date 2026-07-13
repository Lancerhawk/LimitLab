import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.header('x-admin-key');
  
  if (!adminKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin Key is required to perform this action. Enable Developer Mode in Settings.',
    });
  }

  if (adminKey !== env.ADMIN_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'The Admin Key you provided is incorrect. Please check your Settings.',
    });
  }
  
  next();
};
