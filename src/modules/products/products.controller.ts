import { Request, Response } from 'express';
import * as productsService from './products.service';
import { listProductsQuery, productBody, createReviewBody } from './products.schema';

export async function listProducts(req: Request, res: Response): Promise<void> {
  const query = listProductsQuery.parse(req.query);
  const result = await productsService.listProducts(query);
  res.status(200).json(result);
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const result = await productsService.getProduct(req.params.id as string);
  res.status(200).json(result);
}

export async function getProductReviews(req: Request, res: Response): Promise<void> {
  const reviews = await productsService.getProductReviews(req.params.id as string);
  res.status(200).json(reviews);
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const body = productBody.parse(req.body);
  const result = await productsService.createProduct(body, req.user!);
  res.status(201).json(result);
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const body = productBody.parse(req.body);
  const result = await productsService.updateProduct(req.params.id as string, body, req.user!);
  res.status(200).json(result);
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const result = await productsService.deleteProduct(req.params.id as string, req.user!);
  res.status(200).json(result);
}

export async function createReview(req: Request, res: Response): Promise<void> {
  const body = createReviewBody.parse(req.body);
  const result = await productsService.createReview(req.params.id as string, body, req.user!);
  res.status(201).json(result);
}
