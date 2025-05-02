import React from 'react';
import { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const isAi = message.isAi;
  
  return (
    <div className={cn(
      "flex items-start",
      !isAi && "flex-row-reverse"
    )}>
      {isAi ? (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white mr-3 flex-shrink-0">
          <span className="material-icons text-sm">smart_toy</span>
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 ml-3 flex-shrink-0">
          {message.sender?.avatarInitials || 'U'}
        </div>
      )}
      <div 
        className={cn(
          "rounded-lg p-3 max-w-[85%]",
          isAi ? "bg-gray-100" : "bg-primary text-white"
        )}
      >
        <p className="text-sm">{message.content}</p>
      </div>
    </div>
  );
}
