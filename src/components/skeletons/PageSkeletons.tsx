import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton loading states for all major pages.
 * Uses semantic design tokens (bg-muted via Skeleton component).
 */

// ── Messages Page ──
export const MessagesSkeleton = () => (
  <div className="flex-1 min-h-0 flex flex-col animate-fade-in responsive-container-wide">
    <div className="flex items-center justify-center mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
    <div className="space-y-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  </div>
);

// ── My Applications Page ──
export const MyApplicationsSkeleton = () => (
  <div className="responsive-container-wide animate-fade-in">
    <div className="text-center mb-6 space-y-2">
      <Skeleton className="h-7 w-48 mx-auto" />
      <Skeleton className="h-4 w-56 mx-auto" />
    </div>
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Saved Jobs Page ──
export const SavedJobsSkeleton = () => (
  <div className="responsive-container-wide animate-fade-in">
    <div className="text-center mb-6 space-y-2">
      <Skeleton className="h-7 w-36 mx-auto" />
      <Skeleton className="h-4 w-52 mx-auto" />
    </div>
    <div className="flex items-center justify-center gap-2 mb-4">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-8 w-24 rounded-full" />
      ))}
    </div>
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Employer Dashboard (My Jobs) ──
export const EmployerDashboardSkeleton = () => (
  <div className="space-y-4 responsive-container-wide animate-fade-in">
    <div className="flex justify-center mb-6">
      <Skeleton className="h-7 w-48" />
    </div>
    {/* Stats grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-10" />
        </div>
      ))}
    </div>
    {/* Search bar */}
    <Skeleton className="h-10 w-full rounded-lg" />
    {/* Tabs */}
    <div className="flex justify-center gap-2">
      {[1, 2, 3].map(i => (
        <Skeleton key={i} className="h-9 w-20 rounded-full" />
      ))}
    </div>
    {/* Job cards */}
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── My Candidates (Kanban) ──
export const MyCandidatesSkeleton = () => (
  <div className="animate-fade-in px-4 pt-4">
    <div className="flex justify-center mb-4">
      <Skeleton className="h-7 w-40" />
    </div>
    {/* Mobile: list of cards */}
    <div className="md:hidden space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
    {/* Desktop: Kanban columns */}
    <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex-1 min-w-[200px] max-w-[280px]">
          <Skeleton className="h-8 w-full rounded-md mb-2" />
          <div className="space-y-2">
            {i <= 2 && [1, 2].map(j => (
              <div key={j} className="bg-white/5 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-2 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Profile Page ──
export const ProfileSkeleton = () => (
  <div className="responsive-container-wide animate-fade-in space-y-6 py-4">
    {/* Avatar + name */}
    <div className="flex flex-col items-center gap-3">
      <Skeleton className="h-20 w-20 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-24" />
    </div>
    {/* Form fields */}
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  </div>
);

// ── Company Profile Page ──
export const CompanyProfileSkeleton = () => (
  <div className="responsive-container-wide animate-fade-in space-y-6 py-4">
    <div className="flex items-center gap-4 mb-6">
      <Skeleton className="h-16 w-16 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  </div>
);

// ── Employer Settings Page ──
export const SettingsSkeleton = () => (
  <div className="responsive-container-wide animate-fade-in space-y-6 py-4">
    <div className="flex justify-center mb-4">
      <Skeleton className="h-7 w-36" />
    </div>
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

// ── Billing Page ──
export const BillingSkeleton = () => (
  <div className="responsive-container-wide animate-fade-in space-y-6 py-4">
    <div className="flex justify-center mb-4">
      <Skeleton className="h-7 w-32" />
    </div>
    {/* Plan card */}
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-60" />
    </div>
    {/* Payment method */}
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      <Skeleton className="h-5 w-36" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-12 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    {/* History */}
    <div className="space-y-3">
      {[1, 2].map(i => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  </div>
);

// ── Support Page ──
export const SupportSkeleton = () => (
  <div className="responsive-container-wide animate-fade-in space-y-6 py-4">
    <div className="flex justify-center mb-4">
      <Skeleton className="h-7 w-24" />
    </div>
    {/* Form */}
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
    {/* Tickets */}
    <div className="space-y-3">
      {[1, 2].map(i => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  </div>
);

// ── Employer Home Dashboard ──
export const EmployerHomeSkeleton = () => (
  <div className="animate-fade-in px-4 pt-4 space-y-4">
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-36" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  </div>
);

// ── Job Seeker Home Dashboard ──
export const JobSeekerHomeSkeleton = () => (
  <div className="animate-fade-in px-4 pt-4 space-y-4">
    <div className="space-y-2">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-36" />
    </div>
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  </div>
);
