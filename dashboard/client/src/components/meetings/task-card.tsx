import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Task } from '@/types';
import { TaskItem } from './task-item';

interface TaskCardProps {
  tasks: Task[];
  isLoading?: boolean;
  onAddTask?: () => void;
  onTaskUpdate?: (taskId: number, updates: Partial<Task>) => void;
}

export function TaskCard({ 
  tasks, 
  isLoading = false, 
  onAddTask, 
  onTaskUpdate 
}: TaskCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Action Items</CardTitle>
        <Button 
          variant="ghost" 
          size="sm"
          className="text-primary hover:text-primary-dark text-sm flex items-center"
          onClick={onAddTask}
        >
          <span className="material-icons text-sm mr-1">add</span>
          New Task
        </Button>
      </CardHeader>
      <CardContent className="min-h-[200px]"> {/* Add min-height to prevent layout shifts */}
        {isLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, index) => (
              <div key={index} className="p-2 border border-gray-200 rounded flex items-start animate-pulse">
                <div className="mt-1 mr-2 h-4 w-4 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 w-1/3 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <span className="material-icons text-3xl mb-2">assignment</span>
            <p>No tasks assigned yet.</p>
            <p className="text-sm">Tasks will appear here as they are created.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onUpdate={(updates) => onTaskUpdate?.(task.id, updates)} 
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
