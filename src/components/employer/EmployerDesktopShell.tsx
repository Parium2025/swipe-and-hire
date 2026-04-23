import type { CSSProperties, ReactNode, RefObject } from 'react';
import EmployerTopNav from '@/components/EmployerTopNav';
import DeveloperControls from '@/components/DeveloperControls';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { FloatingBubbles } from '@/components/FloatingBubbles';

interface EmployerDesktopShellProps {
  children: ReactNode;
  isOrgAdmin: boolean;
  developerView: string;
  onViewChange: (view: string) => void;
  createJobButtonRef: RefObject<HTMLButtonElement>;
  mainScrollRef: RefObject<HTMLElement>;
  onJobCreated: () => void;
}

const EmployerDesktopShell = ({
  children,
  isOrgAdmin,
  developerView,
  onViewChange,
  createJobButtonRef,
  mainScrollRef,
  onJobCreated,
}: EmployerDesktopShellProps) => {
  return (
    <>
      <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />

      <div className="h-screen flex flex-col w-full overflow-hidden relative">
        <AnimatedBackground showBubbles={false} />

        <header className="sticky top-0 z-40">
          <EmployerTopNav
            extraRight={
              <div className="flex items-center gap-3">
                {isOrgAdmin && (
                  <DeveloperControls
                    onViewChange={onViewChange}
                    currentView={developerView}
                    forceVisible={isOrgAdmin}
                  />
                )}
                <CreateJobSimpleDialog
                  onJobCreated={onJobCreated}
                  triggerRef={createJobButtonRef}
                  triggerClassName="transition-none active:scale-100 active:bg-white/5 active:border-white/20 active:shadow-none"
                />
              </div>
            }
          />
        </header>

        <div className="fixed left-0 right-0 top-14 pointer-events-none z-20" style={{ height: 'calc(100vh - 3.5rem)' }}>
          <FloatingBubbles />
        </div>

        <main
          ref={mainScrollRef}
          data-main-scroll-container="true"
          className="flex-1 min-h-0 overflow-y-auto p-3 relative z-10 flex flex-col"
          style={{ willChange: 'scroll-position', WebkitOverflowScrolling: 'touch' } as CSSProperties}
        >
          {children}
        </main>
      </div>
    </>
  );
};

export default EmployerDesktopShell;