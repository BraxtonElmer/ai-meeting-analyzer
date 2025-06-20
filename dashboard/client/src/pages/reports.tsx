import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import testData from "./test.json";
import { fetchSentimentData, fetchTopicData, fetchTransitionsData, fetchSpeakerContributionData } from "@/services/reportServices";
// Define interfaces for report data types
interface SentimentData {
  overallSentiment: number;
  sentimentOverTime: Array<{ time: string; score: number }>;
  topPositiveTopics: string[];
  topNegativeTopics: string[];
}

import { TopicDriftResponse } from "@/types";
import { Meeting } from "@/types";

interface ToneData {
  dominantTones: string[];
  toneBreakdown: Array<{ tone: string; percentage: number }>;
  participants: Array<{
    name: string;
    tones: {
      analytical: number;
      confident: number;
      tentative: number;
      casual: number;
      formal: number;
      [key: string]: number;
    };
  }>;
}

interface ParticipantData {
  participantCount: number;
  speakingDistribution: Array<{ name: string; speakingTime: number }>;
  interactionStats: Array<{ name: string; count: number }>;
  engagement: {
    high: string[];
    medium: string[];
    low: string[];
  };
}

// Add new interface for transition data
interface TransitionData {
  meeting_id: number;
  meeting_title: string;
  transitions: Array<{
    from_speaker: string;
    to_speaker: string;
    transition_smoothness: number;
    sentiment: string;
  }>;
}

// Add SpeakerContribution interface
interface SpeakerContributionData {
  speaker_contribution: { [key: string]: number };
  speakerContributions: Array<{ name: string; contributions: number }>;
  total_speakers: number;
  total_words: number;
  error?: string;
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Dices, AlertCircle, TrendingUp, Cpu, Users, BarChart3, PieChart, LineChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart as RechartsLineChart, Line, CartesianGrid, Legend, PieChart as RechartsPieChart, Pie, Cell, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";

// Define interface for meeting data 
interface Meeting {
  id: number;
  title: string;
  status: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  summary?: string;
  agenda?: string[];
  external_meeting_code?: string;
  external_meeting_type?: string;
  created_at?: string;
}

// Sentiment Analysis Card
const SentimentAnalysisCard = ({ meetingId }: { meetingId: string }) => {
  const { data: sentimentData, isLoading, isError } = useQuery({
    queryKey: ['sentiment', meetingId],
    queryFn: () => fetchSentimentData(meetingId),
    enabled: !!meetingId,
    retry: 2,
    staleTime: 60000, // 1 minute
  });

  if (isLoading) return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dices className="h-5 w-5" /> Sentiment Analysis
        </CardTitle>
        <CardDescription>Emotional tone throughout the meeting</CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
  if (isError) {
    console.error("Error fetching sentiment data");
    return (
      <Card className="max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5" /> Sentiment Analysis
          </CardTitle>
          <CardDescription>Emotional tone throughout the meeting</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center flex-col">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Could not load sentiment data</p>
        </CardContent>
      </Card>
    );
  }

  // Only use test data if API data is not available after proper loading attempt
  const data: SentimentData = sentimentData || {
    overallSentiment: testData.overallSentiment,
    sentimentOverTime: testData.sentimentOverTime,
    topPositiveTopics: testData.topPositiveTopics,
    topNegativeTopics: testData.topNegativeTopics
  };

  // Color based on sentiment score
  const getSentimentColor = (score: number) => {
    if (score >= 0.7) return 'text-green-500';
    if (score >= 0.4) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dices className="h-5 w-5" /> Sentiment Analysis
        </CardTitle>
        <CardDescription>Emotional tone throughout the meeting</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">Overall Sentiment</div>
            <div className={cn("text-3xl font-bold", getSentimentColor(data.overallSentiment))}>
              {Math.round(data.overallSentiment * 100)}%
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-2 text-sm font-medium text-green-500">Top Positive Topics</h4>
            <ul className="space-y-1">
              {data.topPositiveTopics.map((topic: string, i: number) => (
                <li key={i} className="text-sm">{topic}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-red-500">Top Negative Topics</h4>
            <ul className="space-y-1">
              {data.topNegativeTopics.map((topic: string, i: number) => (
                <li key={i} className="text-sm">{topic}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Topic Drift Analysis Card
const TopicDriftCard = ({ meetingId }: { meetingId: string }) => {
  const { data: topicData, isLoading: isLoadingTopicData, isError: isTopicError } = useQuery<TopicDriftResponse>({
    queryKey: ['topics', meetingId],
    queryFn: () => fetchTopicData(meetingId),
    enabled: !!meetingId,
    retry: 2,
    staleTime: 60000, // 1 minute
  });

  // Add a new query for speaker contribution data
  const { data: speakerContributionData, isLoading: isLoadingSpeakerData } = useQuery({
    queryKey: ['speaker_contribution', meetingId],
    queryFn: () => fetchSpeakerContributionData(meetingId),
    enabled: !!meetingId,
    retry: 2,
    staleTime: 60000, // 1 minute
  });

  // Log data for debugging
  useEffect(() => {
    if (topicData) {
      console.log("Topic data received:", topicData);
      console.log("Topic speaker contributions:", topicData.speakerContributions);
    } else {
      console.log("No topic data received yet");
    }
    
    if (speakerContributionData) {
      console.log("Speaker contribution data:", speakerContributionData);
    }
    
    // Check the meetingId
    console.log("Current meetingId:", meetingId);
  }, [topicData, speakerContributionData, meetingId]);
  if (isLoadingTopicData || isLoadingSpeakerData) return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Topic Drift Analysis
        </CardTitle>
        <CardDescription>How conversations deviated from planned topics</CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
  if (isTopicError) {
    console.error("Error fetching topic data");
    return (
      <Card className="max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Topic Drift Analysis
          </CardTitle>
          <CardDescription>How conversations deviated from planned topics</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center flex-col">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Could not load topic drift data</p>
        </CardContent>
      </Card>
    );
  }  const data = topicData || {
    topicDriftScore: 0,
    plannedTopics: [],
    topicCoverage: [
      { name: "Topic 1", planned: 30, actual: 30, drift: 0 },
      { name: "Topic 2", planned: 40, actual: 40, drift: 0 },
      { name: "Topic 3", planned: 30, actual: 30, drift: 0 }
    ],
    unexpectedTopics: [],
    speakerContributions: [],
    speakerDrift: [
      { 
        time: "00:00", 
        speakers: { "Speaker 1": 0, "Speaker 2": 0, "Speaker 3": 0 } 
      },
      { 
        time: "00:15", 
        speakers: { "Speaker 1": 0, "Speaker 2": 0, "Speaker 3": 0 } 
      }
    ]
  };

  // Process speaker contributions data from the dedicated API
  let speakerContributions = [];
  if (speakerContributionData) {
    if (speakerContributionData.speakerContributions) {
      speakerContributions = speakerContributionData.speakerContributions;
    } else if (speakerContributionData.speaker_contribution) {
      speakerContributions = Object.entries(speakerContributionData.speaker_contribution).map(([name, value]) => ({
        name,
        contributions: typeof value === 'number' ? value : 0
      }));
    }
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="space-y-6">
      <Card className="max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Topic Drift Analysis
          </CardTitle>
          <CardDescription>How conversations deviated from planned topics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground">Overall Topic Drift Score</div>
              <div className={`text-3xl font-bold ${data.topicDriftScore > 0.5 ? 'text-red-500' : 'text-green-500'}`}>
                {Math.round(data.topicDriftScore * 100)}%
              </div>
            </div>
          </div>

          {/* Speaker Drift Over Time Chart */}
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart
                data={data.speakerDrift}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  scale="point" 
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis 
                  domain={[0, 1]} 
                  tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                />
                <Tooltip 
                  formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Drift']}
                  labelFormatter={(label: string) => `Time: ${label}`}
                />                
                <Legend />
                {/* Overall topic drift line as a ReferenceLine */}
                <ReferenceLine 
                  y={data.topicDriftScore} 
                  label={`Overall: ${Math.round(data.topicDriftScore * 100)}%`} 
                  stroke="#FF0000" 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                />
                
                {/* Individual speaker drift lines */}
                {data.speakerDrift && data.speakerDrift.length > 0 && Object.keys(data.speakerDrift[0].speakers).map((speaker, index) => (
                  <Line
                    key={speaker}
                    type="monotone"
                    dataKey={`speakers.${speaker}`}
                    name={speaker}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, stroke } = props;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          stroke={stroke}
                          fill="#fff"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />
                ))}
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Agenda Distribution and Speaker Contributions Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Agenda Distribution Card */}
        <Card className="max-w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" /> Agenda Distribution
            </CardTitle>
            <CardDescription>Time spent on each agenda item</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={data.topicCoverage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="actual"
                    nameKey="name"
                  >
                    {data.topicCoverage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${Math.round(value)}%`, 'Coverage']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Speaker Contributions Card */}
        <Card className="max-w-full overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Speaker Contributions
            </CardTitle>
            <CardDescription>Speaking time distribution among participants</CardDescription>
          </CardHeader>
          <CardContent>            <div className="h-64">
              {speakerContributions && speakerContributions.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={speakerContributions}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Contribution']} />
                    <Legend />
                    <Bar dataKey="contributions" name="Speaking Time" fill="#8884d8">
                      {speakerContributions.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">Loading speaker contribution data...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Meeting Transitions Card
const MeetingTransitionsCard = ({ meetingId }: { meetingId: string }) => {
  const { data: transitionData, isLoading, isError } = useQuery({
    queryKey: ['transitions', meetingId],
    queryFn: () => fetchTransitionsData(meetingId),
    enabled: !!meetingId,
    retry: 2,
    staleTime: 60000, // 1 minute
  });

  if (isLoading) return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Meeting Transitions
        </CardTitle>
        <CardDescription>Speaker transitions and sentiment analysis</CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  if (isError) {
    console.error("Error fetching transition data");
    return (
      <Card className="max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Meeting Transitions
          </CardTitle>
          <CardDescription>Speaker transitions and sentiment analysis</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center flex-col">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Could not load transition data</p>
        </CardContent>
      </Card>
    );
  }

  // Use a fallback if API data is not available
  const data = transitionData || {
    meeting_id: 1,
    meeting_title: "Sample Meeting",
    transitions: [
      {
        from_speaker: "Alice",
        to_speaker: "Bob",
        transition_smoothness: 0.8,
        sentiment: "Positive"
      },
      {
        from_speaker: "Bob",
        to_speaker: "Charlie",
        transition_smoothness: 0.3,
        sentiment: "Negative"
      }
    ]
  };

  // Ensure we have transitions data to display
  if (!data.transitions || data.transitions.length === 0) {
    return (
      <Card className="max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Meeting Transitions
          </CardTitle>
          <CardDescription>Speaker transitions and sentiment analysis</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center flex-col">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No transition data available for this meeting</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Meeting Transitions
        </CardTitle>
        <CardDescription>Speaker transitions and sentiment analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Transition Flow */}
          <div className="relative">
            <div className="flex items-center justify-between">
              {data.transitions.map((transition, index) => (
                <React.Fragment key={index}>
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center text-sm font-medium",
                      transition.sentiment === "Positive" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    )}>
                      {transition.from_speaker}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {Math.round(transition.transition_smoothness * 100)}% smooth
                    </div>
                  </div>
                  {index < data.transitions.length - 1 && (
                    <div className="flex-1 h-0.5 bg-border mx-4 relative">
                      <div 
                        className={cn(
                          "absolute top-0 left-0 h-full",
                          transition.sentiment === "Positive" ? "bg-green-500" : "bg-red-500"
                        )}
                        style={{ width: `${transition.transition_smoothness * 100}%` }}
                      />
                    </div>
                  )}
                </React.Fragment>              ))}
              {data.transitions.length > 0 && (
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-sm font-medium",
                  data.transitions[data.transitions.length - 1].sentiment === "Positive" 
                    ? "bg-green-100 text-green-800" 
                    : "bg-red-100 text-red-800"
                )}>
                  {data.transitions[data.transitions.length - 1].to_speaker}
                </div>
              )}
            </div>
          </div>          {/* Sentiment Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Positive Transitions</h4>
              <div className="text-2xl font-bold text-green-600">
                {data.transitions.filter(t => t.sentiment === "Positive").length}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Negative Transitions</h4>
              <div className="text-2xl font-bold text-red-600">
                {data.transitions.filter(t => t.sentiment === "Negative").length}
              </div>
            </div>
          </div>

          {/* Average Smoothness */}
          <div>
            <h4 className="text-sm font-medium mb-2">Average Transition Smoothness</h4>
            <div className="text-2xl font-bold">
              {data.transitions.length > 0 ? 
                Math.round(
                  (data.transitions.reduce((acc, t) => acc + t.transition_smoothness, 0) / 
                  data.transitions.length) * 100
                ) : 0}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Speaker Contribution Card
const SpeakerContributionCard = ({ meetingId }: { meetingId: string }) => {
  const { data: speakerData, isLoading, isError } = useQuery({
    queryKey: ['speaker_contribution', meetingId],
    queryFn: () => fetchSpeakerContributionData(meetingId),
    enabled: !!meetingId,
    retry: 2,
    staleTime: 60000, // 1 minute
  });

  // Add polling for real-time updates
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Set up polling for real-time updates if meetingId is available
    if (meetingId) {
      const interval = setInterval(() => {
        console.log("Polling for speaker contribution updates...");
        queryClient.invalidateQueries(['speaker_contribution', meetingId]);
      }, 10000); // Poll every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [meetingId, queryClient]);

  if (isLoading) return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Speaker Contributions
        </CardTitle>
        <CardDescription>Distribution of participation among speakers</CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  if (isError) {
    console.error("Error fetching speaker contribution data");
    return (
      <Card className="max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Speaker Contributions
          </CardTitle>
          <CardDescription>Distribution of participation among speakers</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center flex-col">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Could not load speaker contribution data</p>
        </CardContent>
      </Card>
    );
  }

  // Use a safe fallback for missing data
  const data = speakerData || {
    speaker_contribution: {},
    total_speakers: 0,
    total_words: 0,
    speakerContributions: []
  };

  // Create speakerContributions array from the speaker_contribution object if not already present
  const speakerContributions = data.speakerContributions || 
    Object.entries(data.speaker_contribution || {}).map(([name, value]) => ({
      name,
      contributions: typeof value === 'number' ? value : 0
    }));

  // If we have no speaker contributions, provide a fallback
  let contributionsData = speakerContributions;
  if (!contributionsData || contributionsData.length === 0) {
    contributionsData = [
      { name: "No Data", contributions: 100 }
    ];
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Speaker Contributions
        </CardTitle>
        <CardDescription>Distribution of participation among speakers</CardDescription>
      </CardHeader>
      <CardContent>        <div className="mb-6 flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">Total Speakers</div>
            <div className="text-3xl font-bold">{data.total_speakers || speakerContributions.length}</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">Total Words</div>
            <div className="text-3xl font-bold">{data.total_words || 0}</div>
          </div>
        </div><div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={speakerContributions}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={100} />
              <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Contribution']} />
              <Legend />
              <Bar dataKey="contributions" name="Speaking Percentage" fill="#8884d8">
                {speakerContributions.map((entry: { name: string; contributions: number }, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Comprehensive Meeting Report page
export default function ReportsPage() {
  // Get the meetingId parameter from the URL
  const params = useParams();
  const meetingId = params?.id as string | undefined;
  const [, setLocation] = useLocation();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(meetingId || "");

  // Query to get all meetings
  const { data: meetings, isLoading: isLoadingMeetings } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings', { status: 'completed' }],
  });

  // Handle meeting selection change
  const handleMeetingChange = (value: string) => {
    setSelectedMeetingId(value);
    setLocation(`/reports/${value}`);
  };
  return (
    <div className="container h-full flex flex-col py-6 overflow-hidden max-w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Meeting Analytics</h1>

        <div className="mt-4 sm:mt-0 w-full sm:w-72">
          {isLoadingMeetings ? (
            <div className="flex h-10 items-center justify-center rounded-md border">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <Select value={selectedMeetingId} onValueChange={handleMeetingChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a meeting" />
              </SelectTrigger>
              <SelectContent>
                {meetings?.filter(m => m.status === 'completed').map((meeting) => (
                  <SelectItem key={meeting.id} value={meeting.id.toString()}>
                    {meeting.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!selectedMeetingId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Meeting Selected</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a completed meeting from the dropdown to view analytics
          </p>
        </div>      ) : (
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="drift" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="drift" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Topic Drift
              </TabsTrigger>
              <TabsTrigger value="transitions" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Speaker Transitions
              </TabsTrigger>
              <TabsTrigger value="contributions" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Speaker Contributions
              </TabsTrigger>
              <TabsTrigger value="sentiment" className="flex items-center gap-2">
                <Dices className="h-4 w-4" /> Sentiment Analysis
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="drift" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <TopicDriftCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>

            <TabsContent value="transitions" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <MeetingTransitionsCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>

            <TabsContent value="contributions" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <SpeakerContributionCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>
            
            <TabsContent value="sentiment" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <SentimentAnalysisCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}