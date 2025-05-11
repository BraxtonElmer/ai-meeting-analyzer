import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { TranscriptionPanel } from '@/components/meetings/transcription-panel';
import { MeetingInfo } from '@/components/meetings/meeting-info';
import { Meeting, TranscriptionEntry, User } from '@/types';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';

interface MeetingData {
  id: number;
  status: 'live' | 'scheduled' | 'completed';
  title: string;
  startTime: string;
  participants: User[];
  duration: string;
  date: string;
}

// Dummy participant data
const dummyParticipants: User[] = [
  {
    id: 1,
    username: 'john.doe',
    fullName: 'John Doe',
    email: 'john.doe@company.com',
    avatarInitials: 'JD',
    avatarColor: '#4F46E5'
  },
  {
    id: 2,
    username: 'jane.smith',
    fullName: 'Jane Smith',
    email: 'jane.smith@company.com',
    avatarInitials: 'JS',
    avatarColor: '#10B981'
  },
  {
    id: 3,
    username: 'mike.wilson',
    fullName: 'Mike Wilson',
    email: 'mike.wilson@company.com',
    avatarInitials: 'MW',
    avatarColor: '#F59E0B'
  },
  {
    id: 4,
    username: 'sarah.johnson',
    fullName: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    avatarInitials: 'SJ',
    avatarColor: '#EF4444'
  },
  {
    id: 5,
    username: 'david.brown',
    fullName: 'David Brown',
    email: 'david.brown@company.com',
    avatarInitials: 'DB',
    avatarColor: '#8B5CF6'
  }
];

// Participant card component
const ParticipantCard = ({ participant }: { participant: User }) => (
  <div className="flex items-center space-x-3 p-3 bg-white rounded-lg shadow-sm">
    <div className="flex-shrink-0">
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${participant.avatarColor}20` }}
      >
        <span 
          className="font-medium"
          style={{ color: participant.avatarColor }}
        >
          {participant.avatarInitials}
        </span>
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">
        {participant.fullName}
      </p>
      <p className="text-sm text-gray-500 truncate">
        {participant.email}
      </p>
    </div>
  </div>
);

export default function LiveMeeting() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Get meeting ID from URL parameters if available
  const [matchTranscript, paramsTranscript] = useRoute<{ id: string }>('/meetings/:id/transcript');
  
  // Extract the meeting ID from parameters or default to 1
  const meetingId = parseInt(paramsTranscript?.id || '1');

  // Fetch current meeting data with stability measures
  const { data: meeting, isLoading: isLoadingMeeting } = useQuery<MeetingData>({
    queryKey: [`/api/meetings/${meetingId}`],
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
    // Add dummy data for demonstration
    initialData: {
      id: meetingId,
      status: 'live',
      title: 'Project Kickoff Meeting',
      startTime: new Date().toISOString(),
      participants: dummyParticipants,
      duration: '60',
      date: new Date().toISOString()
    }
  });

  // Fetch transcription with stable results
  const { data: transcription = [], isLoading: isLoadingTranscription } = useQuery<TranscriptionEntry[]>({
    queryKey: [`/api/meetings/${meetingId}/transcription`],
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: false,
  });

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
    isMeetingActive ? meetingId : undefined,
    {
      onMessage: handleWebSocketMessage,
      onOpen: () => {},
      onClose: () => {},
      autoReconnect: isMeetingActive,
      maxReconnectAttempts: 3
    }
  );

  // Determine the correct page title based on the current route
  const getPageTitle = () => {
    if (matchTranscript) {
      return "Meeting Transcript";
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          {/* Left Side (Transcription) */}
          <div className="lg:col-span-5">
            <TranscriptionPanel
              entries={transcription || []}
              isLoading={isLoadingTranscription}
              meetingStatus={meeting?.status}
            />
          </div>

          {/* Right Side (Meeting Info & Participants) */}
          <div className="lg:col-span-3 space-y-6">
            {meeting && <MeetingInfo meeting={meeting} />}
            
            {/* Participants Section */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Participants</h3>
                <span className="text-sm text-gray-500">
                  {meeting?.participants?.length || 0} people
                </span>
              </div>
              
              <div className="space-y-3">
                {meeting?.participants?.map((participant) => (
                  <ParticipantCard key={participant.id} participant={participant} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
