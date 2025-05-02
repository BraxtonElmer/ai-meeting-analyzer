import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { storage } from "./storage";
import { generateMeetingSummary, extractTasks, answerMeetingQuestion } from "./gemini";
import { type TranscriptionEntry, type User } from "../shared/schema";
import { setupAuth } from "./auth";

// Extend TranscriptionEntry with user relation for TypeScript
interface TranscriptionEntryWithUser extends TranscriptionEntry {
  user?: User;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    // Add ping interval to detect dead connections
    clientTracking: true,
  });

  // Store active connections by meeting ID
  const connectionsByMeeting = new Map<number, Set<WebSocket>>();

  // Ping all clients every 30 seconds to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    });
  }, 30000);

  // Cleanup interval on server shutdown
  httpServer.on('close', () => {
    clearInterval(pingInterval);
  });

  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    // Parse query parameters to get meetingId
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const meetingId = Number(url.searchParams.get('meetingId'));
    
    // Validate meeting ID
    if (isNaN(meetingId)) {
      try {
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid meeting ID' },
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('Error sending message to client:', err);
      }
      ws.close();
      return;
    }

    // Add connection to the meeting group using a Set to avoid duplicates
    if (!connectionsByMeeting.has(meetingId)) {
      connectionsByMeeting.set(meetingId, new Set());
    }
    connectionsByMeeting.get(meetingId)?.add(ws);

    // Track last activity time
    let lastActivity = Date.now();
    
    // Update activity on pong responses
    ws.on('pong', () => {
      lastActivity = Date.now();
    });

    // Send initial connection confirmation
    try {
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: { meetingId },
        timestamp: new Date().toISOString()
      }));
    } catch (err) {
      console.error('Error sending connection confirmation:', err);
    }

    // Handle client messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Process messages based on type
        switch (data.type) {
          case 'transcription_update':
            // Add transcription to database
            const entry = await storage.addTranscriptionEntry(
              meetingId,
              data.userId,
              data.text
            );
            
            // Broadcast to all clients in the meeting
            broadcastToMeeting(meetingId, {
              type: 'transcription',
              data: { entry },
              meetingId,
              timestamp: new Date().toISOString()
            });
            
            // Attempt to update summary if we have enough entries
            const entries = await storage.getTranscriptionEntries(meetingId);
            if (entries.length % 5 === 0) { // Every 5 entries
              try {
                // Generate AI summary and broadcast it
                const summary = await generateMeetingSummaryFromId(meetingId);
                broadcastToMeeting(meetingId, {
                  type: 'summary',
                  data: { summary },
                  meetingId,
                  timestamp: new Date().toISOString()
                });
              } catch (error) {
                console.error('Failed to generate summary:', error);
              }
            }
            break;
            
          default:
            // Unknown message type
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: 'Unknown message type' },
              timestamp: new Date().toISOString()
            }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' },
          timestamp: new Date().toISOString()
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      const connections = connectionsByMeeting.get(meetingId);
      if (connections) {
        connections.delete(ws);
        
        // Clean up empty meeting connections
        if (connections.size === 0) {
          connectionsByMeeting.delete(meetingId);
        }
      }
    });
    
    // Handle errors to prevent crashes
    ws.on('error', (err) => {
      console.error(`WebSocket error for meeting ${meetingId}:`, err);
      // Remove the connection on error
      const connections = connectionsByMeeting.get(meetingId);
      if (connections) {
        connections.delete(ws);
      }
    });
  });

  // Helper function to broadcast to all clients in a meeting
  function broadcastToMeeting(meetingId: number, data: any) {
    const connections = connectionsByMeeting.get(meetingId);
    if (!connections) return;
    
    connections.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(data));
        } catch (err) {
          console.error(`Error broadcasting to client in meeting ${meetingId}:`, err);
          // Remove problematic connection
          connections.delete(client);
        }
      }
    });
  }

  // Helper function to generate meeting summary using Gemini
  async function generateMeetingSummaryFromId(meetingId: number): Promise<string> {
    try {
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      if (transcriptions.length === 0) {
        return '';
      }
      
      // Format transcriptions for the AI
      const transcript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      // Request summary from Gemini
      const summary = await generateMeetingSummary(transcript);
      
      // Save summary to the database
      await storage.updateMeetingSummary(meetingId, summary);
      
      return summary;
    } catch (error) {
      console.error('Error generating meeting summary:', error);
      throw error;
    }
  }

  // Helper function to extract tasks from meeting transcript using Gemini
  async function extractTasksFromId(meetingId: number): Promise<any[]> {
    try {
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      if (transcriptions.length === 0) {
        return [];
      }
      
      // Format transcriptions for the AI
      const transcript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      // Request task extraction from Gemini
      const tasks = await extractTasks(transcript);
      
      // Save tasks to the database
      for (const task of tasks) {
        const userId = await storage.findUserIdByName(task.assignee);
        await storage.createTask({
          meetingId,
          title: task.description,
          assigneeId: userId || undefined,
          dueDate: task.dueDate || undefined,
          completed: false
        });
      }
      
      return tasks;
    } catch (error) {
      console.error('Error extracting tasks:', error);
      throw error;
    }
  }

  // Helper function to answer questions about the meeting using Gemini
  async function answerMeetingQuestionFromId(meetingId: number, question: string): Promise<string> {
    try {
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      const meeting = await storage.getMeetingById(meetingId);
      
      if (transcriptions.length === 0) {
        return "I don't have any transcription data for this meeting yet.";
      }
      
      // Format transcriptions for the AI
      const transcript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      // Request answer from Gemini
      const meetingTitle = meeting?.title || 'Unknown';
      const answer = await answerMeetingQuestion(transcript, meetingTitle, question);
      
      return answer;
    } catch (error) {
      console.error('Error answering meeting question:', error);
      throw error;
    }
  }

  // API Routes
  
  // Meetings
  app.get('/api/meetings', async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const search = req.query.search as string | undefined;
      
      const meetings = await storage.getMeetings({ status, limit, search });
      res.json(meetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      res.status(500).json({ message: 'Failed to fetch meetings' });
    }
  });
  
  // Import meeting from Google Meet
  app.post('/api/meetings/import', async (req, res) => {
    try {
      const { meetingUrl, title, description } = req.body;
      
      if (!meetingUrl || !title) {
        return res.status(400).json({ message: 'Meeting URL and title are required' });
      }
      
      // Extract Google Meet code from URL
      const meetCodeMatch = meetingUrl.match(/meet\.google\.com\/([\w-]+)/);
      const meetCode = meetCodeMatch ? meetCodeMatch[1] : null;
      
      if (!meetCode) {
        return res.status(400).json({ message: 'Invalid Google Meet URL' });
      }
      
      // Create a new meeting in the database
      const now = new Date();
      const meeting = await storage.createMeeting({
        title,
        description: description || '',
        startTime: now,
        status: 'live',
        externalMeetingCode: meetCode,
        externalMeetingType: 'google_meet'
      });
      
      // In a real implementation, this is where you would trigger your bot to join the meeting
      // For this demo, we'll just simulate that process
      
      // Add the current user as a participant if authenticated
      if (req.isAuthenticated() && req.user && 'id' in req.user) {
        const userId = Number(req.user.id);
        await storage.addMeetingParticipant(meeting.id, userId);
      }
      
      // Add a system message indicating the meeting has been imported
      await storage.addChatMessage(meeting.id, {
        content: `Meeting imported from Google Meet. Meeting code: ${meetCode}`,
        isAi: true
      });
      
      // Return the created meeting
      res.status(201).json(meeting);
    } catch (error) {
      console.error('Error importing meeting:', error);
      res.status(500).json({ message: 'Failed to import meeting' });
    }
  });

  app.get('/api/meetings/:id', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      res.json(meeting);
    } catch (error) {
      console.error('Error fetching meeting:', error);
      res.status(500).json({ message: 'Failed to fetch meeting' });
    }
  });

  // Transcription
  app.get('/api/meetings/:id/transcription', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const transcriptions = await storage.getTranscriptionEntries(meetingId);
      res.json(transcriptions);
    } catch (error) {
      console.error('Error fetching transcriptions:', error);
      res.status(500).json({ message: 'Failed to fetch transcriptions' });
    }
  });

  app.post('/api/meetings/:id/transcription', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { userId, text } = req.body;
      
      if (!userId || !text) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const entry = await storage.addTranscriptionEntry(meetingId, userId, text);
      
      // Broadcast to WebSocket clients
      broadcastToMeeting(meetingId, {
        type: 'transcription',
        data: { entry },
        meetingId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json(entry);
    } catch (error) {
      console.error('Error adding transcription:', error);
      res.status(500).json({ message: 'Failed to add transcription' });
    }
  });
  
  // Special API endpoint for Python bot to add transcriptions
  app.post('/api/bot/transcription', async (req, res) => {
    try {
      const { meetingId, userId, text, apiKey } = req.body;
      
      // Validate required fields
      if (!meetingId || !userId || !text) {
        return res.status(400).json({ message: 'Missing required fields: meetingId, userId, text' });
      }
      
      // Basic API key validation - in a real app, use a secure method
      const validApiKey = process.env.BOT_API_KEY || 'ai-meeting-assistant-bot-key';
      if (apiKey !== validApiKey) {
        return res.status(401).json({ message: 'Invalid API key' });
      }
      
      // Add the transcription entry
      const entry = await storage.addTranscriptionEntry(meetingId, userId, text);
      
      // Broadcast to WebSocket clients
      broadcastToMeeting(meetingId, {
        type: 'transcription',
        data: { entry },
        meetingId,
        timestamp: new Date().toISOString()
      });
      
      // Check if we should generate tasks (every 5 entries or explicit request)
      const generateTasks = req.query.generateTasks === 'true';
      const entries = await storage.getTranscriptionEntries(meetingId);
      
      if (generateTasks || entries.length % 5 === 0) {
        try {
          // Extract tasks and broadcast them
          const tasks = await extractTasksFromId(meetingId);
          
          // Get the formatted tasks for the response
          const formattedTasks = await storage.getTasksByMeeting(meetingId);
          
          // Only broadcast if tasks were found
          if (tasks.length > 0) {
            broadcastToMeeting(meetingId, {
              type: 'task',
              data: { tasks: formattedTasks },
              meetingId,
              timestamp: new Date().toISOString()
            });
          }
          
          // Include tasks in the response
          return res.status(201).json({ 
            entry,
            tasksGenerated: tasks.length > 0,
            tasks: formattedTasks
          });
          
        } catch (error) {
          console.error('Failed to generate tasks:', error);
          // Continue with the response even if task generation fails
        }
      }
      
      // If no tasks were generated or there was an error, return just the entry
      res.status(201).json({ entry });
      
    } catch (error) {
      console.error('Error processing bot transcription:', error);
      res.status(500).json({ message: 'Failed to process transcription from bot' });
    }
  });

  // Tasks
  app.get('/api/meetings/:id/tasks', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const tasks = await storage.getTasksByMeeting(meetingId);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  app.get('/api/tasks', async (req, res) => {
    try {
      const completed = req.query.completed === 'true';
      const assigneeId = req.query.assigneeId ? parseInt(req.query.assigneeId as string) : undefined;
      const meetingId = req.query.meetingId ? parseInt(req.query.meetingId as string) : undefined;
      
      const tasks = await storage.getTasks({ completed, assigneeId, meetingId });
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });
  
  app.post('/api/tasks', async (req, res) => {
    try {
      const { meetingId, title, assigneeId, dueDate } = req.body;
      
      if (!meetingId || !title) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const task = await storage.createTask({
        meetingId: parseInt(meetingId),
        title,
        assigneeId: assigneeId ? parseInt(assigneeId) : undefined,
        dueDate,
        completed: false
      });
      
      // Broadcast to WebSocket clients
      broadcastToMeeting(task.meetingId, {
        type: 'task',
        data: { task },
        meetingId: task.meetingId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ message: 'Failed to create task' });
    }
  });

  app.post('/api/meetings/:id/tasks', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { title, assigneeId, dueDate } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: 'Missing task title' });
      }
      
      const task = await storage.createTask({
        meetingId,
        title,
        assigneeId,
        dueDate,
        completed: false
      });
      
      // Broadcast to WebSocket clients
      broadcastToMeeting(meetingId, {
        type: 'task',
        data: { task },
        meetingId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ message: 'Failed to create task' });
    }
  });

  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const updates = req.body;
      
      const updatedTask = await storage.updateTask(taskId, updates);
      
      if (!updatedTask) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Broadcast task update to meeting
      broadcastToMeeting(updatedTask.meetingId, {
        type: 'task_update',
        data: { task: updatedTask },
        meetingId: updatedTask.meetingId,
        timestamp: new Date().toISOString()
      });
      
      res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ message: 'Failed to update task' });
    }
  });

  // Users
  app.get('/api/users', async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Chat
  app.get('/api/meetings/:id/chat', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const messages = await storage.getChatMessages(meetingId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      res.status(500).json({ message: 'Failed to fetch chat messages' });
    }
  });

  app.post('/api/meetings/:id/chat', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { content, senderId } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: 'Missing message content' });
      }
      
      // Save user message
      const userMessage = await storage.addChatMessage(meetingId, {
        senderId,
        content,
        isAi: false
      });
      
      // Broadcast user message
      broadcastToMeeting(meetingId, {
        type: 'chat',
        data: { message: userMessage },
        meetingId,
        timestamp: new Date().toISOString()
      });
      
      // Generate AI response
      const aiResponse = await answerMeetingQuestionFromId(meetingId, content);
      
      // Save AI response
      const aiMessage = await storage.addChatMessage(meetingId, {
        content: aiResponse,
        isAi: true
      });
      
      // Broadcast AI response
      broadcastToMeeting(meetingId, {
        type: 'chat',
        data: { message: aiMessage },
        meetingId,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json(userMessage);
    } catch (error) {
      console.error('Error processing chat message:', error);
      res.status(500).json({ message: 'Failed to process message' });
    }
  });

  // Ask AI specific questions
  app.post('/api/meetings/:id/ask', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { question } = req.body;
      
      if (!question) {
        return res.status(400).json({ message: 'Missing question' });
      }
      
      const answer = await answerMeetingQuestionFromId(meetingId, question);
      res.json({ content: answer });
    } catch (error) {
      console.error('Error answering question:', error);
      res.status(500).json({ message: 'Failed to answer question' });
    }
  });

  // Generate summary
  app.get('/api/meetings/:id/summary', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const meeting = await storage.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      // If no summary exists, generate one
      if (!meeting.summary) {
        meeting.summary = await generateMeetingSummaryFromId(meetingId);
      }
      
      res.json({ content: meeting.summary });
    } catch (error) {
      console.error('Error generating summary:', error);
      res.status(500).json({ message: 'Failed to generate summary' });
    }
  });

  // Extract tasks from meeting
  app.get('/api/meetings/:id/tasks', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const tasks = await storage.getTasksByMeeting(meetingId);
      
      // If no tasks exist, extract them
      if (tasks.length === 0) {
        await extractTasksFromId(meetingId);
        const newTasks = await storage.getTasksByMeeting(meetingId);
        return res.json(newTasks);
      }
      
      res.json(tasks);
    } catch (error) {
      console.error('Error extracting tasks:', error);
      res.status(500).json({ message: 'Failed to extract tasks' });
    }
  });

  // AI Analysis
  app.post('/api/ai/analyze', async (req, res) => {
    try {
      const { text, type, meetingId } = req.body;
      
      if (!text || !type) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      let result;
      
      switch (type) {
        case 'summary':
          result = await generateMeetingSummaryFromId(meetingId || 0);
          break;
        case 'tasks':
          result = await extractTasksFromId(meetingId || 0);
          break;
        case 'question':
          result = await answerMeetingQuestionFromId(meetingId || 0, text);
          break;
        default:
          return res.status(400).json({ message: 'Invalid analysis type' });
      }
      
      res.json({ content: result });
    } catch (error) {
      console.error('Error during AI analysis:', error);
      res.status(500).json({ message: 'Failed to analyze text' });
    }
  });

  return httpServer;
}
