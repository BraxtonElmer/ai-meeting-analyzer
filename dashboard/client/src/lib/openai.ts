import { apiRequest } from "./queryClient";

// Interface for the AI analysis request
export interface AiAnalysisRequest {
  text: string;
  type: 'summary' | 'tasks' | 'question';
  meetingId?: number;
}

// Interface for the AI analysis response
export interface AiAnalysisResponse {
  content: string;
  tasks?: Array<{
    title: string;
    assigneeId?: number;
    assigneeName?: string;
    dueDate?: string;
  }>;
}

// Function to get an AI summary of a meeting transcript
export async function getAiSummary(meetingId: number): Promise<AiAnalysisResponse> {
  const response = await apiRequest('GET', `/api/meetings/${meetingId}/summary`);
  return await response.json();
}

// Function to get AI-generated tasks from a meeting transcript
export async function getAiTasks(meetingId: number): Promise<AiAnalysisResponse> {
  const response = await apiRequest('GET', `/api/meetings/${meetingId}/tasks`);
  return await response.json();
}

// Function to ask the AI assistant a question about the meeting
export async function askAiQuestion(
  meetingId: number, 
  question: string
): Promise<AiAnalysisResponse> {
  const response = await apiRequest('POST', `/api/meetings/${meetingId}/ask`, {
    question
  });
  return await response.json();
}

// Function to generate an AI analysis of the transcript
export async function generateAiAnalysis(
  data: AiAnalysisRequest
): Promise<AiAnalysisResponse> {
  const response = await apiRequest('POST', `/api/ai/analyze`, data);
  return await response.json();
}
