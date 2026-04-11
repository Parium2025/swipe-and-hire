import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">404</h1>
        <p className="text-xl text-white/60 mb-4">Sidan kunde inte hittas</p>
        <Link to="/" className="text-primary hover:text-primary/80 underline">
          Tillbaka till startsidan
        </Link>
      </div>
    </div>
  );
};

export default NotFound;