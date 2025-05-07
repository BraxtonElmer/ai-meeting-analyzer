import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import ws from "ws";
import * as schema from "@shared/schema";
import "dotenv/config";
// Import migrations directly since they're in the same file
import { getTableInfo, tryToInitializeDb } from './migrations';

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forgot to provision a database or set DATABASE_URL in your .env file?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Initialize database schema automatically on startup
(async () => {
  try {
    console.log('Checking database tables...');
    const tables = await getTableInfo(pool);
    
    if (tables.length === 0) {
      console.log('No tables found. Initializing database schema...');
      await tryToInitializeDb(pool);
      console.log('Database schema initialized successfully!');
    } else {
      console.log(`Database already has ${tables.length} tables. Schema initialization skipped.`);
    }
  } catch (error) {
    console.error('Error initializing database schema:', error);
  }
})();