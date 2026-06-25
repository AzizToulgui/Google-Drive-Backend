import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ override: true });

export default {
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_DATABASE!,
    ssl: false,
  },
} satisfies Config;
