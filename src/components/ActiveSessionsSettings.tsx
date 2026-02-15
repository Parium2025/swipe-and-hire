import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Monitor, Smartphone, Tablet, Laptop, Globe, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface SessionData {
  id: string;
  session_token: string;
  device_label: string | null;
  created_at: string;
  last_heartbeat_at: string;
  is_current: boolean;
}

const SESSION_TOKEN_KEY = 'parium_session_token';

function getCurrentSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Get the appropriate icon for a device label
 */
function getDeviceIcon(label: string | null) {
  if (!label) return <Globe className="h-5 w-5" />;
  const lower = label.toLowerCase();
  if (lower.includes('iphone') || lower.includes('android')) {
    return <Smartphone className="h-5 w-5" />;
  }
  if (lower.includes('ipad') || lower.includes('surfplatta')) {
    return <Tablet className="h-5 w-5" />;
  }
  if (lower.includes('mac') || lower.includes('windows') || lower.includes('linux') || lower.includes('chromebook')) {
    return <Monitor className="h-5 w-5" />;
  }
  return <Laptop className="h-5 w-5" />;
}

export function ActiveSessionsSettings() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [kickingId, setKickingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_active_sessions');
      if (error) {
        console.warn('Failed to fetch sessions:', error.message);
        return;
      }

      const currentToken = getCurrentSessionToken();
      const enriched: SessionData[] = ((data as any[]) || []).map((s) => ({
        ...s,
        is_current: s.session_token === currentToken,
      }));

      setSessions(enriched);
    } catch (err) {
      console.warn('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleKickSession = async (sessionId: string) => {
    setKickingId(sessionId);
    try {
      const { data, error } = await supabase.rpc('kick_session', {
        p_session_id: sessionId,
      });

      if (error) {
        toast({
          title: 'Kunde inte logga ut sessionen',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      if (data) {
        toast({
          title: 'Session avslutad',
          description: 'Enheten har loggats ut.',
        });
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch (err) {
      console.warn('Error kicking session:', err);
    } finally {
      setKickingId(null);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
      <div className="space-y-5 md:space-y-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-white" />
            <h3 className="text-sm font-medium text-white">Aktiva sessioner</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
            className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <p className="text-xs text-white/50">
          Du kan ha max 2 aktiva sessioner samtidigt. Om du loggar in på en tredje enhet avslutas den äldsta sessionen automatiskt.
        </p>

        {loading && sessions.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 animate-pulse">
                <div className="h-5 w-5 rounded bg-white/10" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded bg-white/10" />
                  <div className="h-2.5 w-16 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-white/70 text-center py-4">Inga aktiva sessioner hittades</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  session.is_current
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-white/5 border border-transparent'
                }`}
              >
                <div className="text-white/70">
                  {getDeviceIcon(session.device_label)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-white truncate">
                      {session.device_label || 'Okänd enhet'}
                    </Label>
                    {session.is_current && (
                      <span className="text-[10px] font-medium bg-white/20 text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        Denna enhet
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">
                    Aktiv {formatDistanceToNow(new Date(session.last_heartbeat_at), {
                      addSuffix: true,
                      locale: sv,
                    })}
                  </p>
                </div>
                {!session.is_current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleKickSession(session.id)}
                    disabled={kickingId === session.id}
                    className="h-8 px-2.5 text-xs text-white/60 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                  >
                    <LogOut className={`h-3.5 w-3.5 mr-1 ${kickingId === session.id ? 'animate-spin' : ''}`} />
                    Logga ut
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
