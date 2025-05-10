import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { TranscriptionPanel } from '@/components/meetings/transcription-panel';
import { SummaryCard } from '@/components/meetings/summary-card';
import { TaskCard } from '@/components/meetings/task-card';
import { MeetingInfo } from '@/components/meetings/meeting-info';
import { ChatInterface } from '@/components/chat/chat-interface';
import { Meeting, TranscriptionEntry, Task, ChatMessage, MeetingDetails } from '@/types';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function LiveMeeting() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get meeting ID from URL parameters if available
  const [matchTranscript, paramsTranscript] = useRoute<{ id: string }>('/meetings/:id/transcript');
  const [matchSummary, paramsSummary] = useRoute<{ id: string }>('/meetings/:id/summary');
  const [matchTasks, paramsTasks] = useRoute<{ id: string }>('/meetings/:id/tasks');
  
  // Extract the meeting ID from parameters or default to 1
  const meetingId = parseInt(
    paramsTranscript?.id || paramsSummary?.id || paramsTasks?.id || '1'
  );

  // Fetch current meeting data with stability measures
  const { data: meeting, isLoading: isLoadingMeeting } = useQuery({
    queryKey: [`/api/meetings/${meetingId}`],
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Fetch transcription with stable results
  const { data: transcription = [], isLoading: isLoadingTranscription } = useQuery<TranscriptionEntry[]>({
    queryKey: [`/api/meetings/${meetingId}/transcription`],
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: false,
  });

  // Fetch tasks with stable results
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: [`/api/meetings/${meetingId}/tasks`],
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  // Fetch chat messages with stable results
  const { data: chatMessages = [], isLoading: isLoadingChat } = useQuery<ChatMessage[]>({
    queryKey: [`/api/meetings/${meetingId}/chat`],
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });
  
  // Add a mutation to fetch summary if needed
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/meetings/${meetingId}/summary`);
      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Update the meeting data with the new summary
      queryClient.setQueryData(
        [`/api/meetings/${meetingId}`],
        (old: MeetingDetails | undefined) => {
          if (!old) return old;
          return { ...old, summary: data.content };
        }
      );
      
      // Show success toast
      toast({
        title: "Summary Generated",
        description: "The AI meeting summary has been created successfully.",
      });
    },
    onError: (error) => {
      console.error('Error generating summary:', error);
      
      // Show error toast
      toast({
        title: "Summary Generation Failed",
        description: "We couldn't generate a meeting summary. Please try again later.",
        variant: "destructive"
      });
    }
  });
  
  // Add a mutation to generate tasks from meeting transcript
  const generateTasksMutation = useMutation({
    mutationFn: async () => {
      console.log(`Sending task extraction request for meeting ${meetingId}`);
      
      // Use the dedicated API endpoint for task extraction
      const response = await fetch(`/api/meetings/${meetingId}/extract-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Task extraction failed with status:", response.status, errorText);
        throw new Error(`Failed to generate tasks: ${response.status} ${errorText}`);
      }
      
      // After tasks are generated, fetch the updated task list
      return await queryClient.fetchQuery<Task[]>({
        queryKey: [`/api/meetings/${meetingId}/tasks`],
      });
    },
    onSuccess: (data: Task[]) => {
      // Show success toast
      if (data && data.length > 0) {
        toast({
          title: "Tasks Extracted",
          description: `Successfully identified ${data.length} action items from the meeting.`,
        });
      } else {
        toast({
          title: "No Tasks Found",
          description: "No action items were identified in the meeting transcript.",
        });
      }
    },
    onError: (error) => {
      console.error('Error extracting tasks:', error);
      
      // Show error toast
      toast({
        title: "Task Extraction Failed",
        description: "We couldn't extract tasks from the meeting transcript. Please try again later.",
        variant: "destructive"
      });
    }
  });
  
  // Effect to check and generate summary if needed once per page load
  useEffect(() => {
    // Store attempted state in session storage to persist across refreshes
    const summaryGenerationAttemptKey = `summary-gen-attempted-${meetingId}`;
    const alreadyAttempted = sessionStorage.getItem(summaryGenerationAttemptKey) === 'true';
    
    // Only generate summary if meeting is loaded, has no summary, and has transcriptions
    if (meeting && 
        !meeting.summary && 
        transcription.length > 0 && 
        !generateSummaryMutation.isPending && 
        !alreadyAttempted) {
      
      console.log('Auto-generating summary for imported meeting - one-time attempt');
      sessionStorage.setItem(summaryGenerationAttemptKey, 'true');
      
      // Show a toast to let the user know we're generating a summary
      toast({
        title: "Generating AI Summary",
        description: "Please wait while we analyze the meeting transcript...",
      });
      
      generateSummaryMutation.mutate();
    }
  }, [meetingId, meeting, transcription, generateSummaryMutation, toast]);
  
  // Effect to check and generate tasks if needed once per page load
  useEffect(() => {
    // Store attempted state in session storage to persist across refreshes
    const taskGenerationAttemptKey = `task-gen-attempted-${meetingId}`;
    const alreadyAttempted = sessionStorage.getItem(taskGenerationAttemptKey) === 'true';
    
    // Check if we have transcripts but no tasks and haven't tried yet
    const shouldGenerateTasks = 
      meeting && 
      transcription.length > 0 && 
      tasks.length === 0 && 
      !generateTasksMutation.isPending && 
      !alreadyAttempted;
    
    if (shouldGenerateTasks) {
      console.log('Auto-generating tasks for meeting - one-time attempt');
      sessionStorage.setItem(taskGenerationAttemptKey, 'true');
      
      // Small delay to let summary finish first if it was also triggered
      const timer = setTimeout(() => {
        // Show a toast to let the user know we're extracting tasks
        toast({
          title: "Extracting Action Items",
          description: "Please wait while we identify tasks from the meeting transcript...",
        });
        
        generateTasksMutation.mutate();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [meetingId, meeting, transcription, tasks, generateTasksMutation]);
  
  // Handle WebSocket messages
  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'transcription':
        // Update transcription data
        queryClient.setQueryData(
          [`/api/meetings/${meetingId}/transcription`],
          (old: TranscriptionEntry[] = []) => [...old, message.data.entry]
        );
        break;
      case 'summary':
        // Update meeting summary
        queryClient.setQueryData(
          [`/api/meetings/${meetingId}`],
          (old: Meeting) => ({ ...old, summary: message.data.summary })
        );
        break;
      case 'task':
        // Handle new task
        queryClient.setQueryData(
          [`/api/meetings/${meetingId}/tasks`],
          (old: Task[] = []) => [...old, message.data.task]
        );
        break;
      case 'task_update':
        // Handle task updates, like completion status changes
        queryClient.setQueryData(
          [`/api/meetings/${meetingId}/tasks`],
          (old: Task[] = []) => {
            // Find and replace the updated task in the array
            const updatedTask = message.data.task;
            return old.map(task => 
              task.id === updatedTask.id ? updatedTask : task
            );
          }
        );
        // Also update the general tasks list if it exists in cache
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        break;
      case 'chat':
        // Update chat messages
        queryClient.setQueryData(
          [`/api/meetings/${meetingId}/chat`],
          (old: ChatMessage[] = []) => [...old, message.data.message]
        );
        break;
      case 'meeting_update':
        // Update meeting data
        queryClient.setQueryData(
          [`/api/meetings/${meetingId}`],
          message.data.meeting
        );
        break;
    }
  };

  // Check if meeting is active before setting up WebSocket connection
  const isMeetingActive = meeting?.status === 'live' || meeting?.status === 'scheduled';
  
  // Only attempt WebSocket connection if the meeting is active
  const { isConnected } = useWebSocket(
    isMeetingActive ? meetingId : undefined, // Only pass meetingId if meeting is active
    {
      onMessage: handleWebSocketMessage,
      // Don't show connection notifications - we'll handle connection status with a UI indicator
      onOpen: () => {},
      // Don't show disconnection notifications
      onClose: () => {},
      // Only enable auto-reconnect for active meetings
      autoReconnect: isMeetingActive,
      maxReconnectAttempts: 3
    }
  );

  // Task update mutation
  const taskUpdateMutation = useMutation({
    mutationFn: async ({ 
      taskId, 
      updates 
    }: { 
      taskId: number; 
      updates: Partial<Task>; 
    }) => {
      const response = await apiRequest(
        'PATCH', 
        `/api/tasks/${taskId}`,
        updates
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${meetingId}/tasks`] });
    },
  });

  // Chat message mutation
  const sendChatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest(
        'POST',
        `/api/meetings/${meetingId}/chat`,
        { content: message }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/meetings/${meetingId}/chat`] });
    },
  });

  // Handle task updates
  const handleTaskUpdate = (taskId: number, updates: Partial<Task>) => {
    taskUpdateMutation.mutate({ taskId, updates });
  };

  // Handle sending chat messages
  const handleSendMessage = (message: string) => {
    sendChatMutation.mutate(message);
  };

  // Determine the correct page title based on the current route
  const getPageTitle = () => {
    if (matchTranscript) {
      return "Meeting Transcript";
    } else if (matchSummary) {
      return "Meeting Summary";
    } else if (matchTasks) {
      return "Meeting Tasks";
    } else {
      return "Live Meeting";
    }
  };

  return (
    <>
      <Header title={getPageTitle()} setIsMobileOpen={setIsMobileOpen} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        {/* Meeting Status & Info */}
        <div className="bg-white shadow rounded-lg mb-6 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center">
                {meeting?.status === 'live' ? (
                  <span 
                    className={`h-3 w-3 rounded-full mr-2 ${
                      isConnected 
                        ? 'bg-success animate-pulse' 
                        : 'bg-orange-500'
                    }`} 
                    title={isConnected ? "Connected to live meeting" : "Connection lost"}
                  ></span>
                ) : (
                  <span 
                    className="h-3 w-3 bg-gray-400 rounded-full mr-2"
                    title={meeting?.status === 'completed' ? "Meeting completed" : "Meeting scheduled"}
                  ></span>
                )}
                <h2 className="text-lg font-semibold">
                  {isLoadingMeeting ? "Loading..." : meeting?.title}
                </h2>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                {isLoadingMeeting
                  ? "Loading meeting info..."
                  : `Started ${meeting?.startTime ? new Date(meeting.startTime).toLocaleTimeString() : ""} • ${
                      meeting?.participants?.length || 0
                    } participants`}
              </p>
            </div>
            <div className="flex space-x-2 mt-3 md:mt-0">
              <Button size="sm" className="flex items-center">
                <span className="material-icons text-sm mr-1">add</span>
                Invite
              </Button>
              <Button variant="outline" size="sm" className="flex items-center">
                <span className="material-icons text-sm mr-1">schedule</span>
                Schedule
              </Button>
              <Button variant="destructive" size="icon" className="p-1.5">
                <span className="material-icons text-sm">call_end</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Transcription and Chat Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          {/* Left Side (Transcription) */}
          <div className="lg:col-span-5">
            <TranscriptionPanel
              entries={transcription || []}
              isLoading={isLoadingTranscription}
              meetingStatus={meeting?.status}
            />

            {/* Meeting Summary & Tasks */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <SummaryCard
                summary={meeting?.summary || ''}
                isLoading={isLoadingMeeting}
                onEditClick={() => {
                  toast({
                    title: "Edit Summary",
                    description: "Editing summary functionality coming soon!",
                  });
                }}
              />

              <TaskCard
                tasks={tasks || []}
                isLoading={isLoadingTasks}
                onTaskUpdate={handleTaskUpdate}
                onAddTask={() => {
                  toast({
                    title: "Add Task",
                    description: "Adding task functionality coming soon!",
                  });
                }}
              />
            </div>
          </div>

          {/* Right Side (Chat & Meeting Info) */}
          <div className="lg:col-span-3">
            <ChatInterface
              meetingId={meetingId}
              messages={chatMessages || []}
              isLoading={isLoadingChat}
              onMessageSend={handleSendMessage}
            />

            <div className="mt-6">
              {meeting && <MeetingInfo meeting={meeting} />}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
