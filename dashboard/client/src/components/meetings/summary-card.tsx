import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SummaryCardProps {
  summary: string;
  isLoading?: boolean;
  onEditClick?: () => void;
}

export function SummaryCard({ summary, isLoading = false, onEditClick }: SummaryCardProps) {
  // Parse the summary content from string to structured list
  const parseSummary = (content: string) => {
    if (!content) return { intro: '', points: [] };
    
    const lines = content.split('\n').filter(line => line.trim());
    
    // Check if we have lines to process
    if (lines.length === 0) return { intro: content, points: [] };
    
    const intro = lines[0] || '';
    
    // Look for bullet points with * or - or •
    const points = lines
      .slice(1)
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('-') || 
               trimmed.startsWith('•') || 
               trimmed.startsWith('*');
      })
      .map(line => {
        // Remove any bullet point character and trim
        return line.replace(/^[-•*]\s*/, '').trim();
      });
    
    return { intro, points };
  };

  console.log('Summary content for card:', summary ? `Found: ${summary.substring(0, 50)}...` : 'Empty or undefined');
  const { intro, points } = parseSummary(summary);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">AI Summary</CardTitle>
        <Badge variant="outline" className="text-xs text-primary bg-primary/10 py-1 px-2">
          Auto-generated
        </Badge>
      </CardHeader>
      <CardContent className="min-h-[200px]"> {/* Add min-height to prevent layout shifts */}
        {isLoading ? (
          <div className="flex flex-col space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse"></div>
          </div>
        ) : summary ? (
          <div className="space-y-3 text-sm">
            {/* If we parsed the summary successfully in a structured format */}
            {intro && <p className="text-gray-700">{intro}</p>}
            
            {points.length > 0 && (
              <ul className="list-disc pl-5 text-gray-600 space-y-2">
                {points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            )}
            
            {/* If we couldn't parse it in a structured way, show the raw summary with preserved line breaks */}
            {(!intro && points.length === 0) && (
              <div className="text-gray-700 whitespace-pre-wrap">
                {summary}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <span className="material-icons text-3xl mb-2">summarize</span>
            <p>No summary available yet.</p>
            <p className="text-sm">A summary will be generated as the meeting progresses.</p>
            <p className="text-sm mt-2">Summarization is performed by Gemini AI.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
