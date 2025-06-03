import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Form schema with validation for Google Meet URL
const formSchema = z.object({
  meetingUrl: z.string().optional(),
  title: z.string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title cannot exceed 100 characters"),
  description: z.string().optional(),
  transcriptFile: z.instanceof(File).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ImportMeeting() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      meetingUrl: '',
      title: '',
      description: '',
    },
  });

  // Create meeting mutation
  const createMeetingMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest(
        'POST',
        '/api/meetings/import',
        data
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Meeting imported successfully!",
        description: "Redirecting to the live meeting page...",
      });

      // Small delay to allow the toast to be shown
      setTimeout(() => {
        navigate(`/live-meeting?id=${data.id}`);
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to import meeting",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);

      let transcriptContent = '';
      if (data.transcriptFile) {
        const fileContent = await data.transcriptFile.text();
        transcriptContent = fileContent;
      }

      const response = await fetch('/api/meetings/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meetingUrl: data.meetingUrl,
          title: data.title,
          description: data.description,
          transcriptContent: transcriptContent,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      
      console.log("Meeting import response data:", responseData);
      
      // Start caption bot if a meeting URL was provided (for live meetings)
      if (data.meetingUrl) {
        try {
          console.log(`Starting caption bot for meeting ID: ${responseData.id}`);
          const botResponse = await fetch('http://localhost:5050/api/caption-bot/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              meetingUrl: data.meetingUrl,
              meetingId: responseData.id,
            }),
          });
          
          if (!botResponse.ok) {
            console.error('Failed to start caption bot:', await botResponse.text());
          } else {
            const botData = await botResponse.json();
            console.log('Caption bot started successfully:', botData);
          }
        } catch (botError) {
          console.error('Error starting caption bot:', botError);
        }
      }

      toast({
        title: "Meeting imported successfully!",
        description: "Redirecting to the live meeting page...",
      });

      setTimeout(() => {
        navigate(`/live-meeting?id=${responseData.id}`);
      }, 1000);

    } catch (error: any) {
      toast({
        title: "Failed to import meeting",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header title="Import Google Meet" setIsMobileOpen={setIsMobileOpen} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold">Import Google Meet</CardTitle>
              <CardDescription>
                Enter a Google Meet link to import the meeting for transcription and analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="meetingUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google Meet URL (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://meet.google.com/xyz-abcd-123" 
                            {...field}
                            className="w-full"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the full URL of the Google Meet you want to join
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transcriptFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transcript File (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="file" 
                            accept=".txt,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                field.onChange(file);
                              }
                            }}
                            className="w-full"
                          />
                        </FormControl>
                        <FormDescription>
                          Upload a transcript file to import past meeting
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Weekly Team Sync" 
                            {...field}
                            className="w-full"
                          />
                        </FormControl>
                        <FormDescription>
                          Enter a descriptive name for this meeting
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Brief description of the meeting" 
                            {...field}
                            className="w-full"
                          />
                        </FormControl>
                        <FormDescription>
                          Add any additional notes or context about this meeting
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/")}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-primary text-white"
                      disabled={isLoading || createMeetingMutation.isPending || isSubmitting}
                    >
                      {(isLoading || createMeetingMutation.isPending || isSubmitting) ? (
                        <>
                          <span className="mr-2">
                            <span className="animate-spin inline-block h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                          </span>
                          Importing...
                        </>
                      ) : (
                        <>
                          <span className="material-icons text-sm mr-1">add</span>
                          Import Meeting
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* How It Works Info Card */}
          <Card className="mt-6 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold">How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 list-decimal list-inside text-gray-700">
                <li className="ml-2">Enter the Google Meet URL you wish to join</li>
                <li className="ml-2">Add a title and optional description for your reference</li>
                <li className="ml-2">Our AI assistant will join the meeting</li>
                <li className="ml-2">Live transcription will begin automatically</li>
                <li className="ml-2">Key points, action items, and summaries will be generated in real-time</li>
              </ol>
              <div className="bg-blue-100 rounded-md p-3 mt-4 text-sm text-blue-800">
                <p className="flex items-start">
                  <span className="material-icons text-blue-600 mr-2 text-base">info</span>
                  <span>Meeting participants will see the AI Assistant join with the name "AI Meeting Assistant"</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}