import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config();

// Check if Gemini API key is available
const apiKey = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
export let geminiModel: GenerativeModel | null = null;

// Initialize the Google Generative AI client if API key is available
if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    // Get the generative model (using correct naming format)
    geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    console.log("Gemini AI initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Gemini AI:", error);
    genAI = null;
    geminiModel = null;
  }
} else {
  console.warn(
    "GEMINI_API_KEY not found. AI features will return placeholder responses.",
  );
}

/**
 * Generate a meeting summary from transcription entries
 */
export async function generateMeetingSummary(
  transcript: string,
): Promise<string> {
  // Check if Gemini model is initialized
  if (!geminiModel) {
    return "AI summary generation is not available. Please provide a valid GEMINI_API_KEY in your .env file.";
  }

  try {
    // Define the prompt for summarization
    const prompt = `
    You are an AI meeting assistant. Your task is to create concise, bulleted summaries of meeting transcripts. 
    Identify key points, decisions, action items and follow-ups. 
    Format your response with an introductory sentence followed by bullet points.
    
    Please summarize the following meeting transcript:
    
    ${transcript}
    `;

    // Generate summary from Gemini
    // We've already checked for null above, so this assertion is safe
    const result = await (geminiModel as GenerativeModel).generateContent(
      prompt,
    );
    const response = await result.response;
    const summary = response.text();

    return summary;
  } catch (error) {
    console.error("Error generating meeting summary with Gemini:", error);
    // Return a fallback response instead of throwing
    return "There was an error generating the meeting summary. Please try again later.";
  }
}

/**
 * Extract tasks from meeting transcript
 */
export async function extractTasks(transcript: string): Promise<any[]> {
  // Check if Gemini model is initialized
  if (!geminiModel) {
    console.warn(
      "AI task extraction is not available. Please provide a valid GEMINI_API_KEY in your .env file.",
    );
    return [];
  }

  try {
    // Define the prompt for task extraction
    const prompt = `
    You are an AI meeting assistant that specializes in extracting actionable tasks from meeting transcripts.
    
    IMPORTANT INSTRUCTIONS:
    - Carefully scan the transcript for any mention of tasks, assignments, responsibilities, or deadlines.
    - Look for patterns like "X needs to do Y" or "X will handle Y" or "X's task is to do Y"
    - Extract ANY statement that implies someone has been assigned work, even if it's phrased conversationally.
    - Look for date indicators like "by Monday", "next week", "end of the month" and convert to YYYY-MM-DD format.
    - If a date is not specific (like "next week"), make a reasonable estimate.
    - If a full name is provided in the transcript, use the full name as the assignee.

    Respond ONLY with a JSON object in the following format:
    {
      "tasks": [
        {
          "description": "Task description",
          "assignee": "Person's name",
          "dueDate": "YYYY-MM-DD"
        }
      ]
    }
    
    Extract ALL possible tasks from the following meeting transcript:
    
    ${transcript}
    `;

    // Generate tasks from Gemini
    // We've already checked for null above, so this assertion is safe
    const result = await (geminiModel as GenerativeModel).generateContent(
      prompt,
    );
    const response = await result.response;
    const tasksText = response.text();

    // Parse the JSON response
    try {
      // Clean up the response text to handle code blocks that Gemini might return
      let cleanedResponse = tasksText;
      
      // Check if response is wrapped in markdown code blocks
      if (tasksText.includes("```json")) {
        const jsonMatch = tasksText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          cleanedResponse = jsonMatch[1].trim();
        }
      }
      
      console.log("Attempting to parse JSON task response:", cleanedResponse.substring(0, 300));
      const tasksObj = JSON.parse(cleanedResponse);
      return tasksObj.tasks || [];
    } catch (parseError) {
      console.error("Error parsing Gemini task response as JSON:", parseError);
      console.log("Raw response:", tasksText.substring(0, 300));
      
      // Try a more aggressive approach to extract JSON
      try {
        // Look for anything that might be JSON object with tasks array
        const jsonPattern = /\{\s*"tasks"\s*:\s*\[\s*\{[\s\S]*?\}\s*\]\s*\}/g;
        const jsonMatch = tasksText.match(jsonPattern);
        
        if (jsonMatch) {
          console.log("Found tasks JSON pattern, attempting to parse:", jsonMatch[0].substring(0, 300));
          const tasksObj = JSON.parse(jsonMatch[0]);
          return tasksObj.tasks || [];
        }
      } catch (e) {
        console.error("Failed second attempt to parse JSON:", e);
      }
      
      return [];
    }
  } catch (error) {
    console.error("Error extracting tasks with Gemini:", error);
    // Return empty array instead of throwing
    return [];
  }
}

/**
 * Answer questions about the meeting based on transcript
 */
export async function answerMeetingQuestion(
  transcript: string,
  meetingTitle: string,
  question: string,
  meetingStatus: string = 'live', // Add status parameter with default
): Promise<string> {
  // Check if Gemini model is initialized
  if (!geminiModel) {
    return "AI chat is not available. Please provide a valid GEMINI_API_KEY in your .env file to enable this feature.";
  }

  try {
    // Define the prompt for answering questions with meeting status context
    let prompt = `
    You are an AI meeting assistant. Answer questions about the meeting based on the transcript provided.
    Be concise but thorough. If the information isn't in the transcript, acknowledge that fact.
    `;
    
    // Add context about whether this is a past meeting or live meeting
    if (meetingStatus === 'completed') {
      prompt += `
      This is a past meeting that has already been completed. The transcript has been imported into the system.
      IMPORTANT: Respond in past tense when referring to this meeting since it has already happened.
      For example, say "The speakers discussed..." rather than "The speakers are discussing..."
      Make it clear in your response that you are analyzing a past transcript, not an ongoing conversation.
      `;
    } else {
      prompt += `
      This is an ongoing live meeting happening right now. 
      IMPORTANT: Respond in present tense when referring to the meeting since it is currently in progress.
      For example, say "The speakers are discussing..." rather than "The speakers discussed..."
      `;
    }
    
    prompt += `
    Meeting Title: ${meetingTitle}
    Meeting Status: ${meetingStatus}
    
    Transcript:
    ${transcript}
    
    Question: ${question}
    `;

    // Generate answer from Gemini
    // We've already checked for null above, so this assertion is safe
    const result = await (geminiModel as GenerativeModel).generateContent(
      prompt,
    );
    const response = await result.response;
    const answer = response.text();

    return answer;
  } catch (error) {
    console.error("Error answering meeting question with Gemini:", error);
    // Return a fallback response instead of throwing
    return "I'm sorry, I couldn't process your question at this time. Please try again later.";
  }
}
