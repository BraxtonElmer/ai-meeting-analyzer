import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import testData from "./test.json";
// Define interfaces for report data types
interface SentimentData {
  overallSentiment: number;
  sentimentOverTime: Array<{ time: string; score: number }>;
  topPositiveTopics: string[];
  topNegativeTopics: string[];
}

interface TopicData {
  topicDriftScore: number;
  plannedTopics: string[];
  topicCoverage: Array<{ name: string; planned: number; actual: number; drift: number }>;
  unexpectedTopics: string[];
  speakerContributions: Array<{ name: string; contributions: number }>;
  speakerDrift: Array<{
    time: string;
    speakers: {
      [key: string]: number; // drift score for each speaker at this time
    };
  }>;
}

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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart as RechartsLineChart, Line, CartesianGrid, Legend, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
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
  const { data: sentimentData, isLoading } = useQuery<SentimentData>({
    queryKey: ['/api/reports/sentiment', meetingId],
    enabled: !!meetingId,
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

  // Use test data if API data is not available
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
  const { data: topicData, isLoading } = useQuery<TopicData>({
    queryKey: ['/api/reports/topics', meetingId],
    enabled: !!meetingId,
  });

  if (isLoading) return (
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

  const data = topicData || {
    topicDriftScore: testData.topicDriftScore,
    plannedTopics: testData.plannedTopics,
    topicCoverage: testData.topicCoverage,
    speakerContributions: [
      { name: "John", contributions: 35 },
      { name: "Alice", contributions: 25 },
      { name: "Bob", contributions: 20 },
      { name: "Carol", contributions: 15 },
      { name: "Dave", contributions: 5 }
    ],
    speakerDrift: [
      { time: "0:00", speakers: { "John": 0.1, "Alice": 0.2, "Bob": 0.15, "Carol": 0.05, "Dave": 0.1 } },
      { time: "5:00", speakers: { "John": 0.3, "Alice": 0.25, "Bob": 0.2, "Carol": 0.15, "Dave": 0.1 } },
      { time: "10:00", speakers: { "John": 0.4, "Alice": 0.35, "Bob": 0.3, "Carol": 0.25, "Dave": 0.2 } },
      { time: "15:00", speakers: { "John": 0.35, "Alice": 0.3, "Bob": 0.25, "Carol": 0.2, "Dave": 0.15 } },
      { time: "20:00", speakers: { "John": 0.25, "Alice": 0.2, "Bob": 0.15, "Carol": 0.1, "Dave": 0.05 } }
    ]
  };

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
                <XAxis dataKey="time" />
                <YAxis domain={[0, 1]} />
                <Tooltip 
                  formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Drift']}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Legend />
                {Object.keys(data.speakerDrift[0].speakers).map((speaker, index) => (
                  <Line
                    key={speaker}
                    type="monotone"
                    dataKey={`speakers.${speaker}`}
                    name={speaker}
                    stroke={COLORS[index % COLORS.length]}
                    activeDot={{ r: 8 }}
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
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.speakerContributions}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Contribution']} />
                  <Bar dataKey="contributions" fill="#8884d8">
                    {data.speakerContributions.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Meeting Transitions Card
const MeetingTransitionsCard = ({ meetingId }: { meetingId: string }) => {
  const { data: transitionData, isLoading } = useQuery<TransitionData>({
    queryKey: ['/api/reports/transitions', meetingId],
    enabled: !!meetingId,
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

  // Use test data if API data is not available
  const data = transitionData || {
    meeting_id: 1,
    meeting_title: "Sample Meeting",
    transitions: [
      {
        from_speaker: "Alice",
        to_speaker: "Bob",
        transition_smoothness: 1.0,
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
                </React.Fragment>
              ))}
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-sm font-medium",
                data.transitions[data.transitions.length - 1].sentiment === "Positive" 
                  ? "bg-green-100 text-green-800" 
                  : "bg-red-100 text-red-800"
              )}>
                {data.transitions[data.transitions.length - 1].to_speaker}
              </div>
            </div>
          </div>

          {/* Sentiment Summary */}
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
              {Math.round(
                (data.transitions.reduce((acc, t) => acc + t.transition_smoothness, 0) / 
                data.transitions.length) * 100
              )}%
            </div>
          </div>
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
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="drift" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="drift" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Drift Analysis
              </TabsTrigger>
              <TabsTrigger value="sentiment" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Sentiment Analysis
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="drift" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <TopicDriftCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>

            <TabsContent value="sentiment" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <MeetingTransitionsCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}