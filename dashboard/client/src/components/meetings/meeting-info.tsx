import React from 'react';
import { MeetingDetails, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MeetingInfoProps {
  meeting: MeetingDetails;
}

interface AvatarProps {
  user: User;
  size?: 'sm' | 'md';
}

const UserAvatar: React.FC<AvatarProps> = ({ user, size = 'sm' }) => {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium',
        size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm',
        user.avatarColor
      )}
    >
      {user.avatarInitials}
    </div>
  );
};

export function MeetingInfo({ meeting }: MeetingInfoProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Meeting Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm text-gray-500 mb-1">Date & Time</h4>
          <p className="text-sm font-medium">
            {meeting.date} • {meeting.startTime} 
            {meeting.endTime ? ` - ${meeting.endTime}` : ''}
          </p>
        </div>

        <div>
          <h4 className="text-sm text-gray-500 mb-1">
            Participants ({meeting.participants.length})
          </h4>
          <div className="flex flex-wrap items-center mt-2">
            {meeting.participants.map((participant) => (
              <div key={participant.id} className="mr-1 mb-1">
                <UserAvatar user={participant} />
              </div>
            ))}
          </div>
        </div>

        {meeting.agenda && meeting.agenda.length > 0 && (
          <div>
            <h4 className="text-sm text-gray-500 mb-1">Meeting Agenda</h4>
            <ul className="list-disc text-sm pl-5 space-y-1">
              {meeting.agenda.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h4 className="text-sm text-gray-500 mb-1">Upcoming Meetings</h4>
          <div className="text-sm space-y-2 mt-1">
            <div className="flex justify-between items-center">
              <span>Frontend Team Sync</span>
              <span className="text-xs text-gray-500">Mar 15, 2:00 PM</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Sprint Planning</span>
              <span className="text-xs text-gray-500">Mar 17, 11:00 AM</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
