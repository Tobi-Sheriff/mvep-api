import { Request, Response } from 'express';
import * as analyticsService from './analytics.service';
import { revenuePeriodQuery } from './analytics.schema';

export async function getOverview(req: Request, res: Response): Promise<void> {
  const result = await analyticsService.getOverview(req.user!.id);
  res.status(200).json(result);
}

export async function getRevenueSeries(req: Request, res: Response): Promise<void> {
  const { period } = revenuePeriodQuery.parse(req.query);
  const result = await analyticsService.getRevenueSeries(req.user!.id, period);
  res.status(200).json(result);
}

export async function getTopProducts(req: Request, res: Response): Promise<void> {
  const result = await analyticsService.getTopProducts(req.user!.id);
  res.status(200).json(result);
}
