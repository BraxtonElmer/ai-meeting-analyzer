// User related types
export interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  avatarInitials: string;
  avatarColor: string;
}

// Meeting related types
export interface Meeting {
  id: number;
  title: string;
  startTime: string;
  endTime?: string;
  status: 'scheduled' | 'live' | 'completed';
  participants: User[];
  agenda?: string[];
  summary?: string;
}

export interface MeetingDetails extends Meeting {
  duration: string;
  date: string;
}

// Transcription related types
export interface TranscriptionEntry {
  id: number;
  meetingId: number;
  userId: number;
  user: User;
  text: string;
  timestamp: string;
  createdAt: string;
}

// Task related types
export interface Task {
  id: number;
  meetingId: number;
  title: string;
  completed: boolean;
  assigneeId?: number;
  assignee?: User;
  dueDate?: string;
  createdAt: string;
}

// Chat related types
export interface ChatMessage {
  id: number;
  meetingId: number;
  senderId?: number;
  sender?: User;
  content: string;
  isAi: boolean;
  timestamp: string;
}

// WebSocket message types
export type WebSocketMessageType = 
  | 'transcription' 
  | 'summary' 
  | 'task' 
  | 'chat' 
  | 'meeting_update'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  meetingId: number;
  timestamp: string;
}

// WebSocket transcription message
export interface TranscriptionMessage extends WebSocketMessage {
  type: 'transcription';
  data: {
    entry: TranscriptionEntry;
  };
}

// WebSocket meeting update message
export interface MeetingUpdateMessage extends WebSocketMessage {
  type: 'meeting_update';
  data: {
    meeting: Meeting;
  };
}
