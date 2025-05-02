# MySQL Migration Guide for AI Meeting Assistant

This guide explains how to use MySQL instead of PostgreSQL for the AI Meeting Assistant application.

## Overview

The application now supports both PostgreSQL (default) and MySQL databases. All the necessary components have been created to enable a seamless transition between these two database systems.

## MySQL Files

The following MySQL-specific files have been created:

1. **Database Connection**: `db/mysql.ts`
2. **Schema Definition**: `shared/schema.mysql.ts`
3. **Storage and Data Access Layer**: `server/storage.mysql.ts`
4. **Authentication Module**: `server/auth.mysql.ts`
5. **Server Startup Script**: `server/index.mysql.ts`
6. **Database Seed Script**: `db/seed.mysql.ts`
7. **Drizzle Configuration**: `drizzle.mysql.config.ts`

## Helper Scripts

To facilitate working with MySQL, the following shell scripts are available:

1. **Start MySQL Application**: `./mysql_start.sh`
2. **Run MySQL Database Migrations**: `./mysql_migrations.sh`
3. **Seed MySQL Database**: `./mysql_seed.sh`

Make these scripts executable with:
```bash
chmod +x mysql_start.sh mysql_migrations.sh mysql_seed.sh
```

## MySQL Configuration

Update your `.env` file with MySQL connection details:

```
# MySQL Configuration
DATABASE_URL=mysql://username:password@localhost:3306/meetingsmart

# Optional: Individual MySQL params (used by session store)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=meetingsmart
```

## Running with MySQL

1. **Install MySQL**: Ensure MySQL is installed and running on your system.

2. **Create Database**: Create a MySQL database matching your configuration:
   ```sql
   CREATE DATABASE meetingsmart;
   ```

3. **Configure Environment**: Update `.env` file with MySQL connection details.

4. **Run Migrations**: Initialize the database schema with Drizzle ORM:
   ```bash
   ./mysql_migrations.sh
   ```

5. **Seed Database**: Populate the database with sample data:
   ```bash
   ./mysql_seed.sh
   ```

6. **Start Application**: Run the application with MySQL:
   ```bash
   ./mysql_start.sh
   ```

## Main Components

### Database Connection (`db/mysql.ts`)

Sets up the MySQL connection pool and provides the Drizzle ORM instance configured for MySQL.

### Schema Definition (`shared/schema.mysql.ts`)

Defines all database tables and relationships using MySQL-specific column types and constraints.

### Storage Layer (`server/storage.mysql.ts`)

Implements data access methods specifically for MySQL, including session store support with `express-mysql-session`.

### Authentication Module (`server/auth.mysql.ts`)

Handles user authentication with MySQL-specific integration.

## Session Storage

The application uses `express-mysql-session` for persistent session storage with MySQL. If the MySQL database is unavailable, sessions will automatically fall back to in-memory storage.

## TypeScript Integration

There are some TypeScript issues related to the MySQL driver that may appear as warnings. These are related to differences in how MySQL and PostgreSQL handle returning values from queries and don't affect functionality.

## Known Limitations

1. The MySQL implementation uses `insertId` for retrieving newly created records, which differs from PostgreSQL's `RETURNING` clause.
2. Some of the TypeScript types for MySQL are not fully compatible with the existing application types, resulting in TypeScript warnings.
3. The drizzle-orm MySQL integration is less mature than the PostgreSQL integration, so some features may require workarounds.

## Switching Back to PostgreSQL

To revert to PostgreSQL, simply update your `.env` file to use the PostgreSQL connection string and restart the application with the standard workflow.