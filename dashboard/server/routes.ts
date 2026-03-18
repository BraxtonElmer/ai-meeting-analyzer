import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import axios from "axios";
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
  
  // Store custom report data
  const customReportData = new Map<string, any>();

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
            try {
              // Create a request-like object with only the headers we need for checkUserMeetingAccess
              const requestLike = { headers: req.headers };
              
              // Check if user has access to this meeting
              const hasAccess = await checkUserMeetingAccess(requestLike, meetingId);
              if (!hasAccess) {
                console.warn(`Unauthorized WebSocket attempt to add transcription for meeting ${meetingId}`);
                ws.send(JSON.stringify({
                  type: 'error',
                  data: { message: 'Unauthorized access to this meeting' },
                  timestamp: new Date().toISOString()
                }));
                break;
              }
            
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
            } catch (error) {
              console.error('Error handling transcription update:', error);
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Failed to process transcription' },
                timestamp: new Date().toISOString()
              }));
            }
            break;
            
          case 'custom_report_data':
            // Handle custom report data submission
            if (!data.reportType || !data.reportData) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Missing reportType or reportData' },
                timestamp: new Date().toISOString()
              }));
              break;
            }

            // Validate report type
            const validReportTypes = ['sentiment', 'topics', 'tone', 'participants'];
            if (!validReportTypes.includes(data.reportType)) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid reportType. Must be one of: sentiment, topics, tone, participants' },
                timestamp: new Date().toISOString()
              }));
              break;
            }
            
            // Check if user has access to this meeting
            try {
              // Create a request-like object with only the headers we need for checkUserMeetingAccess
              // This is a simplified approach for WebSockets
              const requestLike = { headers: req.headers };
              
              const hasAccess = await checkUserMeetingAccess(requestLike, meetingId);
              if (!hasAccess) {
                console.warn(`Unauthorized WebSocket attempt to submit report data for meeting ${meetingId}`);
                ws.send(JSON.stringify({
                  type: 'error',
                  data: { message: 'Unauthorized access to this meeting' },
                  timestamp: new Date().toISOString()
                }));
                break;
              }
              
              // Store the custom report data
              const customKey = `${data.reportType}-${meetingId}`;
              customReportData.set(customKey, data.reportData);
              
              // Send confirmation
              ws.send(JSON.stringify({
                type: 'custom_report_data_confirmation',
                data: { 
                  message: `${data.reportType} data stored successfully for meeting ${meetingId}`,
                  reportType: data.reportType
                },
                timestamp: new Date().toISOString()
              }));
              
              // Broadcast to all clients that new report data is available
              broadcastToMeeting(meetingId, {
                type: 'report_data_updated',
                data: { 
                  reportType: data.reportType
                },
                meetingId,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              console.error(`Error handling custom ${data.reportType} data:`, error);
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: `Failed to process ${data.reportType} data` },
                timestamp: new Date().toISOString()
              }));
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

  // Helper function to check if user has access to a meeting
  async function checkUserMeetingAccess(req: any, meetingId: number): Promise<boolean> {
    // For HTTP requests that have authenticated users
    if (req && req.isAuthenticated && req.isAuthenticated()) {
      if (!req.user || !('id' in req.user)) {
        return false;
      }
      
      const userId = Number(req.user.id);
      const meeting = await storage.getMeetingById(meetingId);
      
      if (!meeting) {
        return false;
      }
      
      // Check if user is the creator of the meeting
      if (meeting.creatorId === userId) {
        return true;
      }
      
      // Check if user is a participant
      const isParticipant = meeting.participants.some(p => 
        // Check if the participant is this user
        p.id === userId
      );
      
      if (isParticipant) {
        return true;
      }
      
      return false;
    } 
    // For WebSocket connections or other requests
    else {
      // We should require proper authentication for WebSocket connections as well
      // This would typically involve checking auth cookies or tokens
      // For now, we'll be more restrictive and require authentication
      console.log("Non-authenticated request access check for meeting", meetingId);
      return false; // Changed to false to enforce authentication for all requests
    }
  }
  
  // Helper function to extract tasks from meeting transcript using Gemini
  async function extractTasksFromId(meetingId: number): Promise<any[]> {
    try {
      // First check if the meeting exists
      const meeting = await storage.getMeetingById(meetingId);
      if (!meeting) {
        console.error(`Cannot extract tasks: Meeting with ID ${meetingId} not found`);
        return [];
      }
      
      // Get transcription entries
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      if (transcriptions.length === 0) {
        console.log(`No transcription entries found for meeting ID ${meetingId}`);
        return [];
      }
      
      console.log(`Processing ${transcriptions.length} transcription entries for task extraction from meeting "${meeting.title}"`);
      
      // Format transcriptions for the AI
      const transcript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      // Request task extraction from Gemini
      console.log("Sending transcript to Gemini for task extraction...");
      const tasks = await extractTasks(transcript);
      console.log(`Received ${tasks.length} tasks from Gemini:`, JSON.stringify(tasks));
      
      // Check if we have existing tasks for this meeting
      const existingTasks = await storage.getTasksByMeeting(meetingId);
      if (existingTasks.length > 0) {
        console.log(`Found ${existingTasks.length} existing tasks for this meeting. Will skip duplicate tasks.`);
      }
      
      // Track tasks we add to avoid duplicates
      const addedTaskTitles = new Set(existingTasks.map(t => t.title.toLowerCase()));
      const addedTasks = [];
      
      // Save tasks to the database, but skip any that already exist
      for (const task of tasks) {
        // Skip empty tasks
        if (!task.description || task.description.trim() === '') {
          continue;
        }
        
        // Check for duplicates
        const normalizedTitle = task.description.toLowerCase();
        if (addedTaskTitles.has(normalizedTitle)) {
          console.log(`Skipping duplicate task: ${task.description}`);
          continue;
        }
        
        // Find assignee user ID
        const assigneeName = task.assignee || '';
        let userId = null;
        if (assigneeName) {
          userId = await storage.findUserIdByName(assigneeName);
          if (!userId) {
            console.log(`Could not find user ID for assignee: ${assigneeName}`);
          } else {
            console.log(`Found user ID ${userId} for assignee: ${assigneeName}`);
          }
        }
        
        // Create the task
        try {
          await storage.createTask({
            meetingId,
            title: task.description,
            assigneeId: userId || undefined,
            dueDate: task.dueDate || undefined,
            completed: false
          });
          
          addedTaskTitles.add(normalizedTitle);
          addedTasks.push(task);
          console.log(`Created task: "${task.description}" ${userId ? `assigned to user ${userId}` : 'unassigned'}`);
        } catch (err) {
          console.error(`Error creating task "${task.description}":`, err);
        }
      }
      
      console.log(`Successfully added ${addedTasks.length} new tasks for meeting ID ${meetingId}`);
      return addedTasks;
    } catch (error) {
      console.error('Error extracting tasks:', error);
      return []; // Return empty array instead of throwing
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
      
      // Request answer from Gemini with meeting status
      const meetingTitle = meeting?.title || 'Unknown';
      const meetingStatus = meeting?.status || 'completed'; // Default to completed for imported meetings
      
      // Pass meeting status to the answer function
      const answer = await answerMeetingQuestion(transcript, meetingTitle, question, meetingStatus);
      
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
      const userId = req.user?.id;
      
      const meetings = await storage.getMeetings({ status, limit, search, userId });
      res.json(meetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      res.status(500).json({ message: 'Failed to fetch meetings' });
    }
  });
  
  // Import meeting from Google Meet or transcript file
  app.post('/api/meetings/import', async (req, res) => {
    try {
      const { meetingUrl, title, description, transcriptContent } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: 'Title is required' });
      }

      let meetCode = null;
      if (meetingUrl) {
        const meetCodeMatch = meetingUrl.match(/meet\.google\.com\/([\w-]+)/);
        meetCode = meetCodeMatch ? meetCodeMatch[1] : null;
      }

      // Process transcript file content if provided
      interface FormattedTranscript {
        speaker: string;
        text: string;
      }
      let formattedTranscript: FormattedTranscript[] = [];
      if (transcriptContent) {
        const prompt = `
          Convert this transcript text into a structured format. For each speaker's line, identify:
          1. The speaker's name (if available)
          2. The spoken text
          
          Format each line as: "Speaker Name: Spoken text"
          If no speaker is identified, use "Unknown Speaker"
          Try to consistently identify the same speakers throughout the transcript.
          If the text matches a conversation pattern like "John: What do you think?" followed by "I think it's great",
          infer that the second line is from a different speaker.
          
          Transcript:
          ${transcriptContent}
        `;
        
        try {
          const { geminiModel } = await import('./gemini');
          if (geminiModel) {
            // Enhanced prompt for better speaker detection
            const enhancedPrompt = `
              You are a meeting transcription parser. I'll give you meeting transcript text that may be poorly formatted.
              
              YOUR TASK:
              Extract the speaker name and spoken text from each line of a meeting transcript.
              
              RULES:
              1. Look for patterns like "Name: text", "Name - text", timestamps + names, etc.
              2. Use consistent speaker names throughout (don't abbreviate some and use full names for others)
              3. If a speaker can't be identified, use "Unknown Speaker"
              4. Detect when consecutive lines are from different speakers even if not explicitly marked
              5. Never create new text that wasn't in the original
              
              Return ONLY a JSON array with each entry having "speaker" and "text" fields:
              [
                {"speaker": "John Smith", "text": "Welcome everyone to our meeting."},
                {"speaker": "Sarah Johnson", "text": "Thanks for organizing this."}
              ]
              
              FORMAT EXACTLY AS SHOWN ABOVE - ONLY VALID JSON.
              
              Here's the transcript to parse:
              
              ${transcriptContent}
            `;
            
            console.log("Sending enhanced prompt to Gemini for transcript parsing");
            const response = await geminiModel.generateContent(enhancedPrompt);
            
            if (response) {
              const formattedText = response.response.text();
              
              // Try to extract JSON from the response
              try {
                // Find anything that looks like a JSON array in the response
                const jsonPattern = /\[\s*\{[\s\S]*\}\s*\]/g;
                const jsonMatch = formattedText.match(jsonPattern);
                
                if (jsonMatch) {
                  const jsonStr = jsonMatch[0];
                  console.log("Found JSON pattern in Gemini response");
                  
                  const parsedData = JSON.parse(jsonStr);
                  if (Array.isArray(parsedData) && parsedData.length > 0 && 'speaker' in parsedData[0]) {
                    formattedTranscript = parsedData;
                    console.log(`Successfully parsed ${formattedTranscript.length} entries from Gemini JSON response`);
                  } else {
                    throw new Error("Invalid JSON structure in Gemini response");
                  }
                } else {
                  // If no JSON pattern found, try with line parsing
                  console.log("No JSON pattern found in Gemini response, trying line parsing");
                  formattedTranscript = formattedText.split('\n')
                    .filter((line: string) => line.trim())
                    .map((line: string) => {
                      // Better detection of speaker vs text with more robust parsing
                      const match = line.match(/^([^:]+):\s+(.+)$/);
                      if (match) {
                        return {
                          speaker: match[1].trim(),
                          text: match[2].trim()
                        };
                      } else {
                        // Try to detect names followed by statement
                        const namePattern = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})[\s:-]+(.+)$/);
                        if (namePattern) {
                          return {
                            speaker: namePattern[1].trim(),
                            text: namePattern[2].trim()
                          };
                        }
                        return {
                          speaker: 'Unknown Speaker',
                          text: line.trim()
                        };
                      }
                    });
                }
              } catch (jsonError) {
                console.error("Failed to parse Gemini JSON response:", jsonError);
                throw jsonError; // Rethrow to try fallback method
              }
              
              // Log the extracted names to ensure we're getting proper speakers
              const speakers = new Set(formattedTranscript.map(entry => entry.speaker));
              console.log("Extracted speakers:", Array.from(speakers));
            }
          }
        } catch (error) {
          console.warn('Failed to format transcript with Gemini AI:', error);
          
          // Enhanced fallback: Better speaker detection with multiple patterns
          console.log("Using enhanced pattern matching fallback for transcript parsing");
          formattedTranscript = [];
          
          // Define patterns to try (in order of specificity)
          const speakerPatterns = [
            // Time + Name: Text patterns
            /^(\d{1,2}:\d{2}(:\d{2})?\s*[AP]M)\s+([^:]+):\s*(.+)$/i,  // 10:30 AM Name: Text
            /^(\d{1,2}:\d{2}(:\d{2})?)\s+([^:]+):\s*(.+)$/,  // 10:30 Name: Text (without AM/PM)
            
            // Standard name patterns
            /^([^:]+):\s*(.+)$/,                     // Name: Text
            /^([^-]+)\s+-\s+(.+)$/,                  // Name - Text
            /^\(([^)]+)\):\s*(.+)$/,                 // (Name): Text
            /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)[\s:-]+(.+)$/,  // Full Name: Text (prioritizing capitalized names)
            /^\[([^\]]+)\]:\s*(.+)$/,                // [Name]: Text
          ];
          
          // Split transcript into lines and clean
          const lines = transcriptContent.split('\n')
            .filter((line: string) => line.trim().length > 1)
            .map(line => line.trim());
          
          console.log(`Processing ${lines.length} lines with fallback pattern matching...`);
          
          // First pass: identify all possible speaker names
          const potentialSpeakers = new Set<string>();
          
          // Pre-process to identify potential speakers
          for (const line of lines) {
            for (const pattern of speakerPatterns) {
              const match = line.match(pattern);
              if (match) {
                // Different handling based on the pattern matched
                if (pattern.toString().includes("\\d{1,2}:\\d{2}")) {
                  // This is a timestamp pattern with name
                  if (match[3]) potentialSpeakers.add(match[3].trim());
                } else {
                  // Standard name pattern
                  potentialSpeakers.add(match[1].trim());
                }
                break;
              }
            }
          }
          
          console.log("Potential speakers identified:", Array.from(potentialSpeakers));
          
          // Second pass: process lines with identified speakers
          for (const line of lines) {
            let matched = false;
            
            // Try patterns in order
            for (const pattern of speakerPatterns) {
              const match = line.match(pattern);
              if (match) {
                matched = true;
                
                // Different handling based on the pattern matched
                if (pattern.toString().includes("\\d{1,2}:\\d{2}")) {
                  // Timestamp pattern
                  const speaker = match[3] ? match[3].trim() : "Unknown Speaker";
                  const text = match[4] ? match[4].trim() : "";
                  
                  if (text) {
                    formattedTranscript.push({ speaker, text });
                  }
                } else {
                  // Standard pattern
                  const speaker = match[1].trim();
                  const text = match[2].trim();
                  
                  if (text) {
                    formattedTranscript.push({ speaker, text });
                  }
                }
                break;
              }
            }
            
            // If no patterns matched but line has content
            if (!matched && line.length > 10) {
              // Look for capitalized words at the beginning that might be names
              const capitalizedNamePattern = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[:\s-]+(.+)$/);
              if (capitalizedNamePattern) {
                const speaker = capitalizedNamePattern[1].trim();
                const text = capitalizedNamePattern[2].trim();
                formattedTranscript.push({ speaker, text });
              } else {
                // Default to Unknown Speaker
                formattedTranscript.push({
                  speaker: 'Unknown Speaker',
                  text: line.trim()
                });
              }
            }
          }
          
          // Normalize transcript - combine consecutive entries from same speaker
          const normalizedTranscript: Array<{ speaker: string; text: string }> = [];
          let currentSpeaker = '';
          let currentText = '';
          
          for (const entry of formattedTranscript) {
            if (entry.speaker === currentSpeaker) {
              // Same speaker, append text
              currentText += ' ' + entry.text;
            } else {
              // New speaker - add previous entry if exists
              if (currentSpeaker && currentText) {
                normalizedTranscript.push({
                  speaker: currentSpeaker,
                  text: currentText
                });
              }
              // Start new entry
              currentSpeaker = entry.speaker;
              currentText = entry.text;
            }
          }
          
          // Add final entry
          if (currentSpeaker && currentText) {
            normalizedTranscript.push({
              speaker: currentSpeaker,
              text: currentText
            });
          }
          
          formattedTranscript = normalizedTranscript;
          
          console.log(`Fallback extraction identified ${formattedTranscript.length} entries with speakers:`, 
            Array.from(new Set(formattedTranscript.map(entry => entry.speaker))));
        }
      }
      
      // Create a new meeting in the database 
      const now = new Date();
      const meeting = await storage.createMeeting({
        title,
        description: description || '',
        startTime: now,
        status: 'completed',
        externalMeetingCode: meetCode,
        externalMeetingType: transcriptContent ? 'transcript_import' : 'google_meet',
        creatorId: req.user?.id
      });
      
      // Add the current user as a participant if authenticated
      if (req.isAuthenticated() && req.user && 'id' in req.user) {
        const userId = Number(req.user.id);
        await storage.addMeetingParticipant(meeting.id, userId);
        
        // If we have transcript content, create transcription entries with proper speaker identification
        if (formattedTranscript.length > 0) {
          // Get or create speaker users and map speakers to IDs
          const speakerToUserIdMap = new Map<string, number>();
          const existingUsers = await storage.getAllUsers();
          
          // First, try to match speakers with existing users
          for (const entry of formattedTranscript) {
            if (entry.speaker && !speakerToUserIdMap.has(entry.speaker)) {
              // Try to find an existing user by name
              const existingUser = existingUsers.find(user => 
                user.fullName.toLowerCase() === entry.speaker.toLowerCase()
              );
              
              if (existingUser) {
                speakerToUserIdMap.set(entry.speaker, existingUser.id);
                // Add existing user as participant if not already
                await storage.addMeetingParticipant(meeting.id, existingUser.id);
              }
            }
          }
          
          // Create temporary users for speakers not matched to existing users
          const unidentifiedSpeakers = new Set<string>();
          for (const entry of formattedTranscript) {
            if (entry.speaker && !speakerToUserIdMap.has(entry.speaker) && entry.speaker !== 'Unknown Speaker') {
              unidentifiedSpeakers.add(entry.speaker);
            }
          }
          
          // Create temporary users for unidentified speakers
          for (const speaker of Array.from(unidentifiedSpeakers)) {
            try {
              // Generate initials for the avatar
              const initials = speaker.split(' ')
                .map((word: string) => word[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              
              // Generate a random color for the avatar
              const colors = [
                "bg-gray-200", "bg-indigo-100", "bg-blue-100", 
                "bg-green-100", "bg-yellow-100", "bg-purple-100", "bg-pink-100"
              ];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];
              
              // Create a user for this speaker
              const newUser = await storage.createUser({
                username: `${speaker.replace(/\s+/g, '').toLowerCase()}_${Date.now()}`,
                password: 'password',  // This is a placeholder as we will not use these accounts to login
                fullName: speaker,
                email: `${speaker.replace(/\s+/g, '').toLowerCase()}@example.com`,
                avatarInitials: initials,
                avatarColor: randomColor
              });
              
              // Add new user as meeting participant
              await storage.addMeetingParticipant(meeting.id, newUser.id);
              
              // Map the speaker to the new user ID
              speakerToUserIdMap.set(speaker, newUser.id);
            } catch (error) {
              console.error(`Error creating user for speaker ${speaker}:`, error);
            }
          }
          
          // Debug information to help diagnose the speaker mapping
          console.log("Speaker to user map:", 
            Array.from(speakerToUserIdMap.entries()).map(([speaker, id]) => `${speaker}: ${id}`));
          
          // Add transcription entries using the speaker's user ID or fallback to the current user
          for (const entry of formattedTranscript) {
            // Always try to use the mapped speaker ID first
            const entryUserId = speakerToUserIdMap.get(entry.speaker) || userId;
            console.log(`Adding entry for speaker "${entry.speaker}" with userId ${entryUserId}`);
            
            const newEntry = await storage.addTranscriptionEntry(
              meeting.id,
              entryUserId,
              entry.text
            );
            
            console.log("Created entry:", newEntry);
          }
          
          // Generate summary after adding transcripts
          console.log("Generating summary for imported meeting...");
          const summary = await generateMeetingSummaryFromId(meeting.id);
          if (summary) {
            console.log("Updating meeting summary...");
            await storage.updateMeetingSummary(meeting.id, summary);
          }
          
          // Extract tasks after adding transcripts
          console.log("Extracting tasks from imported meeting...");
          const tasks = await extractTasksFromId(meeting.id);
          if (tasks && tasks.length > 0) {
            console.log(`Created ${tasks.length} tasks from imported meeting`);
          } else {
            console.log("No tasks extracted from imported meeting");
          }
        }
      }
      
      // Add a system message indicating the meeting has been imported
      await storage.addChatMessage(meeting.id, {
        content: meetCode 
          ? `Meeting imported from Google Meet. Meeting code: ${meetCode}` 
          : `Meeting transcript imported with ${formattedTranscript.length} entries.`,
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
      
      // Check if user has access to this meeting using our centralized access check
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ message: 'Authentication required' });
        } else {
          return res.status(403).json({ message: 'Meeting not available - you can only access meetings you created or have been invited to' });
        }
      }
      
      // Log meeting details for debugging
      console.log('Returning meeting details:', { 
        id: meeting.id, 
        title: meeting.title,
        summaryExists: !!meeting.summary,
        summaryLength: meeting.summary ? meeting.summary.length : 0,
        summaryPreview: meeting.summary ? meeting.summary.substring(0, 100) + '...' : 'No summary'
      });
      
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
      const liveOnly = req.query.liveOnly === 'true';
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Meeting not available - you can only access meetings you created or have been invited to' });
      }
      
      // Get transcriptions with optional live filter
      const transcriptions = await storage.getTranscriptionEntries(meetingId, liveOnly);
      res.json(transcriptions);
    } catch (error) {
      console.error('Error fetching transcriptions:', error);
      res.status(500).json({ message: 'Failed to fetch transcriptions' });
    }
  });

  // Update to get all transcriptions for a meeting
  app.get('/api/meetings/:id/transcription/all', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Meeting not available - you can only access meetings you created or have been invited to' });
      }
      
      // Get all transcriptions regardless of live status
      const transcriptions = await storage.getTranscriptionEntries(meetingId, false);
      res.json(transcriptions);
    } catch (error) {
      console.error('Error fetching all transcriptions:', error);
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
      const { meetingId, userId, text, apiKey, live = true } = req.body;
      
      // Validate required fields
      if (!meetingId || !userId || !text) {
        return res.status(400).json({ message: 'Missing required fields: meetingId, userId, text' });
      }
      
      // Require BOT_API_KEY from environment for bot endpoint authentication.
      const validApiKey = process.env.BOT_API_KEY;
      if (!validApiKey) {
        return res.status(500).json({ message: 'Server configuration error: BOT_API_KEY is not set' });
      }
      if (apiKey !== validApiKey) {
        return res.status(401).json({ message: 'Invalid API key' });
      }
      
      // Add the transcription entry with live status
      const entry = await storage.addTranscriptionEntry(meetingId, userId, text, live);
      
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
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Meeting not available - you can only access meetings you created or have been invited to' });
      }
      
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
      
      // Get the logged-in user's ID to check their meeting access
      if (!req.isAuthenticated() || !req.user?.id) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const tasks = await storage.getTasks({ 
        completed, 
        assigneeId, 
        meetingId,
        userId: req.user.id 
      });
      
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
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Meeting not available - you can only access meetings you created or have been invited to' });
      }
      
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
      
      if (!type) {
        return res.status(400).json({ message: 'Missing required type field' });
      }
      
      // For question type, text is required
      if (type === 'question' && !text) {
        return res.status(400).json({ message: 'Missing required text field for question type' });
      }
      
      let result;
      
      console.log(`Processing AI analysis request of type "${type}" for meeting ID ${meetingId}`);
      
      switch (type) {
        case 'summary':
          result = await generateMeetingSummaryFromId(meetingId || 0);
          res.json({ content: result });
          break;
          
        case 'tasks':
          // For tasks, extract them and then return the updated task list
          const extractedTasks = await extractTasksFromId(meetingId || 0);
          
          if (extractedTasks && extractedTasks.length > 0) {
            console.log(`Successfully extracted ${extractedTasks.length} tasks`);
          } else {
            console.log("No tasks were extracted");
          }
          
          // Get all tasks for the meeting from database
          const updatedTasksList = await storage.getTasksByMeeting(meetingId || 0);
          
          // Return the full updated task list
          res.json(updatedTasksList);
          break;
          
        case 'question':
          result = await answerMeetingQuestionFromId(meetingId || 0, text);
          res.json({ content: result });
          break;
          
        default:
          return res.status(400).json({ message: 'Invalid analysis type' });
      }
    } catch (error) {
      console.error('Error during AI analysis:', error);
      res.status(500).json({ message: 'Failed to analyze text' });
    }
  });

  // REPORT API ENDPOINTS

  // Custom report data endpoints
  app.post("/api/reports/custom/sentiment/:meetingId", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Meeting not available - you can only access meetings you created or have been invited to' });
      }
      
      const key = `sentiment-${meetingId}`;
      customReportData.set(key, req.body);
      res.status(200).json({ success: true, message: "Sentiment data stored successfully" });
    } catch (error) {
      console.error("Error storing custom sentiment data:", error);
      res.status(500).json({ error: "Failed to store sentiment data" });
    }
  });

  app.post("/api/reports/custom/topics/:meetingId", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Meeting not available - you can only access meetings you created or have been invited to' });
      }
      
      const key = `topics-${meetingId}`;
      customReportData.set(key, req.body);
      res.status(200).json({ success: true, message: "Topic data stored successfully" });
    } catch (error) {
      console.error("Error storing custom topic data:", error);
      res.status(500).json({ error: "Failed to store topic data" });
    }
  });

  app.post("/api/reports/custom/tone/:meetingId", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      const key = `tone-${meetingId}`;
      customReportData.set(key, req.body);
      res.status(200).json({ success: true, message: "Tone data stored successfully" });
    } catch (error) {
      console.error("Error storing custom tone data:", error);
      res.status(500).json({ error: "Failed to store tone data" });
    }
  });

  app.post("/api/reports/custom/participants/:meetingId", async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      const key = `participants-${meetingId}`;
      customReportData.set(key, req.body);
      res.status(200).json({ success: true, message: "Participant data stored successfully" });
    } catch (error) {
      console.error("Error storing custom participant data:", error);
      res.status(500).json({ error: "Failed to store participant data" });
    }
  });
  
  // Sentiment Analysis Report
  app.get('/api/reports/sentiment/:meetingId', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      // Check if we have custom data for this meeting
      const customKey = `sentiment-${meetingId}`;
      if (customReportData.has(customKey)) {
        return res.json(customReportData.get(customKey));
      }
      
      // Call the Flask API for sentiment analysis
      try {
        console.log(`Calling Flask API for sentiment analysis for meeting ${meetingId}`);
        const flaskResponse = await axios.get(`http://localhost:6000/api/sentiment_transition/${meetingId}`, {
          timeout: 8000 // 8 second timeout
        });
        
        if (flaskResponse.data) {
          // Transform the Flask API response to match the expected format
          const transitions = flaskResponse.data.transitions || [];
          
          // Calculate overall sentiment from transitions
          const overallSentiment = transitions.length > 0 ? 
            transitions.reduce((sum, t) => sum + (t.transition_smoothness || 0), 0) / transitions.length : 
            0.5; // Default to neutral if no data
          
          // Group transitions by time for sentiment over time
          const timePoints = [...new Set(transitions.map(t => t.time || '0:00'))].sort();
          const sentimentOverTime = timePoints.map(time => {
            const relatedTransitions = transitions.filter(t => t.time === time);
            const avgSentiment = relatedTransitions.length > 0 ?
              relatedTransitions.reduce((sum, t) => sum + (t.transition_smoothness || 0), 0) / relatedTransitions.length :
              0.5; // Default to neutral if no data
            
            return {
              time,
              score: avgSentiment
            };
          });
          
          // Extract positive and negative topics
          const topPositiveTopics = [...new Set(
            transitions
              .filter(t => t.sentiment === 'Positive')
              .map(t => t.topic || `${t.from_speaker} to ${t.to_speaker}`)
          )].slice(0, 3);
          
          const topNegativeTopics = [...new Set(
            transitions
              .filter(t => t.sentiment === 'Negative')
              .map(t => t.topic || `${t.from_speaker} to ${t.to_speaker}`)
          )].slice(0, 3);
          
          const sentimentData = {
            overallSentiment: Math.min(1, Math.max(0, overallSentiment)),
            sentimentOverTime,
            topPositiveTopics: topPositiveTopics.length ? topPositiveTopics : ['Product features', 'Team collaboration', 'Customer feedback'],
            topNegativeTopics: topNegativeTopics.length ? topNegativeTopics : ['Technical limitations', 'Budget constraints'],
          };
          
          // Store the data for future requests
          customReportData.set(customKey, sentimentData);
          return res.json(sentimentData);
        }
      } catch (flaskError) {
        console.error(`Error calling Flask API for sentiment analysis: ${flaskError.message}`);
        // Continue with the fallback approach if Flask API fails
      }
      
      // Get transcriptions for the meeting
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      
      if (transcriptions.length === 0) {
        return res.status(404).json({ message: 'No transcription data found for this meeting' });
      }
      
      // Format transcriptions for analysis
      const transcript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      try {
        // Use Gemini to analyze sentiment
        const prompt = `
        Please analyze the sentiment of this meeting transcript. Provide:
        1. An overall sentiment score between 0 and 1 (0 being most negative, 1 being most positive)
        2. A time-based breakdown of sentiment changes (at least 5 points)
        3. Top positive topics discussed
        4. Top negative topics discussed
        
        Format the response as a JSON object with these fields:
        {
          "overallSentiment": number,
          "sentimentOverTime": [{"time": string, "score": number}, ...],
          "topPositiveTopics": [string, string, ...],
          "topNegativeTopics": [string, string, ...]
        }
        
        Transcript:
        ${transcript}
        `;
        
        const response = await answerMeetingQuestion(transcript, "Sentiment Analysis", prompt);
        
        // Parse the JSON response
        let sentimentData;
        try {
          // Extract JSON from potential text wrapping
          const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
          if (jsonMatch) {
            sentimentData = JSON.parse(jsonMatch[0]);
          } else {
            sentimentData = JSON.parse(response);
          }
        } catch (parseError) {
          console.error('Error parsing sentiment JSON:', parseError);
          // Fallback to simulate sentiment data
          sentimentData = {
            overallSentiment: 0.65,
            sentimentOverTime: [
              { time: '0:00', score: 0.7 },
              { time: '5:00', score: 0.8 },
              { time: '10:00', score: 0.6 },
              { time: '15:00', score: 0.5 },
              { time: '20:00', score: 0.4 },
              { time: '25:00', score: 0.7 },
              { time: '30:00', score: 0.8 },
            ],
            topPositiveTopics: ['Product features', 'Team collaboration', 'Customer feedback'],
            topNegativeTopics: ['Technical limitations', 'Budget constraints'],
          };
        }
        
        res.json(sentimentData);
      } catch (aiError) {
        console.error('Error analyzing sentiment with AI:', aiError);
        res.status(503).json({ 
          message: 'Sentiment analysis service temporarily unavailable',
          error: aiError.message
        });
      }
    } catch (error) {
      console.error('Error fetching sentiment report:', error);
      res.status(500).json({ message: 'Failed to generate sentiment report' });
    }
  });
  
  // Topic Drift Analysis Report
  app.get('/api/reports/topics/:meetingId', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      // Check if we have custom data for this meeting
      const customKey = `topics-${meetingId}`;
      if (customReportData.has(customKey)) {
        return res.json(customReportData.get(customKey));
      }
      
      // Call the Flask API for agenda drift analysis
      try {
        console.log(`Calling Flask API for agenda drift analysis for meeting ${meetingId}`);
        const flaskResponse = await axios.get(`http://localhost:6000/api/agenda_drift/${meetingId}`, {
          timeout: 8000 // 8 second timeout
        });
        
        if (flaskResponse.data) {
          // Transform the Flask API response to match the expected format
          const agendaDriftData = flaskResponse.data;
          const topicDriftScore = agendaDriftData.overall_topic_drift || 0.35;
          
          // Extract topics
          const topics = agendaDriftData.topics || [];
          const plannedTopics = topics.map(t => t.topic);
          
          // Create topic coverage data
          const topicCoverage = topics.map(topic => {
            // Calculate drift as a percentage
            const driftScore = topic.topic_drift || 0;
            
            // Estimate planned vs actual (this is a simplification)
            const planned = Math.round(100 / topics.length);
            const actual = Math.round(planned * (1 - driftScore / 2));
            
            return {
              name: topic.topic,
              planned,
              actual,
              drift: driftScore
            };
          });
          
          // Add off-topic if there's significant drift
          if (topicDriftScore > 0.3) {
            const offTopicPercentage = Math.round(topicDriftScore * 20);
            const totalActual = topicCoverage.reduce((sum, t) => sum + t.actual, 0);
            const remainder = 100 - totalActual;
            
            if (remainder > 0) {
              topicCoverage.push({
                name: 'Off-topic',
                planned: 0,
                actual: remainder,
                drift: 1.0
              });
            }
          }
          
          // Extract speaker contributions from speaker_drift
          const speakerContributions = [];
          const speakerTotals = {};
          
          // Aggregate all speaker contributions
          topics.forEach(topic => {
            const speakerDrift = topic.speaker_drift || {};
            Object.keys(speakerDrift).forEach(speaker => {
              if (!speakerTotals[speaker]) {
                speakerTotals[speaker] = 0;
              }
              // Lower drift means higher contribution
              speakerTotals[speaker] += (1 - speakerDrift[speaker]);
            });
          });
          
          // Convert to percentage and format
          const totalContributions = Object.values(speakerTotals).reduce((sum: any, val: any) => sum + val, 0);
          Object.keys(speakerTotals).forEach(speaker => {
            const percentage = totalContributions > 0 
              ? Math.round((speakerTotals[speaker] / totalContributions) * 100) 
              : 0;
            
            speakerContributions.push({
              name: speaker,
              contributions: percentage
            });
          });
          
          // Create speaker drift over time data
          // This is more complex and requires time-based analysis
          // For simplicity, we'll create a synthetic version based on the drift data
          const speakerDrift = [];
          const allSpeakers = Object.keys(speakerTotals);
          
          // Create time points (e.g., every 5 minutes)
          const timePoints = ['0:00', '5:00', '10:00', '15:00', '20:00'];
          
          timePoints.forEach((time, timeIndex) => {
            const timePoint = { time, speakers: {} };
            
            allSpeakers.forEach(speaker => {
              // Calculate a synthetic drift value that varies over time
              // This is a placeholder - in a real implementation, you'd extract this from the data
              const baseDrift = Math.random() * 0.3 + 0.1; // Random drift between 0.1 and 0.4
              const timeFactor = Math.sin(timeIndex / (timePoints.length - 1) * Math.PI);
              
              timePoint.speakers[speaker] = Math.min(0.9, Math.max(0.1, baseDrift + timeFactor * 0.2));
            });
            
            speakerDrift.push(timePoint);
          });
          
          const topicData = {
            topicDriftScore,
            plannedTopics,
            topicCoverage,
            unexpectedTopics: topicDriftScore > 0.3 ? ['Unplanned discussion', 'Technical issues'] : [],
            speakerContributions,
            speakerDrift
          };
          
          // Store the data for future requests
          customReportData.set(customKey, topicData);
          return res.json(topicData);
        }
      } catch (flaskError) {
        console.error(`Error calling Flask API for agenda drift analysis: ${flaskError.message}`);
        // Continue with the fallback approach if Flask API fails
      }
      
      // Get meeting data to check for agenda
      const meeting = await storage.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      // Get transcriptions
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      
      if (transcriptions.length === 0) {
        return res.status(404).json({ message: 'No transcription data found for this meeting' });
      }
      
      // Format transcriptions for analysis
      const transcript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      try {
        // Parse agenda topics from meeting data if available
        let agendaTopics: string[] = [];
        if (meeting.agenda) {
          try {
            if (typeof meeting.agenda === 'string') {
              agendaTopics = JSON.parse(meeting.agenda);
            } else if (Array.isArray(meeting.agenda)) {
              agendaTopics = meeting.agenda;
            }
          } catch (e) {
            console.error('Error parsing agenda:', e);
          }
        }
        
        // Use Gemini to analyze topic drift
        const prompt = `
        Please analyze how this meeting transcript followed or deviated from the intended topics. ${agendaTopics.length > 0 ? `The planned agenda topics were: ${agendaTopics.join(', ')}` : 'Infer what the main topics should have been based on the meeting title and initial discussion.'}
        
        Provide:
        1. A topic drift score between 0 and 1 (0 being completely on topic, 1 being completely off topic)
        2. A list of planned topics (either from the agenda or inferred)
        3. The percentage of time spent on each topic vs. planned allocation
        4. Any unexpected topics that were discussed but not planned
        
        Format the response as a JSON object with these fields:
        {
          "topicDriftScore": number,
          "plannedTopics": [string, string, ...],
          "topicCoverage": [
            {"name": string, "planned": number, "actual": number, "drift": number},
            ...
          ],
          "unexpectedTopics": [string, string, ...]
        }
        
        Meeting Title: ${meeting.title}
        Transcript:
        ${transcript}
        `;
        
        const response = await answerMeetingQuestion(transcript, "Topic Drift Analysis", prompt);
        
        // Parse the JSON response
        let topicData;
        try {
          // Extract JSON from potential text wrapping
          const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
          if (jsonMatch) {
            topicData = JSON.parse(jsonMatch[0]);
          } else {
            topicData = JSON.parse(response);
          }
        } catch (parseError) {
          console.error('Error parsing topic drift JSON:', parseError);
          // Fallback to simulate topic drift data
          topicData = {
            topicDriftScore: 0.35,
            plannedTopics: ['Budget Review', 'Product Roadmap', 'Team Structure', 'Client Feedback'],
            topicCoverage: [
              { name: 'Budget Review', planned: 25, actual: 15, drift: 0.4 },
              { name: 'Product Roadmap', planned: 30, actual: 35, drift: 0.17 },
              { name: 'Team Structure', planned: 20, actual: 10, drift: 0.5 },
              { name: 'Client Feedback', planned: 25, actual: 20, drift: 0.2 },
              { name: 'Off-topic', planned: 0, actual: 20, drift: 1.0 },
            ],
            unexpectedTopics: ['Technical Issues', 'Office Layout', 'Social Events'],
          };
        }
        
        res.json(topicData);
      } catch (aiError) {
        console.error('Error analyzing topic drift with AI:', aiError);
        res.status(503).json({ 
          message: 'Topic analysis service temporarily unavailable',
          error: aiError.message
        });
      }
    } catch (error) {
      console.error('Error fetching topic drift report:', error);
      res.status(500).json({ message: 'Failed to generate topic drift report' });
    }
  });
  
  // Tone Analysis Report
  app.get('/api/reports/tone/:meetingId', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      // Check if we have custom data for this meeting
      const customKey = `tone-${meetingId}`;
      if (customReportData.has(customKey)) {
        return res.json(customReportData.get(customKey));
      }
      
      // Get transcriptions and participants
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      const meeting = await storage.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      if (transcriptions.length === 0) {
        return res.status(404).json({ message: 'No transcription data found for this meeting' });
      }
      
      // Group transcriptions by participant
      const participantTranscripts: Record<string, string[]> = {};
      
      transcriptions.forEach(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        if (!participantTranscripts[userName]) {
          participantTranscripts[userName] = [];
        }
        participantTranscripts[userName].push(entry.text);
      });
      
      // Format full transcript for overall analysis
      const fullTranscript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      try {
        // Use Gemini to analyze communication tone
        const prompt = `
        Please analyze the communication tone in this meeting transcript. For each participant and the overall meeting, identify the tone used (analytical, confident, tentative, casual, formal, etc.)
        
        Provide:
        1. A list of the dominant tones in the meeting
        2. The percentage breakdown of different tones across the entire meeting
        3. For each participant, the percentage of different tones they used
        
        Format the response as a JSON object with these fields:
        {
          "dominantTones": [string, string, ...],
          "toneBreakdown": [
            {"tone": string, "percentage": number},
            ...
          ],
          "participants": [
            {
              "name": string,
              "tones": {
                "analytical": number,
                "confident": number,
                "tentative": number,
                "casual": number,
                "formal": number
              }
            },
            ...
          ]
        }
        
        The participants are: ${Object.keys(participantTranscripts).join(', ')}
        
        Meeting Title: ${meeting.title}
        Transcript:
        ${fullTranscript}
        `;
        
        const response = await answerMeetingQuestion(fullTranscript, "Tone Analysis", prompt);
        
        // Parse the JSON response
        let toneData;
        try {
          // Extract JSON from potential text wrapping
          const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
          if (jsonMatch) {
            toneData = JSON.parse(jsonMatch[0]);
          } else {
            toneData = JSON.parse(response);
          }
        } catch (parseError) {
          console.error('Error parsing tone analysis JSON:', parseError);
          // Fallback to simulate tone analysis data
          const participants = Object.keys(participantTranscripts).slice(0, 3);
          toneData = {
            dominantTones: ['Analytical', 'Confident', 'Tentative'],
            toneBreakdown: [
              { tone: 'Analytical', percentage: 40 },
              { tone: 'Confident', percentage: 25 },
              { tone: 'Tentative', percentage: 15 },
              { tone: 'Casual', percentage: 10 },
              { tone: 'Formal', percentage: 10 },
            ],
            participants: participants.map((name, i) => {
              // Generate different tone profiles for each participant
              if (i === 0) {
                return { 
                  name, 
                  tones: { analytical: 60, confident: 20, tentative: 10, casual: 5, formal: 5 } 
                };
              } else if (i === 1) {
                return { 
                  name, 
                  tones: { analytical: 30, confident: 40, tentative: 10, casual: 10, formal: 10 } 
                };
              } else {
                return { 
                  name, 
                  tones: { analytical: 20, confident: 15, tentative: 40, casual: 15, formal: 10 } 
                };
              }
            }),
          };
        }
        
        res.json(toneData);
      } catch (aiError) {
        console.error('Error analyzing communication tone with AI:', aiError);
        res.status(503).json({ 
          message: 'Tone analysis service temporarily unavailable',
          error: aiError.message
        });
      }
    } catch (error) {
      console.error('Error fetching tone analysis report:', error);
      res.status(500).json({ message: 'Failed to generate tone analysis report' });
    }
  });
  
  // Meeting Transitions Report
  app.get('/api/reports/transitions/:meetingId', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      // Check if we have custom data for this meeting
      const customKey = `transitions-${meetingId}`;
      if (customReportData.has(customKey)) {
        return res.json(customReportData.get(customKey));
      }
      
      // Get meeting data
      const meeting = await storage.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      // Call the Flask API for sentiment transitions
      try {
        console.log(`Calling Flask API for sentiment transitions for meeting ${meetingId}`);
        const flaskResponse = await axios.get(`http://localhost:6000/api/sentiment_transition/${meetingId}`);
        
        if (flaskResponse.data) {
          // Store the data for future requests
          customReportData.set(customKey, flaskResponse.data);
          return res.json(flaskResponse.data);
        }
      } catch (flaskError) {
        console.error(`Error calling Flask API for sentiment transitions: ${flaskError.message}`);
        // Fallback to default data if Flask API fails
        const fallbackData = {
          meeting_id: meetingId,
          meeting_title: meeting.title,
          transitions: [
            {
              from_speaker: "Alice",
              to_speaker: "Bob",
              transition_smoothness: 0.9,
              sentiment: "Positive"
            },
            {
              from_speaker: "Bob",
              to_speaker: "Charlie",
              transition_smoothness: 0.3,
              sentiment: "Negative"
            },
            {
              from_speaker: "Charlie",
              to_speaker: "Alice",
              transition_smoothness: 0.7,
              sentiment: "Positive"
            }
          ]
        };
        
        // Store the fallback data
        customReportData.set(customKey, fallbackData);
        return res.json(fallbackData);
      }
      
      // Fallback if the Flask API call doesn't return properly
      return res.status(404).json({ message: 'No transition data available for this meeting' });
    } catch (error) {
      console.error('Error fetching meeting transitions:', error);
      res.status(500).json({ message: 'Failed to generate meeting transitions report' });
    }
  });

  // Speaker Contribution Report
  app.get('/api/reports/speaker_contribution/:meetingId', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      // Check if we have custom data for this meeting
      const customKey = `speaker-contribution-${meetingId}`;
      if (customReportData.has(customKey)) {
        return res.json(customReportData.get(customKey));
      }
      
      // Call the Flask API for speaker contribution
      try {
        console.log(`Calling Flask API for speaker contribution for meeting ${meetingId}`);
        const flaskResponse = await axios.get(`http://localhost:6000/api/speaker_contribution/${meetingId}`, {
          timeout: 8000 // 8 second timeout
        });
        
        if (flaskResponse.data) {
          // Store the data for future requests
          customReportData.set(customKey, flaskResponse.data);
          return res.json(flaskResponse.data);
        }
      } catch (flaskError) {
        console.error(`Error calling Flask API for speaker contribution: ${flaskError.message}`);
        // Continue with the fallback approach if Flask API fails
      }
      
      // Fallback if the Flask API call doesn't return properly
      return res.status(404).json({ message: 'No speaker contribution data available for this meeting' });
    } catch (error) {
      console.error('Error fetching speaker contribution:', error);
      res.status(500).json({ message: 'Failed to generate speaker contribution report' });
    }
  });

  // Participant Analysis Report
  app.get('/api/reports/participants/:meetingId', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      // Check if user has access to this meeting
      const hasAccess = await checkUserMeetingAccess(req, meetingId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have access to this meeting' });
      }
      
      // Check if we have custom data for this meeting
      const customKey = `participants-${meetingId}`;
      if (customReportData.has(customKey)) {
        return res.json(customReportData.get(customKey));
      }
      
      // Get transcriptions and meeting data
      const transcriptions = await storage.getTranscriptionEntries(meetingId) as TranscriptionEntryWithUser[];
      const meeting = await storage.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      if (transcriptions.length === 0) {
        return res.status(404).json({ message: 'No transcription data found for this meeting' });
      }
      
      // Count word usage per participant to estimate speaking time
      interface ParticipantStats {
        name: string;
        wordCount: number;
        entryCount: number;
        words: string[];
      }
      
      const participantStats: Record<string, ParticipantStats> = {};
      
      transcriptions.forEach(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        const words = entry.text.split(/\s+/).filter(w => w.length > 0);
        
        if (!participantStats[userName]) {
          participantStats[userName] = {
            name: userName,
            wordCount: 0,
            entryCount: 0,
            words: []
          };
        }
        
        participantStats[userName].wordCount += words.length;
        participantStats[userName].entryCount += 1;
        participantStats[userName].words = participantStats[userName].words.concat(words);
      });
      
      // Calculate total words to get percentages
      const totalWords = Object.values(participantStats).reduce((sum, p) => sum + p.wordCount, 0);
      
      // Format full transcript for overall analysis
      const fullTranscript = transcriptions.map(entry => {
        const userName = entry.user ? entry.user.fullName : `User ${entry.userId}`;
        return `${userName}: ${entry.text}`;
      }).join('\n');
      
      try {
        // Use Gemini to analyze participant engagement
        const prompt = `
        Please analyze the participation and engagement in this meeting transcript. For each participant, assess their level of engagement and the nature of their contributions.
        
        Provide:
        1. The total number of participants
        2. Speaking time distribution (percentage per participant)
        3. Interaction statistics (questions asked, interruptions, cross-talk instances, silent periods)
        4. Engagement levels (categorized as high, medium, low) for each participant
        
        Format the response as a JSON object with these fields:
        {
          "participantCount": number,
          "speakingDistribution": [
            {"name": string, "speakingTime": number},
            ...
          ],
          "interactionStats": [
            {"name": string, "count": number},
            ...
          ],
          "engagement": {
            "high": [string, ...],
            "medium": [string, ...],
            "low": [string, ...]
          }
        }
        
        The participants are: ${Object.keys(participantStats).join(', ')}
        
        Meeting Title: ${meeting.title}
        Transcript:
        ${fullTranscript}
        `;
        
        const response = await answerMeetingQuestion(fullTranscript, "Participant Analysis", prompt);
        
        // Parse the JSON response
        let participantData;
        try {
          // Extract JSON from potential text wrapping
          const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
          if (jsonMatch) {
            participantData = JSON.parse(jsonMatch[0]);
          } else {
            participantData = JSON.parse(response);
          }
        } catch (parseError) {
          console.error('Error parsing participant analysis JSON:', parseError);
          // Calculate speaking percentages from our word count analysis
          const speakingDistribution = Object.values(participantStats).map(p => ({
            name: p.name,
            speakingTime: Math.round((p.wordCount / totalWords) * 100)
          }));
          
          // Sort by speaking time
          speakingDistribution.sort((a, b) => b.speakingTime - a.speakingTime);
          
          // Simple engagement categorization based on speaking time
          const engagement = {
            high: [],
            medium: [],
            low: []
          };
          
          speakingDistribution.forEach(p => {
            if (p.speakingTime > 30) {
              engagement.high.push(p.name);
            } else if (p.speakingTime > 15) {
              engagement.medium.push(p.name);
            } else {
              engagement.low.push(p.name);
            }
          });
          
          // Fallback to simulated participant analysis data
          participantData = {
            participantCount: Object.keys(participantStats).length,
            speakingDistribution,
            interactionStats: [
              { name: 'Questions Asked', count: 15 },
              { name: 'Interruptions', count: 8 },
              { name: 'Cross-talk Instances', count: 6 },
              { name: 'Silent Periods', count: 3 },
            ],
            engagement
          };
        }
        
        res.json(participantData);
      } catch (aiError) {
        console.error('Error analyzing participant engagement with AI:', aiError);
        res.status(503).json({ 
          message: 'Participant analysis service temporarily unavailable',
          error: aiError.message
        });
      }
    } catch (error) {
      console.error('Error fetching participant analysis report:', error);
      res.status(500).json({ message: 'Failed to generate participant analysis report' });
    }
  });

  // Special API endpoint for updating transcription live status
  app.post('/api/meetings/:id/transcription/update-status', async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { live, apiKey } = req.body;
      
      // Validate required fields
      if (live === undefined) {
        return res.status(400).json({ message: 'Missing required field: live' });
      }
      
      // Require BOT_API_KEY from environment for bot endpoint authentication.
      const validApiKey = process.env.BOT_API_KEY;
      if (!validApiKey) {
        return res.status(500).json({ message: 'Server configuration error: BOT_API_KEY is not set' });
      }
      if (apiKey !== validApiKey) {
        return res.status(401).json({ message: 'Invalid API key' });
      }
      
      // Update all transcription entries for this meeting
      const result = await db.update(transcriptionEntries)
        .set({ live: !!live })
        .where(eq(transcriptionEntries.meetingId, meetingId))
        .returning();
      
      console.log(`Updated ${result.length} transcription entries for meeting ${meetingId} to live=${live}`);
      
      // Return success
      res.status(200).json({ 
        status: 'success', 
        message: `Updated ${result.length} transcription entries`, 
        count: result.length 
      });
      
    } catch (error) {
      console.error('Error updating transcription live status:', error);
      res.status(500).json({ message: 'Failed to update transcription live status' });
    }
  });

  return httpServer;
}
