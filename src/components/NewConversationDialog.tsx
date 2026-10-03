import { useState, useMemo } from 'react';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useMyCandidatesData } from '@/hooks/useMyCandidatesData';
import { useCreateConversation } from '@/hooks/useConversations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResolvedAvatar } from '@/components/ui/resolved-avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Search, 
  Check,
  Users, 
  Loader2,
  MessageSquare,
  Send,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

type ContactType = 'colleague' | 'candidate';

interface Contact {
  id: string; // Unique key (applicationId for candidates, userId for colleagues)
  type: ContactType;
  firstName: string | null;
  lastName: string | null;
  companyName?: string | null;
  profileImageUrl: string | null;
  jobTitle?: string;
  applicationId?: string;
  jobId?: string;
  userId?: string; // Actual user_id for conversation creation (candidates)
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationDialogProps) {
  const { teamMembers, isLoading: loadingTeam } = useTeamMembers();
  const { candidates, isLoading: loadingCandidates } = useMyCandidatesData();
  const createConversation = useCreateConversation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');

  const isLoading = loadingTeam || loadingCandidates;
  const isGroup = selectedContacts.length > 1;

  // Build unified contact list
  const contacts: Contact[] = useMemo(() => {
    const list: Contact[] = [];

    // Add team members (colleagues)
    teamMembers.forEach(member => {
      list.push({
        id: member.userId,
        type: 'colleague',
        firstName: member.firstName,
        lastName: member.lastName,
        profileImageUrl: member.profileImageUrl,
      });
    });

    // Add candidates - one entry per application for frozen profile support
    // This allows selecting the specific application context for the chat
    candidates.forEach(candidate => {
      list.push({
        id: candidate.application_id || candidate.applicant_id, // Unique per application
        type: 'candidate',
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        profileImageUrl: candidate.profile_image_url,
        jobTitle: candidate.job_title,
        applicationId: candidate.application_id,
        jobId: candidate.job_id,
        userId: candidate.applicant_id, // Actual user ID for conversation creation
      });
    });

    return list;
  }, [teamMembers, candidates]);

  // Filter contacts based on search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    
    return contacts.filter(contact => {
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
      return fullName.includes(query) || contact.jobTitle?.toLowerCase().includes(query);
    });
  }, [contacts, searchQuery]);

  // Group contacts by type
  const colleagueContacts = filteredContacts.filter(c => c.type === 'colleague');
  const candidateContacts = filteredContacts.filter(c => c.type === 'candidate');

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleCreate = async () => {
    if (selectedContactObjects.length === 0) return;

    try {
      // For single candidate selection, include applicationId for frozen profile
      const selectedContact = selectedContactObjects[0];
      const applicationId = !isGroup && selectedContact?.type === 'candidate' 
        ? selectedContact.applicationId 
        : undefined;
      const jobId = !isGroup && selectedContact?.type === 'candidate'
        ? selectedContact.jobId
        : undefined;
      
      // Resolve actual user IDs (candidates store userId separately from their unique key)
      const memberUserIds = selectedContactObjects.map(c => c.userId || c.id);

      // Enbart kollegor → intern chatt. Blandat urval hamnar alltid i jobbspåret.
      const isInternal =
        selectedContactObjects.length > 0 &&
        selectedContactObjects.every(c => c.type === 'colleague');

      const result = await createConversation.mutateAsync({
        memberIds: memberUserIds,
        name: isGroup ? groupName.trim() || undefined : undefined,
        isGroup,
        initialMessage: initialMessage.trim() || undefined,
        applicationId: applicationId || null,
        jobId: jobId || null,
        kind: isInternal ? 'internal' : 'job',
      });

      toast.success(result.isExisting ? 'Konversation öppnad' : 'Konversation skapad!');
      onConversationCreated(result.id);
      handleClose();
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Kunde inte skapa konversation');
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedContacts([]);
    setGroupName('');
    setInitialMessage('');
    onOpenChange(false);
  };

  const getDisplayName = (contact: Contact) => {
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Okänd';
  };

  const selectedContactObjects = contacts.filter(c => selectedContacts.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="bg-[hsl(var(--surface-blue))] border-pure-white/20 text-pure-white w-[calc(100%-2rem)] max-w-md h-[min(72dvh,600px)] flex flex-col gap-4 rounded-lg p-5 max-sm:top-[17dvh] max-sm:translate-y-0 sm:h-[min(80dvh,620px)] sm:p-6"
      >
        <DialogHeader className="text-left pr-8">
          <DialogTitle className="flex items-center gap-2 text-pure-white">
            <MessageSquare className="h-5 w-5" />
            Ny konversation
          </DialogTitle>
          <DialogDescription className="text-pure-white text-sm leading-relaxed">
            Välj vem du vill chatta med.
          </DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pure-white" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök personer..."
            aria-label="Sök personer"
            className="pl-9 h-11 bg-pure-white/10 border-pure-white/20 text-pure-white placeholder:text-pure-white text-base"
          />
        </div>
        <ScrollArea className="flex-1 min-h-[96px] -mx-2 px-2">
              {isLoading ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32 bg-white/10" />
                        <Skeleton className="h-3 w-20 bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                   <Users className="h-10 w-10 text-pure-white mb-2" />
                   <p className="text-pure-white text-sm">Inga kontakter att visa.</p>
                   <p className="text-pure-white text-xs">
                    Lägg till kollegor i ditt team eller spara kandidater först.
                  </p>
                </div>
               ) : filteredContacts.length === 0 ? (
                 <p className="py-8 text-center text-sm text-pure-white">Inga personer hittades.</p>
               ) : (
                <div className="space-y-4 pb-4">
                  {/* Colleagues section */}
                  {colleagueContacts.length > 0 && (
                    <div>
                       <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[hsl(var(--surface-blue))] py-1">
                         <Users className="h-4 w-4 text-pure-white" />
                         <span className="text-pure-white text-xs font-medium uppercase tracking-wider">
                          Kollegor ({colleagueContacts.length})
                        </span>
                      </div>
                      <div className="space-y-1">
                        {colleagueContacts.map(contact => (
                          <ContactItem
                            key={contact.id}
                            contact={contact}
                            isSelected={selectedContacts.includes(contact.id)}
                            onToggle={() => toggleContact(contact.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Candidates section */}
                  {candidateContacts.length > 0 && (
                    <div>
                       <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[hsl(var(--surface-blue))] py-1">
                         <UserCheck className="h-4 w-4 text-pure-white" />
                         <span className="text-pure-white text-xs font-medium uppercase tracking-wider">
                          Kandidater ({candidateContacts.length})
                        </span>
                      </div>
                      <div className="space-y-1">
                        {candidateContacts.map(contact => (
                          <ContactItem
                            key={contact.id}
                            contact={contact}
                            isSelected={selectedContacts.includes(contact.id)}
                            onToggle={() => toggleContact(contact.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
        </ScrollArea>
        {selectedContactObjects.length > 0 && (
           <div className="space-y-3 shrink-0 border-t border-pure-white/20 pt-3">
            <p className="text-sm text-pure-white break-words">
              {isGroup ? `${selectedContactObjects.length} valda` : getDisplayName(selectedContactObjects[0])}
            </p>
            {isGroup && (
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Gruppnamn (valfritt)"
                aria-label="Gruppnamn (valfritt)"
                 className="h-10 bg-pure-white/10 border-pure-white/20 text-pure-white placeholder:text-pure-white text-base"
              />
            )}
            <Textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Meddelande (valfritt)"
              aria-label="Meddelande (valfritt)"
               className="min-h-11 max-h-24 bg-pure-white/10 border-pure-white/20 text-pure-white placeholder:text-pure-white text-base resize-none"
            />
          </div>
        )}
         <div className="flex justify-end gap-2 shrink-0 border-t border-pure-white/20 pt-3">
           <Button variant="outlineNeutral" onClick={handleClose} className="border-transparent text-pure-white md:hover:bg-pure-white/10 md:hover:text-pure-white">Avbryt</Button>
          <Button variant="glassBlue" onClick={handleCreate} disabled={selectedContactObjects.length === 0 || createConversation.isPending} className="text-pure-white">
            {createConversation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isGroup ? 'Skapa grupp' : 'Starta chatt'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Contact list item
function ContactItem({ 
  contact, 
  isSelected, 
  onToggle,
}: { 
  contact: Contact;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const getDisplayName = () => {
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Okänd';
  };

  const getInitials = () => {
    const first = contact.firstName?.[0] || '';
    const last = contact.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  return (
    <Button
      type="button"
      variant="outlineNeutral"
      onClick={onToggle}
      aria-pressed={isSelected}
      className={cn(
        "w-full h-auto min-h-14 min-w-0 whitespace-normal flex items-center justify-start gap-3 p-2.5 rounded-md text-left transition-colors text-pure-white active:scale-100 [-webkit-tap-highlight-color:transparent]",
        isSelected 
          ? "bg-primary/20 border-primary/40" 
           : "border-transparent md:hover:bg-pure-white/10"
      )}
    >
      <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-sm border border-pure-white bg-transparent flex items-center justify-center">
        {isSelected && <Check className="h-3 w-3 text-pure-white" strokeWidth={2.5} />}
      </span>
      
      <ResolvedAvatar
        src={contact.profileImageUrl}
        mediaType="profile-image"
        fallback={getInitials()}
         className="h-9 w-9 shrink-0 border border-pure-white/20"
         fallbackClassName="bg-pure-white/10 text-pure-white text-sm"
      />

      <div className="flex-1 min-w-0">
        <span className="font-medium text-pure-white text-sm break-words block">
          {getDisplayName()}
        </span>
        {contact.type === 'candidate' && contact.jobTitle && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-pure-white">
            <Briefcase className="h-3 w-3 shrink-0" />
            <span className="block min-w-0 flex-1 break-words">{contact.jobTitle}</span>
          </span>
        )}
        {contact.type === 'colleague' && (
          <span className="text-pure-white text-xs">Kollega</span>
        )}
      </div>

    </Button>
  );
}
