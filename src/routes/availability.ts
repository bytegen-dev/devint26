import type { Request, Response } from 'express';
import { prisma } from '../db.js';

export async function getAvailability(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'available', type: 'masumi-agent' });
  } catch {
    res.status(503).json({ status: 'unavailable', type: 'masumi-agent' });
  }
}
