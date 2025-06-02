import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Meeting, Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

export default function Dashboard() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { data: upcomingMeetings, isLoading: isLoadingMeetings } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings?status=scheduled'],
  });

  const { data: recentMeetings, isLoading: isLoadingRecent } = useQuery<Meeting[]>({
    queryKey: ['/api/meetings?status=completed&limit=5'],
  });

  const { data: pendingTasks, isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['/api/tasks?completed=false'],
  });

  return (
    <>
      <Header title="Dashboard" setIsMobileOpen={setIsMobileOpen} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              title="Active Meetings"
              value="2"
              icon="record_voice_over"
              color="bg-blue-100 text-blue-800"
            />
            <StatCard
              title="Completed Today"
              value="5"
              icon="check_circle"
              color="bg-green-100 text-green-800"
            />
            <StatCard
              title="Pending Tasks"
              value={pendingTasks?.length.toString() || "0"}
              icon="assignment"
              color="bg-amber-100 text-amber-800"
            />
          </div>

          {/* Upcoming Meetings */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Upcoming Meetings</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/meetings/schedule">
                    <span className="material-icons text-sm mr-1">add</span>
                    Schedule
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingMeetings ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : !upcomingMeetings || upcomingMeetings.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <span className="material-icons text-3xl mb-2">event_busy</span>
                  <p>No upcoming meetings scheduled.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingMeetings.map((meeting) => (
                    <MeetingListItem key={meeting.id} meeting={meeting} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Meetings */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Recent Meetings</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingRecent ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : !recentMeetings || recentMeetings.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <span className="material-icons text-3xl mb-2">history</span>
                    <p>No recent meetings found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentMeetings.map((meeting) => (
                      <MeetingListItem key={meeting.id} meeting={meeting} isRecent />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Tasks */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Pending Tasks</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/tasks">View All</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingTasks ? (
                  <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : !pendingTasks || pendingTasks.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <span className="material-icons text-3xl mb-2">task_alt</span>
                    <p>No pending tasks.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTasks.slice(0, 5).map((task) => (
                      <TaskListItem key={task.id} task={task} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center space-x-4">
        <div className={`p-3 rounded-full ${color}`}>
          <span className="material-icons">{icon}</span>
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface MeetingListItemProps {
  meeting: Meeting;
  isRecent?: boolean;
}

function MeetingListItem({ meeting, isRecent = false }: MeetingListItemProps) {
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (timeString: string) => {
    return new Date(timeString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-3 border rounded-md hover:bg-gray-50 transition-colors">
      <div className="flex justify-between">
        <h3 className="font-medium truncate">{meeting.title}</h3>
        <div className="flex items-center">
          {meeting.status === 'live' && (
            <span className="h-2 w-2 bg-success rounded-full mr-1 animate-pulse"></span>
          )}
          <span className="text-sm text-gray-500">
            {isRecent ? formatDate(meeting.startTime) : formatTime(meeting.startTime)}
          </span>
        </div>
      </div>
      <div className="flex items-center mt-2 text-sm text-gray-500">
        <span className="material-icons text-sm mr-1">
          {isRecent ? 'history' : 'schedule'}
        </span>
        <span>
          {meeting.participants.length} participants
          {meeting.duration && ` • ${meeting.duration}`}
        </span>
      </div>
    </div>
  );
}

interface TaskListItemProps {
  task: Task;
}

function TaskListItem({ task }: TaskListItemProps) {
  const { user } = useAuth();
  
  return (
    <div className="p-3 border rounded-md hover:bg-gray-50 transition-colors">
      <div className="flex items-start">
        <span className="material-icons text-sm text-gray-400 mt-1 mr-2">assignment</span>
        <div className="flex-1">
          <p className="font-medium">{task.title}</p>
          <div className="flex items-center mt-1 text-sm">
            {task.assignee && (
              <span className={`bg-${task.assignee.avatarColor} text-xs py-0.5 px-2 rounded-full mr-2`}>
                {user && task.assignee.id === user.id 
                  ? "Me" 
                  : task.assignee.fullName.split(' ')[0]
                }
              </span>
            )}
            {task.dueDate && (
              <span className="text-xs text-gray-500">
                Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
