import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className="flex items-center gap-3 p-2 hover:bg-accent/50 rounded-lg transition-colors"
        >
          <img 
            src="/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png" 
            alt="Parium" 
            className="h-8 w-auto"
            width="128"
            height="32"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
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