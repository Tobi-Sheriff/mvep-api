import { prisma } from '../../lib/prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuthUser } from '../../middleware/authenticate';
import type { CreateOrderBody, ListOrdersQuery, UpdateOrderStatusBody } from './orders.schema';
import type { OrderStatus } from '../../generated/prisma/client';

// Valid status transitions
const TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface OrderResponse {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  status: string;
  total: number;
  createdAt: string;
  updatedAt: string;
}

type DecimalLike = { toString(): string };

function toOrderResponse(order: {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: unknown;
  status: string;
  total: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
}): OrderResponse {
  return {
    id: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    items: order.items as OrderItem[],
    status: order.status,
    total: parseFloat(order.total.toString()),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

async function getVendorProductIds(vendorUserId: string): Promise<Set<string>> {
  const vendor = await prisma.vendor.findUnique({ where: { userId: vendorUserId } });
  if (!vendor) throw new ForbiddenError('No vendor profile found for this user');

  const products = await prisma.product.findMany({
    where: { vendorId: vendor.id },
    select: { id: true },
  });
  return new Set(products.map((p) => p.id));
}

function parseItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as OrderItem[];
}

function orderContainsProducts(order: { items: unknown }, productIds: Set<string>): boolean {
  return parseItems(order.items).some((item) => productIds.has(item.productId));
}

export async function createOrder(body: CreateOrderBody, customer: AuthUser) {
  const customerUser = await prisma.user.findUnique({ where: { id: customer.id } });
  if (!customerUser) throw new NotFoundError('User not found');

  const orderItems: OrderItem[] = [];
  let total = 0;

  // Validate all products and stock before any mutation
  for (const item of body.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) throw new NotFoundError(`Product not found: ${item.productId}`);
    if (product.stock < item.quantity) {
      throw new ConflictError(`Insufficient stock for: ${product.name}`);
    }
    const unitPrice = parseFloat(product.price.toString());
    orderItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice,
    });
    total += unitPrice * item.quantity;
  }

  // Atomic: decrement stock and create order
  const order = await prisma.$transaction(async (tx) => {
    for (const item of body.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return tx.order.create({
      data: {
        customerId: customerUser.id,
        customerName: customerUser.name,
        customerEmail: customerUser.email,
        items: orderItems as never,
        total: Math.round(total * 100) / 100,
        status: 'pending',
      },
    });
  });

  return toOrderResponse(order);
}

export async function listOrders(filters: ListOrdersQuery, requestingUser: AuthUser) {
  const { status, page, limit } = filters;
  const where = status ? { status } : {};

  if (requestingUser.role === 'admin') {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);
    return { orders: orders.map(toOrderResponse), total };
  }

  // Vendor: scope to orders containing at least one of their own products.
  // `items` is a JSON snapshot, so filtering happens in JS after fetching.
  const productIds = await getVendorProductIds(requestingUser.id);
  const allOrders = await prisma.order.findMany({ where, orderBy: { createdAt: 'desc' } });
  const filtered = allOrders.filter((o) => orderContainsProducts(o, productIds));

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * limit, (page - 1) * limit + limit);

  return { orders: paginated.map(toOrderResponse), total };
}

export async function listMyOrders(customerId: string, filters: ListOrdersQuery) {
  const { status, page, limit } = filters;
  const where = { customerId, ...(status ? { status } : {}) };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders: orders.map(toOrderResponse), total };
}

export async function getOrder(id: string, requestingUser: AuthUser) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError('Order not found');

  if (requestingUser.role === 'customer' && order.customerId !== requestingUser.id) {
    throw new ForbiddenError();
  }

  if (requestingUser.role === 'vendor') {
    const productIds = await getVendorProductIds(requestingUser.id);
    if (!orderContainsProducts(order, productIds)) throw new ForbiddenError();
  }

  return toOrderResponse(order);
}

export async function updateOrderStatus(
  id: string,
  body: UpdateOrderStatusBody,
  requestingUser: AuthUser,
) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new NotFoundError('Order not found');

  if (requestingUser.role === 'vendor') {
    const productIds = await getVendorProductIds(requestingUser.id);
    if (!orderContainsProducts(order, productIds)) throw new ForbiddenError();
  }

  if (!isValidTransition(order.status as OrderStatus, body.status as OrderStatus)) {
    throw new BadRequestError(`Invalid status transition: ${order.status} → ${body.status}`);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: body.status },
  });

  return toOrderResponse(updated);
}
