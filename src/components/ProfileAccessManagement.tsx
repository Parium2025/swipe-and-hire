import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSecureProfileAccess } from '@/hooks/useSecureProfileAccess';
import { Trash2, Eye, Clock, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface ProfilePermission {
  id: string;
  employer_id: string;
  job_posting_id?: string;
  permission_type: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
}

export const ProfileAccessManagement = () => {
  const { user } = useAuth();
  const { revokeProfileAccess } = useSecureProfileAccess();
  const [permissions, setPermissions] = useState<ProfilePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, [user]);

  const fetchPermissions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profile_view_permissions')
        .select('*')
        .eq('job_seeker_id', user.id)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch permissions:', error);
        return;
      }

      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (employerId: string) => {
    const success = await revokeProfileAccess(employerId);
    if (success) {
      // Refresh the permissions list
      fetchPermissions();
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getExpirationText = (expiresAt?: string) => {
    if (!expiresAt) return 'Permanent åtkomst';
    
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    
    if (expirationDate < now) {
      return 'Utgången';
    }
    
    return `Går ut ${formatDistanceToNow(expirationDate, { 
      addSuffix: true, 
      locale: sv 
    })}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Profilåtkomst
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Laddar åtkomstbehörigheter...</p>
        </CardContent>
      </Card>
    );
  }

  if (permissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Profilåtkomst
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Inga arbetsgivare har för närvarande åtkomst till din profil.
          </p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Din integritet är skyddad:</strong> När du ansöker om jobb får 
              arbetsgivaren endast begränsad åtkomst till din profil med maskerade 
              känsliga uppgifter som telefonnummer och fullständig adress.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Profilåtkomst ({permissions.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Hantera vilka arbetsgivare som har åtkomst till din profil
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {permissions.map((permission, index) => (
            <div key={permission.id}>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      Arbetsgivare (ID: {permission.employer_id.slice(0, 8)}...)
                    </span>
                    <Badge 
                      variant={isExpired(permission.expires_at) ? 'destructive' : 'secondary'}
                    >
                      {permission.permission_type === 'application_based' ? 'Ansökan' : 'Annan'}
                    </Badge>
                  </div>
                  
                  {permission.job_posting_id && (
                    <p className="text-sm text-muted-foreground mb-1">
                      Jobb ID: {permission.job_posting_id.slice(0, 8)}...
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Beviljad {formatDistanceToNow(new Date(permission.granted_at), { 
                        addSuffix: true, 
                        locale: sv 
                      })}
                    </span>
                    <span>{getExpirationText(permission.expires_at)}</span>
                  </div>
                </div>
                
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleRevokeAccess(permission.employer_id)}
                  disabled={isExpired(permission.expires_at)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Återkalla
                </Button>
              </div>
              
              {index < permissions.length - 1 && <Separator className="my-2" />}
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            🛡️ Dina uppgifter är skyddade
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Telefonnummer och fullständig adress döljs</li>
            <li>• Endast stad visas, inte fullständig adress</li>
            <li>• Biografin trunkeras till 200 tecken</li>
            <li>• Åtkomst går automatiskt ut efter 30 dagar</li>
            <li>• All åtkomst loggas för säkerhet</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};