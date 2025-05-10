import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Meeting } from '@/types';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PastMeetings() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: meetings, isLoading } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings', { status: 'completed', search: searchTerm, date: dateFilter }],
  });

  const filteredMeetings = meetings || [];

  return (
    <>
      <Header title="Past Meetings" setIsMobileOpen={setIsMobileOpen} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {/* Search and Filter Bar */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="Search meetings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full"
                  />
                  <span className="material-icons absolute left-2 top-2 text-gray-400">
                    search
                  </span>
                </div>
                <div className="w-full md:w-48">
                  <Select
                    value={dateFilter}
                    onValueChange={setDateFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meetings List */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Past Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  {Array(5).fill(0).map((_, index) => (
                    <div key={index} className="h-24 bg-gray-200 rounded-md"></div>
                  ))}
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="material-icons text-4xl mb-2">history_toggle_off</span>
                  <p>No past meetings found.</p>
                  {searchTerm && (
                    <p className="mt-2">
                      Try adjusting your search or filters to find what you're looking for.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMeetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

interface MeetingCardProps {
  meeting: Meeting;
}

function MeetingCard({ meeting }: MeetingCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-medium text-lg">{meeting.title}</h3>
          <p className="text-gray-500 text-sm mt-1">
            {formatDate(meeting.startTime)} • {formatTime(meeting.startTime)}
            {meeting.endTime && ` - ${formatTime(meeting.endTime)}`}
          </p>
          <div className="mt-2">
            <div className="flex items-center mb-1">
              <span className="material-icons text-sm text-gray-500 mr-1">group</span>
              <span className="text-sm text-gray-500">{meeting.participants.length} participants</span>
            </div>
            <div className="text-sm text-gray-500">
              {meeting.participants.map(p => p.fullName).join(', ')}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/${meeting.id}/transcript`}>
              <span className="material-icons text-xs mr-1">description</span>
              Transcript
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/${meeting.id}/summary`}>
              <span className="material-icons text-xs mr-1">summarize</span>
              Summary
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/meetings/${meeting.id}/tasks`}>
              <span className="material-icons text-xs mr-1">assignment</span>
              Tasks
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
