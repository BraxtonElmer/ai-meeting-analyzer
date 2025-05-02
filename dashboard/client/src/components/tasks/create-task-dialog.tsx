import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Form schema
const taskFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  meetingId: z.string(),
  assigneeId: z.string().optional(),
  dueDate: z.date().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMeetingId?: number;
  isActionItem?: boolean;
}

export function CreateTaskDialog({ 
  open, 
  onOpenChange, 
  defaultMeetingId,
  isActionItem = false
}: CreateTaskDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Fetch meetings for the dropdown
  const { data: meetings = [] } = useQuery<Array<{id: number, title: string}>>({
    queryKey: ['/api/meetings'],
    enabled: open, // Only fetch when dialog is open
  });
  
  // Fetch users for assignee dropdown
  const { data: users = [] } = useQuery<Array<{id: number, fullName: string}>>({
    queryKey: ['/api/users'],
    enabled: open, // Only fetch when dialog is open
  });
  
  // Default form values
  const defaultValues: Partial<TaskFormValues> = {
    meetingId: defaultMeetingId ? defaultMeetingId.toString() : '',
    title: isActionItem ? 'Action Item: ' : '',
  };
  
  // Initialize the form
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues,
  });
  
  // Task creation mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      const meetingId = parseInt(data.meetingId);
      const payload = {
        title: data.title,
        assigneeId: data.assigneeId ? parseInt(data.assigneeId) : undefined,
        dueDate: data.dueDate?.toISOString(),
      };
      
      const response = await apiRequest(
        'POST',
        `/api/meetings/${meetingId}/tasks`,
        payload
      );
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tasks'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/meetings/${data.meetingId}/tasks`] 
      });
      
      // Show success toast
      toast({
        title: isActionItem ? 'Action item created' : 'Task created',
        description: `${isActionItem ? 'Action item' : 'Task'} "${data.title}" has been created successfully.`,
      });
      
      // Close the dialog and reset form
      onOpenChange(false);
      form.reset(defaultValues);
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast({
        title: 'Failed to create task',
        description: 'An error occurred while creating the task. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (values: TaskFormValues) => {
    createTaskMutation.mutate(values);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isActionItem ? 'Create New Action Item' : 'Create New Task'}
          </DialogTitle>
          <DialogDescription>
            {isActionItem 
              ? 'Add an action item with owner and due date' 
              : 'Add a task to track work that needs to be completed'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isActionItem ? 'Action Item' : 'Task Title'}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={isActionItem ? "Describe the action needed" : "Enter task title"} 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="meetingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Meeting</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={!!defaultMeetingId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a meeting" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {meetings?.map(meeting => (
                        <SelectItem key={meeting.id} value={meeting.id.toString()}>
                          {meeting.title}
                        </SelectItem>
                      ))}
                      {!meetings?.length && defaultMeetingId && (
                        <SelectItem value={defaultMeetingId.toString()}>
                          Current Meeting
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="assigneeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to someone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setCalendarOpen(false);
                        }}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? (
                  <>
                    <span className="mr-2">
                      <span className="animate-spin inline-block h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                    </span>
                    Creating...
                  </>
                ) : (
                  <>Create {isActionItem ? 'Action Item' : 'Task'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}