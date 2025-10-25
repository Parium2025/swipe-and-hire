import { useState, useMemo } from 'react';
import EmployerLayout from '@/components/EmployerLayout';
import { useApplicationsData } from '@/hooks/useApplicationsData';
import { CandidatesTable } from '@/components/CandidatesTable';
import { CandidatesFilters } from '@/components/CandidatesFilters';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const Candidates = () => {
  const { applications, stats, isLoading, refetch } = useApplicationsData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [developerView, setDeveloperView] = useState('candidates');

  const filteredApplications = useMemo(() => {
    let filtered = [...applications];

    // Filter by status
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(app => app.status === selectedFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app => {
        const fullName = `${app.first_name || ''} ${app.last_name || ''}`.toLowerCase();
        const email = (app.email || '').toLowerCase();
        const jobTitle = (app.job_title || '').toLowerCase();
        
        return fullName.includes(query) || email.includes(query) || jobTitle.includes(query);
      });
    }

    return filtered;
  }, [applications, selectedFilter, searchQuery]);

  return (
    <EmployerLayout developerView={developerView} onViewChange={setDeveloperView}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Alla kandidater ({stats.total})
            </h1>
            <p className="text-muted-foreground">
              Hantera och granska kandidater som sökt till dina jobbannonser
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Sök på namn, email eller tjänst..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                <CandidatesFilters
                  stats={stats}
                  selectedFilter={selectedFilter}
                  onFilterChange={setSelectedFilter}
                />
              </div>
            </div>

            {/* Candidates Table */}
            <div className="lg:col-span-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <CandidatesTable applications={filteredApplications} onUpdate={refetch} />
              )}
            </div>
          </div>
        </div>
      </div>
    </EmployerLayout>
  );
};

export default Candidates;
