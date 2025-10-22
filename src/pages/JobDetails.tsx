import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Mail, 
  Phone, 
  FileText,
  MoreVertical,
  CheckCircle,
  XCircle,
  Users,
  Eye
} from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EmployerLayout from '@/components/EmployerLayout';

interface JobApplication {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  age: number;
  location: string;
  bio: string;
  cv_url: string;
  employment_status: string;
  availability: string;
  applied_at: string;
  status: 'pending' | 'reviewing' | 'interview' | 'offered' | 'hired' | 'rejected';
  custom_answers: any;
}

interface JobPosting {
  id: string;
  title: string;
  location: string;
  is_active: boolean;
  views_count: number;
  applications_count: number;
  created_at: string;
}

const JobDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId || !user) return;
    fetchJobData();
  }, [jobId, user]);

  const fetchJobData = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', jobId)
        .eq('employer_id', user?.id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      // Fetch applications
      const { data: applicationsData, error: applicationsError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('job_id', jobId)
        .order('applied_at', { ascending: false });

      if (applicationsError) throw applicationsError;
      setApplications((applicationsData || []) as JobApplication[]);
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (applicationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);

      if (error) throw error;

      toast({
        title: 'Status uppdaterad',
        description: 'Ansökningsstatus har uppdaterats.',
      });

      fetchJobData();
    } catch (error: any) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'reviewing':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'interview':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'offered':
        return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'hired':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'rejected':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      default:
        return 'bg-white/10 text-white border-white/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Inkorg';
      case 'reviewing': return 'Granskar';
      case 'interview': return 'Intervju';
      case 'offered': return 'Erbjuden';
      case 'hired': return 'Anställd';
      case 'rejected': return 'Avvisad';
      default: return status;
    }
  };

  const filterApplicationsByStatus = (status: string) => {
    return applications.filter(app => app.status === status);
  };

  const ApplicationCard = ({ application }: { application: JobApplication }) => (
    <Card className="bg-white/5 backdrop-blur-sm border-white/20 mb-2">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-white text-xs">
              {getInitials(application.first_name, application.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-white font-semibold text-sm truncate">
                {application.first_name} {application.last_name}
              </h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-white hover:bg-white/10">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[hsl(215,100%,12%)] border-white/20">
                  <DropdownMenuItem 
                    onClick={() => updateApplicationStatus(application.id, 'reviewing')}
                    className="text-white hover:bg-white/10"
                  >
                    Flytta till Granskar
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => updateApplicationStatus(application.id, 'interview')}
                    className="text-white hover:bg-white/10"
                  >
                    Flytta till Intervju
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => updateApplicationStatus(application.id, 'offered')}
                    className="text-white hover:bg-white/10"
                  >
                    Flytta till Erbjuden
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => updateApplicationStatus(application.id, 'hired')}
                    className="text-white hover:bg-white/10"
                  >
                    Flytta till Anställd
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => updateApplicationStatus(application.id, 'rejected')}
                    className="text-red-300 hover:bg-red-500/10"
                  >
                    Avvisa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-1 text-sm text-white/70">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(application.applied_at).toLocaleDateString('sv-SE')}</span>
              </div>
              {application.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{application.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Laddar...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Jobbet hittades inte</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto px-12 py-4 pb-safe min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="bg-white/10 border-2 border-white text-white hover:bg-white/20 transition-all duration-150 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka
          </Button>
        </div>

        {/* Job Title and Stats */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <TruncatedText 
                text={job.title}
                className="text-xl font-bold text-white mb-2 two-line-ellipsis block"
              />
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-white">
                  <MapPin className="h-4 w-4" />
                  {job.location}
                </div>
                <Badge 
                  variant={job.is_active ? "default" : "secondary"}
                  className={`text-sm whitespace-nowrap cursor-pointer ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('job_postings')
                        .update({ is_active: !job.is_active })
                        .eq('id', jobId);
                      
                      if (error) throw error;
                      
                      toast({
                        title: job.is_active ? 'Jobb inaktiverat' : 'Jobb aktiverat',
                        description: job.is_active ? 'Jobbet är nu inaktivt.' : 'Jobbet är nu aktivt.',
                      });
                      
                      fetchJobData();
                    } catch (error: any) {
                      toast({
                        title: 'Fel',
                        description: error.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  {job.is_active ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2 text-white text-sm mb-1">
                <Eye className="h-4 w-4" />
                Visningar
              </div>
              <div className="text-xl font-bold text-white">{job.views_count}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2 text-white text-sm mb-1">
                <Users className="h-4 w-4" />
                Ansökningar
              </div>
              <div className="text-xl font-bold text-white">{job.applications_count}</div>
            </div>
          </div>
        </div>

        {/* Kanban View */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Inkorg */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Inkorg</h3>
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">
                {filterApplicationsByStatus('pending').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('pending').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Granskar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Granskar</h3>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/40">
                {filterApplicationsByStatus('reviewing').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('reviewing').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Intervju */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Intervju</h3>
              <Badge variant="outline" className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                {filterApplicationsByStatus('interview').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('interview').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Erbjuden */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Erbjuden</h3>
              <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/40">
                {filterApplicationsByStatus('offered').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('offered').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>

          {/* Anställd */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold text-sm">Anställd</h3>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                {filterApplicationsByStatus('hired').length}
              </Badge>
            </div>
            <div className="space-y-2">
              {filterApplicationsByStatus('hired').map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          </div>
        </div>
      </div>
  );
};

export default JobDetails;
