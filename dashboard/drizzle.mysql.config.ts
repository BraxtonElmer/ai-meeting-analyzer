import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not provided. Make sure to provide a MySQL connection string.");
}

export default defineConfig({
  out: "./db/mysql-migrations",
  schema: "./shared/schema.mysql.ts",
  dialect: "mysql2",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
});