import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Task } from '@/types';
import { TaskItem } from '@/components/meetings/task-item';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export default function Tasks() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [meetingFilter, setMeetingFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('pending');
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createActionItemOpen, setCreateActionItemOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Use the current user ID as the default assignee filter instead of 'all'
  const [assigneeFilter, setAssigneeFilter] = useState(user ? String(user.id) : 'all');

  // Fetch tasks with filters
  const { data: tasks, isLoading, refetch } = useQuery<Task[]>({
    queryKey: [
      '/api/tasks',
      { 
        completed: activeTab === 'completed', 
        assigneeId: assigneeFilter !== 'all' ? assigneeFilter : undefined,
        meetingId: meetingFilter !== 'all' ? meetingFilter : undefined
      }
    ],
    // Add refetch on tab change
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  // Effect to refetch when filters change
  useEffect(() => {
    refetch();
  }, [activeTab, assigneeFilter, meetingFilter, refetch]);
  
  // Update assigneeFilter when user data becomes available
  useEffect(() => {
    if (user) {
      setAssigneeFilter(String(user.id));
    }
  }, [user]);

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
    onSuccess: (updatedTask) => {
      // If the task completion status changed, we need to invalidate the queries for both tabs
      const isCompletionUpdate = 'completed' in updatedTask;
      
      if (isCompletionUpdate) {
        // Invalidate all task queries
        queryClient.invalidateQueries({ 
          queryKey: ['/api/tasks'] 
        });
        
        // Also invalidate any meeting-specific task lists
        queryClient.invalidateQueries({
          queryKey: [`/api/meetings/${updatedTask.meetingId}/tasks`]
        });
        
        toast({
          title: updatedTask.completed ? "Task completed" : "Task reopened",
          description: updatedTask.completed 
            ? "The task has been marked as completed." 
            : "The task has been moved back to pending tasks.",
        });
      } else {
        // For other updates, just invalidate the current query
        queryClient.invalidateQueries({ 
          queryKey: [
            '/api/tasks', 
            { 
              completed: activeTab === 'completed', 
              assigneeId: assigneeFilter !== 'all' ? assigneeFilter : undefined,
              meetingId: meetingFilter !== 'all' ? meetingFilter : undefined
            }
          ]
        });
        
        toast({
          title: "Task updated",
          description: "The task has been updated successfully.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive"
      });
      console.error("Failed to update task:", error);
    }
  });

  // Handle task updates
  const handleTaskUpdate = (taskId: number, updates: Partial<Task>) => {
    taskUpdateMutation.mutate({ taskId, updates });
  };

  return (
    <>
      <Header 
        title={assigneeFilter === 'all' ? 'All Tasks' : 
              user && assigneeFilter === String(user.id) ? 'My Tasks' : 'Task Management'} 
        setIsMobileOpen={setIsMobileOpen} 
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {/* Header with filters */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
            <h1 className="text-2xl font-bold mb-4 md:mb-0">
              {assigneeFilter === 'all' ? 'All Tasks' : 
               user && assigneeFilter === String(user.id) ? 'My Tasks' : 'Task Management'}
            </h1>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select
                value={assigneeFilter}
                onValueChange={setAssigneeFilter}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {user && (
                    <SelectItem value={String(user.id)}>My Tasks</SelectItem>
                  )}
                  <SelectItem value="1">John Doe</SelectItem>
                  <SelectItem value="2">Sarah Lee</SelectItem>
                  <SelectItem value="3">Mike Thompson</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={meetingFilter}
                onValueChange={setMeetingFilter}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Filter by meeting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Meetings</SelectItem>
                  <SelectItem value="1">Product Team Sync</SelectItem>
                  <SelectItem value="2">Client Presentation</SelectItem>
                  <SelectItem value="3">Sprint Planning</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Button 
                  className="flex items-center" 
                  onClick={() => setCreateTaskOpen(true)}
                >
                  <span className="material-icons text-sm mr-1">add</span>
                  New Task
                </Button>
                <Button 
                  variant="outline" 
                  className="flex items-center" 
                  onClick={() => setCreateActionItemOpen(true)}
                >
                  <span className="material-icons text-sm mr-1">assignment</span>
                  Action Item
                </Button>
              </div>
            </div>
          </div>

          {/* Tasks Card with Tabs */}
          <Card>
            <CardHeader className="pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>
                  {assigneeFilter === 'all' ? 'All Tasks' : 
                   user && assigneeFilter === String(user.id) ? 'My Tasks' : 'Filtered Tasks'}
                </CardTitle>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 sm:mt-0">
                  <TabsList>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  {Array(5).fill(0).map((_, index) => (
                    <div key={index} className="h-16 bg-gray-200 rounded-md"></div>
                  ))}
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="material-icons text-4xl mb-2">assignment_turned_in</span>
                  <p>No {activeTab} tasks found.</p>
                  <p className="text-sm mt-2">
                    {activeTab === 'pending'
                      ? assigneeFilter !== 'all' && user && assigneeFilter === String(user.id)
                        ? "You don't have any pending tasks. Great job!"
                        : "No pending tasks found with the current filters."
                      : assigneeFilter !== 'all' && user && assigneeFilter === String(user.id)
                        ? "You haven't completed any tasks yet."
                        : "No completed tasks found with the current filters."
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <TaskItem 
                      key={task.id} 
                      task={task} 
                      onUpdate={(updates) => handleTaskUpdate(task.id, updates)} 
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Create Task Dialog */}
      <CreateTaskDialog 
        open={createTaskOpen} 
        onOpenChange={setCreateTaskOpen} 
        isActionItem={false}
      />
      
      {/* Create Action Item Dialog */}
      <CreateTaskDialog 
        open={createActionItemOpen} 
        onOpenChange={setCreateActionItemOpen} 
        isActionItem={true}
      />
    </>
  );
}
