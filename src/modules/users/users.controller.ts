import { Request, Response } from 'express';
import * as usersService from './users.service';
import { updateProfileBody } from './users.schema';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const result = await usersService.getProfile(req.user!.id);
  res.status(200).json(result);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const body = updateProfileBody.parse(req.body);
  const result = await usersService.updateProfile(req.user!.id, body);
  res.status(200).json(result);
}

export async function getWishlist(req: Request, res: Response): Promise<void> {
  const result = await usersService.getWishlist(req.user!.id);
  res.status(200).json(result);
}

export async function addToWishlist(req: Request, res: Response): Promise<void> {
  const result = await usersService.addToWishlist(req.user!.id, req.params.productId as string);
  res.status(200).json(result);
}

export async function removeFromWishlist(req: Request, res: Response): Promise<void> {
  const result = await usersService.removeFromWishlist(req.user!.id, req.params.productId as string);
  res.status(200).json(result);
}
