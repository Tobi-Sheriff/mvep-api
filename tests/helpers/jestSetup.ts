import dotenv from 'dotenv';

// Load .env so TEST_DATABASE_URL is available
dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set. Add it to your .env file.');
}

// Override DATABASE_URL before any src module loads — config/index.ts reads it on first import
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
