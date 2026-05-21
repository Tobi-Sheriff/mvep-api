/**
 * Developer CLI for managing admin accounts.
 * Admin accounts are intentionally excluded from the admin UI to prevent
 * privilege escalation. Use this script instead.
 *
 * Usage:
 *   npx ts-node scripts/admin.ts list
 *   npx ts-node scripts/admin.ts create <name> <email> <password>
 *   npx ts-node scripts/admin.ts suspend <email>
 *   npx ts-node scripts/admin.ts ban <email>
 *   npx ts-node scripts/admin.ts activate <email>
 *   npx ts-node scripts/admin.ts delete <email>
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const [, , command, ...args] = process.argv;

async function list() {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true, name: true, email: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  if (admins.length === 0) {
    console.log('No admin accounts found.');
    return;
  }
  console.log(`\n${'ID'.padEnd(30)} ${'Name'.padEnd(20)} ${'Email'.padEnd(30)} Status`);
  console.log('─'.repeat(90));
  for (const a of admins) {
    console.log(`${a.id.padEnd(30)} ${a.name.padEnd(20)} ${a.email.padEnd(30)} ${a.status}`);
  }
  console.log();
}

async function create(name: string, email: string, password: string) {
  if (!name || !email || !password) {
    console.error('Usage: create <name> <email> <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with email "${email}" already exists (role: ${existing.role}).`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { name, email, password: hashed, role: 'admin', isVerified: true },
    select: { id: true, name: true, email: true, status: true },
  });
  console.log(`✓ Admin created: ${admin.name} <${admin.email}> (id: ${admin.id})`);
}

async function setStatus(email: string, status: 'active' | 'suspended' | 'banned') {
  if (!email) {
    console.error(`Usage: ${status} <email>`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }
  if (user.role !== 'admin') {
    console.error(`User "${email}" is not an admin (role: ${user.role}). Use the admin UI for non-admin users.`);
    process.exit(1);
  }

  await prisma.user.update({ where: { email }, data: { status } });
  console.log(`✓ Admin "${email}" status set to: ${status}`);
}

async function deleteAdmin(email: string) {
  if (!email) {
    console.error('Usage: delete <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }
  if (user.role !== 'admin') {
    console.error(`User "${email}" is not an admin (role: ${user.role}). Use the admin UI for non-admin users.`);
    process.exit(1);
  }

  await prisma.user.delete({ where: { email } });
  console.log(`✓ Admin "${email}" permanently deleted.`);
}

async function main() {
  switch (command) {
    case 'list':
      await list();
      break;
    case 'create':
      await create(args[0], args[1], args[2]);
      break;
    case 'suspend':
      await setStatus(args[0], 'suspended');
      break;
    case 'ban':
      await setStatus(args[0], 'banned');
      break;
    case 'activate':
      await setStatus(args[0], 'active');
      break;
    case 'delete':
      await deleteAdmin(args[0]);
      break;
    default:
      console.log(`
Admin CLI — manage admin accounts outside the UI.

Commands:
  list                          List all admin accounts
  create <name> <email> <pass>  Create a new admin account
  suspend <email>               Suspend an admin (blocks login)
  ban <email>                   Ban an admin (blocks login)
  activate <email>              Restore an admin to active
  delete <email>                Permanently delete an admin account

Examples:
  npx ts-node scripts/admin.ts list
  npx ts-node scripts/admin.ts create "Jane Smith" jane@company.com s3cr3tPass!
  npx ts-node scripts/admin.ts suspend jane@company.com
  npx ts-node scripts/admin.ts delete jane@company.com
      `);
  }
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
