import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/types';
import { MessageItem } from './message-item';
import { askAiQuestion } from '@/lib/openai';
import { useToast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  meetingId: number;
  messages: ChatMessage[];
  onMessageSend?: (message: string) => void;
  isLoading?: boolean;
}

export function ChatInterface({ 
  meetingId, 
  messages, 
  onMessageSend, 
  isLoading = false
}: ChatInterfaceProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Predefined suggested prompts that users can click on
  const suggestedPrompts = [
    "Summarize this meeting for me",
    "What are my action items?",
    "Who is responsible for which tasks?",
    "When is our next meeting?",
    "What were the key decisions made?"
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputFocus = () => {
    setIsInputFocused(true);
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Small delay to allow suggestion clicks to register
    setTimeout(() => {
      setIsInputFocused(false);
      setShowSuggestions(false);
    }, 200);
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    setNewMessage(suggestion);
    // Focus the input after selecting a suggestion
    inputRef.current?.focus();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    const tempMessage = newMessage;
    setNewMessage('');
    setShowSuggestions(false);
    
    if (onMessageSend) {
      onMessageSend(tempMessage);
    } else {
      // Fallback to direct API call if no callback provided
      try {
        setIsSending(true);
        await askAiQuestion(meetingId, tempMessage);
      } catch (error) {
        toast({
          title: "Error sending message",
          description: "Failed to send your message. Please try again.",
          variant: "destructive"
        });
        console.error("Failed to send message:", error);
      } finally {
        setIsSending(false);
      }
    }
  };

  return (
    <Card className="flex flex-col h-[420px]">
      <CardHeader className="border-b p-4 flex flex-row justify-between items-center">
        <CardTitle className="text-base">AI Assistant</CardTitle>
        <div className="flex items-center">
          <span className="h-2 w-2 bg-success rounded-full mr-2"></span>
          <span className="text-sm text-gray-600">Online</span>
        </div>
      </CardHeader>
      
      <CardContent
        className="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4"
        id="chat-messages"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-start">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white mr-3 flex-shrink-0">
              <span className="material-icons text-sm">smart_toy</span>
            </div>
            <div className="bg-gray-100 rounded-lg p-3 max-w-[85%]">
              <p className="text-sm">
                Hello! I'm your AI meeting assistant. I'm listening to your meeting and can answer questions or help with tasks. What can I help you with?
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>
      
      <CardFooter className="p-3 border-t relative">
        <form className="flex flex-col w-full" onSubmit={handleSendMessage}>
          {/* Suggestions box that appears above the input when focused */}
          {showSuggestions && (
            <div className="absolute bottom-full left-0 right-0 bg-white rounded-t-lg shadow-lg border border-gray-200 p-3 mb-1 z-10 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center mb-2">
                <span className="material-icons text-xs text-gray-400 mr-1">lightbulb</span>
                <p className="text-xs text-gray-500 font-medium">Try asking these questions:</p>
              </div>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    type="button"
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full transition-colors flex items-center hover:scale-105 transform active:scale-95"
                    onClick={() => handleSuggestionClick(prompt)}
                  >
                    <span className="material-icons text-[10px] mr-1 text-gray-400">smart_toy</span>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center w-full">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Ask a question about the meeting..."
              className={`flex-1 rounded-l-lg transition-all duration-200 ${
                isInputFocused 
                  ? 'ring-2 ring-primary ring-offset-1 shadow-md transform -translate-y-1' 
                  : ''
              }`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={isSending}
            />
            <Button 
              type="submit" 
              className={`bg-primary text-white rounded-r-lg px-4 py-2 hover:bg-primary-dark transition-all duration-200 ${
                isInputFocused ? 'shadow-md transform -translate-y-1' : ''
              }`}
              disabled={isSending || !newMessage.trim()}
            >
              <span className="material-icons text-sm">send</span>
            </Button>
          </div>
        </form>
      </CardFooter>
    </Card>
  );
}
