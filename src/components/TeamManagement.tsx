import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useIsOrgAdmin } from '@/hooks/useIsOrgAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, Trash2, Crown, Loader2, Mail } from 'lucide-react';
import { TruncatedText } from '@/components/ui/truncated-text';

interface TeamMember {
  user_id: string;
  role: string;
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface TeamCache {
  userId: string;
  organizationId: string;
  members: TeamMember[];
}

const TEAM_CACHE_PREFIX = 'parium-team-cache:';

const readTeamCache = (userId?: string): TeamCache | null => {
  if (!userId) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(`${TEAM_CACHE_PREFIX}${userId}`) || 'null') as TeamCache | null;
    if (!parsed || parsed.userId !== userId || typeof parsed.organizationId !== 'string' || !Array.isArray(parsed.members)) {
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(`${TEAM_CACHE_PREFIX}${userId}`); } catch { /* ignore */ }
    return null;
  }
};

const writeTeamCache = (userId: string, organizationId: string, members: TeamMember[]) => {
  try {
    localStorage.setItem(
      `${TEAM_CACHE_PREFIX}${userId}`,
      JSON.stringify({ userId, organizationId, members } satisfies TeamCache),
    );
  } catch {
    // Cache is only a fast path; the database remains the source of truth.
  }
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'Rekryterare',
  viewer: 'Läsare'
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  recruiter: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  viewer: 'bg-white/10 text-white/70 border-white/20'
};

const TeamManagement = () => {
  const { user, profile } = useAuth();
  const { isAdmin } = useIsOrgAdmin();
  const initialCache = readTeamCache(user?.id);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialCache?.members ?? []);
  const [loading, setLoading] = useState(!initialCache);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');
  const [inviting, setInviting] = useState(false);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(initialCache?.organizationId ?? null);
  

  const fetchTeamMembers = useCallback(async (silent = false) => {
    if (!user?.id) return;

    if (!silent) setLoading(true);
    try {
      // Get user's organization
      const { data: orgData } = await supabase.rpc('get_user_organization_id', {
        p_user_id: user.id
      });
      
      if (!orgData) {
        setOrganizationId(null);
        setTeamMembers([]);
        try { localStorage.removeItem(`${TEAM_CACHE_PREFIX}${user.id}`); } catch { /* ignore */ }
        setLoading(false);
        return;
      }
      
      setOrganizationId(orgData);
      
      // Get all team members in the organization
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role, is_active')
        .eq('organization_id', orgData)
        .eq('is_active', true);

      if (error) throw error;

      const userIds = (roles || []).map((role) => role.user_id);
      const { data: profileRows, error: profilesError } = userIds.length > 0
        ? await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const profilesByUser = new Map((profileRows || []).map((row) => [row.user_id, row]));
      const members = (roles || []).map((role) => {
        const profileData = profilesByUser.get(role.user_id);
        return {
          ...role,
          first_name: profileData?.first_name || null,
          last_name: profileData?.last_name || null,
          email: profileData?.email || null
        };
      });
      setTeamMembers(members);
      writeTeamCache(user.id, orgData, members);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: "Fel",
        description: "Kunde inte hämta teammedlemmar.",
        variant: "destructive"
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const cached = readTeamCache(user.id);
    if (cached) {
      setTeamMembers(cached.members);
      setOrganizationId(cached.organizationId);
      setLoading(false);
    }
    void fetchTeamMembers(Boolean(cached));
  }, [user?.id, fetchTeamMembers]);

  const fetchInvitations = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('id, email, role, status, expires_at, created_at')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return;
    }
    setInvitations(data ?? []);
  }, [organizationId]);

  useEffect(() => {
    void fetchInvitations();
  }, [fetchInvitations]);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !organizationId) {
      toast({
        title: "Fel",
        description: "Ange en e-postadress.",
        variant: "destructive"
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast({
        title: "Ogiltig e-postadress",
        description: "Kontrollera adressen och försök igen.",
        variant: "destructive"
      });
      return;
    }

    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('team-invite', {
        body: { email, role: inviteRole, origin: window.location.origin },
      });

      if (error) {
        let serverMessage = "Kunde inte skicka inbjudan.";
        const context = (error as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            if (typeof body?.error === 'string') serverMessage = body.error;
          } catch {
            // Keep the generic message.
          }
        }
        throw new Error(serverMessage);
      }

      toast({
        title: "Inbjudan skickad",
        description: `En inbjudan har skickats till ${email} som ${ROLE_LABELS[inviteRole]}.`,
      });
      setInviteEmail('');
      void fetchInvitations();
    } catch (error) {
      console.error('Error inviting:', error);
      toast({
        title: "Fel",
        description: error instanceof Error ? error.message : "Kunde inte skicka inbjudan.",
        variant: "destructive"
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({ title: "Inbjudan återkallad", description: "Länken fungerar inte längre." });
      void fetchInvitations();
    } catch (error) {
      console.error('Error revoking invitation:', error);
      toast({
        title: "Fel",
        description: "Kunde inte återkalla inbjudan.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === user?.id) {
      toast({
        title: "Fel",
        description: "Du kan inte ta bort dig själv.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', memberId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: "Medlem borttagen",
        description: "Teammedlemmen har tagits bort."
      });
      
      void fetchTeamMembers(true);
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort medlemmen.",
        variant: "destructive"
      });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (memberId === user?.id && newRole !== 'admin') {
      toast({
        title: "Fel",
        description: "Du kan inte ändra din egen roll.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', memberId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: "Roll uppdaterad",
        description: `Rollen har ändrats till ${ROLE_LABELS[newRole]}.`
      });
      
      void fetchTeamMembers(true);
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera rollen.",
        variant: "destructive"
      });
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || '?';
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/50 rounded-lg p-6 md:p-4">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-5 w-5 text-white" />
        <h2 className="text-lg font-semibold text-white">Team</h2>
        <Badge variant="glass" className="ml-auto">
          {teamMembers.length} {teamMembers.length === 1 ? 'medlem' : 'medlemmar'}
        </Badge>
      </div>

      {/* Invite Section */}
      <div className="space-y-3 mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <div className="flex items-center gap-2 text-white mb-2">
          <UserPlus className="h-4 w-4" />
          <span className="text-sm font-medium">Bjud in teammedlem</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="E-postadress"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm"
            />
          </div>
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-full sm:w-40 bg-white/5 border-white/10 text-white h-11 !min-h-0 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-panel">
              <SelectItem value="admin" className="text-white hover:bg-white/20">Admin</SelectItem>
              <SelectItem value="recruiter" className="text-white hover:bg-white/20">Rekryterare</SelectItem>
              <SelectItem value="viewer" className="text-white hover:bg-white/20">Läsare</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            variant="glass"
            className="h-11 !min-h-0 px-4 text-sm"
          >
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Bjud in
          </Button>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-white">Väntande inbjudningar</p>
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Mail className="h-4 w-4 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <TruncatedText text={invitation.email} className="min-w-0 font-medium text-white" />
                <p className="text-sm text-white">
                  {ROLE_LABELS[invitation.role] || invitation.role} · väntar på svar
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Återkalla inbjudan"
                onClick={() => handleRevokeInvitation(invitation.id)}
                className="h-8 w-8 shrink-0 border border-destructive/40 bg-destructive/20 text-white md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Team Members List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        ) : teamMembers.length === 0 ? (
          <p className="text-center text-white py-4">Inga teammedlemmar ännu.</p>
        ) : (
          teamMembers.map((member) => (
            <div 
              key={member.user_id}
              className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-white/10 text-white text-sm" delayMs={150}>
                  {getInitials(member.first_name, member.last_name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <TruncatedText
                    text={member.first_name && member.last_name
                      ? `${member.first_name} ${member.last_name}`
                      : member.email || 'Okänd'}
                    className="min-w-0 flex-1 font-medium text-white"
                  />
                  {member.user_id === user?.id && (
                    <Badge variant="glass" className="text-xs">Du</Badge>
                  )}
                </div>
                {member.email && (
                  <TruncatedText text={member.email} className="text-sm text-white" />
                )}
              </div>

              <div className="flex items-center gap-2">
                {member.user_id === user?.id ? (
                  <Badge className={`${ROLE_COLORS[member.role]} flex items-center gap-1`}>
                    {member.role === 'admin' && <Crown className="h-3 w-3" />}
                    {ROLE_LABELS[member.role] || member.role}
                  </Badge>
                ) : (
                  <>
                    <Select 
                      value={member.role} 
                      onValueChange={(value) => handleRoleChange(member.user_id, value)}
                    >
                      <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass-panel">
                        <SelectItem value="admin" className="text-white hover:bg-white/20">Admin</SelectItem>
                        <SelectItem value="recruiter" className="text-white hover:bg-white/20">Rekryterare</SelectItem>
                        <SelectItem value="viewer" className="text-white hover:bg-white/20">Läsare</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ta bort medlem"
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="h-8 w-8 border border-destructive/40 bg-destructive/20 text-white md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Role Descriptions */}
      <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <p className="text-sm text-white mb-2 font-medium">Rollbeskrivningar:</p>
        <ul className="text-sm text-white space-y-1">
          <li><span className="text-amber-300">Admin</span> - Full åtkomst, kan hantera team och inställningar</li>
          <li><span className="text-blue-300">Rekryterare</span> - Kan skapa annonser och hantera kandidater</li>
          <li><span className="text-white/70">Läsare</span> - Kan endast se annonser och kandidater</li>
        </ul>
      </div>
    </div>
  );
};

export default TeamManagement;
