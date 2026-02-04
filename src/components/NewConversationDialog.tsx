import { useState, useMemo } from 'react';
import { useTeamMembers, TeamMember } from '@/hooks/useTeamMembers';
import { useMyCandidatesData } from '@/hooks/useMyCandidatesData';
import { useCreateConversation } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResolvedAvatar } from '@/components/ui/resolved-avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
  Users, 
  User,
  Loader2,
  MessageSquare,
  Send,
  Briefcase,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnline } from '@/hooks/useOnlineStatus';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversationId: string) => void;
}

type ContactType = 'colleague' | 'candidate';

interface Contact {
  id: string;
  type: ContactType;
  firstName: string | null;
  lastName: string | null;
  companyName?: string | null;
  profileImageUrl: string | null;
  jobTitle?: string; // For candidates - which job they applied to
  applicationId?: string; // For candidates - link to frozen profile
  jobId?: string; // For candidates - the job they applied to
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
}: NewConversationDialogProps) {
  const { user } = useAuth();
  const { teamMembers, isLoading: loadingTeam } = useTeamMembers();
  const { candidates, isLoading: loadingCandidates } = useMyCandidatesData();
  const createConversation = useCreateConversation();
  const { isOnline, showOfflineToast } = useOnline();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [step, setStep] = useState<'select' | 'compose'>('select');

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
        id: candidate.applicant_id,
        type: 'candidate',
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        profileImageUrl: candidate.profile_image_url,
        jobTitle: candidate.job_title,
        applicationId: candidate.application_id,
        jobId: candidate.job_id,
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

  const handleNext = () => {
    if (selectedContacts.length === 0) {
      toast.error('Välj minst en person att chatta med');
      return;
    }
    setStep('compose');
  };

  const handleBack = () => {
    setStep('select');
  };

  const handleCreate = async () => {
    if (!isOnline) {
      showOfflineToast();
      return;
    }
    
    if (selectedContacts.length === 0) return;

    try {
      // For single candidate selection, include applicationId for frozen profile
      const selectedContact = selectedContactObjects[0];
      const applicationId = !isGroup && selectedContact?.type === 'candidate' 
        ? selectedContact.applicationId 
        : undefined;
      const jobId = !isGroup && selectedContact?.type === 'candidate'
        ? selectedContact.jobId
        : undefined;
      
      const result = await createConversation.mutateAsync({
        memberIds: selectedContacts,
        name: isGroup ? groupName.trim() || undefined : undefined,
        isGroup,
        initialMessage: initialMessage.trim() || undefined,
        applicationId: applicationId || null,
        jobId: jobId || null,
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
    setStep('select');
    onOpenChange(false);
  };

  const getDisplayName = (contact: Contact) => {
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Okänd';
  };

  const getInitials = (contact: Contact) => {
    const first = contact.firstName?.[0] || '';
    const last = contact.lastName?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const selectedContactObjects = contacts.filter(c => selectedContacts.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {step === 'select' ? 'Ny konversation' : 'Skicka meddelande'}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {step === 'select' 
              ? 'Välj en eller flera personer att chatta med'
              : isGroup 
                ? `Gruppchatt med ${selectedContacts.length} personer`
                : `Chatta med ${getDisplayName(selectedContactObjects[0])}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök personer..."
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            {/* Selected contacts preview */}
            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-2 py-2">
                {selectedContactObjects.map(contact => (
                  <Badge 
                    key={contact.id}
                    variant="secondary"
                    className="bg-blue-500/20 text-blue-300 gap-1 cursor-pointer hover:bg-blue-500/30"
                    onClick={() => toggleContact(contact.id)}
                  >
                    {getDisplayName(contact)}
                    <span className="ml-1 text-blue-300/60">×</span>
                  </Badge>
                ))}
              </div>
            )}

            {/* Contact list */}
            <ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
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
                  <Users className="h-10 w-10 text-white/20 mb-2" />
                  <p className="text-white/50 text-sm">Inga kontakter att visa</p>
                  <p className="text-white/30 text-xs">
                    Lägg till kollegor i ditt team eller spara kandidater först
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {/* Colleagues section */}
                  {colleagueContacts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-slate-900 py-1">
                        <Users className="h-4 w-4 text-white/50" />
                        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">
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
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-slate-900 py-1">
                        <UserCheck className="h-4 w-4 text-white/50" />
                        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">
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

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="ghost" onClick={handleClose}>
                Avbryt
              </Button>
              <Button
                variant="glass"
                onClick={handleNext}
                disabled={selectedContacts.length === 0}
                className="bg-blue-500/20 border-blue-500/40"
              >
                Nästa
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Group name (only for groups) */}
            {isGroup && (
              <div className="space-y-2">
                <label className="text-white/70 text-sm">Gruppnamn (valfritt)</label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="T.ex. Rekrytering Säljare"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>
            )}

            {/* Initial message */}
            <div className="space-y-2 flex-1">
              <label className="text-white/70 text-sm">Meddelande (valfritt)</label>
              <Textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Skriv ett meddelande för att starta konversationen..."
                className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex justify-between pt-2 border-t border-white/10">
              <Button variant="ghost" onClick={handleBack}>
                Tillbaka
              </Button>
              <Button
                variant="glass"
                onClick={handleCreate}
                disabled={createConversation.isPending || !isOnline}
                className={`bg-blue-500/20 border-blue-500/40 ${!isOnline ? 'opacity-50' : ''}`}
              >
                {createConversation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : !isOnline ? (
                  <WifiOff className="h-4 w-4 mr-1.5" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                {!isOnline ? 'Offline' : isGroup ? 'Skapa grupp' : 'Starta chatt'}
              </Button>
            </div>
          </>
        )}
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
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
        isSelected 
          ? "bg-blue-500/20 border border-blue-500/30" 
          : "hover:bg-white/5 border border-transparent"
      )}
    >
      <Checkbox
        checked={isSelected}
        className="h-4 w-4 border-white/30 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
      />
      
      <ResolvedAvatar
        src={contact.profileImageUrl}
        mediaType="profile-image"
        fallback={getInitials()}
        className="h-9 w-9 border border-white/10"
        fallbackClassName="bg-white/10 text-white text-sm"
      />

      <div className="flex-1 min-w-0">
        <span className="font-medium text-white text-sm truncate block">
          {getDisplayName()}
        </span>
        {contact.type === 'candidate' && contact.jobTitle && (
          <span className="text-white/40 text-xs flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {contact.jobTitle}
          </span>
        )}
        {contact.type === 'colleague' && (
          <span className="text-white/40 text-xs">Kollega</span>
        )}
      </div>

      <Badge 
        variant="outline" 
        className={cn(
          "text-[10px] border-white/20",
          contact.type === 'colleague' ? "text-purple-300" : "text-green-300"
        )}
      >
        {contact.type === 'colleague' ? 'Team' : 'Kandidat'}
      </Badge>
    </button>
  );
}
