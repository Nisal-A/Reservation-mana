const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  FRONTEND_URL: z.string().default('http://127.0.0.1:5173'),
  HOTEL_TIMEZONE: z.string().default('Asia/Colombo'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default(''),
  RECEPTION_USERNAME: z.string().default('reception'),
  RECEPTION_PASSWORD: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Server startup error: invalid environment configuration:');
  const issues = parsed.error.issues || parsed.error.errors || [];
  issues.forEach((err) => {
    console.error(`  - ${err.path.join('.') || 'config'}: ${err.message}`);
  });
  process.exit(1);
}

module.exports = parsed.data;
