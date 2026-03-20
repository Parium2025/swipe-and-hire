import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Search } from 'lucide-react';

import { CandidatesTable } from '@/components/CandidatesTable';
import { QuestionFilter, type QuestionFilterValue } from '@/components/QuestionFilter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApplicationsData } from '@/hooks/useApplicationsData';

const CandidatesContent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [questionFilters, setQuestionFilters] = useState<QuestionFilterValue[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    applications,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    hasReachedLimit,
    continueLoading,
    loadedCount,
    updateRating,
  } = useApplicationsData(debouncedSearch);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(timer);
    }

    setShowContent(false);
  }, [isLoading]);

  const safeApplications = applications || [];

  const filteredApplications = useMemo(() => {
    if (questionFilters.length === 0) return safeApplications;

    return safeApplications.filter((app) => {
      const customAnswers = app.custom_answers || {};

      return questionFilters.every((filter) => {
        const matchingKey = Object.keys(customAnswers).find(
          (key) =>
            key.toLowerCase().includes(filter.question.toLowerCase()) ||
            filter.question.toLowerCase().includes(key.toLowerCase())
        );

        if (!matchingKey) return false;

        const answer = customAnswers[matchingKey];

        if (filter.answers.length === 0) {
          return answer !== undefined && answer !== null && answer !== '';
        }

        const normalizedAnswer =
          typeof answer === 'string'
            ? answer.toLowerCase()
            : typeof answer === 'boolean'
              ? answer
                ? 'ja'
                : 'nej'
              : String(answer).toLowerCase();

        return filter.answers.some(
          (selectedAnswer) =>
            normalizedAnswer === selectedAnswer.toLowerCase() ||
            (typeof answer === 'boolean' &&
              ((answer && selectedAnswer.toLowerCase() === 'ja') ||
                (!answer && selectedAnswer.toLowerCase() === 'nej')))
        );
      });
    });
  }, [questionFilters, safeApplications]);

  const filteredStats = useMemo(
    () => ({
      total: filteredApplications.length,
      new: filteredApplications.filter((app) => app.status === 'pending').length,
      reviewing: filteredApplications.filter((app) => app.status === 'reviewing').length,
      hired: filteredApplications.filter((app) => app.status === 'hired').length,
      rejected: filteredApplications.filter((app) => app.status === 'rejected').length,
    }),
    [filteredApplications]
  );

  if (isLoading || !showContent) {
    return <div className="responsive-container-wide opacity-0" />;
  }

  return (
    <div className="responsive-container-wide animate-fade-in">
      <div className="space-y-4">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Alla kandidater ({isLoading ? '...' : filteredStats.total})
          </h1>
          <p className="mt-1 text-sm text-white">
            Hantera och granska kandidater som sökt till dina jobbannonser
          </p>
        </div>

        {!isLoading && (
          <div className="mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-white" />
              <Input
                type="text"
                placeholder="Sök på namn, email, telefon, plats, jobb..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-white/20 bg-white/5 pl-10 text-white transition-colors placeholder:text-white hover:border-white/50"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <QuestionFilter value={questionFilters} onChange={setQuestionFilters} hideChips />
                <button
                  onClick={() => setSelectionMode((prev) => !prev)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    selectionMode
                      ? 'border-white/30 bg-white/20 text-white'
                      : 'border-white/20 bg-white/5 text-white hover:border-white/50 hover:bg-white/10'
                  }`}
                >
                  {selectionMode ? <span>Avsluta urval</span> : <span>Välj kandidater</span>}
                </button>
              </div>

              {questionFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <QuestionFilter value={questionFilters} onChange={setQuestionFilters} chipsOnly />
                </div>
              )}
            </div>
          </div>
        )}

        {error ? (
          <div className="py-12 text-center text-destructive">Något gick fel vid hämtning av kandidater</div>
        ) : safeApplications.length === 0 && isLoading ? (
          <Card className="border-white/10 bg-white/5 hover:border-white/50">
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-full bg-white/10" />
                <Skeleton className="h-8 w-full bg-white/10" />
                <Skeleton className="h-8 w-full bg-white/10" />
                <Skeleton className="h-8 w-3/4 bg-white/10" />
              </div>
            </CardContent>
          </Card>
        ) : safeApplications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
            <p className="text-center text-white">
              Inga kandidater än.
              <br />
              När någon söker till dina jobb så kommer deras ansökning att visas här.
            </p>
          </div>
        ) : filteredApplications.length === 0 && (questionFilters.length > 0 || searchQuery.trim()) ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-12">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Search className="h-5 w-5 text-white" />
            </div>
            <p className="text-base font-medium text-white">Inga kandidater hittades</p>
            <p className="mt-1 max-w-xs text-center text-sm text-white">
              {searchQuery.trim()
                ? 'Försök med ett annat sökord eller kontrollera stavningen'
                : 'Prova att ändra eller ta bort några filter'}
            </p>

            {(searchQuery.trim() || questionFilters.length > 0) && (
              <Button
                variant="glass"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setQuestionFilters([]);
                }}
                className="mt-3 text-xs"
              >
                Rensa filter
                <ArrowRightLeft size={14} />
              </Button>
            )}
          </div>
        ) : (
          <CandidatesTable
            applications={filteredApplications}
            onUpdate={refetch}
            onLoadMore={fetchNextPage}
            hasMore={hasNextPage && questionFilters.length === 0}
            isLoadingMore={isFetchingNextPage}
            selectionMode={selectionMode}
            onSelectionModeChange={setSelectionMode}
            hasReachedLimit={hasReachedLimit}
            onContinueLoading={continueLoading}
            loadedCount={loadedCount}
            onRatingUpdate={(applicantId, rating) => updateRating.mutate({ applicantId, rating })}
          />
        )}
      </div>
    </div>
  );
};

export default CandidatesContent;