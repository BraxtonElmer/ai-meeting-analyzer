import { db } from "./index";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

type AvatarColor = 
  | "bg-gray-200"
  | "bg-indigo-100"
  | "bg-blue-100"
  | "bg-green-100"
  | "bg-yellow-100"
  | "bg-purple-100"
  | "bg-pink-100";

// Function to generate avatar initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
}

// Seed users
async function seedUsers() {
  const users = [
    {
      username: "johndoe",
      password: "password123", // In a real app, this would be hashed
      fullName: "John Doe",
      email: "john.doe@example.com",
      avatarColor: "bg-gray-200" as AvatarColor,
    },
    {
      username: "sarahlee",
      password: "password123",
      fullName: "Sarah Lee",
      email: "sarah.lee@example.com",
      avatarColor: "bg-indigo-100" as AvatarColor,
    },
    {
      username: "mikethompson",
      password: "password123",
      fullName: "Mike Thompson",
      email: "mike.t@example.com",
      avatarColor: "bg-blue-100" as AvatarColor,
    },
    {
      username: "annakim",
      password: "password123",
      fullName: "Anna Kim",
      email: "anna.k@example.com",
      avatarColor: "bg-green-100" as AvatarColor,
    },
    {
      username: "robertlee",
      password: "password123",
      fullName: "Robert Lee",
      email: "robert.l@example.com",
      avatarColor: "bg-yellow-100" as AvatarColor,
    },
    {
      username: "katiethomas",
      password: "password123",
      fullName: "Katie Thomas",
      email: "katie.t@example.com",
      avatarColor: "bg-purple-100" as AvatarColor,
    },
    {
      username: "michaelross",
      password: "password123",
      fullName: "Michael Ross",
      email: "michael.r@example.com",
      avatarColor: "bg-pink-100" as AvatarColor,
    },
    {
      username: "alexmorgan",
      password: "password123",
      fullName: "Alex Morgan",
      email: "alex.m@company.com",
      avatarColor: "bg-primary" as AvatarColor,
    }
  ];

  for (const user of users) {
    // Skip if user already exists
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.username, user.username)
    });
    
    if (!existing) {
      await db.insert(schema.users).values({
        ...user,
        avatarInitials: getInitials(user.fullName)
      });
    }
  }
}

// Seed meetings
async function seedMeetings() {
  // Get user IDs first
  const allUsers = await db.query.users.findMany();
  if (allUsers.length === 0) {
    console.error("No users found. Please seed users first.");
    return;
  }

  const meetings = [
    {
      title: "Weekly Product Team Sync",
      startTime: new Date("2023-03-14T10:00:00"),
      endTime: new Date("2023-03-14T11:00:00"),
      status: "live",
      agenda: ["Feature implementation progress review", "Timeline adjustments and priorities", "Resource allocation for upcoming sprint", "Open issues and blockers"],
      participants: ["John Doe", "Sarah Lee", "Mike Thompson", "Anna Kim", "Robert Lee", "Katie Thomas", "Michael Ross"]
    },
    {
      title: "Frontend Team Sync",
      startTime: new Date("2023-03-15T14:00:00"),
      endTime: null,
      status: "scheduled",
      agenda: ["Code review process", "UI component library", "Mobile responsive issues", "Testing strategy"],
      participants: ["Sarah Lee", "Mike Thompson", "Alex Morgan", "Katie Thomas"]
    },
    {
      title: "Sprint Planning",
      startTime: new Date("2023-03-17T11:00:00"),
      endTime: null,
      status: "scheduled",
      agenda: ["Review backlog", "Prioritize user stories", "Assign story points", "Define sprint goals"],
      participants: ["John Doe", "Sarah Lee", "Mike Thompson", "Anna Kim", "Alex Morgan"]
    },
    {
      title: "Project Kickoff",
      startTime: new Date("2023-03-10T09:00:00"),
      endTime: new Date("2023-03-10T10:30:00"),
      status: "completed",
      agenda: ["Project overview", "Team introductions", "Timeline discussion", "Next steps"],
      participants: ["John Doe", "Sarah Lee", "Mike Thompson", "Anna Kim", "Robert Lee", "Alex Morgan"]
    },
    {
      title: "Client Presentation",
      startTime: new Date("2023-03-12T13:00:00"),
      endTime: new Date("2023-03-12T14:30:00"),
      status: "completed",
      agenda: ["Demo preparation", "Slide deck review", "Q&A session planning", "Follow-up strategy"],
      participants: ["John Doe", "Sarah Lee", "Alex Morgan", "Katie Thomas"]
    }
  ];

  for (const meetingData of meetings) {
    // Skip if meeting already exists with same title and start time
    const existingMeeting = await db.query.meetings.findFirst({
      where: eq(schema.meetings.title, meetingData.title)
    });
    
    if (!existingMeeting) {
      // Insert meeting
      const [meeting] = await db.insert(schema.meetings).values({
        title: meetingData.title,
        startTime: meetingData.startTime,
        endTime: meetingData.endTime,
        status: meetingData.status,
        agenda: meetingData.agenda,
      }).returning();
      
      // Add participants
      for (const participantName of meetingData.participants) {
        const user = allUsers.find(u => u.fullName === participantName);
        if (user) {
          await db.insert(schema.meetingParticipants).values({
            meetingId: meeting.id,
            userId: user.id
          });
        }
      }
      
      // If it's the "live" meeting, add some transcription entries
      if (meetingData.status === "live") {
        await seedTranscriptionEntries(meeting.id, meetingData.participants, allUsers);
        
        // Add AI-generated summary
        await db.update(schema.meetings)
          .set({
            summary: "The team discussed progress on the new feature implementation:\n• Front-end development is at 80% completion\n• Desktop version is ready for testing, mobile responsive design still in progress\n• SSO integration postponed to next sprint\n• Focus will be on user dashboard and reporting features\n• Backend API endpoints will be ready by Friday"
          })
          .where(eq(schema.meetings.id, meeting.id));
        
        // Add tasks for the live meeting
        await seedTasks(meeting.id, allUsers);
        
        // Add chat messages for the live meeting
        await seedChatMessages(meeting.id, allUsers);
      }
    }
  }
}

// Seed transcription entries for a meeting
async function seedTranscriptionEntries(
  meetingId: number, 
  participantNames: string[], 
  allUsers: schema.User[]
) {
  const transcripts = [
    {
      speaker: "John Doe",
      text: "Thanks everyone for joining today. Let's start by discussing the progress on the new feature implementation. Sarah, can you share an update on the front-end development?"
    },
    {
      speaker: "Sarah Lee",
      text: "Sure. We've completed about 80% of the UI components. We're still working on the responsive behavior for mobile devices, but the desktop version is almost ready for testing. I've shared the latest designs in our Figma workspace."
    },
    {
      speaker: "Mike Thompson",
      text: "I've looked at the designs, and they look great. One question about the user authentication flow - are we implementing the new SSO integration in this sprint or postponing it to the next one?"
    },
    {
      speaker: "John Doe",
      text: "Good question, Mike. Let's postpone the SSO integration to the next sprint. We need to focus on getting the core functionality working first. Let's prioritize the user dashboard and reporting features."
    },
    {
      speaker: "Anna Kim",
      text: "I agree with John. We should focus on the core features first. I've been working on the backend API and database models. We're on track to have the REST endpoints ready by Friday."
    }
  ];

  let timestamp = new Date();
  timestamp.setMinutes(timestamp.getMinutes() - 30); // Start 30 minutes ago
  
  for (const entry of transcripts) {
    const speaker = allUsers.find(u => u.fullName === entry.speaker);
    if (speaker) {
      await db.insert(schema.transcriptionEntries).values({
        meetingId,
        userId: speaker.id,
        text: entry.text,
        timestamp: new Date(timestamp) // Create a new Date object to avoid reference issues
      });
      
      // Advance time by 2-3 minutes for each entry
      timestamp.setMinutes(timestamp.getMinutes() + 2 + Math.floor(Math.random() * 2));
    }
  }
}

// Seed tasks for a meeting
async function seedTasks(meetingId: number, allUsers: schema.User[]) {
  const tasks = [
    {
      title: "Complete mobile responsive design",
      assignee: "Sarah Lee",
      dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
      completed: false
    },
    {
      title: "Prepare user dashboard mockups",
      assignee: "Mike Thompson",
      dueDate: new Date(Date.now() + 86400000), // 1 day from now
      completed: false
    },
    {
      title: "Finalize REST API endpoints",
      assignee: "Anna Kim",
      dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
      completed: false
    }
  ];

  for (const task of tasks) {
    const assignee = allUsers.find(u => u.fullName === task.assignee);
    
    await db.insert(schema.tasks).values({
      meetingId,
      title: task.title,
      assigneeId: assignee?.id || null,
      dueDate: task.dueDate,
      completed: task.completed
    });
  }
}

// Seed chat messages for a meeting
async function seedChatMessages(meetingId: number, allUsers: schema.User[]) {
  const userMessages = [
    {
      sender: "Alex Morgan",
      content: "Can you summarize what was discussed about the SSO integration?"
    }
  ];

  const aiResponses = [
    {
      content: "Mike asked if the SSO integration would be implemented in this sprint. John decided to postpone it to the next sprint to focus on core functionality first, specifically the user dashboard and reporting features."
    }
  ];

  // Add welcome message from AI
  await db.insert(schema.chatMessages).values({
    meetingId,
    content: "Hello! I'm your AI meeting assistant. I'm listening to your meeting and can answer questions or help with tasks. What can I help you with?",
    isAi: true,
    timestamp: new Date(Date.now() - 1800000) // 30 minutes ago
  });

  let timestamp = new Date();
  timestamp.setMinutes(timestamp.getMinutes() - 10); // User message 10 minutes ago
  
  // Add user messages and AI responses
  for (let i = 0; i < userMessages.length; i++) {
    const message = userMessages[i];
    const sender = allUsers.find(u => u.fullName === message.sender);
    
    // Add user message
    await db.insert(schema.chatMessages).values({
      meetingId,
      senderId: sender?.id || null,
      content: message.content,
      isAi: false,
      timestamp: new Date(timestamp)
    });
    
    // Add AI response 30 seconds later
    timestamp.setSeconds(timestamp.getSeconds() + 30);
    
    await db.insert(schema.chatMessages).values({
      meetingId,
      content: aiResponses[i].content,
      isAi: true,
      timestamp: new Date(timestamp)
    });
    
    // Advance time for next message pair
    timestamp.setMinutes(timestamp.getMinutes() + 5);
  }
}

async function seed() {
  try {
    console.log("Seeding database...");
    
    // Seed users first
    await seedUsers();
    console.log("✓ Users seeded");
    
    // Seed meetings and related data
    await seedMeetings();
    console.log("✓ Meetings, transcriptions, tasks, and chat messages seeded");
    
    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
