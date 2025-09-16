import { DataSharingConsent } from '@/components/DataSharingConsent';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

const Consent = () => {
  return (
    <SidebarProvider>
      <div className="relative min-h-screen w-full">
        {/* Top header with sidebar trigger (does not change page layout) */}
        <header className="h-12 flex items-center px-4">
          <SidebarTrigger className="text-white hover:bg-white/20" />
        </header>

        {/* Sidebar mounted as overlay so main content layout stays EXACTLY the same */}
        <div className="fixed inset-y-0 left-0 z-40">
          <AppSidebar />
        </div>

        {/* Original page content preserved */}
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Mitt samtycke</h1>
            <p className="text-white">
              Hantera hur din information delas med potentiella arbetsgivare
            </p>
          </div>
          <DataSharingConsent />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Consent;