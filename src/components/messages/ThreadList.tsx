import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare } from 'lucide-react';
import { MessageThread } from './types';
import { ThreadItem } from './ThreadItem';
import { SwipeableThreadItem } from './SwipeableThreadItem';
import { useDevice } from '@/hooks/use-device';
import { useDeleteConversation } from '@/hooks/useDeleteConversation';

interface ThreadListProps {
  threads: MessageThread[];
  currentUserId: string;
  unreadCount: number;
  onSelectThread: (threadId: string) => void;
}

export function ThreadList({ 
  threads, 
  currentUserId, 
  unreadCount,
  onSelectThread,
}: ThreadListProps) {
  const device = useDevice();
  const isTouchDevice = device === 'mobile';
  const { deleteConversation } = useDeleteConversation();

  const handleDeleteThread = (threadId: string) => {
    deleteConversation(threadId);
  };

  return (
     <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-140px)] flex flex-col animate-fade-in max-w-4xl mx-auto px-3 md:px-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Meddelanden</h1>
          {unreadCount > 0 && (
            <p className="text-white/60 text-sm">{unreadCount} olästa meddelanden</p>
          )}
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-hidden rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
        {threads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">Inga meddelanden</h3>
            <p className="text-white text-sm max-w-xs">
              När du söker jobb eller arbetsgivare kontaktar dig visas konversationerna här
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {threads.map((thread) => (
                isTouchDevice ? (
                  <SwipeableThreadItem
                    key={thread.id}
                    thread={thread}
                    currentUserId={currentUserId}
                    onClick={() => onSelectThread(thread.id)}
                    onDelete={handleDeleteThread}
                  />
                ) : (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    currentUserId={currentUserId}
                    onClick={() => onSelectThread(thread.id)}
                  />
                )
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
