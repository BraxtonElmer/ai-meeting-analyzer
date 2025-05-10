import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

const profileFormSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  username: z.string().min(3, "Username must be at least 3 characters."),
});

const notificationsSchema = z.object({
  emailNotifications: z.boolean(),
  meetingReminders: z.boolean(),
  taskAssignments: z.boolean(),
  summaryGeneration: z.boolean(),
});

const aiSettingsSchema = z.object({
  transcriptionLanguage: z.string(),
  summaryLength: z.string(),
  aiResponseStyle: z.string(),
  customInstructions: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type NotificationsValues = z.infer<typeof notificationsSchema>;
type AiSettingsValues = z.infer<typeof aiSettingsSchema>;

export default function Settings() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  
  // Profile form with dynamic values based on current user
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
    },
  });
  
  // Update form values when user data is loaded
  useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.fullName || "",
        email: user.email || "",
        username: user.username || "",
      });
    }
  }, [user, profileForm]);

  // Notifications form
  const notificationsForm = useForm<NotificationsValues>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      emailNotifications: true,
      meetingReminders: true,
      taskAssignments: true,
      summaryGeneration: false,
    },
  });

  // AI Settings form
  const aiSettingsForm = useForm<AiSettingsValues>({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      transcriptionLanguage: "en-US",
      summaryLength: "medium",
      aiResponseStyle: "balanced",
      customInstructions: "",
    },
  });

  // Profile submit is implemented below

  const onNotificationsSubmit = (data: NotificationsValues) => {
    toast({
      title: "Notification preferences saved",
      description: "Your notification settings have been updated.",
    });
    console.log("Notifications form submitted:", data);
  };

  const onAiSettingsSubmit = (data: AiSettingsValues) => {
    toast({
      title: "AI settings updated",
      description: "Your AI assistant preferences have been saved.",
    });
    console.log("AI settings form submitted:", data);
  };

  // State for the profile form submission loading status
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Update the user profile using the API
  const onProfileSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
      
      const updatedUser = await response.json();
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      
      // Refresh the form with updated values if needed
      profileForm.reset({
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        username: updatedUser.username,
      });
      
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "There was a problem updating your profile.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Header title="Settings" setIsMobileOpen={setIsMobileOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-full">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading your settings...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Settings" setIsMobileOpen={setIsMobileOpen} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
          
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="ai-settings">AI Settings</TabsTrigger>
            </TabsList>
            
            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                    {user && (
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold ${user.avatarColor}`}>
                        {user.avatarInitials}
                      </div>
                    )}
                    <div>
                      <CardTitle>Profile</CardTitle>
                      <CardDescription>
                        Manage your account information and preferences.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                      <FormField
                        control={profileForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Control how and when you receive notifications.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...notificationsForm}>
                    <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-6">
                      <div className="space-y-4">
                        <FormField
                          control={notificationsForm.control}
                          name="emailNotifications"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-4">
                              <div>
                                <FormLabel>Email Notifications</FormLabel>
                                <FormDescription>
                                  Receive notifications via email.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={notificationsForm.control}
                          name="meetingReminders"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-4">
                              <div>
                                <FormLabel>Meeting Reminders</FormLabel>
                                <FormDescription>
                                  Get notified before scheduled meetings start.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={notificationsForm.control}
                          name="taskAssignments"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-4">
                              <div>
                                <FormLabel>Task Assignments</FormLabel>
                                <FormDescription>
                                  Get notified when you are assigned a new task.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={notificationsForm.control}
                          name="summaryGeneration"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-lg border p-4">
                              <div>
                                <FormLabel>Summary Generation</FormLabel>
                                <FormDescription>
                                  Get notified when meeting summaries are ready.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <Button type="submit">Save Preferences</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* AI Settings Tab */}
            <TabsContent value="ai-settings">
              <Card>
                <CardHeader>
                  <CardTitle>AI Assistant Settings</CardTitle>
                  <CardDescription>
                    Customize how the AI assistant works for you.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...aiSettingsForm}>
                    <form onSubmit={aiSettingsForm.handleSubmit(onAiSettingsSubmit)} className="space-y-6">
                      <FormField
                        control={aiSettingsForm.control}
                        name="transcriptionLanguage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transcription Language</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="en-US">English (US)</SelectItem>
                                <SelectItem value="en-GB">English (UK)</SelectItem>
                                <SelectItem value="es-ES">Spanish</SelectItem>
                                <SelectItem value="fr-FR">French</SelectItem>
                                <SelectItem value="de-DE">German</SelectItem>
                                <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                                <SelectItem value="ja-JP">Japanese</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Select the language for transcription.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={aiSettingsForm.control}
                        name="summaryLength"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Summary Length</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select length" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="short">Short</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="long">Long</SelectItem>
                                <SelectItem value="comprehensive">Comprehensive</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose how detailed you want meeting summaries to be.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={aiSettingsForm.control}
                        name="aiResponseStyle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>AI Response Style</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="balanced">Balanced</SelectItem>
                                <SelectItem value="conversational">Conversational</SelectItem>
                                <SelectItem value="technical">Technical</SelectItem>
                                <SelectItem value="simple">Simple</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Set the tone and style of AI assistant responses.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={aiSettingsForm.control}
                        name="customInstructions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Instructions</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Add any specific instructions for the AI assistant..."
                                className="h-20"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Provide additional guidance for how the AI should behave.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button type="submit">Save AI Settings</Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
