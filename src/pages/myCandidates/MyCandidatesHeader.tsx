import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TruncatedText } from '@/components/TruncatedText';
import { useCandidateListCounts } from '@/hooks/useCandidateListCounts';
import { TeamMemberAvatar } from '@/components/TeamMemberAvatar';
import {
  Search,
  X,
  UserCheck,
  Eye,
  ChevronDown,
  CheckSquare,
  Check,
  Settings2,
} from 'lucide-react';
import type { CandidateStage } from '@/hooks/useStageSettings';
import type { CandidateList } from '@/hooks/useCandidateLists';

interface TeamMember {
  userId: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
}

interface MyCandidatesHeaderProps {
  // Stats
  totalCount: number;
  filteredTotal: number;
  candidatesByStage: Record<string, any[]>;
  
  // Team
  hasTeam: boolean;
  teamMembers: TeamMember[];
  isViewingColleague: boolean;
  viewingColleague?: TeamMember;
  viewingColleagueId: string | null;
  onViewColleague: (id: string | null, listId?: string | null) => void;
  colleagueListsByOwner: Record<string, CandidateList[]>;
  viewingColleagueList: CandidateList | null;

  // Lists
  lists: CandidateList[];
  activeList: CandidateList | null;
  onSelectList: (id: string) => void;
  onManageLists: () => void;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  // Selection
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  displayedCandidatesCount: number;
  
  // Stage filter (desktop)
  activeStageFilter: string;
  onStageFilterChange: (filter: string) => void;
  stageOrder: string[];
  stageConfig: Record<string, { label: string; color: string; iconName?: string }>;
  
  // Device
  useMobileView: boolean;
}

export const MyCandidatesHeader = ({
  totalCount,
  filteredTotal,
  candidatesByStage,
  hasTeam,
  teamMembers,
  isViewingColleague,
  viewingColleague,
  viewingColleagueId,
  onViewColleague,
  colleagueListsByOwner,
  viewingColleagueList,
  lists,
  activeList,
  onSelectList,
  onManageLists,
  searchQuery,
  onSearchChange,
  isSelectionMode,
  onToggleSelectionMode,
  displayedCandidatesCount,
  activeStageFilter,
  onStageFilterChange,
  stageOrder,
  stageConfig,
  useMobileView,
}: MyCandidatesHeaderProps) => {
  const [listMenuOpen, setListMenuOpen] = React.useState(false);
  const countByList = useCandidateListCounts(!isViewingColleague);
  const activeListName = activeList?.name || 'Mina kandidater';

  const title = isViewingColleague
    ? `${viewingColleague?.firstName} ${viewingColleague?.lastName}${viewingColleagueList && !viewingColleagueList.is_default ? ` · ${viewingColleagueList.name}` : ''}`
    : activeListName;

  return (
    <div className="mb-6 bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg p-3 md:p-4">
      {/* Title and description */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 min-w-0">
          <DropdownMenu open={listMenuOpen} onOpenChange={setListMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Byt lista"
                className="flex items-center gap-2 min-w-0 max-w-full text-xl md:text-2xl font-semibold text-white tracking-tight transition-colors md:hover:text-white/80 active:scale-[0.99] touch-manipulation"
              >
                {isViewingColleague && <Eye className="h-5 w-5 flex-shrink-0 text-fuchsia-400" />}
                <TruncatedText
                  text={title}
                  className="truncate min-w-0 text-white"
                  tooltipSide="bottom"
                />
                <span className="text-white flex-shrink-0">({totalCount})</span>
                <ChevronDown
                  className={`h-4 w-4 text-white flex-shrink-0 transition-transform duration-300 ease-out ${listMenuOpen ? 'rotate-180' : 'rotate-0'}`}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              className="min-w-[240px] max-w-[86vw] bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-xl z-[10000] rounded-lg p-1 [&>*+*:not([role=separator])]:border-t [&>*+*:not([role=separator])]:border-white/10"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-medium text-white/70">Mina listor</DropdownMenuLabel>
              {lists.map((list, index) => {
                const isActive = !isViewingColleague && activeList?.id === list.id;
                return (
                  <DropdownMenuItem
                    key={list.id}
                    onClick={() => {
                      onViewColleague(null);
                      onSelectList(list.id);
                    }}
                    className={`flex items-center gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white/15' : ''}`}
                  >
                    {isActive ? (
                      <Check className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <UserCheck className="h-4 w-4 flex-shrink-0 text-white/70" />
                    )}
                    <span className="truncate min-w-0">{list.name}</span>
                    <span className="ml-auto pl-2 flex-shrink-0 text-white tabular-nums">
                      ({countByList[list.id] ?? 0})
                    </span>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem
                onClick={onManageLists}
                className="flex items-center gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm font-medium transition-colors"
              >
                <Settings2 className="h-4 w-4 flex-shrink-0 text-white/70" />
                Hantera listor
              </DropdownMenuItem>

              {hasTeam && teamMembers.length > 0 && (
                <DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-white/10 my-1" />
                  <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-medium text-white/70">Kollegors listor</DropdownMenuLabel>
                  {teamMembers.map(member => {
                    const memberLists = colleagueListsByOwner[member.userId] ?? [];
                    const avatar = (
                      <TeamMemberAvatar
                        profileImageUrl={member.profileImageUrl}
                        firstName={member.firstName}
                        lastName={member.lastName}
                        size="xs"
                        className="flex-shrink-0"
                      />
                    );

                    if (memberLists.length <= 1) {
                      return (
                        <DropdownMenuItem
                          key={member.userId}
                          onClick={() => onViewColleague(member.userId, memberLists[0]?.id ?? null)}
                          className={`flex items-center gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${viewingColleagueId === member.userId ? 'bg-white/15' : ''}`}
                        >
                          {avatar}
                          <span className="truncate min-w-0">{member.firstName} {member.lastName}</span>
                        </DropdownMenuItem>
                      );
                    }

                    return (
                      <DropdownMenuSub key={member.userId}>
                        <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm font-medium transition-colors">
                          {avatar}
                          <span className="truncate min-w-0">{member.firstName} {member.lastName}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="min-w-[200px] bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-xl rounded-lg p-1 [&>*+*:not([role=separator])]:border-t [&>*+*:not([role=separator])]:border-white/10">
                          {memberLists.map(list => (
                            <DropdownMenuItem
                              key={list.id}
                              onClick={() => onViewColleague(member.userId, list.id)}
                              className={`flex items-center gap-2 cursor-pointer text-white hover:bg-white/20 focus:bg-white/20 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                                viewingColleagueId === member.userId && viewingColleagueList?.id === list.id ? 'bg-white/15' : ''
                              }`}
                            >
                              <span className="truncate min-w-0">{list.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                </DropdownMenuGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-white mt-1">
          {isViewingColleague 
            ? `Visar ${viewingColleague?.firstName}s rekryteringspipeline - du kan flytta och ta bort kandidater`
            : 'Din personliga rekryteringspipeline - dra kandidater mellan steg'
          }
        </p>
      </div>


      {/* Search and Stage Filters */}
      {totalCount > 0 && (
        <div className="space-y-3">
          {/* Search input */}
          <div className="relative mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white" />
            <Input
              placeholder="Sök på namn, jobb eller anteckning"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="dashboard-control-compact pl-11 pr-12 text-base font-medium bg-white/5 border-white/20 hover:border-white/50 text-white placeholder:text-white/90 placeholder:font-normal"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="dashboard-icon-control absolute right-1.5 top-1/2 flex !min-h-0 !min-w-0 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full text-white bg-white/10 transition-colors focus:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Välj button — mobile */}
          <div className="flex justify-center min-w-0 md:hidden">
            <button
              onClick={() => displayedCandidatesCount > 0 ? onToggleSelectionMode() : undefined}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-full px-6 py-2.5 flex items-center justify-center gap-2 outline-none focus:outline-none transition-all duration-200 ring-1 min-w-0 overflow-hidden active:scale-[0.97] touch-manipulation ${
                isSelectionMode 
                  ? 'bg-white/15 ring-white/60' 
                  : displayedCandidatesCount > 0 
                    ? 'bg-white/5 ring-white/20' 
                    : 'bg-white/5 ring-white/10 opacity-40 cursor-default'
              }`}
            >
              <CheckSquare className="h-4 w-4 text-white flex-shrink-0" />
              <span className="text-white text-sm font-medium">{isSelectionMode ? 'Avbryt' : 'Välj'}</span>
            </button>
          </div>
          {/* Desktop Välj button */}
          <div className="hidden md:flex justify-center">
            <button
              onClick={() => displayedCandidatesCount > 0 ? onToggleSelectionMode() : undefined}
              onMouseDown={(e) => e.preventDefault()}
              className={`rounded-full px-5 py-2 flex items-center justify-center gap-2 outline-none focus:outline-none transition-all duration-200 min-w-0 overflow-hidden ${
                isSelectionMode 
                  ? 'bg-white/10 ring-1 ring-white hover:bg-white/15' 
                  : displayedCandidatesCount > 0 
                    ? 'bg-white/5 hover:bg-white/10' 
                    : 'bg-white/5 opacity-40 cursor-default'
              }`}
            >
              <CheckSquare className="h-4 w-4 text-white flex-shrink-0" />
              <span className="text-white text-sm font-medium">{isSelectionMode ? 'Avbryt' : 'Välj'}</span>
            </button>
          </div>

          {/* Stage filters — hidden on mobile */}
          <div className={`flex-wrap justify-center gap-2 ${useMobileView ? 'hidden' : 'flex'}`}>
            <button
              onClick={() => onStageFilterChange('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                activeStageFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white hover:bg-white/10 hover:text-white'
              }`}
            >
              Alla ({totalCount})
            </button>
            {stageOrder.map(stage => {
              const settings = stageConfig[stage];
              const count = candidatesByStage[stage]?.length || 0;
              const isActive = activeStageFilter === stage;
              const label = settings?.label || '';
              const isTruncated = label.length > 20;
              
              const buttonContent = (
                <button
                  key={stage}
                  onClick={() => onStageFilterChange(isActive ? 'all' : stage)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full transition-all text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm max-w-[200px] min-w-0 inline-flex items-center gap-1"
                  style={{
                    backgroundColor: isActive ? `${settings?.color}66` : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <span className="truncate min-w-0">{label}</span>
                  <span className="flex-shrink-0">({count})</span>
                </button>
              );
              
              if (!isTruncated) {
                return buttonContent;
              }

              
              return (
                <TooltipProvider key={stage} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {buttonContent}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{label} ({count})</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          {/* Search results info */}
          {searchQuery && (
            filteredTotal === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 px-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
                  <Search className="h-5 w-5 text-white/60" />
                </div>
                <p className="text-white font-medium text-sm">Inga kandidater hittades</p>
                <p className="text-white/60 text-xs mt-1 text-center max-w-xs">
                  Försök med ett annat sökord eller kontrollera stavningen
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSearchChange('')}
                  className="mt-3 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Rensa sökning
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-white">
                Visar {filteredTotal} av {totalCount} kandidater
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
};
