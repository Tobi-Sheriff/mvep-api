import { Request, Response } from 'express';
import * as ordersService from './orders.service';
import { createOrderBody, updateOrderStatusBody, listOrdersQuery } from './orders.schema';

export async function createOrder(req: Request, res: Response): Promise<void> {
  const body = createOrderBody.parse(req.body);
  const result = await ordersService.createOrder(body, req.user!);
  res.status(201).json(result);
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const query = listOrdersQuery.parse(req.query);
  const result = await ordersService.listOrders(query, req.user!);
  res.status(200).json(result);
}

export async function listMyOrders(req: Request, res: Response): Promise<void> {
  const query = listOrdersQuery.parse(req.query);
  const result = await ordersService.listMyOrders(req.user!.id, query);
  res.status(200).json(result);
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const result = await ordersService.getOrder(req.params.id as string, req.user!);
  res.status(200).json(result);
}

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  const body = updateOrderStatusBody.parse(req.body);
  const result = await ordersService.updateOrderStatus(req.params.id as string, body, req.user!);
  res.status(200).json(result);
}
