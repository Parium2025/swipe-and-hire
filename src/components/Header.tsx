import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className="flex items-center gap-2 font-semibold text-lg hover:bg-accent/50"
        >
          <Home className="h-5 w-5" />
          Parium
        </Button>
        
        {/* Space for future navigation items */}
        <div className="flex items-center gap-2">
          {/* Future: User profile, notifications, etc. */}
        </div>
      </div>
    </header>
  );
};