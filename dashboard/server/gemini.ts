import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Check if Gemini API key is available
const apiKey = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
let geminiModel: GenerativeModel | null = null;

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
    You are an AI meeting assistant. Extract actionable tasks from the meeting transcript. 
    For each task, identify the task description, the person assigned to it (if mentioned), and the due date (if mentioned).
    
    Respond only with a JSON object in the following format:
    {
      "tasks": [
        {
          "description": "Task description",
          "assignee": "Person's name",
          "dueDate": "YYYY-MM-DD"
        }
      ]
    }
    
    Extract tasks from the following meeting transcript:
    
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
      const tasksObj = JSON.parse(tasksText);
      return tasksObj.tasks || [];
    } catch (parseError) {
      console.error("Error parsing Gemini task response as JSON:", parseError);
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
): Promise<string> {
  // Check if Gemini model is initialized
  if (!geminiModel) {
    return "AI chat is not available. Please provide a valid GEMINI_API_KEY in your .env file to enable this feature.";
  }

  try {
    // Define the prompt for answering questions
    const prompt = `
    You are an AI meeting assistant. Answer questions about the meeting based on the transcript provided.
    Be concise but thorough. If the information isn't in the transcript, acknowledge that fact.
    
    Meeting Title: ${meetingTitle}
    
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
