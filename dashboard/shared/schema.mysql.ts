import { mysqlTable, serial, varchar, text, boolean, timestamp, int, mysqlEnum } from 'drizzle-orm/mysql-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Users
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  avatarInitials: varchar("avatar_initials", { length: 10 }).notNull(),
  avatarColor: varchar("avatar_color", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  email: true,
  avatarInitials: true,
  avatarColor: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Meetings
export const meetings = mysqlTable("meetings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: mysqlEnum("status", ['scheduled', 'live', 'completed']).notNull(),
  summary: text("summary"),
  // agenda: json("agenda").$type<string[]>(), // MySQL JSON field to store string array
  agenda: text("agenda"), // Store JSON as text for compatibility
  externalMeetingCode: varchar("external_meeting_code", { length: 100 }),
  externalMeetingType: varchar("external_meeting_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMeetingSchema = createInsertSchema(meetings).pick({
  title: true,
  description: true,
  startTime: true,
  status: true,
  externalMeetingCode: true,
  externalMeetingType: true,
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Meeting Participants
export const meetingParticipants = mysqlTable("meeting_participants", {
  meetingId: int("meeting_id").notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  pk: z.object([t.meetingId, t.userId]),
}));

// Relations
export const meetingsRelations = relations(meetings, ({ many }) => ({
  participants: many(meetingParticipants),
}));

export const usersRelations = relations(users, ({ many }) => ({
  participatedMeetings: many(meetingParticipants),
  transcriptionEntries: many(transcriptionEntries),
  assignedTasks: many(tasks),
  sentMessages: many(chatMessages),
}));

export const meetingParticipantsRelations = relations(meetingParticipants, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingParticipants.meetingId],
    references: [meetings.id],
  }),
  user: one(users, {
    fields: [meetingParticipants.userId],
    references: [users.id],
  }),
}));

// Transcription Entries
export const transcriptionEntries = mysqlTable("transcription_entries", {
  id: serial("id").primaryKey(),
  meetingId: int("meeting_id").notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transcriptionEntriesRelations = relations(transcriptionEntries, ({ one }) => ({
  meeting: one(meetings, {
    fields: [transcriptionEntries.meetingId],
    references: [meetings.id],
  }),
  user: one(users, {
    fields: [transcriptionEntries.userId],
    references: [users.id],
  }),
}));

export const insertTranscriptionEntrySchema = createInsertSchema(transcriptionEntries).pick({
  meetingId: true,
  userId: true,
  text: true,
  timestamp: true,
});

export type InsertTranscriptionEntry = z.infer<typeof insertTranscriptionEntrySchema>;
export type TranscriptionEntry = typeof transcriptionEntries.$inferSelect;

// Tasks
export const tasks = mysqlTable("tasks", {
  id: serial("id").primaryKey(),
  meetingId: int("meeting_id").notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 255 }).notNull(),
  completed: boolean("completed").notNull().default(false),
  assigneeId: int("assignee_id").references(() => users.id, { onDelete: 'set null' }),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  meeting: one(meetings, {
    fields: [tasks.meetingId],
    references: [meetings.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
}));

export const insertTaskSchema = createInsertSchema(tasks).pick({
  meetingId: true,
  title: true,
  completed: true,
  assigneeId: true,
  dueDate: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Chat Messages
export const chatMessages = mysqlTable("chat_messages", {
  id: serial("id").primaryKey(),
  meetingId: int("meeting_id").notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  senderId: int("sender_id").references(() => users.id, { onDelete: 'set null' }),
  content: text("content").notNull(),
  isAi: boolean("is_ai").notNull().default(false),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  meeting: one(meetings, {
    fields: [chatMessages.meetingId],
    references: [meetings.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  meetingId: true,
  senderId: true,
  content: true,
  isAi: true,
  timestamp: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;