import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { PariumLogoRingsInline } from "@/assets/pariumLogoRingsInline";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className="flex items-center gap-3 p-2 hover:bg-accent/50 rounded-lg transition-colors"
        >
          <PariumLogoRingsInline
            alt="Parium"
            width={128}
            height={32}
            className="h-8 w-auto"
          />
        </Button>
        
        {/* Space for future navigation items */}
        <div className="flex items-center gap-2">
          {/* Future: User profile, notifications, etc. */}
        </div>
      </div>
    </header>
  );
};
