import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Star,
  MoreVertical,
  Users,
  Eye
} from 'lucide-react';
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

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500', 
      'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500',
      'bg-teal-500', 'bg-cyan-500'
    ];
    const index = (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % colors.length;
    return colors[index];
  };

  const getDaysAgo = (date: string) => {
    const days = Math.floor((new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Idag';
    if (days === 1) return '1 dag';
    return `${days} dagar`;
  };

  const ApplicationCard = ({ application }: { application: JobApplication }) => {
    const fullName = `${application.first_name} ${application.last_name}`;
    
    return (
      <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/[0.15] transition-all duration-200 cursor-pointer group">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <Avatar className={`h-12 w-12 ${getAvatarColor(fullName)} flex-shrink-0`}>
              <AvatarFallback className="bg-transparent text-white font-semibold text-sm">
                {getInitials(application.first_name, application.last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium text-sm truncate mb-1">
                    {application.first_name} {application.last_name}
                  </h4>
                  <div className="flex items-center gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 text-white/30 fill-white/30" />
                    ))}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 text-white/60 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[hsl(215,100%,12%)] border-white/20">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateApplicationStatus(application.id, 'reviewing');
                      }}
                      className="text-white hover:bg-white/10 text-xs"
                    >
                      Granskar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateApplicationStatus(application.id, 'interview');
                      }}
                      className="text-white hover:bg-white/10 text-xs"
                    >
                      Intervju
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateApplicationStatus(application.id, 'offered');
                      }}
                      className="text-white hover:bg-white/10 text-xs"
                    >
                      Erbjuden
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateApplicationStatus(application.id, 'hired');
                      }}
                      className="text-white hover:bg-white/10 text-xs"
                    >
                      Anställd
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        updateApplicationStatus(application.id, 'rejected');
                      }}
                      className="text-red-300 hover:bg-red-500/10 text-xs"
                    >
                      Avvisa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/50">
                <Clock className="h-3 w-3" />
                <span>{getDaysAgo(application.applied_at)} sedan</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

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
    <EmployerLayout developerView="dashboard" onViewChange={() => {}}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="bg-white/10 border border-white/30 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tillbaka
          </Button>
        </div>

        {/* Job Title and Stats */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-white mb-2">{job.title}</h1>
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={job.is_active ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-gray-500/20 text-gray-300 border-gray-500/30'}
                  >
                    {job.is_active ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                  <Eye className="h-4 w-4" />
                  Visningar
                </div>
                <div className="text-xl font-bold text-white">{job.views_count || 0}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
                  <Users className="h-4 w-4" />
                  Ansökningar
                </div>
                <div className="text-xl font-bold text-white">{applications.length || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <Tabs defaultValue="kanban" className="w-full">
          <TabsList className="bg-white/10 border-white/20 mb-4">
            <TabsTrigger value="kanban" className="text-white data-[state=active]:bg-white/20">
              Kanban
            </TabsTrigger>
            <TabsTrigger value="list" className="text-white data-[state=active]:bg-white/20">
              Lista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 overflow-x-auto pb-4">
              {/* Inkorg */}
              <div className="min-w-[250px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-white font-medium text-sm">Inkorg</h3>
                  <Badge className="bg-white/10 text-white border-white/20 h-5 min-w-[20px] px-1.5">
                    {filterApplicationsByStatus('pending').length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {filterApplicationsByStatus('pending').map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                  {filterApplicationsByStatus('pending').length === 0 && (
                    <div className="text-white/40 text-xs text-center py-8">Inga ansökningar</div>
                  )}
                </div>
              </div>

              {/* Granskar */}
              <div className="min-w-[250px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-white font-medium text-sm">Granskar</h3>
                  <Badge className="bg-white/10 text-white border-white/20 h-5 min-w-[20px] px-1.5">
                    {filterApplicationsByStatus('reviewing').length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {filterApplicationsByStatus('reviewing').map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                  {filterApplicationsByStatus('reviewing').length === 0 && (
                    <div className="text-white/40 text-xs text-center py-8">Inga ansökningar</div>
                  )}
                </div>
              </div>

              {/* Intervju */}
              <div className="min-w-[250px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-white font-medium text-sm">Intervju</h3>
                  <Badge className="bg-white/10 text-white border-white/20 h-5 min-w-[20px] px-1.5">
                    {filterApplicationsByStatus('interview').length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {filterApplicationsByStatus('interview').map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                  {filterApplicationsByStatus('interview').length === 0 && (
                    <div className="text-white/40 text-xs text-center py-8">Inga ansökningar</div>
                  )}
                </div>
              </div>

              {/* Erbjuden */}
              <div className="min-w-[250px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-white font-medium text-sm">Erbjuden</h3>
                  <Badge className="bg-white/10 text-white border-white/20 h-5 min-w-[20px] px-1.5">
                    {filterApplicationsByStatus('offered').length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {filterApplicationsByStatus('offered').map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                  {filterApplicationsByStatus('offered').length === 0 && (
                    <div className="text-white/40 text-xs text-center py-8">Inga ansökningar</div>
                  )}
                </div>
              </div>

              {/* Anställd */}
              <div className="min-w-[250px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-white font-medium text-sm">Anställd</h3>
                  <Badge className="bg-white/10 text-white border-white/20 h-5 min-w-[20px] px-1.5">
                    {filterApplicationsByStatus('hired').length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {filterApplicationsByStatus('hired').map((app) => (
                    <ApplicationCard key={app.id} application={app} />
                  ))}
                  {filterApplicationsByStatus('hired').length === 0 && (
                    <div className="text-white/40 text-xs text-center py-8">Inga ansökningar</div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <div className="space-y-2">
              {applications.length === 0 ? (
                <div className="text-white/60 text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-3 text-white/30" />
                  <p>Inga ansökningar ännu</p>
                </div>
              ) : (
                applications.map((app) => (
                  <Card key={app.id} className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/[0.15] transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className={`h-12 w-12 ${getAvatarColor(`${app.first_name} ${app.last_name}`)}`}>
                            <AvatarFallback className="bg-transparent text-white font-semibold">
                              {getInitials(app.first_name, app.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="text-white font-semibold text-sm mb-1">
                              {app.first_name} {app.last_name}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-white/60">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getDaysAgo(app.applied_at)} sedan
                              </span>
                              {app.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {app.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={getStatusColor(app.status)}>
                          {getStatusLabel(app.status)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </EmployerLayout>
  );
};

export default JobDetails;
