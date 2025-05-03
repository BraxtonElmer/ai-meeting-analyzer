import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import LiveMeeting from "@/pages/live-meeting";
import PastMeetings from "@/pages/past-meetings";
import Tasks from "@/pages/tasks";
import Settings from "@/pages/settings";
import AuthPage from "@/pages/auth-page";
import ImportMeeting from "@/pages/import-meeting";
import Reports from "@/pages/reports";
import { Sidebar } from "@/components/layout/sidebar";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

// Main application layout with sidebar for authenticated routes
function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// Router component that includes authentication
function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      {/* Public route */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Protected routes with layout */}
      <ProtectedRoute 
        path="/" 
        component={() => (
          <AppLayout>
            <Dashboard />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/live-meeting" 
        component={() => (
          <AppLayout>
            <LiveMeeting />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/past-meetings" 
        component={() => (
          <AppLayout>
            <PastMeetings />
          </AppLayout>
        )} 
      />
      
      {/* Meeting detail routes */}
      <ProtectedRoute 
        path="/meetings/:id/transcript" 
        component={() => (
          <AppLayout>
            <LiveMeeting />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/meetings/:id/summary" 
        component={() => (
          <AppLayout>
            <LiveMeeting />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/meetings/:id/tasks" 
        component={() => (
          <AppLayout>
            <LiveMeeting />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/import-meeting" 
        component={() => (
          <AppLayout>
            <ImportMeeting />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/tasks" 
        component={() => (
          <AppLayout>
            <Tasks />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/settings" 
        component={() => (
          <AppLayout>
            <Settings />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/reports" 
        component={() => (
          <AppLayout>
            <Reports />
          </AppLayout>
        )} 
      />
      
      <ProtectedRoute 
        path="/reports/:id" 
        component={() => (
          <AppLayout>
            <Reports />
          </AppLayout>
        )} 
      />
      

      
      {/* Not found route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
