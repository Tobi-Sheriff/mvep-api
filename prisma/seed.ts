import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PASSWORD_HASH = bcrypt.hashSync('password', 10);

// ─── Users ────────────────────────────────────────────────────────────────────

const USERS = [
  {
    id: '1',
    name: 'Alice Customer',
    email: 'customer@mvep.dev',
    password: PASSWORD_HASH,
    role: 'customer' as const,
    isVerified: true,
  },
  {
    id: '2',
    name: 'Bob Vendor',
    email: 'vendor@mvep.dev',
    password: PASSWORD_HASH,
    role: 'vendor' as const,
    isVerified: true,
  },
  {
    id: '3',
    name: 'Carol Admin',
    email: 'admin@mvep.dev',
    password: PASSWORD_HASH,
    role: 'admin' as const,
    isVerified: true,
  },
];

// ─── Vendor ───────────────────────────────────────────────────────────────────

const VENDOR = {
  id: 'v1',
  userId: '2',
  storeName: "Bob's Tech Shop",
  description: 'Quality electronics and more, shipped fast.',
};

// ─── Products ─────────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: 'p1',
    name: 'iPhone 15 Pro',
    description: 'Latest Apple flagship with titanium frame and A17 Pro chip.',
    price: 999.99,
    stock: 30,
    category: 'Electronics',
    image: 'https://placehold.co/400x400?text=iPhone+15',
    images: ['https://placehold.co/400x400?text=iPhone+15'],
    rating: 4.8,
    reviewCount: 142,
    vendorId: 'v1',
  },
  {
    id: 'p2',
    name: 'MacBook Pro 14"',
    description: 'M3 Pro chip, Liquid Retina XDR display, 18-hour battery life.',
    price: 1999.00,
    stock: 15,
    category: 'Electronics',
    image: 'https://placehold.co/400x400?text=MacBook+Pro',
    images: ['https://placehold.co/400x400?text=MacBook+Pro'],
    rating: 4.9,
    reviewCount: 87,
    vendorId: 'v1',
  },
  {
    id: 'p3',
    name: 'Nike Dri-FIT T-Shirt',
    description: 'Lightweight performance tee with moisture-wicking fabric.',
    price: 35.00,
    stock: 100,
    category: 'Clothing',
    image: 'https://placehold.co/400x400?text=Nike+Tee',
    images: ['https://placehold.co/400x400?text=Nike+Tee'],
    rating: 4.5,
    reviewCount: 310,
    vendorId: 'v1',
  },
  {
    id: 'p4',
    name: "Levi's 501 Jeans",
    description: 'Classic straight-fit jeans in stonewash blue.',
    price: 79.99,
    stock: 60,
    category: 'Clothing',
    image: 'https://placehold.co/400x400?text=Levis+Jeans',
    images: ['https://placehold.co/400x400?text=Levis+Jeans'],
    rating: 4.4,
    reviewCount: 255,
    vendorId: 'v1',
  },
  {
    id: 'p5',
    name: 'Breville Espresso Machine',
    description: '15-bar pressure pump, integrated grinder, steam wand.',
    price: 499.95,
    stock: 20,
    category: 'Home & Garden',
    image: 'https://placehold.co/400x400?text=Espresso+Machine',
    images: ['https://placehold.co/400x400?text=Espresso+Machine'],
    rating: 4.7,
    reviewCount: 96,
    vendorId: 'v1',
  },
  {
    id: 'p6',
    name: 'Ceramic Planter Set',
    description: 'Set of 3 hand-painted ceramic pots with drainage holes.',
    price: 29.99,
    stock: 80,
    category: 'Home & Garden',
    image: 'https://placehold.co/400x400?text=Planter+Set',
    images: ['https://placehold.co/400x400?text=Planter+Set'],
    rating: 4.3,
    reviewCount: 178,
    vendorId: 'v1',
  },
  {
    id: 'p7',
    name: 'Asics Gel-Nimbus 25',
    description: 'Maximum cushioning road running shoe for long-distance training.',
    price: 159.99,
    stock: 45,
    category: 'Sports',
    image: 'https://placehold.co/400x400?text=Running+Shoes',
    images: ['https://placehold.co/400x400?text=Running+Shoes'],
    rating: 4.6,
    reviewCount: 203,
    vendorId: 'v1',
  },
  {
    id: 'p8',
    name: 'Liforme Yoga Mat',
    description: 'Eco-friendly alignment yoga mat, 4.2mm thick, non-slip.',
    price: 120.00,
    stock: 35,
    category: 'Sports',
    image: 'https://placehold.co/400x400?text=Yoga+Mat',
    images: ['https://placehold.co/400x400?text=Yoga+Mat'],
    rating: 4.8,
    reviewCount: 119,
    vendorId: 'v1',
  },
  {
    id: 'p9',
    name: 'TypeScript Deep Dive',
    description: 'Comprehensive guide to TypeScript from beginner to advanced.',
    price: 39.99,
    stock: 200,
    category: 'Books',
    image: 'https://placehold.co/400x400?text=TS+Book',
    images: ['https://placehold.co/400x400?text=TS+Book'],
    rating: 4.9,
    reviewCount: 421,
    vendorId: 'v1',
  },
  {
    id: 'p10',
    name: 'Clean Code',
    description: "Robert C. Martin's definitive guide to writing maintainable code.",
    price: 44.99,
    stock: 150,
    category: 'Books',
    image: 'https://placehold.co/400x400?text=Clean+Code',
    images: ['https://placehold.co/400x400?text=Clean+Code'],
    rating: 4.7,
    reviewCount: 689,
    vendorId: 'v1',
  },
  {
    id: 'p11',
    name: 'LEGO Technic Car',
    description: '1,580-piece supercar with working suspension and gearbox.',
    price: 189.99,
    stock: 25,
    category: 'Toys',
    image: 'https://placehold.co/400x400?text=LEGO+Car',
    images: ['https://placehold.co/400x400?text=LEGO+Car'],
    rating: 4.8,
    reviewCount: 334,
    vendorId: 'v1',
  },
  {
    id: 'p12',
    name: 'Catan Board Game',
    description: 'The classic strategy board game for 3–4 players.',
    price: 44.95,
    stock: 55,
    category: 'Toys',
    image: 'https://placehold.co/400x400?text=Catan',
    images: ['https://placehold.co/400x400?text=Catan'],
    rating: 4.6,
    reviewCount: 512,
    vendorId: 'v1',
  },
  {
    id: 'p13',
    name: 'CeraVe Moisturizing Cream',
    description: 'Fragrance-free moisturiser with ceramides and hyaluronic acid.',
    price: 19.99,
    stock: 120,
    category: 'Beauty',
    image: 'https://placehold.co/400x400?text=CeraVe',
    images: ['https://placehold.co/400x400?text=CeraVe'],
    rating: 4.7,
    reviewCount: 845,
    vendorId: 'v1',
  },
  {
    id: 'p14',
    name: 'OGX Argan Oil Shampoo',
    description: 'Sulfate-free shampoo enriched with Moroccan argan oil.',
    price: 12.99,
    stock: 200,
    category: 'Beauty',
    image: 'https://placehold.co/400x400?text=Shampoo',
    images: ['https://placehold.co/400x400?text=Shampoo'],
    rating: 4.4,
    reviewCount: 623,
    vendorId: 'v1',
  },
  {
    id: 'p15',
    name: 'Ethiopian Single-Origin Coffee',
    description: '250g whole-bean light roast with blueberry and citrus notes.',
    price: 18.99,
    stock: 300,
    category: 'Food',
    image: 'https://placehold.co/400x400?text=Coffee+Beans',
    images: ['https://placehold.co/400x400?text=Coffee+Beans'],
    rating: 4.6,
    reviewCount: 287,
    vendorId: 'v1',
  },
];

// ─── Orders ───────────────────────────────────────────────────────────────────

type OrderSeed = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
};

const ORDERS: OrderSeed[] = [
  {
    id: 'o1',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p1', productName: 'iPhone 15 Pro', quantity: 1, unitPrice: 999.99 }],
    status: 'delivered',
    total: 999.99,
  },
  {
    id: 'o2',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p9', productName: 'TypeScript Deep Dive', quantity: 2, unitPrice: 39.99 }],
    status: 'delivered',
    total: 79.98,
  },
  {
    id: 'o3',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [
      { productId: 'p3', productName: 'Nike Dri-FIT T-Shirt', quantity: 2, unitPrice: 35.00 },
      { productId: 'p4', productName: "Levi's 501 Jeans", quantity: 1, unitPrice: 79.99 },
    ],
    status: 'shipped',
    total: 149.99,
  },
  {
    id: 'o4',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p11', productName: 'LEGO Technic Car', quantity: 1, unitPrice: 189.99 }],
    status: 'processing',
    total: 189.99,
  },
  {
    id: 'o5',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p15', productName: 'Ethiopian Single-Origin Coffee', quantity: 3, unitPrice: 18.99 }],
    status: 'pending',
    total: 56.97,
  },
  {
    id: 'o6',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p7', productName: 'Asics Gel-Nimbus 25', quantity: 1, unitPrice: 159.99 }],
    status: 'cancelled',
    total: 159.99,
  },
  {
    id: 'o7',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p5', productName: 'Breville Espresso Machine', quantity: 1, unitPrice: 499.95 }],
    status: 'delivered',
    total: 499.95,
  },
  {
    id: 'o8',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [
      { productId: 'p13', productName: 'CeraVe Moisturizing Cream', quantity: 2, unitPrice: 19.99 },
      { productId: 'p14', productName: 'OGX Argan Oil Shampoo', quantity: 1, unitPrice: 12.99 },
    ],
    status: 'delivered',
    total: 52.97,
  },
  {
    id: 'o9',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p2', productName: 'MacBook Pro 14"', quantity: 1, unitPrice: 1999.00 }],
    status: 'delivered',
    total: 1999.00,
  },
  {
    id: 'o10',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p12', productName: 'Catan Board Game', quantity: 1, unitPrice: 44.95 }],
    status: 'shipped',
    total: 44.95,
  },
  {
    id: 'o11',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p8', productName: 'Liforme Yoga Mat', quantity: 1, unitPrice: 120.00 }],
    status: 'processing',
    total: 120.00,
  },
  {
    id: 'o12',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [
      { productId: 'p6', productName: 'Ceramic Planter Set', quantity: 2, unitPrice: 29.99 },
      { productId: 'p10', productName: 'Clean Code', quantity: 1, unitPrice: 44.99 },
    ],
    status: 'delivered',
    total: 104.97,
  },
  // o13–o15: explicitly assigned to customerId='1' per spec
  {
    id: 'o13',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p1', productName: 'iPhone 15 Pro', quantity: 1, unitPrice: 999.99 }],
    status: 'pending',
    total: 999.99,
  },
  {
    id: 'o14',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p3', productName: 'Nike Dri-FIT T-Shirt', quantity: 3, unitPrice: 35.00 }],
    status: 'processing',
    total: 105.00,
  },
  {
    id: 'o15',
    customerId: '1',
    customerName: 'Alice Customer',
    customerEmail: 'customer@mvep.dev',
    items: [{ productId: 'p11', productName: 'LEGO Technic Car', quantity: 2, unitPrice: 189.99 }],
    status: 'shipped',
    total: 379.98,
  },
];

// ─── Wishlist ─────────────────────────────────────────────────────────────────

const WISHLIST = [
  { userId: '1', productId: 'p1' },
  { userId: '1', productId: 'p3' },
  { userId: '1', productId: 'p11' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding database...');

  // Users
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: u,
      update: { name: u.name, email: u.email, isVerified: u.isVerified },
    });
  }
  console.log('  ✓ Users');

  // Vendor
  await prisma.vendor.upsert({
    where: { id: VENDOR.id },
    create: VENDOR,
    update: { storeName: VENDOR.storeName, description: VENDOR.description },
  });
  console.log('  ✓ Vendor');

  // Products
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      create: p,
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        category: p.category,
      },
    });
  }
  console.log('  ✓ Products (15)');

  // Orders
  for (const o of ORDERS) {
    await prisma.order.upsert({
      where: { id: o.id },
      create: {
        id: o.id,
        customerId: o.customerId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        items: o.items as never,
        status: o.status,
        total: o.total,
      },
      update: { status: o.status },
    });
  }
  console.log('  ✓ Orders (15)');

  // Wishlist
  for (const w of WISHLIST) {
    await prisma.wishlist.upsert({
      where: { userId_productId: { userId: w.userId, productId: w.productId } },
      create: w,
      update: {},
    });
  }
  console.log('  ✓ Wishlist');

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
