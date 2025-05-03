import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";

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

  // Fallback data if the API call fails
  const data = sentimentData || {
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

  // Color based on sentiment score
  const getSentimentColor = (score: number) => {
    if (score >= 0.7) return 'text-green-500';
    if (score >= 0.4) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Data for sentiment chart
  const chartData = data.sentimentOverTime;

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

        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 1]} />
              <Tooltip 
                formatter={(value: number) => [`${Math.round(value * 100)}%`, 'Sentiment']} 
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-2 text-sm font-medium text-green-500">Top Positive Topics</h4>
            <ul className="space-y-1">
              {data.topPositiveTopics.map((topic, i) => (
                <li key={i} className="text-sm">{topic}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-red-500">Top Negative Topics</h4>
            <ul className="space-y-1">
              {data.topNegativeTopics.map((topic, i) => (
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

  // Fallback data if the API call fails
  const data = topicData || {
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

  return (
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
            <div className="text-sm font-medium text-muted-foreground">Topic Drift Score</div>
            <div className={`text-3xl font-bold ${data.topicDriftScore > 0.5 ? 'text-red-500' : 'text-green-500'}`}>
              {Math.round(data.topicDriftScore * 100)}%
            </div>
          </div>
        </div>

        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              width={500}
              height={300}
              data={data.topicCoverage}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="planned" fill="#8884d8" name="Planned %" />
              <Bar dataKey="actual" fill="#82ca9d" name="Actual %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {data.unexpectedTopics.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 text-sm font-medium text-orange-500">Unexpected Topics Discussed</h4>
            <ul className="space-y-1">
              {data.unexpectedTopics.map((topic, i) => (
                <li key={i} className="text-sm">{topic}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Tone Analysis Card
const ToneAnalysisCard = ({ meetingId }: { meetingId: string }) => {
  const { data: toneData, isLoading } = useQuery<ToneData>({
    queryKey: ['/api/reports/tone', meetingId],
    enabled: !!meetingId,
  });

  if (isLoading) return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" /> Communication Tone
        </CardTitle>
        <CardDescription>Analysis of speaking tones during the meeting</CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  // Fallback data if the API call fails
  const data = toneData || {
    dominantTones: ['Analytical', 'Confident', 'Tentative'],
    toneBreakdown: [
      { tone: 'Analytical', percentage: 40 },
      { tone: 'Confident', percentage: 25 },
      { tone: 'Tentative', percentage: 15 },
      { tone: 'Casual', percentage: 10 },
      { tone: 'Formal', percentage: 10 },
    ],
    participants: [
      { name: 'John', tones: { analytical: 60, confident: 20, tentative: 10, casual: 5, formal: 5 } },
      { name: 'Sarah', tones: { analytical: 30, confident: 40, tentative: 10, casual: 10, formal: 10 } },
      { name: 'Alex', tones: { analytical: 20, confident: 15, tentative: 40, casual: 15, formal: 10 } },
    ],
  };

  // Colors for the pie chart
  const COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c'];

  return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" /> Communication Tone
        </CardTitle>
        <CardDescription>Analysis of speaking tones during the meeting</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium">Dominant Tones</h4>
          <div className="flex flex-wrap gap-2">
            {data.dominantTones.map((tone, i) => (
              <span key={i} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                {tone}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={data.toneBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="percentage"
                  nameKey="tone"
                >
                  {data.toneBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius={60} width={500} height={300} data={[
                { subject: 'Analytical', A: data.participants[0].tones.analytical, B: data.participants[1].tones.analytical, C: data.participants[2].tones.analytical },
                { subject: 'Confident', A: data.participants[0].tones.confident, B: data.participants[1].tones.confident, C: data.participants[2].tones.confident },
                { subject: 'Tentative', A: data.participants[0].tones.tentative, B: data.participants[1].tones.tentative, C: data.participants[2].tones.tentative },
                { subject: 'Casual', A: data.participants[0].tones.casual, B: data.participants[1].tones.casual, C: data.participants[2].tones.casual },
                { subject: 'Formal', A: data.participants[0].tones.formal, B: data.participants[1].tones.formal, C: data.participants[2].tones.formal },
              ]}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name={data.participants[0].name} dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                <Radar name={data.participants[1].name} dataKey="B" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                <Radar name={data.participants[2].name} dataKey="C" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Participant Analysis Card
const ParticipantAnalysisCard = ({ meetingId }: { meetingId: string }) => {
  const { data: participantData, isLoading } = useQuery<ParticipantData>({
    queryKey: ['/api/reports/participants', meetingId],
    enabled: !!meetingId,
  });

  if (isLoading) return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Participant Analysis
        </CardTitle>
        <CardDescription>Insights on participant engagement and interaction</CardDescription>
      </CardHeader>
      <CardContent className="h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );

  // Fallback data if the API call fails
  const data = participantData || {
    participantCount: 4,
    speakingDistribution: [
      { name: 'John', speakingTime: 42 },
      { name: 'Sarah', speakingTime: 28 },
      { name: 'Alex', speakingTime: 18 },
      { name: 'Emily', speakingTime: 12 },
    ],
    interactionStats: [
      { name: 'Questions Asked', count: 15 },
      { name: 'Interruptions', count: 8 },
      { name: 'Cross-talk Instances', count: 6 },
      { name: 'Silent Periods', count: 3 },
    ],
    engagement: {
      high: ['John', 'Sarah'],
      medium: ['Emily'],
      low: ['Alex'],
    },
  };

  // Colors for pie chart
  const COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d'];

  return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Participant Analysis
        </CardTitle>
        <CardDescription>Insights on participant engagement and interaction</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground">Participants</div>
            <div className="text-3xl font-bold">{data.participantCount}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="mb-2 text-sm font-medium">Speaking Distribution</h4>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={data.speakingDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="speakingTime"
                    nameKey="name"
                  >
                    {data.speakingDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-medium">Interaction Statistics</h4>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.interactionStats}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div>
            <h4 className="mb-2 text-sm font-medium text-green-500">High Engagement</h4>
            <ul className="space-y-1">
              {data.engagement.high.map((name, i) => (
                <li key={i} className="text-sm">{name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-yellow-500">Medium Engagement</h4>
            <ul className="space-y-1">
              {data.engagement.medium.map((name, i) => (
                <li key={i} className="text-sm">{name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-red-500">Low Engagement</h4>
            <ul className="space-y-1">
              {data.engagement.low.map((name, i) => (
                <li key={i} className="text-sm">{name}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Define interface for meeting data 
interface Meeting {
  id: number;
  title: string;
  status: string;
  [key: string]: any;
}

// Comprehensive Meeting Report page
export default function ReportsPage() {
  // Get the meetingId parameter from the URL
  const params = useParams();
  const meetingId = params?.id as string | undefined;
  const [, setLocation] = useLocation();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(meetingId || "");

  // Query to get all meetings
  const { data: meetings, isLoading: isLoadingMeetings } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings'],
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
          <Tabs defaultValue="overview" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="sentiment" className="flex items-center gap-2">
                <Dices className="h-4 w-4" /> Sentiment
              </TabsTrigger>
              <TabsTrigger value="topics" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Topics
              </TabsTrigger>
              <TabsTrigger value="participants" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Participants
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-6 flex-1 overflow-auto">
              <div className="grid gap-6 md:grid-cols-2 pb-6 max-w-full">
                <SentimentAnalysisCard meetingId={selectedMeetingId} />
                <TopicDriftCard meetingId={selectedMeetingId} />
                <ToneAnalysisCard meetingId={selectedMeetingId} />
                <ParticipantAnalysisCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>
            
            <TabsContent value="sentiment" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <SentimentAnalysisCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>
            
            <TabsContent value="topics" className="mt-6 flex-1 overflow-auto">
              <div className="pb-6 max-w-full">
                <TopicDriftCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>

            <TabsContent value="participants" className="mt-6 flex-1 overflow-auto">
              <div className="grid gap-6 md:grid-cols-2 pb-6 max-w-full">
                <ToneAnalysisCard meetingId={selectedMeetingId} />
                <ParticipantAnalysisCard meetingId={selectedMeetingId} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}