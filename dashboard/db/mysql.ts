import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "@shared/schema";

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database or set DATABASE_URL in your .env file?",
  );
}

// Create a MySQL connection pool
export const pool = mysql.createPool(process.env.DATABASE_URL);
export const db = drizzle(pool, { schema, mode: 'default' });

// Initialize database schema automatically on startup
export async function getTableInfo(connection: mysql.Pool): Promise<any[]> {
  try {
    const [rows] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    return rows as any[];
  } catch (error) {
    console.error('Error checking database tables:', error);
    return [];
  }
}

export async function tryToInitializeDb(connection: mysql.Pool): Promise<void> {
  // Execute DDL statements to create tables
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`username\` VARCHAR(255) NOT NULL UNIQUE,
      \`password\` VARCHAR(255) NOT NULL,
      \`full_name\` VARCHAR(255) NOT NULL,
      \`email\` VARCHAR(255) NOT NULL,
      \`avatar_initials\` VARCHAR(10) NOT NULL,
      \`avatar_color\` VARCHAR(50) NOT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createMeetingsTable = `
    CREATE TABLE IF NOT EXISTS \`meetings\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`title\` VARCHAR(255) NOT NULL,
      \`description\` TEXT,
      \`start_time\` TIMESTAMP NOT NULL,
      \`end_time\` TIMESTAMP NULL,
      \`status\` VARCHAR(20) NOT NULL,
      \`summary\` TEXT,
      \`agenda\` JSON,
      \`external_meeting_code\` VARCHAR(100),
      \`external_meeting_type\` VARCHAR(50),
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createMeetingParticipantsTable = `
    CREATE TABLE IF NOT EXISTS \`meeting_participants\` (
      \`meeting_id\` INT NOT NULL,
      \`user_id\` INT NOT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`meeting_id\`, \`user_id\`),
      FOREIGN KEY (\`meeting_id\`) REFERENCES \`meetings\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    );
  `;

  const createTranscriptionEntriesTable = `
    CREATE TABLE IF NOT EXISTS \`transcription_entries\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`meeting_id\` INT NOT NULL,
      \`user_id\` INT NOT NULL,
      \`text\` TEXT NOT NULL,
      \`timestamp\` TIMESTAMP NOT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (\`meeting_id\`) REFERENCES \`meetings\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
    );
  `;

  const createTasksTable = `
    CREATE TABLE IF NOT EXISTS \`tasks\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`meeting_id\` INT NOT NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`completed\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`assignee_id\` INT,
      \`due_date\` TIMESTAMP NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (\`meeting_id\`) REFERENCES \`meetings\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`assignee_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
    );
  `;

  const createChatMessagesTable = `
    CREATE TABLE IF NOT EXISTS \`chat_messages\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`meeting_id\` INT NOT NULL,
      \`sender_id\` INT,
      \`content\` TEXT NOT NULL,
      \`is_ai\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`timestamp\` TIMESTAMP NOT NULL,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (\`meeting_id\`) REFERENCES \`meetings\`(\`id\`) ON DELETE CASCADE,
      FOREIGN KEY (\`sender_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
    );
  `;

  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS \`sessions\` (
      \`session_id\` VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
      \`expires\` INT UNSIGNED NOT NULL,
      \`data\` MEDIUMTEXT COLLATE utf8mb4_bin,
      PRIMARY KEY (\`session_id\`)
    );
  `;

  // Create tables
  await connection.query(createUsersTable);
  await connection.query(createMeetingsTable);
  await connection.query(createMeetingParticipantsTable);
  await connection.query(createTranscriptionEntriesTable);
  await connection.query(createTasksTable);
  await connection.query(createChatMessagesTable);
  await connection.query(createSessionsTable);

  // Create default test user
  const createTestUser = `
    INSERT INTO \`users\` (
      \`username\`, 
      \`password\`, 
      \`full_name\`, 
      \`email\`, 
      \`avatar_initials\`, 
      \`avatar_color\`
    ) VALUES (
      'testuser', 
      '355015d2ac95203c7f19dab7b3650fc0f9bd2dc7ebfcda758935f5b34ebc9d66.65d4e0c95b9bea17', 
      'Test User', 
      'test@example.com', 
      'TU', 
      'bg-blue-100'
    ) ON DUPLICATE KEY UPDATE \`username\` = \`username\`;
  `;
  
  // Create sample data
  const seedSampleData = `
    -- Sample meetings
    INSERT INTO \`meetings\` (
      \`title\`, 
      \`description\`, 
      \`start_time\`, 
      \`status\`
    ) VALUES 
    (
      'Weekly Product Team Sync', 
      'Regular sync meeting to discuss product roadmap and progress', 
      NOW() - INTERVAL 1 DAY, 
      'completed'
    ),
    (
      'UI/UX Design Workshop', 
      'Workshop to align on design guidelines and patterns', 
      NOW() - INTERVAL 2 DAY, 
      'completed'
    ),
    (
      'Sprint Planning', 
      'Planning session for the upcoming sprint', 
      NOW() + INTERVAL 1 DAY, 
      'scheduled'
    ) ON DUPLICATE KEY UPDATE \`title\` = \`title\`;
  `;

  const associateTestUser = `
    -- Associate test user with meetings
    INSERT IGNORE INTO \`meeting_participants\` (\`meeting_id\`, \`user_id\`)
    SELECT m.id, u.id
    FROM \`meetings\` m, \`users\` u
    WHERE u.username = 'testuser' AND m.id = 1;
  `;
  
  const sampleTranscription = `
    -- Sample transcription entry
    INSERT IGNORE INTO \`transcription_entries\` (
      \`meeting_id\`, 
      \`user_id\`, 
      \`text\`, 
      \`timestamp\`
    )
    SELECT 
      1, 
      u.id, 
      'Welcome everyone to our weekly product team sync meeting. Today we will discuss the progress on our AI features.', 
      NOW() - INTERVAL 23 HOUR
    FROM \`users\` u
    WHERE u.username = 'testuser';
  `;
  
  const sampleTask = `
    -- Sample task
    INSERT IGNORE INTO \`tasks\` (
      \`meeting_id\`, 
      \`title\`, 
      \`assignee_id\`
    )
    SELECT 
      1, 
      'Complete UI design for dashboard', 
      u.id
    FROM \`users\` u
    WHERE u.username = 'testuser';
  `;
  
  const sampleChat = `
    -- Sample chat message
    INSERT IGNORE INTO \`chat_messages\` (
      \`meeting_id\`, 
      \`content\`, 
      \`is_ai\`, 
      \`timestamp\`
    )
    VALUES (
      1, 
      'Welcome to the meeting chat. You can ask questions about the meeting content here.', 
      TRUE, 
      NOW() - INTERVAL 23 HOUR
    );
  `;
  
  await connection.query(createTestUser);
  await connection.query(seedSampleData);
  await connection.query(associateTestUser);
  await connection.query(sampleTranscription);
  await connection.query(sampleTask);
  await connection.query(sampleChat);
}

// Initialize database schema automatically on startup
(async () => {
  try {
    console.log('Checking MySQL database tables...');
    const tables = await getTableInfo(pool);
    
    if (tables.length === 0) {
      console.log('No tables found. Initializing MySQL database schema...');
      await tryToInitializeDb(pool);
      console.log('MySQL database schema initialized successfully!');
    } else {
      console.log(`MySQL database already has ${tables.length} tables. Schema initialization skipped.`);
    }
  } catch (error) {
    console.error('Error initializing MySQL database schema:', error);
  }
})();