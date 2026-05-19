import type { Request, Response } from 'express';
import * as adminService from './admin.service';
import {
  listUsersQuery,
  updateUserStatusBody,
  listVendorsQuery,
  listAdminOrdersQuery,
  platformPeriodQuery,
} from './admin.schema';

export async function getPlatformStats(_req: Request, res: Response) {
  const stats = await adminService.getPlatformStats();
  res.json(stats);
}

export async function listUsers(req: Request, res: Response) {
  const filters = listUsersQuery.parse(req.query);
  const result = await adminService.listUsers(filters);
  res.json(result);
}

export async function getUser(req: Request, res: Response) {
  const user = await adminService.getUser(req.params.id as string);
  res.json(user);
}

export async function updateUserStatus(req: Request, res: Response) {
  const body = updateUserStatusBody.parse(req.body);
  const result = await adminService.updateUserStatus(
    req.params.id as string,
    body,
    req.user!.id,
  );
  res.json(result);
}

export async function listVendors(req: Request, res: Response) {
  const filters = listVendorsQuery.parse(req.query);
  const result = await adminService.listVendors(filters);
  res.json(result);
}

export async function listAllOrders(req: Request, res: Response) {
  const filters = listAdminOrdersQuery.parse(req.query);
  const result = await adminService.listAllOrders(filters);
  res.json(result);
}

export async function getPlatformRevenueSeries(req: Request, res: Response) {
  const { period } = platformPeriodQuery.parse(req.query);
  const result = await adminService.getPlatformRevenueSeries(period);
  res.json(result);
}
