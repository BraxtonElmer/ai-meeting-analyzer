import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Task } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

interface TaskItemProps {
  task: Task;
  onUpdate?: (updates: Partial<Task>) => void;
}

export function TaskItem({ task, onUpdate }: TaskItemProps) {
  const { user } = useAuth();
  
  const handleCheckboxChange = (checked: boolean) => {
    onUpdate?.({ completed: checked });
  };

  const getAvatarColorClass = (assignee?: { avatarColor: string }) => {
    return assignee?.avatarColor || 'bg-gray-200 text-gray-600';
  };

  const formatDueDate = (date?: string) => {
    if (!date) return '';
    
    // Check if it's "today", "tomorrow", or format as "Day"
    const dueDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (dueDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (dueDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return dueDate.toLocaleDateString('en-US', { weekday: 'long' });
    }
  };

  return (
    <div className="p-2 border border-gray-200 rounded flex items-start">
      <Checkbox 
        checked={task.completed} 
        onCheckedChange={handleCheckboxChange}
        className="mt-1 mr-2" 
      />
      <div className="flex-1">
        <p className={cn(
          "text-sm font-medium",
          task.completed && "line-through text-gray-400"
        )}>
          {task.title}
        </p>
        <div className="flex items-center mt-1">
          {task.assignee && (
            <span 
              className={cn(
                "text-xs py-0.5 px-2 rounded-full mr-2",
                getAvatarColorClass(task.assignee)
              )}
            >
              {user && task.assignee && task.assignee.id === user.id 
                ? "Me" 
                : task.assignee.fullName.split(' ')[0]
              }
            </span>
          )}
          {task.dueDate && (
            <span className="text-xs text-gray-500">
              Due: {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
