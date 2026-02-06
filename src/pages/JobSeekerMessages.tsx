import { useState, useMemo } from 'react';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/hooks/useAuth';
import { MessageThread } from '@/components/messages/types';
import { ThreadList } from '@/components/messages/ThreadList';
import { ChatView } from '@/components/messages/ChatView';

export default function JobSeekerMessages() {
  const { user } = useAuth();
  const { inbox, sent, isLoading, unreadCount, markAsRead, refetch } = useMessages();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Group messages by sender (employer) into threads
  const threads = useMemo(() => {
    const threadMap = new Map<string, MessageThread>();

    // Process inbox messages (received from employers)
    inbox.forEach(msg => {
      const senderId = msg.sender_id;
      if (!threadMap.has(senderId) && msg.sender_profile) {
        threadMap.set(senderId, {
          id: senderId,
          senderProfile: msg.sender_profile,
          lastMessage: msg,
          unreadCount: 0,
          messages: [],
        });
      }
      const thread = threadMap.get(senderId);
      if (thread) {
        thread.messages.push(msg);
        if (!msg.is_read) {
          thread.unreadCount++;
        }
        // Update last message if newer
        if (new Date(msg.created_at) > new Date(thread.lastMessage.created_at)) {
          thread.lastMessage = msg;
        }
      }
    });

    // Add sent messages to threads
    sent.forEach(msg => {
      const recipientId = msg.recipient_id;
      const thread = threadMap.get(recipientId);
      if (thread) {
        thread.messages.push(msg);
        // Update last message if newer
        if (new Date(msg.created_at) > new Date(thread.lastMessage.created_at)) {
          thread.lastMessage = msg;
        }
      }
    });

    // Sort messages within each thread by date
    threadMap.forEach(thread => {
      thread.messages.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    // Convert to array and sort by last message date
    return Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [inbox, sent]);

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleBack = () => {
    setSelectedThreadId(null);
    refetch();
  };

  // Only show loading if there's no cached data at all
  const hasData = inbox.length > 0 || sent.length > 0;
  
  if (isLoading && !hasData) {
    return (
       <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col opacity-0 responsive-container-wide">
        {/* Invisible placeholder to prevent layout shift */}
      </div>
    );
  }

  // Show chat view if thread is selected
  if (selectedThread) {
    return (
       <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in responsive-container-wide">
        <ChatView 
          thread={selectedThread}
          currentUserId={user?.id || ''}
          onBack={handleBack}
          markAsRead={markAsRead}
          refetch={refetch}
        />
      </div>
    );
  }

  // Show thread list
  return (
    <ThreadList
      threads={threads}
      currentUserId={user?.id || ''}
      unreadCount={unreadCount}
      onSelectThread={handleSelectThread}
    />
  );
}
