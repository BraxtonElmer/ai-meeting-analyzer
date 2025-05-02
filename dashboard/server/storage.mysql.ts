import { db, pool } from "../db/mysql";
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
} from "../shared/schema.mysql";
import { eq, and, desc, like, or, isNull, isNotNull, sql } from "drizzle-orm";
import session from "express-session";
import createMySQLStore from "express-mysql-session";
import createMemoryStore from "memorystore";

// Session store setup
const MySQLStore = createMySQLStore(session);
const MemoryStore = createMemoryStore(session);

// Create MySQL session store with fallback to memory store
let sessionStore: session.Store;

// Try to use MySQL session store
try {
  const options = {
    // MySQL session store options
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'meetingsmart'
  };
  
  sessionStore = new MySQLStore(options);
  console.log('Using MySQL session store');
} catch (error) {
  // Fallback to memory store if database is not available
  sessionStore = new MemoryStore({
    checkPeriod: 86400000, // 24 hours (prune expired entries)
  });
  console.warn('Falling back to memory store for sessions. Sessions will be lost on server restart.');
}

// Export the session store
export { sessionStore };

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

  // Meeting functions
  async createMeeting(data: {
    title: string;
    description?: string;
    startTime: Date;
    status: 'scheduled' | 'live' | 'completed';
    externalMeetingCode?: string | null;
    externalMeetingType?: string | null;
  }): Promise<any> {  // Using any temporarily to bypass TypeScript's strict checking
    const [meeting] = await db.insert(meetings)
      .values({
        title: data.title,
        description: data.description || null,
        startTime: data.startTime,
        status: data.status,
        externalMeetingCode: data.externalMeetingCode || null,
        externalMeetingType: data.externalMeetingType || null,
      })
      .returning();
      
    // Return with empty participants array
    return {
      ...meeting,
      participants: []
    };
  },
  
  async addMeetingParticipant(meetingId: number, userId: number): Promise<void> {
    try {
      await db.insert(meetingParticipants)
        .values({
          meetingId,
          userId,
        })
        .onDuplicateKeyUpdate({ set: {} }); // No-op update to handle duplicate keys
    } catch (error) {
      console.error('Error adding meeting participant:', error);
      // Ignore duplicate key errors
    }
  },
  
  async getMeetings({ 
    status, 
    limit, 
    search 
  }: { 
    status?: string; 
    limit?: number; 
    search?: string;
  }): Promise<Meeting[]> {
    let query = db.query.meetings;
    
    // Build query conditionally
    const conditions = [];
    
    if (status) {
      conditions.push(eq(meetings.status, status));
    }
    
    if (search) {
      conditions.push(like(meetings.title, `%${search}%`));
    }
    
    let result = await query.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(meetings.startTime)],
      limit: limit,
      with: {
        participants: {
          with: {
            user: true,
          },
        },
      },
    });
    
    // Transform to include participants array
    return result.map(meeting => {
      return {
        ...meeting,
        participants: meeting.participants.map(p => p.user)
      };
    });
  },

  async getMeetingById(meetingId: number): Promise<{
    id: number;
    title: string;
    startTime: Date;
    endTime: Date | null;
    status: string;
    summary: string | null;
    agenda: string[] | null;
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
    
    // Parse agenda from JSON string if it exists
    let agenda: string[] | null = null;
    if (result.agenda) {
      try {
        agenda = JSON.parse(result.agenda);
      } catch {
        agenda = null;
      }
    }
    
    return {
      ...result,
      agenda,
      participants: result.participants.map(p => p.user),
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
    const entries = await db.query.transcriptionEntries.findMany({
      where: eq(transcriptionEntries.meetingId, meetingId),
      orderBy: [transcriptionEntries.timestamp],
      with: {
        user: true,
      },
    });
    
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