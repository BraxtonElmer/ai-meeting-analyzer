import { db } from "./mysql";
import * as schema from "../shared/schema.mysql";
import { faker } from "@faker-js/faker";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

type AvatarColor = 
  | "bg-gray-200"
  | "bg-indigo-100"
  | "bg-blue-100"
  | "bg-green-100"
  | "bg-yellow-100"
  | "bg-purple-100"
  | "bg-pink-100";

// Helper function to get initials from a name
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

// Password hashing function
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Seed users
async function seedUsers() {
  console.log("Seeding users...");
  
  const existingUsers = await db.query.users.findMany();
  if (existingUsers.length > 0) {
    console.log(`Found ${existingUsers.length} existing users. Skipping user creation.`);
    return existingUsers;
  }
  
  const usersToCreate = [
    {
      username: "johndoe",
      password: await hashPassword("password123"),
      fullName: "John Doe",
      email: "john@example.com",
      avatarInitials: "JD",
      avatarColor: "bg-blue-100" as AvatarColor
    },
    {
      username: "janedoe",
      password: await hashPassword("password123"),
      fullName: "Jane Doe",
      email: "jane@example.com",
      avatarInitials: "JD",
      avatarColor: "bg-green-100" as AvatarColor
    },
    {
      username: "bobsmith",
      password: await hashPassword("password123"),
      fullName: "Bob Smith",
      email: "bob@example.com",
      avatarInitials: "BS",
      avatarColor: "bg-yellow-100" as AvatarColor
    }
  ];
  
  // Create users
  const createdUsers = [];
  for (const userData of usersToCreate) {
    const result = await db.insert(schema.users).values(userData);
    const userId = result.insertId;
    const user = { id: Number(userId), ...userData };
    createdUsers.push(user);
  }
  
  console.log(`Created ${createdUsers.length} users`);
  return createdUsers;
}

// Seed meetings
async function seedMeetings() {
  console.log("Seeding meetings...");
  
  const existingMeetings = await db.query.meetings.findMany();
  if (existingMeetings.length > 0) {
    console.log(`Found ${existingMeetings.length} existing meetings. Skipping meeting creation.`);
    return existingMeetings;
  }
  
  const meetingsToCreate = [
    {
      title: "Product Roadmap Planning",
      description: "Quarterly planning session for product roadmap",
      startTime: faker.date.recent({ days: 5 }),
      status: "completed" as const,
      summary: "We discussed Q3 priorities including the new UI redesign and mobile app features. Action items were assigned to team members with deadlines for the next sprint."
    },
    {
      title: "Weekly Team Standup",
      description: "Regular sync to discuss progress and blockers",
      startTime: faker.date.recent({ days: 2 }),
      status: "completed" as const,
      summary: "Each team member shared updates on their tasks. Several blockers were identified and resolved during the meeting."
    },
    {
      title: "Customer Feedback Review",
      description: "Review recent customer feedback and prioritize actions",
      startTime: faker.date.soon({ days: 3 }),
      status: "scheduled" as const
    },
    {
      title: "Marketing Campaign Planning",
      description: "Planning session for upcoming product launch",
      startTime: faker.date.soon({ days: 7 }),
      status: "scheduled" as const
    }
  ];
  
  // Create meetings
  const createdMeetings = [];
  for (const meetingData of meetingsToCreate) {
    const result = await db.insert(schema.meetings).values(meetingData);
    const meetingId = result.insertId;
    const meeting = { id: Number(meetingId), ...meetingData };
    createdMeetings.push(meeting);
  }
  
  console.log(`Created ${createdMeetings.length} meetings`);
  return createdMeetings;
}

// Seed transcription entries
async function seedTranscriptionEntries(
  meetingId: number, 
  allUsers: schema.User[]
) {
  console.log(`Seeding transcription entries for meeting ${meetingId}...`);
  
  const existingEntries = await db.query.transcriptionEntries.findMany({
    where: (transcription, { eq }) => eq(transcription.meetingId, meetingId)
  });
  
  if (existingEntries.length > 0) {
    console.log(`Found ${existingEntries.length} existing entries for meeting ${meetingId}. Skipping.`);
    return;
  }
  
  // Only add transcriptions to completed meetings
  const meeting = await db.query.meetings.findFirst({
    where: (meeting, { eq }) => eq(meeting.id, meetingId)
  });
  
  if (!meeting || meeting.status !== "completed") {
    console.log(`Meeting ${meetingId} is not completed. Skipping transcription entries.`);
    return;
  }
  
  // Generate 10-15 transcription entries spread across users
  const numEntries = faker.number.int({ min: 10, max: 15 });
  const startTime = meeting.startTime;
  
  for (let i = 0; i < numEntries; i++) {
    const randomUser = allUsers[faker.number.int({ min: 0, max: allUsers.length - 1 })];
    const timestamp = new Date(startTime.getTime() + (i * 60000)); // Add minutes
    
    let text = "";
    // Generate realistic meeting transcription text
    switch (faker.number.int({ min: 1, max: 5 })) {
      case 1:
        text = `I think we should focus on ${faker.commerce.productAdjective()} improvements to the ${faker.commerce.productName()} this quarter.`;
        break;
      case 2:
        text = `Does anyone have an update on the ${faker.commerce.department()} project timeline?`;
        break;
      case 3:
        text = `We need to address the feedback from customers about our ${faker.commerce.productMaterial()} quality.`;
        break;
      case 4:
        text = `I'll take ownership of the ${faker.commerce.productAdjective()} task and have it done by next week.`;
        break;
      case 5:
        text = `Let's schedule a follow-up meeting to discuss the ${faker.company.buzzNoun()} implementation details.`;
        break;
    }
    
    await db.insert(schema.transcriptionEntries).values({
      meetingId,
      userId: randomUser.id,
      text,
      timestamp
    });
  }
  
  console.log(`Created ${numEntries} transcription entries for meeting ${meetingId}`);
}

// Seed tasks
async function seedTasks(meetingId: number, allUsers: schema.User[]) {
  console.log(`Seeding tasks for meeting ${meetingId}...`);
  
  const existingTasks = await db.query.tasks.findMany({
    where: (task, { eq }) => eq(task.meetingId, meetingId)
  });
  
  if (existingTasks.length > 0) {
    console.log(`Found ${existingTasks.length} existing tasks for meeting ${meetingId}. Skipping.`);
    return;
  }
  
  // Generate 3-5 tasks per meeting
  const numTasks = faker.number.int({ min: 3, max: 5 });
  
  for (let i = 0; i < numTasks; i++) {
    // Randomize if the task has an assignee
    const hasAssignee = faker.datatype.boolean();
    const assigneeId = hasAssignee 
      ? allUsers[faker.number.int({ min: 0, max: allUsers.length - 1 })].id 
      : null;
    
    // Randomize if the task has a due date
    const hasDueDate = faker.datatype.boolean();
    const dueDate = hasDueDate 
      ? faker.date.soon({ days: 14 }) 
      : null;
    
    // Generate task title
    let title = "";
    switch (faker.number.int({ min: 1, max: 5 })) {
      case 1:
        title = `Create documentation for ${faker.commerce.productName()}`;
        break;
      case 2:
        title = `Review the ${faker.commerce.department()} proposal`;
        break;
      case 3:
        title = `Schedule meeting with ${faker.company.name()} team`;
        break;
      case 4:
        title = `Prepare presentation for ${faker.commerce.productAdjective()} project`;
        break;
      case 5:
        title = `Fix issue with ${faker.commerce.productMaterial()} component`;
        break;
    }
    
    await db.insert(schema.tasks).values({
      meetingId,
      title,
      completed: faker.datatype.boolean({ probability: 0.3 }), // 30% chance of being completed
      assigneeId,
      dueDate
    });
  }
  
  console.log(`Created ${numTasks} tasks for meeting ${meetingId}`);
}

// Seed chat messages
async function seedChatMessages(meetingId: number, allUsers: schema.User[]) {
  console.log(`Seeding chat messages for meeting ${meetingId}...`);
  
  const existingMessages = await db.query.chatMessages.findMany({
    where: (message, { eq }) => eq(message.meetingId, meetingId)
  });
  
  if (existingMessages.length > 0) {
    console.log(`Found ${existingMessages.length} existing chat messages for meeting ${meetingId}. Skipping.`);
    return;
  }
  
  // Add an AI welcome message
  await db.insert(schema.chatMessages).values({
    meetingId,
    content: "Welcome to the meeting chat! You can ask questions about the meeting here.",
    isAi: true,
    timestamp: new Date(),
    senderId: null
  });
  
  // Only add chat messages to completed meetings
  const meeting = await db.query.meetings.findFirst({
    where: (meeting, { eq }) => eq(meeting.id, meetingId)
  });
  
  if (!meeting || meeting.status !== "completed") {
    console.log(`Meeting ${meetingId} is not completed. Skipping additional chat messages.`);
    return;
  }
  
  // Generate 3-7 user chat messages
  const numMessages = faker.number.int({ min: 3, max: 7 });
  const startTime = meeting.startTime;
  
  for (let i = 0; i < numMessages; i++) {
    const randomUser = allUsers[faker.number.int({ min: 0, max: allUsers.length - 1 })];
    const timestamp = new Date(startTime.getTime() + (i * 120000)); // Add 2 minutes per message
    
    let content = "";
    // Generate realistic chat message content
    switch (faker.number.int({ min: 1, max: 5 })) {
      case 1:
        content = `Could you please summarize what we discussed about the ${faker.commerce.productName()}?`;
        break;
      case 2:
        content = `When is our next follow-up meeting scheduled?`;
        break;
      case 3:
        content = `@${allUsers[faker.number.int({ min: 0, max: allUsers.length - 1 })].fullName.split(' ')[0]} can you share that document you mentioned?`;
        break;
      case 4:
        content = `I think we should prioritize the ${faker.commerce.productAdjective()} feature for the next sprint.`;
        break;
      case 5:
        content = `Great discussion everyone, thanks for your input!`;
        break;
    }
    
    await db.insert(schema.chatMessages).values({
      meetingId,
      senderId: randomUser.id,
      content,
      isAi: false,
      timestamp
    });
    
    // 50% chance of adding an AI response after a user message
    if (faker.datatype.boolean()) {
      const aiTimestamp = new Date(timestamp.getTime() + 30000); // 30 seconds after user message
      
      let aiResponse = "";
      switch (faker.number.int({ min: 1, max: 3 })) {
        case 1:
          aiResponse = `Based on the meeting transcript, the team agreed to prioritize ${faker.commerce.productName()} development for Q3.`;
          break;
        case 2:
          aiResponse = `The next follow-up meeting is scheduled for next Tuesday at 2 PM.`;
          break;
        case 3:
          aiResponse = `I've created a task to track that action item and assigned it to ${randomUser.fullName}.`;
          break;
      }
      
      await db.insert(schema.chatMessages).values({
        meetingId,
        senderId: null,
        content: aiResponse,
        isAi: true,
        timestamp: aiTimestamp
      });
    }
  }
  
  console.log(`Created chat messages for meeting ${meetingId}`);
}

// Main seed function
async function seed() {
  try {
    // Seed users
    const allUsers = await seedUsers();
    
    // Seed meetings
    const allMeetings = await seedMeetings();
    
    // Add all users as participants to all meetings
    for (const meeting of allMeetings) {
      for (const user of allUsers) {
        await db.insert(schema.meetingParticipants)
          .values({
            meetingId: meeting.id,
            userId: user.id
          })
          .onDuplicateKeyUpdate({ set: {} }); // No-op update to handle duplicates
      }
    }
    
    // Seed transcription entries, tasks, and chat messages for each meeting
    for (const meeting of allMeetings) {
      await seedTranscriptionEntries(meeting.id, allUsers);
      await seedTasks(meeting.id, allUsers);
      await seedChatMessages(meeting.id, allUsers);
    }
    
    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seed function
seed();