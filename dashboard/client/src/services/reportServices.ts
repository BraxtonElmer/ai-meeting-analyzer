// Services to handle API requests for meeting reports
import apiClient from '../lib/apiClient';

import { TopicDriftResponse } from "@/types";

interface TransitionItem {
  from_speaker: string;
  to_speaker: string;
  transition_smoothness: number;
  sentiment: string;
}

interface TransitionResponse {
  meeting_id: number;
  meeting_title: string;
  transitions: TransitionItem[];
}

interface SpeakerContributionResponse {
  meeting_id: number;
  meeting_title: string;
  speaker_contribution: {
    [speaker: string]: number;
  };
}

/**
 * Fetches sentiment analysis data for a meeting
 * @param meetingId The ID of the meeting
 * @returns Promise with sentiment data
 */
export const fetchSentimentData = async (meetingId: string) => {
  try {
    const response = await apiClient.get(`/api/reports/sentiment/${meetingId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching sentiment data:', error);
    throw error;
  }
};

/**
 * Fetches topic drift analysis data for a meeting
 * @param meetingId The ID of the meeting
 * @returns Promise with topic drift data
 */
export const fetchTopicData = async (meetingId: string): Promise<TopicDriftResponse> => {
  try {
    const response = await apiClient.get<TopicDriftResponse>(`/api/reports/topics/${meetingId}`);
    
    // Ensure speakerContributions is properly formatted
    const data = response.data;
    
    // If speakerContributions is empty or missing, try to create it from other data
    if (!data.speakerContributions || data.speakerContributions.length === 0) {
      // Try to extract speakers from speakerDrift if available
      if (data.speakerDrift && data.speakerDrift.length > 0 && data.speakerDrift[0].speakers) {
        const speakers = Object.keys(data.speakerDrift[0].speakers);
        data.speakerContributions = speakers.map((name, index) => ({
          name,
          contributions: Math.round(100 / speakers.length) // Evenly distribute for now
        }));
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching topic data:', error);
    throw error;
  }
};

/**
 * Fetches meeting transitions data for a meeting
 * @param meetingId The ID of the meeting
 * @returns Promise with transitions data
 */
export const fetchTransitionsData = async (meetingId: string) => {
  try {
    const response = await apiClient.get<TransitionResponse>(`/api/reports/transitions/${meetingId}`);
    
    // Validate response data structure
    if (response.data && !response.data.transitions) {
      // If transitions property is missing but data exists, try to fix the structure
      if (Array.isArray(response.data)) {
        return {
          meeting_id: parseInt(meetingId),
          meeting_title: "Meeting",
          transitions: response.data
        };
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching transitions data:', error);
    throw error;
  }
};

/**
 * Fetches speaker contribution data for a meeting
 * @param meetingId The ID of the meeting
 * @returns Promise with speaker contribution data
 */
export const fetchSpeakerContributionData = async (meetingId: string) => {  try {
    const response = await apiClient.get<SpeakerContributionResponse>(`/api/reports/speaker_contribution/${meetingId}`);
    // Transform speaker_contribution object into array format that our components expect
    if (response.data && response.data.speaker_contribution) {
      const speakerContributions = Object.entries(response.data.speaker_contribution || {}).map(
        ([name, value]) => ({
          name,
          contributions: typeof value === 'number' ? value : 0
        })
      );
      return {
        ...response.data,
        speakerContributions,
        timestamp: new Date().toISOString() // Add timestamp for caching
      };
    }
    return {
      ...response.data,
      timestamp: new Date().toISOString() // Add timestamp for caching
    };
  } catch (error) {
    console.error('Error fetching speaker contribution data:', error);
    throw error;
  }
};
