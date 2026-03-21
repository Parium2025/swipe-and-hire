import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import EmployerSidebar from '@/components/EmployerSidebar';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { FloatingBubbles } from '@/components/FloatingBubbles';
import { Plus } from 'lucide-react';
import { EmployerLogoSidebarTrigger, EmployerMobileProfileAvatar } from '@/components/employer/EmployerMobileHeader';
import NotificationCenter from '@/components/NotificationCenter';
import DeveloperControls from '@/components/DeveloperControls';

interface EmployerMobileShellProps {
  children: ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  isOrgAdmin: boolean;
  developerView: string;
  onViewChange: (view: string) => void;
  createJobButtonRef: RefObject<HTMLButtonElement>;
  mainScrollRef: RefObject<HTMLElement>;
  onJobCreated: () => void;
}

const EmployerMobileShell = ({
  children,
  sidebarOpen,
  setSidebarOpen,
  isOrgAdmin,
  developerView,
  onViewChange,
  createJobButtonRef,
  mainScrollRef,
  onJobCreated,
}: EmployerMobileShellProps) => {
  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />

      <div className="h-[100dvh] flex w-full overflow-hidden relative" style={{ WebkitOverflowScrolling: 'touch' } as CSSProperties}>
        <AnimatedBackground showBubbles={false} />
        <EmployerSidebar />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
          <header className="shrink-0 z-40 h-14 flex items-center justify-between border-b border-white/20 bg-transparent px-3" style={{ contain: 'layout style', transform: 'translateZ(0)' }}>
            <div className="flex items-center">
              <EmployerLogoSidebarTrigger />
            </div>
            <span className="absolute left-1/2 -translate-x-1/2 text-white text-base font-semibold tracking-tight select-none pointer-events-none">
              Parium
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => createJobButtonRef.current?.click()}
                className="flex items-center justify-center h-9 w-9 rounded-full text-white hover:bg-white/10 transition-colors"
                aria-label="Skapa ny annons"
              >
                <Plus className="h-[18px] w-[18px]" />
              </button>
              <NotificationCenter />
              <EmployerMobileProfileAvatar />
              {isOrgAdmin && (
                <div className="hidden md:block">
                  <DeveloperControls
                    onViewChange={onViewChange}
                    currentView={developerView}
                  />
                </div>
              )}
            </div>
          </header>

          <div className="hidden">
            <CreateJobSimpleDialog
              onJobCreated={onJobCreated}
              triggerRef={createJobButtonRef}
            />
          </div>

          <div className="absolute left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
            <FloatingBubbles />
          </div>

          <main
            ref={mainScrollRef}
            data-main-scroll-container="true"
            className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-3 pb-8 flex flex-col"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' } as CSSProperties}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EmployerMobileShell;