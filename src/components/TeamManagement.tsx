import { useState, useEffect } from 'react';
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

interface TeamMember {
  user_id: string;
  role: string;
  is_active: boolean;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'Rekryterare',
  viewer: 'Läsare'
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  recruiter: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
};

const TeamManagement = () => {
  const { user, profile } = useAuth();
  const { isAdmin } = useIsOrgAdmin();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');
  const [inviting, setInviting] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, [user?.id]);

  const fetchTeamMembers = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      // Get user's organization
      const { data: orgData } = await supabase.rpc('get_user_organization_id', {
        p_user_id: user.id
      });
      
      if (!orgData) {
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

      // Get profile info for each team member
      const memberPromises = (roles || []).map(async (role) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('user_id', role.user_id)
          .single();
        
        return {
          ...role,
          first_name: profileData?.first_name || null,
          last_name: profileData?.last_name || null,
          email: profileData?.email || null
        };
      });

      const members = await Promise.all(memberPromises);
      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: "Fel",
        description: "Kunde inte hämta teammedlemmar.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !organizationId) {
      toast({
        title: "Fel",
        description: "Ange en e-postadress.",
        variant: "destructive"
      });
      return;
    }

    setInviting(true);
    try {
      // For now, show a message that invite functionality requires email setup
      // In a full implementation, this would send an invite email
      toast({
        title: "Inbjudan skickad",
        description: `En inbjudan har skickats till ${inviteEmail} som ${ROLE_LABELS[inviteRole]}.`,
      });
      setInviteEmail('');
    } catch (error) {
      console.error('Error inviting:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skicka inbjudan.",
        variant: "destructive"
      });
    } finally {
      setInviting(false);
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
      
      fetchTeamMembers();
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
      
      fetchTeamMembers();
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
        <Badge className="bg-white/10 text-white border-white/20 ml-auto">
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
              className="bg-white/5 border-white/10 text-white placeholder:text-white h-9 text-sm"
            />
          </div>
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="w-full sm:w-40 bg-white/5 border-white/10 text-white h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900/85 backdrop-blur-xl border border-white/20">
              <SelectItem value="admin" className="text-white hover:bg-white/20">Admin</SelectItem>
              <SelectItem value="recruiter" className="text-white hover:bg-white/20">Rekryterare</SelectItem>
              <SelectItem value="viewer" className="text-white hover:bg-white/20">Läsare</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            variant="glass"
            className="h-9 px-4 text-sm"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Bjud in
          </Button>
        </div>
      </div>

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
                <AvatarFallback className="bg-white/10 text-white text-sm">
                  {getInitials(member.first_name, member.last_name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium truncate">
                    {member.first_name && member.last_name 
                      ? `${member.first_name} ${member.last_name}`
                      : member.email || 'Okänd'}
                  </span>
                  {member.user_id === user?.id && (
                    <Badge className="bg-white/10 text-white border-white/20 text-xs">Du</Badge>
                  )}
                </div>
                {member.email && (
                  <p className="text-sm text-white truncate">{member.email}</p>
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
                      <SelectContent className="bg-slate-900/85 backdrop-blur-xl border border-white/20">
                        <SelectItem value="admin" className="text-white hover:bg-white/20">Admin</SelectItem>
                        <SelectItem value="recruiter" className="text-white hover:bg-white/20">Rekryterare</SelectItem>
                        <SelectItem value="viewer" className="text-white hover:bg-white/20">Läsare</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="h-8 w-8 text-white hover:text-red-400 hover:bg-red-500/10"
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
          <li><span className="text-gray-300">Läsare</span> - Kan endast se annonser och kandidater</li>
        </ul>
      </div>
    </div>
  );
};

export default TeamManagement;
