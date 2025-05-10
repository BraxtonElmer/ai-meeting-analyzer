import { db } from "@db";
import { 
  users, 
  meetings, 
  meetingParticipants, 
  transcriptionEntries, 
  tasks,
  chatMessages, 
  type User,
  type Meeting,
  type TranscriptionEntry,
  type Task,
  type ChatMessage
} from "@shared/schema";
import { eq, and, desc, like, or, isNull, isNotNull, sql, inArray } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import session from "express-session";
import { pool } from "@db";

// User related functions
export const storage = {
  // User functions
  async getUserById(userId: number): Promise<User | null> {
    const result = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return result || null;
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    return result || null;
  },

  async getAllUsers(): Promise<User[]> {
    const userList = await db.query.users.findMany({
      orderBy: [users.fullName],
    });

    return userList;
  },

  async createUser(userData: {
    username: string;
    password: string;
    fullName: string;
    email: string;
    avatarInitials: string;
    avatarColor: string;
  }): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  },

  async findUserIdByName(name: string): Promise<number | null> {
    if (!name) return null;

    // Try to find user by full name (case insensitive)
    const cleanName = name.trim();
    const result = await db.query.users.findFirst({
      where: sql`LOWER(${users.fullName}) = LOWER(${cleanName})`,
      columns: { id: true }
    });

    if (result) {
      return result.id;
    }

    // Try by first name if full name fails
    const firstName = cleanName.split(' ')[0];
    const byFirstName = await db.query.users.findFirst({
      where: sql`LOWER(${users.fullName}) LIKE LOWER(${firstName + '%'})`,
      columns: { id: true }
    });

    return byFirstName?.id || null;
  },
  
  async updateUserProfile(userId: number, userData: {
    username: string;
    fullName: string;
    email: string;
    avatarInitials: string;
  }): Promise<User | null> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, userId))
      .returning();
      
    return updatedUser || null;
  },

  // Meeting functions
  async createMeeting(data: {
    title: string;
    description?: string;
    startTime: Date;
    status: 'scheduled' | 'live' | 'completed';
    externalMeetingCode?: string | null;
    externalMeetingType?: string | null;
    creatorId?: number | null;
  }): Promise<any> {  // Using any temporarily to bypass TypeScript's strict checking
    const [meeting] = await db.insert(meetings)
      .values({
        title: data.title,
        description: data.description || null,
        startTime: data.startTime,
        status: data.status,
        externalMeetingCode: data.externalMeetingCode || null,
        externalMeetingType: data.externalMeetingType || null,
        creatorId: data.creatorId || null,
      })
      .returning();

    // Return with empty participants array
    return {
      ...meeting,
      participants: []
    };
  },

  async addMeetingParticipant(meetingId: number, userId: number): Promise<void> {
    await db.insert(meetingParticipants)
      .values({
        meetingId,
        userId,
      })
      .onConflictDoNothing();
  },

  async getMeetings({ 
    status, 
    limit, 
    search,
    userId 
  }: { 
    status?: string; 
    limit?: number; 
    search?: string;
    userId?: number;
  }): Promise<Meeting[]> {
    // Build the array of conditions manually
    const conditions = [];
    
    if (status) {
      conditions.push(eq(meetings.status, status));
    }
    
    if (search) {
      conditions.push(like(meetings.title, `%${search}%`));
    }
    
    let result;
    
    // If userId is provided, we need to get both:
    // 1. Meetings where user is creator
    // 2. Meetings where user is a participant
    if (userId) {
      // First, get all meetings where user is creator
      let creatorQuery = db.select().from(meetings)
        .where(and(eq(meetings.creatorId, userId), ...conditions))
        .orderBy(desc(meetings.startTime))
        .limit(limit || 50);
        
      const creatorMeetings = await creatorQuery;
      
      // Second, get all meeting IDs where user is a participant
      const participantMeetingIds = await db.select({ meetingId: meetingParticipants.meetingId })
        .from(meetingParticipants)
        .where(eq(meetingParticipants.userId, userId));
        
      // If there are participant meetings, get those too
      if (participantMeetingIds.length > 0) {
        // Extract just the IDs
        const meetingIds = participantMeetingIds.map(p => p.meetingId);
        
        // Build a query for participant meetings
        const participantQuery = db.select().from(meetings)
          .where(and(
            inArray(meetings.id, meetingIds),
            ...conditions
          ))
          .orderBy(desc(meetings.startTime))
          .limit(limit || 50);
          
        const participantMeetings = await participantQuery;
        
        // Combine and deduplicate meetings
        const allMeetings = [...creatorMeetings, ...participantMeetings];
        const uniqueMeetingIds = new Set();
        result = allMeetings.filter(meeting => {
          if (uniqueMeetingIds.has(meeting.id)) {
            return false;
          }
          uniqueMeetingIds.add(meeting.id);
          return true;
        });
      } else {
        // User is not a participant in any meetings
        result = creatorMeetings;
      }
    } else {
      // No userId filter, get all meetings
      let query = db.select().from(meetings);
      
      // Apply conditions if there are any
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      result = await query
        .orderBy(desc(meetings.startTime))
        .limit(limit || 50);
    }

    // Get participants for each meeting
    const meetingsWithParticipants = await Promise.all(
      result.map(async (meeting) => {
        const participants = await db.query.meetingParticipants.findMany({
          where: eq(meetingParticipants.meetingId, meeting.id),
          with: {
            user: true,
          },
        });
        return {
          ...meeting,
          participants: participants.map(p => p.user)
        };
      })
    );

    return meetingsWithParticipants;
  },

  async getMeetingById(meetingId: number): Promise<{
    id: number;
    title: string;
    startTime: Date;
    endTime: Date | null;
    status: string;
    summary: string | null;
    agenda: string[] | null;
    creatorId: number | null;
    participants: User[];
    date: string;
    duration: string;
  } | null> {
    const result = await db.query.meetings.findFirst({
      where: eq(meetings.id, meetingId),
      with: {
        participants: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!result) return null;

    // Format date and calculate duration
    const formattedDate = formatDate(result.startTime);
    const duration = calculateDuration(result.startTime, result.endTime);

    return {
      ...result,
      participants: result.participants.map(p => p.user),
      creatorId: result.creatorId,
      date: formattedDate,
      duration,
    };
  },

  async updateMeetingSummary(meetingId: number, summary: string): Promise<void> {
    await db.update(meetings)
      .set({ summary })
      .where(eq(meetings.id, meetingId));
  },

  // Transcription functions
  async getTranscriptionEntries(meetingId: number): Promise<TranscriptionEntry[]> {
    // Enhanced query to ensure user information is included
    const entries = await db.query.transcriptionEntries.findMany({
      where: eq(transcriptionEntries.meetingId, meetingId),
      orderBy: [transcriptionEntries.timestamp],
      with: {
        user: true,
      },
    });

    // Log entries to diagnose any issues with missing user information
    console.log(`Retrieved ${entries.length} transcription entries for meeting ${meetingId}`);
    
    // Check for entries with missing user info
    const entriesWithMissingUser = entries.filter(entry => !entry.user);
    if (entriesWithMissingUser.length > 0) {
      console.warn(`Found ${entriesWithMissingUser.length} entries with missing user info`);
      
      // Try to fetch user information for these entries separately
      for (let i = 0; i < entriesWithMissingUser.length; i++) {
        const entry = entriesWithMissingUser[i];
        try {
          const user = await this.getUserById(entry.userId);
          if (user) {
            // Update the entry in the original array
            const index = entries.findIndex(e => e.id === entry.id);
            if (index !== -1) {
              entries[index].user = user;
            }
          }
        } catch (error) {
          console.error(`Error fetching user info for entry ${entry.id}:`, error);
        }
      }
    }

    return entries;
  },

  async addTranscriptionEntry(
    meetingId: number, 
    userId: number, 
    text: string
  ): Promise<TranscriptionEntry> {
    const now = new Date();

    const [entry] = await db.insert(transcriptionEntries)
      .values({
        meetingId,
        userId,
        text,
        timestamp: now,
      })
      .returning();

    // Fetch the entry with user details
    const result = await db.query.transcriptionEntries.findFirst({
      where: eq(transcriptionEntries.id, entry.id),
      with: {
        user: true,
      },
    });

    if (!result) {
      throw new Error('Failed to retrieve created transcription entry');
    }

    return result;
  },

  // Task functions
  async getTasks({ 
    completed,
    assigneeId,
    meetingId
  }: { 
    completed?: boolean;
    assigneeId?: number;
    meetingId?: number;
  }): Promise<Task[]> {
    const conditions = [];

    if (completed !== undefined) {
      conditions.push(eq(tasks.completed, completed));
    }

    if (assigneeId) {
      conditions.push(eq(tasks.assigneeId, assigneeId));
    }

    if (meetingId) {
      conditions.push(eq(tasks.meetingId, meetingId));
    }

    const result = await db.query.tasks.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [tasks.createdAt],
      with: {
        assignee: true,
      },
    });

    return result;
  },

  async getTasksByMeeting(meetingId: number): Promise<Task[]> {
    const result = await db.query.tasks.findMany({
      where: eq(tasks.meetingId, meetingId),
      orderBy: [tasks.createdAt],
      with: {
        assignee: true,
      },
    });

    return result;
  },

  async createTask(taskData: {
    meetingId: number;
    title: string;
    assigneeId?: number;
    dueDate?: string;
    completed: boolean;
  }): Promise<Task> {
    const [task] = await db.insert(tasks)
      .values({
        meetingId: taskData.meetingId,
        title: taskData.title,
        assigneeId: taskData.assigneeId || null,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
        completed: taskData.completed || false,
      })
      .returning();

    // Fetch the task with assignee details
    const result = await db.query.tasks.findFirst({
      where: eq(tasks.id, task.id),
      with: {
        assignee: true,
      },
    });

    if (!result) {
      throw new Error('Failed to retrieve created task');
    }

    return result;
  },

  async updateTask(taskId: number, updates: Partial<Task>): Promise<Task | null> {
    const [updated] = await db.update(tasks)
      .set(updates)
      .where(eq(tasks.id, taskId))
      .returning();

    if (!updated) return null;

    // Fetch the task with assignee details
    const result = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      with: {
        assignee: true,
      },
    });

    // Handle null case explicitly for TypeScript
    if (!result) return null;

    return result;
  },

  // Chat functions
  async getChatMessages(meetingId: number): Promise<ChatMessage[]> {
    const messages = await db.query.chatMessages.findMany({
      where: eq(chatMessages.meetingId, meetingId),
      orderBy: [chatMessages.timestamp],
      with: {
        sender: true,
      },
    });

    return messages;
  },

  async addChatMessage(
    meetingId: number, 
    messageData: {
      senderId?: number;
      content: string;
      isAi: boolean;
    }
  ): Promise<ChatMessage> {
    const now = new Date();

    const [message] = await db.insert(chatMessages)
      .values({
        meetingId,
        senderId: messageData.senderId || null,
        content: messageData.content,
        isAi: messageData.isAi,
        timestamp: now,
      })
      .returning();

    // Fetch the message with sender details
    const result = await db.query.chatMessages.findFirst({
      where: eq(chatMessages.id, message.id),
      with: {
        sender: true,
      },
    });

    if (!result) {
      throw new Error('Failed to retrieve created chat message');
    }

    return result;
  },
};

// Session store
// Create PostgreSQL session store when database is available, otherwise fallback to memory store
let sessionStore: session.Store;

// Try to use PostgreSQL session store
try {
  const PostgresSessionStore = connectPg(session);
  sessionStore = new PostgresSessionStore({ 
    pool, 
    createTableIfMissing: true 
  });
  console.log('Using PostgreSQL session store');
} catch (error) {
  // Fallback to memory store if database is not available
  const MemoryStore = createMemoryStore(session);
  sessionStore = new MemoryStore({
    checkPeriod: 86400000, // 24 hours (prune expired entries)
  });
  console.warn('Falling back to memory store for sessions. Sessions will be lost on server restart.');
}

// Export the session store
export { sessionStore };

// Helper functions

// Format date to a user-friendly string
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Calculate duration between start and end times
function calculateDuration(startTime: Date, endTime: Date | null): string {
  if (!endTime) {
    return 'In progress';
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  const minutes = Math.floor(durationMs / (1000 * 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours} hr${hours > 1 ? 's' : ''} ${remainingMinutes} min`;
}