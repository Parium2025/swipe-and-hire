import { useState, memo, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { Eye, MessageCircle, MapPin, Calendar, Edit, Trash2, AlertTriangle, Briefcase, TrendingUp, Users, Search, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { expandSearchTerms } from '@/lib/smartSearch';
import EditJobDialog from '@/components/EditJobDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobsData, type JobPosting } from '@/hooks/useJobsData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { JobTitleCell } from '@/components/JobTitleCell';
import { TruncatedText } from '@/components/TruncatedText';
import { MobileJobCard } from '@/components/MobileJobCard';
import { formatDateShortSv } from '@/lib/date';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const EmployerDashboard = memo(() => {
  const navigate = useNavigate();
  const { jobs, stats, isLoading: loading, invalidateJobs } = useJobsData();
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobPosting | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  // Search and sort state
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc'>('newest');
  
  // Pagination state for mobile
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const listTopRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);
  
  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1); // Reset to first page when searching
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchInput]);
  
  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];
    
    // Filter based on search term
    if (searchTerm.trim()) {
      const expandedTerms = expandSearchTerms(searchTerm);
      result = result.filter(job => {
        const searchableText = [
          job.title,
          job.location,
          job.employment_type,
          job.description,
          job.workplace_city
        ].filter(Boolean).join(' ').toLowerCase();
        
        return expandedTerms.some(term => 
          searchableText.includes(term.toLowerCase())
        );
      });
    }
    
    // Sort
    switch (sortBy) {
      case 'oldest':
        return result.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'title-asc':
        return result.sort((a, b) => 
          a.title.localeCompare(b.title, 'sv')
        );
      case 'title-desc':
        return result.sort((a, b) => 
          b.title.localeCompare(a.title, 'sv')
        );
      case 'newest':
      default:
        return result.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  }, [jobs, searchTerm, sortBy]);
  
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedJobs.length / pageSize));
  const pageJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedJobs.slice(start, start + pageSize);
  }, [filteredAndSortedJobs, page]);
  
  // Scroll to top when page changes (but not on initial mount)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page]);

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('job_postings')
        .update({ is_active: !currentStatus })
        .eq('id', jobId);

      if (error) {
        toast({
          title: "Fel vid uppdatering",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Status uppdaterad",
        description: `Annonsen är nu ${!currentStatus ? 'aktiv' : 'inaktiv'}.`
      });

      invalidateJobs();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte uppdatera annonsens status.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (job: JobPosting) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      const { error } = await supabase
        .from('job_postings')
        .delete()
        .eq('id', jobToDelete.id);

      if (error) {
        toast({
          title: "Fel vid borttagning",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Annons borttagen",
        description: "Jobbannonsen har tagits bort."
      });

      setDeleteDialogOpen(false);
      setJobToDelete(null);
      invalidateJobs();
    } catch (error) {
      toast({
        title: "Ett fel uppstod",
        description: "Kunde inte ta bort annonsen.",
        variant: "destructive"
      });
    }
  };

  const handleEditJob = (job: JobPosting) => {
    console.log('[MyJobs] Open edit for job:', { id: job.id, title: job.title });
    setEditingJob(job);
    setEditDialogOpen(true);
  };


  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return '';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    if (min) return `Från ${min.toLocaleString()} kr/mån`;
    if (max) return `Upp till ${max.toLocaleString()} kr/mån`;
    return '';
  };


  return (
    <div className="space-y-4 max-w-6xl mx-auto px-3 md:px-12">
      <div className="flex justify-center items-center mb-4">
        <h1 className="text-xl md:text-2xl font-semibold text-white">Mina jobbannonser</h1>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-2">
        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <Briefcase className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Totalt annonser</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Aktiva annonser</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.filter(job => job.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <Eye className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Totala visningar</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.reduce((sum, job) => sum + job.views_count, 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4">
            <Users className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white">Ansökningar</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {loading ? '...' : jobs.reduce((sum, job) => sum + job.applications_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        {/* Search field */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
          <Input
            placeholder="Sök efter titel, plats, anställningstyp..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/60"
          />
        </div>
        
        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full md:w-auto md:min-w-[180px] bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              {sortBy === 'newest' && 'Nyast först'}
              {sortBy === 'oldest' && 'Äldst först'}
              {sortBy === 'title-asc' && 'Titel A-Ö'}
              {sortBy === 'title-desc' && 'Titel Ö-A'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end"
            className="w-[200px]"
          >
            <DropdownMenuItem onClick={() => setSortBy('newest')}>
              Nyast först
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('oldest')}>
              Äldst först
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('title-asc')}>
              Titel A-Ö
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('title-desc')}>
              Titel Ö-A
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Result indicator */}
      {searchTerm && (
        <div className="text-sm text-white mb-4">
          {filteredAndSortedJobs.length === 0 ? (
            <span>Inga annonser matchar din sökning</span>
          ) : (
            <span>
              Visar {filteredAndSortedJobs.length} av {jobs.length} annonser
            </span>
          )}
        </div>
      )}

      {/* Jobs Table */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader className="hidden md:block md:p-4">
              <CardTitle className="text-sm text-white md:text-left">
                Mina jobbannonser
              </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 md:px-4 md:pb-4">
          {/* Desktop: Table view */}
          <div className="hidden md:block">
            <div className="overflow-x-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/20 hover:bg-white/5">
                    <TableHead className="text-white font-semibold text-sm px-2 w-[28%]">Titel</TableHead>
                    <TableHead className="text-white font-semibold text-sm px-2 w-[10%]">Status</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[8%]">Visningar</TableHead>
                    <TableHead className="text-white font-semibold text-sm text-center px-2 w-[8%]">Ansökningar</TableHead>
                    <TableHead className="text-white font-semibold text-sm px-2 w-[12%]">Plats</TableHead>
                    <TableHead className="text-white font-semibold text-sm px-2 w-[12%]">Rekryterare</TableHead>
                    <TableHead className="text-white font-semibold text-sm px-2 w-[10%]">Skapad</TableHead>
                    <TableHead className="text-white font-semibold text-sm px-2 w-[12%]">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-white/60 py-8 text-sm">
                        Laddar...
                      </TableCell>
                    </TableRow>
                  ) : filteredAndSortedJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center !text-white py-8 font-medium text-sm">
                        {searchTerm.trim() ? 'Inga annonser matchar din sökning' : 'Inga jobbannonser än. Skapa din första annons!'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedJobs.map((job) => (
                      <TableRow 
                        key={job.id}
                        className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => navigate(`/job-details/${job.id}`)}
                      >
                        <TableCell className="font-medium text-white px-2 py-2">
                          <JobTitleCell title={job.title} employmentType={job.employment_type} />
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Badge
                            variant={job.is_active ? "default" : "secondary"}
                            className={`text-sm whitespace-nowrap ${job.is_active ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                          >
                            {job.is_active ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center px-2 py-2">
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-sm">
                            {job.views_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center px-2 py-2">
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-sm">
                            {job.applications_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white px-2 py-2">
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin size={12} className="flex-shrink-0" />
                            <TruncatedText text={job.location} className="truncate max-w-[100px]" />
                          </div>
                        </TableCell>
                        <TableCell className="text-white px-2 py-2">
                          <TruncatedText 
                            text={job.employer_profile?.first_name && job.employer_profile?.last_name
                              ? `${job.employer_profile.first_name} ${job.employer_profile.last_name}`
                              : '-'}
                            className="text-sm truncate max-w-[110px] block"
                          />
                        </TableCell>
                        <TableCell className="text-white px-2 py-2">
                          <div className="flex items-center gap-1 text-sm whitespace-nowrap">
                            <Calendar size={12} />
                            {formatDateShortSv(job.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <div className="flex items-center gap-0.5">
                            <Switch
                              checked={job.is_active}
                              onCheckedChange={() => toggleJobStatus(job.id, job.is_active)}
                              onClick={(e) => e.stopPropagation()}
                              className="scale-75"
                            />
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditJob(job);
                              }}
                              className="h-6 px-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 text-[10px]"
                            >
                              <Edit size={12} />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(job);
                              }}
                              className="h-6 px-1.5 bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 text-[10px]"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile: Card view */}
          <div className="md:hidden">
            {loading ? (
              <div className="text-center text-white/60 py-8 text-sm">
                Laddar...
              </div>
            ) : filteredAndSortedJobs.length === 0 ? (
              <div className="text-center text-white py-8 font-medium text-sm">
                {searchTerm.trim() ? 'Inga annonser matchar din sökning' : 'Inga jobbannonser än. Skapa din första annons!'}
              </div>
            ) : (
              <>
                <div ref={listTopRef} />
                <div className="rounded-none bg-transparent ring-0 shadow-none">
                  <ScrollArea className="h-[calc(100vh-280px)] min-h-[320px]">
                    <div className="space-y-2 px-2 py-2 pb-24">
                      {pageJobs.map((job) => (
                        <MobileJobCard
                          key={job.id}
                          job={job}
                          onToggleStatus={toggleJobStatus}
                          onEdit={handleEditJob}
                          onDelete={handleDeleteClick}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {totalPages > 1 && (
                  <Pagination className="mt-3">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p => Math.max(1, p - 1));
                          }}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>

                      {page > 2 && (
                        <>
                          <PaginationItem>
                            <PaginationLink
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(1);
                              }}
                              className="cursor-pointer"
                            >
                              1
                            </PaginationLink>
                          </PaginationItem>
                          {page > 3 && <PaginationEllipsis />}
                        </>
                      )}

                      {page > 1 && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(page - 1);
                            }}
                            className="cursor-pointer"
                          >
                            {page - 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      <PaginationItem>
                        <PaginationLink isActive>
                          {page}
                        </PaginationLink>
                      </PaginationItem>

                      {page < totalPages && (
                        <PaginationItem>
                          <PaginationLink
                            onClick={(e) => {
                              e.preventDefault();
                              setPage(page + 1);
                            }}
                            className="cursor-pointer"
                          >
                            {page + 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}

                      {page < totalPages - 1 && (
                        <>
                          {page < totalPages - 2 && <PaginationEllipsis />}
                          <PaginationItem>
                            <PaginationLink
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(totalPages);
                              }}
                              className="cursor-pointer"
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        </>
                      )}

                      <PaginationItem>
                        <PaginationNext
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p => Math.min(totalPages, p + 1));
                          }}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0">
          <AlertDialogHeader className="space-y-3">
            <div className="flex items-center justify-center sm:justify-start gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold text-center sm:text-left">
                Ta bort jobbannons
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white/90 text-sm leading-relaxed break-words text-center">
              {jobToDelete && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white break-words">"{jobToDelete.title}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setJobToDelete(null);
              }}
              className="w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteJob}
              className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white border-0 text-sm"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditJobDialog
        job={editingJob}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onJobUpdated={invalidateJobs}
      />
    </div>
  );
});

EmployerDashboard.displayName = 'EmployerDashboard';

export default EmployerDashboard;