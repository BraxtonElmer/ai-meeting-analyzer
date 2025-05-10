import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TranscriptionEntry } from '@/types';
import { cn } from '@/lib/utils';

interface TranscriptionPanelProps {
  entries: TranscriptionEntry[];
  isLoading?: boolean;
  className?: string;
  meetingStatus?: string;
}

export function TranscriptionPanel({
  entries,
  isLoading = false,
  className,
  meetingStatus = 'completed'
}: TranscriptionPanelProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new entries come in
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [entries]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Card className={cn('overflow-hidden flex flex-col', className)}>
      <CardHeader className="border-b p-4 flex flex-row justify-between items-center bg-white sticky top-0 z-10">
        <CardTitle className="text-base">
          {meetingStatus === 'live' ? 'Live Transcription' : 'Meeting Transcript'}
        </CardTitle>
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary-dark">
            <span className="material-icons text-sm mr-1 align-text-bottom">cloud_download</span>
            Export
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
            <span className="material-icons">more_vert</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent
        ref={transcriptRef}
        className="flex-1 overflow-y-auto p-4 scrollbar-thin"
        style={{ 
          maxHeight: 'calc(100vh - 300px)',
          minHeight: '300px' // Set min-height to prevent layout shifts
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <span className="material-icons text-4xl mb-2">mic_off</span>
            <p>No transcription entries yet.</p>
            <p className="text-sm">Transcription will appear here when the meeting starts.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="mb-6">
              <div className="flex items-start">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-medium mr-3 flex-shrink-0',
                    entry.user?.avatarColor || 'bg-gray-200'
                  )}
                >
                  {entry.user?.avatarInitials || (entry.user?.fullName ? entry.user.fullName[0] : 'U')}
                </div>
                <div>
                  <div className="flex items-baseline">
                    <span className="font-medium">
                      {/* Display the speaker name appropriately for both live meetings and imported transcripts */}
                      {entry.user?.fullName || 'Unknown Speaker'}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-700 leading-relaxed">{entry.text}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
