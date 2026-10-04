import { Button } from '@/components/ui/button';
import { ConversationAvatar } from '@/components/messages/ConversationAvatar';
import type { TeamMember } from '@/hooks/useTeamMembers';
import { Loader2 } from 'lucide-react';

interface ColleagueStartItemProps {
  member: TeamMember;
  pending: boolean;
  onStart: () => void;
}

export function ColleagueStartItem({ member, pending, onStart }: ColleagueStartItemProps) {
  const name = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Kollega';

  return (
    <Button
      type="button"
      variant="outlineNeutral"
      onClick={onStart}
      disabled={pending}
      className="w-full min-w-0 h-auto min-h-[76px] flex items-center justify-start gap-3 whitespace-normal rounded-lg border-transparent p-3 text-left text-pure-white md:hover:bg-pure-white/10"
      aria-label={`Starta konversation med ${name}`}
    >
      <ConversationAvatar
        profile={{ role: 'employer', first_name: member.firstName, last_name: member.lastName, profile_image_url: member.profileImageUrl, company_name: null, company_logo_url: null }}
        size="lg"
        className="border-2 border-primary/50"
      />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="w-full break-words text-base font-medium">{name}</span>
        <span className="text-sm text-pure-white">Starta konversation</span>
      </span>
      {pending && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
    </Button>
  );
}