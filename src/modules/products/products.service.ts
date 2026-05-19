import { prisma } from '../../lib/prisma';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuthUser } from '../../middleware/authenticate';
import type { ListProductsQuery, ProductBody } from './products.schema';

type DecimalLike = { toString(): string };

interface CustomerProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  rating: number;
  reviewCount: number;
  vendorId: string;
  vendorName: string;
  createdAt: string;
}

interface VendorProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;
  vendorId: string;
  createdAt: string;
}

function toCustomerProduct(p: {
  id: string;
  name: string;
  description: string;
  price: DecimalLike;
  stock: number;
  category: string;
  images: string[];
  rating: DecimalLike;
  reviewCount: number;
  vendorId: string;
  createdAt: Date;
  vendor: { storeName: string };
}): CustomerProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: parseFloat(p.price.toString()),
    stock: p.stock,
    category: p.category,
    images: p.images,
    rating: parseFloat(p.rating.toString()),
    reviewCount: p.reviewCount,
    vendorId: p.vendorId,
    vendorName: p.vendor.storeName,
    createdAt: p.createdAt.toISOString(),
  };
}

function toVendorProduct(p: {
  id: string;
  name: string;
  description: string;
  price: DecimalLike;
  stock: number;
  category: string;
  image: string;
  vendorId: string;
  createdAt: Date;
}): VendorProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: parseFloat(p.price.toString()),
    stock: p.stock,
    category: p.category,
    image: p.image,
    vendorId: p.vendorId,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listProducts(filters: ListProductsQuery) {
  const { page, limit, search, category, minPrice, maxPrice, rating, sort } = filters;

  const where: Record<string, unknown> = {};

  if (search?.trim()) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;

  const priceFilter: Record<string, number> = {};
  if (minPrice !== undefined) priceFilter.gte = minPrice;
  if (maxPrice !== undefined) priceFilter.lte = maxPrice;
  if (Object.keys(priceFilter).length > 0) where.price = priceFilter;

  if (rating !== undefined) where.rating = { gte: rating };

  const orderBy =
    sort === 'price_asc' ? { price: 'asc' as const }
    : sort === 'price_desc' ? { price: 'desc' as const }
    : sort === 'popular' ? { reviewCount: 'desc' as const }
    : { createdAt: 'desc' as const };

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: where as never,
      include: { vendor: { select: { storeName: true } } },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where: where as never }),
  ]);

  return {
    data: products.map(toCustomerProduct),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { vendor: { select: { storeName: true } } },
  });
  if (!product) throw new NotFoundError('Product not found');
  return toCustomerProduct(product);
}

export async function getProductReviews(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError('Product not found');

  const reviews = await prisma.review.findMany({
    where: { productId: id },
    select: { id: true, userId: true, userName: true, rating: true, comment: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function createProduct(body: ProductBody, requestingUser: AuthUser) {
  const vendor = await prisma.vendor.findUnique({ where: { userId: requestingUser.id } });
  if (!vendor) throw new ForbiddenError('No vendor profile found for this user');

  const product = await prisma.product.create({
    data: {
      name: body.name,
      description: body.description,
      price: body.price,
      stock: body.stock,
      category: body.category,
      images: body.images,
      image: body.images[0],
      vendorId: vendor.id,
    },
  });

  return toVendorProduct(product);
}

export async function updateProduct(id: string, body: ProductBody, requestingUser: AuthUser) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError('Product not found');

  if (requestingUser.role === 'vendor') {
    const vendor = await prisma.vendor.findUnique({ where: { userId: requestingUser.id } });
    if (!vendor || product.vendorId !== vendor.id) throw new ForbiddenError();
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      price: body.price,
      stock: body.stock,
      category: body.category,
      images: body.images,
      image: body.images[0],
    },
  });

  return toVendorProduct(updated);
}

export async function deleteProduct(id: string, requestingUser: AuthUser) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError('Product not found');

  if (requestingUser.role === 'vendor') {
    const vendor = await prisma.vendor.findUnique({ where: { userId: requestingUser.id } });
    if (!vendor || product.vendorId !== vendor.id) throw new ForbiddenError();
  }

  await prisma.product.delete({ where: { id } });
  return { message: 'Product deleted' };
}
