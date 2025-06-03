import { Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import * as schema from "@shared/schema";

export async function getTableInfo(pool: Pool): Promise<any[]> {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    return result.rows;
  } catch (error) {
    console.error('Error checking database tables:', error);
    return [];
  }
}

export async function tryToInitializeDb(pool: Pool): Promise<void> {
  // Execute DDL statements to create tables
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS "users" (
      "id" SERIAL PRIMARY KEY,
      "username" VARCHAR(255) NOT NULL UNIQUE,
      "password" VARCHAR(255) NOT NULL,
      "full_name" VARCHAR(255) NOT NULL,
      "email" VARCHAR(255) NOT NULL,
      "avatar_initials" VARCHAR(10) NOT NULL,
      "avatar_color" VARCHAR(50) NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createMeetingsTable = `
    CREATE TABLE IF NOT EXISTS "meetings" (
      "id" SERIAL PRIMARY KEY,
      "title" VARCHAR(255) NOT NULL,
      "description" TEXT,
      "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
      "end_time" TIMESTAMP WITH TIME ZONE,
      "status" VARCHAR(20) NOT NULL,
      "summary" TEXT,
      "agenda" TEXT[],
      "external_meeting_code" VARCHAR(100),
      "external_meeting_type" VARCHAR(50),
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createMeetingParticipantsTable = `
    CREATE TABLE IF NOT EXISTS "meeting_participants" (
      "meeting_id" INTEGER NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
      "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("meeting_id", "user_id")
    );
  `;

  const createTranscriptionEntriesTable = `
    CREATE TABLE IF NOT EXISTS "transcription_entries" (
      "id" SERIAL PRIMARY KEY,
      "meeting_id" INTEGER NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
      "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "text" TEXT NOT NULL,
      "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
      "live" BOOLEAN NOT NULL DEFAULT FALSE,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createTasksTable = `
    CREATE TABLE IF NOT EXISTS "tasks" (
      "id" SERIAL PRIMARY KEY,
      "meeting_id" INTEGER NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
      "title" VARCHAR(255) NOT NULL,
      "completed" BOOLEAN NOT NULL DEFAULT FALSE,
      "assignee_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "due_date" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createChatMessagesTable = `
    CREATE TABLE IF NOT EXISTS "chat_messages" (
      "id" SERIAL PRIMARY KEY,
      "meeting_id" INTEGER NOT NULL REFERENCES "meetings"("id") ON DELETE CASCADE,
      "sender_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
      "content" TEXT NOT NULL,
      "is_ai" BOOLEAN NOT NULL DEFAULT FALSE,
      "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Create tables
  await pool.query(createUsersTable);
  await pool.query(createMeetingsTable);
  await pool.query(createMeetingParticipantsTable);
  await pool.query(createTranscriptionEntriesTable);
  await pool.query(createTasksTable);
  await pool.query(createChatMessagesTable);

  // Create default test user
  const createTestUser = `
    INSERT INTO "users" (
      "username", 
      "password", 
      "full_name", 
      "email", 
      "avatar_initials", 
      "avatar_color"
    ) VALUES (
      'testuser', 
      '355015d2ac95203c7f19dab7b3650fc0f9bd2dc7ebfcda758935f5b34ebc9d66.65d4e0c95b9bea17', 
      'Test User', 
      'test@example.com', 
      'TU', 
      'bg-blue-100'
    ) ON CONFLICT DO NOTHING;
  `;
  
  // Create sample data
  const seedSampleData = `
    -- Sample meetings
    INSERT INTO "meetings" (
      "title", 
      "description", 
      "start_time", 
      "status"
    ) VALUES 
    (
      'Weekly Product Team Sync', 
      'Regular sync meeting to discuss product roadmap and progress', 
      NOW() - INTERVAL '1 DAY', 
      'completed'
    ),
    (
      'UI/UX Design Workshop', 
      'Workshop to align on design guidelines and patterns', 
      NOW() - INTERVAL '2 DAY', 
      'completed'
    ),
    (
      'Sprint Planning', 
      'Planning session for the upcoming sprint', 
      NOW() + INTERVAL '1 DAY', 
      'scheduled'
    ) ON CONFLICT DO NOTHING;
    
    -- Associate test user with meetings
    INSERT INTO "meeting_participants" ("meeting_id", "user_id")
    SELECT m.id, u.id
    FROM "meetings" m, "users" u
    WHERE u.username = 'testuser'
    ON CONFLICT DO NOTHING;
    
    -- Sample transcription entry
    INSERT INTO "transcription_entries" (
      "meeting_id", 
      "user_id", 
      "text", 
      "timestamp"
    )
    SELECT 
      1, 
      u.id, 
      'Welcome everyone to our weekly product team sync meeting. Today we will discuss the progress on our AI features.', 
      NOW() - INTERVAL '23 HOURS'
    FROM "users" u
    WHERE u.username = 'testuser'
    ON CONFLICT DO NOTHING;
    
    -- Sample task
    INSERT INTO "tasks" (
      "meeting_id", 
      "title", 
      "assignee_id"
    )
    SELECT 
      1, 
      'Complete UI design for dashboard', 
      u.id
    FROM "users" u
    WHERE u.username = 'testuser'
    ON CONFLICT DO NOTHING;
    
    -- Sample chat message
    INSERT INTO "chat_messages" (
      "meeting_id", 
      "content", 
      "is_ai", 
      "timestamp"
    )
    VALUES (
      1, 
      'Welcome to the meeting chat. You can ask questions about the meeting content here.', 
      TRUE, 
      NOW() - INTERVAL '23 HOURS'
    ) ON CONFLICT DO NOTHING;
  `;
  
  await pool.query(createTestUser);
  await pool.query(seedSampleData);
}