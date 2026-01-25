import { Message } from '@/hooks/useMessages';

export interface SenderProfile {
  user_id?: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  profile_image_url: string | null;
  company_logo_url: string | null;
  role: 'job_seeker' | 'employer';
}

export interface MessageThread {
  id: string; // sender_id as thread ID
  senderProfile: SenderProfile;
  lastMessage: Message;
  unreadCount: number;
  messages: Message[];
}

export interface OptimisticMessage extends Message {
  isOptimistic?: boolean;
}
