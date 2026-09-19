import type { CSSProperties, Dispatch, ReactNode, RefObject, SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessagesChrome } from '@/hooks/useMessagesChrome';
import { useVisualViewportBounds } from '@/hooks/useVisualViewportBounds';
import { SidebarProvider } from '@/components/ui/sidebar';
import EmployerSidebar from '@/components/EmployerSidebar';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import CreateJobSimpleDialog from '@/components/CreateJobSimpleDialog';
import { FloatingBubbles } from '@/components/FloatingBubbles';
import { Plus } from 'lucide-react';
import { EmployerLogoSidebarTrigger, EmployerMobileProfileAvatar } from '@/components/employer/EmployerMobileHeader';
import NotificationCenter from '@/components/NotificationCenter';

interface EmployerMobileShellProps {
  children: ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  createJobButtonRef: RefObject<HTMLButtonElement>;
  mainScrollRef: RefObject<HTMLElement>;
  onJobCreated: () => void;
}

const EmployerMobileShell = ({
  children,
  sidebarOpen,
  setSidebarOpen,
  createJobButtonRef,
  mainScrollRef,
  onJobCreated,
}: EmployerMobileShellProps) => {
  const navigate = useNavigate();
  // Chattsidan är en fullhöjdsvy — extra bottenutrymme skulle lämna en tom yta.
  // Flaggan släpps först när vybytet är klart, annars klipps chatten mitt i övergången.
  const isMessages = useMessagesChrome();
  useVisualViewportBounds();

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <div className="fixed inset-0 bg-parium-gradient pointer-events-none z-0" />

      <div
        className="fixed left-0 right-0 flex w-full overflow-hidden"
        style={{
          WebkitOverflowScrolling: 'touch',
          // Ankra mot den FAKTISKT synliga ytan på iOS. Annars kan Safari
          // lämna toppraden ovanför skärmkanten utan att den kommer tillbaka.
          top: 'var(--app-viewport-offset, 0px)',
          height: 'var(--app-viewport-height, 100dvh)',
        } as CSSProperties}
      >
        <AnimatedBackground showBubbles={false} />
        <EmployerSidebar />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 [padding-top:var(--top-chrome-content-offset,0px)]">
          <header className="relative flex-none z-50 h-14 min-h-14 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-white/20 bg-transparent px-3 [padding-left:max(0.75rem,env(safe-area-inset-left,0px))] [padding-right:max(0.75rem,env(safe-area-inset-right,0px))]" style={{ contain: 'layout paint style', transform: 'translate3d(0,0,0)', WebkitBackfaceVisibility: 'hidden' }}>
            <div className="min-w-0 flex items-center justify-self-start">
              <EmployerLogoSidebarTrigger />
            </div>
            <button
              onClick={() => navigate('/home')}
              className="min-w-0 max-w-full truncate px-2 text-white text-base font-semibold tracking-tight select-none hover:opacity-80 active:scale-[0.97] transition-all"
              aria-label="Gå till startsidan"
            >
              Parium
            </button>
            <div className="min-w-0 flex items-center justify-self-end gap-1 sm:gap-2">
              <button
                onClick={() => createJobButtonRef.current?.click()}
                className="flex items-center justify-center h-9 w-9 rounded-full text-white hover:bg-white/10 transition-colors"
                aria-label="Skapa ny annons"
              >
                <Plus className="h-[18px] w-[18px]" />
              </button>
              <NotificationCenter />
              <EmployerMobileProfileAvatar />
            </div>
          </header>

          <div className="hidden">
            <CreateJobSimpleDialog
              onJobCreated={onJobCreated}
              triggerRef={createJobButtonRef}
            />
          </div>

          <div className="absolute left-0 right-0 pointer-events-none z-20 top-14" style={{ height: 'calc(100vh - 3.5rem)' }}>
            <FloatingBubbles />
          </div>

          <main
            ref={mainScrollRef}
            data-main-scroll-container="true"
            data-scroll-managed="keepalive"
            className={`flex-1 min-h-0 overflow-x-hidden overflow-y-auto p-3 flex flex-col ${isMessages ? 'no-chrome-pad' : 'pb-8'}`}
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              paddingBottom: isMessages
                ? 'calc(env(safe-area-inset-bottom, 0px) + 14px)'
                : undefined,
            } as CSSProperties}
          >
            {children}
            <div aria-hidden="true" style={{ flexShrink: 0, height: isMessages ? '0px' : 'var(--chrome-strip-pad, calc(env(safe-area-inset-bottom, 0px) + 96px))' }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EmployerMobileShell;