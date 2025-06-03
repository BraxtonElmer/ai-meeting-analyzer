import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  avatarInitials: text("avatar_initials").notNull(),
  avatarColor: text("avatar_color").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schema for users
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

// Meetings table
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'live', 'completed'
  summary: text("summary"),
  agenda: json("agenda").$type<string[]>(),
  externalMeetingCode: text("external_meeting_code"),
  externalMeetingType: text("external_meeting_type"),
  creatorId: integer("creator_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schema for meetings
export const insertMeetingSchema = createInsertSchema(meetings).pick({
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  status: true,
  summary: true,
  agenda: true,
  externalMeetingCode: true,
  externalMeetingType: true,
  creatorId: true,
});

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;

// Meeting participants join table
export const meetingParticipants = pgTable("meeting_participants", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations for meetings
export const meetingsRelations = relations(meetings, ({ many, one }) => ({
  participants: many(meetingParticipants),
  transcriptionEntries: many(transcriptionEntries),
  tasks: many(tasks),
  chatMessages: many(chatMessages),
  creator: one(users, {
    fields: [meetings.creatorId],
    references: [users.id],
    relationName: "created_meetings"
  }),
}));

// Define relations for users
export const usersRelations = relations(users, ({ many }) => ({
  meetingParticipants: many(meetingParticipants),
  transcriptionEntries: many(transcriptionEntries),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdMeetings: many(meetings, { relationName: "created_meetings" }),
}));

// Define relations for meeting participants
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

// Transcription entries table
export const transcriptionEntries = pgTable("transcription_entries", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  userId: integer("user_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
    live: boolean("live").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations for transcription entries
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

// Insert schema for transcription entries
export const insertTranscriptionEntrySchema = createInsertSchema(transcriptionEntries).pick({
  meetingId: true,
  userId: true,
  text: true,
  timestamp: true,
  live: true,
});

export type InsertTranscriptionEntry = z.infer<typeof insertTranscriptionEntrySchema>;
export type TranscriptionEntry = typeof transcriptionEntries.$inferSelect;

// Tasks table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  assigneeId: integer("assignee_id").references(() => users.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations for tasks
export const tasksRelations = relations(tasks, ({ one }) => ({
  meeting: one(meetings, {
    fields: [tasks.meetingId],
    references: [meetings.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
}));

// Insert schema for tasks
export const insertTaskSchema = createInsertSchema(tasks).pick({
  meetingId: true,
  title: true,
  completed: true,
  assigneeId: true,
  dueDate: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id),
  senderId: integer("sender_id").references(() => users.id),
  content: text("content").notNull(),
  isAi: boolean("is_ai").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations for chat messages
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

// Insert schema for chat messages
export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  meetingId: true,
  senderId: true,
  content: true,
  isAi: true,
  timestamp: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
