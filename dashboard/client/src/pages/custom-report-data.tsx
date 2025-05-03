import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define interfaces for data types
interface SentimentInputData {
  overallSentiment: number;
  sentimentOverTime: Array<{ time: string; score: number }>;
  topPositiveTopics: string[];
  topNegativeTopics: string[];
}

interface TopicInputData {
  topicDriftScore: number;
  plannedTopics: string[];
  topicCoverage: Array<{ name: string; planned: number; actual: number; drift: number }>;
  unexpectedTopics: string[];
}

interface ToneInputData {
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
    };
  }>;
}

interface ParticipantInputData {
  participantCount: number;
  speakingDistribution: Array<{ name: string; speakingTime: number }>;
  interactionStats: Array<{ name: string; count: number }>;
  engagement: {
    high: string[];
    medium: string[];
    low: string[];
  };
}

export default function CustomReportDataPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sentiment");
  const [selectedMeeting, setSelectedMeeting] = useState("");
  
  // Get meetings
  const { data: meetings, isLoading: isLoadingMeetings } = useQuery({
    queryKey: ['/api/meetings'],
  });

  // Form states
  const [sentimentData, setSentimentData] = useState<string>("");
  const [topicData, setTopicData] = useState<string>("");
  const [toneData, setToneData] = useState<string>("");
  const [participantData, setParticipantData] = useState<string>("");

  // Mutations
  const sentimentMutation = useMutation({
    mutationFn: async (data: SentimentInputData) => {
      return await apiRequest("POST", `/api/reports/custom/sentiment/${selectedMeeting}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sentiment data has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/sentiment', selectedMeeting] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update sentiment data: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const topicMutation = useMutation({
    mutationFn: async (data: TopicInputData) => {
      return await apiRequest("POST", `/api/reports/custom/topics/${selectedMeeting}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Topic data has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/topics', selectedMeeting] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update topic data: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const toneMutation = useMutation({
    mutationFn: async (data: ToneInputData) => {
      return await apiRequest("POST", `/api/reports/custom/tone/${selectedMeeting}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tone data has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/tone', selectedMeeting] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update tone data: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const participantMutation = useMutation({
    mutationFn: async (data: ParticipantInputData) => {
      return await apiRequest("POST", `/api/reports/custom/participants/${selectedMeeting}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Participant data has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/reports/participants', selectedMeeting] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update participant data: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const handleSentimentSubmit = () => {
    try {
      const data = JSON.parse(sentimentData) as SentimentInputData;
      sentimentMutation.mutate(data);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data.",
        variant: "destructive",
      });
    }
  };

  const handleTopicSubmit = () => {
    try {
      const data = JSON.parse(topicData) as TopicInputData;
      topicMutation.mutate(data);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data.",
        variant: "destructive",
      });
    }
  };

  const handleToneSubmit = () => {
    try {
      const data = JSON.parse(toneData) as ToneInputData;
      toneMutation.mutate(data);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data.",
        variant: "destructive",
      });
    }
  };

  const handleParticipantSubmit = () => {
    try {
      const data = JSON.parse(participantData) as ParticipantInputData;
      participantMutation.mutate(data);
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON data.",
        variant: "destructive",
      });
    }
  };

  const handleViewReports = () => {
    if (selectedMeeting) {
      setLocation(`/reports/${selectedMeeting}`);
    }
  };

  // Sample data templates
  const sentimentTemplate = `{
  "overallSentiment": 0.75,
  "sentimentOverTime": [
    { "time": "0:00", "score": 0.6 },
    { "time": "5:00", "score": 0.7 },
    { "time": "10:00", "score": 0.8 },
    { "time": "15:00", "score": 0.7 },
    { "time": "20:00", "score": 0.9 }
  ],
  "topPositiveTopics": [
    "Product features",
    "Customer feedback",
    "Team collaboration"
  ],
  "topNegativeTopics": [
    "Budget constraints",
    "Timeline pressure"
  ]
}`;

  const topicTemplate = `{
  "topicDriftScore": 0.3,
  "plannedTopics": [
    "Project Status",
    "Budget Review",
    "Timeline Discussion", 
    "Resource Allocation"
  ],
  "topicCoverage": [
    { "name": "Project Status", "planned": 30, "actual": 25, "drift": 0.17 },
    { "name": "Budget Review", "planned": 20, "actual": 15, "drift": 0.25 },
    { "name": "Timeline Discussion", "planned": 25, "actual": 20, "drift": 0.2 },
    { "name": "Resource Allocation", "planned": 25, "actual": 20, "drift": 0.2 },
    { "name": "Off-topic", "planned": 0, "actual": 20, "drift": 1.0 }
  ],
  "unexpectedTopics": [
    "Office Layout",
    "Company Event Planning",
    "Technical Issues"
  ]
}`;

  const toneTemplate = `{
  "dominantTones": [
    "Analytical",
    "Confident",
    "Formal"
  ],
  "toneBreakdown": [
    { "tone": "Analytical", "percentage": 40 },
    { "tone": "Confident", "percentage": 30 },
    { "tone": "Formal", "percentage": 15 },
    { "tone": "Tentative", "percentage": 10 },
    { "tone": "Casual", "percentage": 5 }
  ],
  "participants": [
    {
      "name": "John",
      "tones": {
        "analytical": 60,
        "confident": 20,
        "tentative": 5,
        "casual": 5,
        "formal": 10
      }
    },
    {
      "name": "Sarah",
      "tones": {
        "analytical": 30,
        "confident": 40,
        "tentative": 10,
        "casual": 5,
        "formal": 15
      }
    },
    {
      "name": "Michael",
      "tones": {
        "analytical": 20,
        "confident": 30,
        "tentative": 20,
        "casual": 10,
        "formal": 20
      }
    }
  ]
}`;

  const participantTemplate = `{
  "participantCount": 4,
  "speakingDistribution": [
    { "name": "John", "speakingTime": 35 },
    { "name": "Sarah", "speakingTime": 25 },
    { "name": "Michael", "speakingTime": 30 },
    { "name": "Emily", "speakingTime": 10 }
  ],
  "interactionStats": [
    { "name": "Questions Asked", "count": 12 },
    { "name": "Interruptions", "count": 8 },
    { "name": "Cross-talk Instances", "count": 5 },
    { "name": "Silent Periods", "count": 3 }
  ],
  "engagement": {
    "high": ["John", "Sarah"],
    "medium": ["Michael"],
    "low": ["Emily"]
  }
}`;

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Custom Report Data</h1>
        <div className="flex items-center gap-4">
          <div className="w-72">
            {isLoadingMeetings ? (
              <div className="flex h-10 items-center justify-center rounded-md border">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedMeeting} onValueChange={setSelectedMeeting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a meeting" />
                </SelectTrigger>
                <SelectContent>
                  {meetings && Array.isArray(meetings) ? 
                    meetings
                      .filter(meeting => meeting.status === 'completed')
                      .map((meeting) => (
                        <SelectItem key={meeting.id} value={meeting.id.toString()}>
                          {meeting.title}
                        </SelectItem>
                      ))
                    : null}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button 
            onClick={handleViewReports} 
            disabled={!selectedMeeting}
          >
            View Reports
          </Button>
        </div>
      </div>

      {!selectedMeeting ? (
        <Card>
          <CardHeader>
            <CardTitle>Select a Meeting</CardTitle>
            <CardDescription>Please select a completed meeting to add custom report data</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sentiment">Sentiment Data</TabsTrigger>
            <TabsTrigger value="topics">Topic Data</TabsTrigger>
            <TabsTrigger value="tone">Tone Data</TabsTrigger>
            <TabsTrigger value="participants">Participant Data</TabsTrigger>
          </TabsList>

          <TabsContent value="sentiment">
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis Data</CardTitle>
                <CardDescription>
                  Enter custom sentiment data in JSON format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sentimentData" className="col-span-4">
                      JSON Data
                    </Label>
                    <Textarea
                      id="sentimentData"
                      className="col-span-4 h-[400px] font-mono"
                      placeholder='{"overallSentiment": 0.7, ...}'
                      value={sentimentData}
                      onChange={(e) => setSentimentData(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setSentimentData(sentimentTemplate)}>
                    Load Template
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={() => setSentimentData("")}>
                  Clear
                </Button>
                <Button 
                  onClick={handleSentimentSubmit}
                  disabled={sentimentMutation.isPending}
                >
                  {sentimentMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Sentiment Data
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="topics">
            <Card>
              <CardHeader>
                <CardTitle>Topic Drift Data</CardTitle>
                <CardDescription>
                  Enter custom topic drift data in JSON format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="topicData" className="col-span-4">
                      JSON Data
                    </Label>
                    <Textarea
                      id="topicData"
                      className="col-span-4 h-[400px] font-mono"
                      placeholder='{"topicDriftScore": 0.3, ...}'
                      value={topicData}
                      onChange={(e) => setTopicData(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setTopicData(topicTemplate)}>
                    Load Template
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={() => setTopicData("")}>
                  Clear
                </Button>
                <Button 
                  onClick={handleTopicSubmit}
                  disabled={topicMutation.isPending}
                >
                  {topicMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Topic Data
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="tone">
            <Card>
              <CardHeader>
                <CardTitle>Communication Tone Data</CardTitle>
                <CardDescription>
                  Enter custom tone analysis data in JSON format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="toneData" className="col-span-4">
                      JSON Data
                    </Label>
                    <Textarea
                      id="toneData"
                      className="col-span-4 h-[400px] font-mono"
                      placeholder='{"dominantTones": ["Analytical", ...], ...}'
                      value={toneData}
                      onChange={(e) => setToneData(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setToneData(toneTemplate)}>
                    Load Template
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={() => setToneData("")}>
                  Clear
                </Button>
                <Button 
                  onClick={handleToneSubmit}
                  disabled={toneMutation.isPending}
                >
                  {toneMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Tone Data
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="participants">
            <Card>
              <CardHeader>
                <CardTitle>Participant Analysis Data</CardTitle>
                <CardDescription>
                  Enter custom participant data in JSON format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="participantData" className="col-span-4">
                      JSON Data
                    </Label>
                    <Textarea
                      id="participantData"
                      className="col-span-4 h-[400px] font-mono"
                      placeholder='{"participantCount": 4, ...}'
                      value={participantData}
                      onChange={(e) => setParticipantData(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setParticipantData(participantTemplate)}>
                    Load Template
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-between">
                <Button variant="outline" onClick={() => setParticipantData("")}>
                  Clear
                </Button>
                <Button 
                  onClick={handleParticipantSubmit}
                  disabled={participantMutation.isPending}
                >
                  {participantMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Participant Data
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}