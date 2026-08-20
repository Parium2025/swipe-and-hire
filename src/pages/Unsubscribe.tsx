import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, Mail } from "lucide-react";
import { Helmet } from "react-helmet-async";

/**
 * Tidigare låg en "Avprenumerera"-knapp här som verifierade en token direkt
 * vid sidladdning. Den togs bort: användaren styr i stället sina utskick i
 * notisinställningarna, så inget hinner blinka eller låsa sig i UI:t.
 */
const Unsubscribe = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#001F3D] to-[#002a52] flex items-center justify-center px-4">
      <Helmet>
        <title>Hantera dina mejl – Parium</title>
        <meta name="description" content="Styr vilka mejl och notiser du får från Parium i dina notisinställningar." />
      </Helmet>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-2 mb-6">
          <Mail className="w-5 h-5 text-[#001F3D]" />
          <span className="font-bold text-[#001F3D] tracking-tight">Parium</span>
        </div>

        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4">
          <Bell className="w-6 h-6 text-[#001F3D]" />
        </div>

        <h1 className="text-2xl font-bold text-[#001F3D] mb-2">Hantera dina utskick</h1>
        <p className="text-slate-600 mb-6">
          Du väljer själv vilka mejl och notiser du vill få. Allt styrs i dina notisinställningar — slå av
          det du inte vill ha och slå på det igen när du vill.
        </p>

        <Link to="/profile">
          <Button className="w-full bg-[#001F3D] hover:bg-[#002a52] text-white">
            Gå till notisinställningar
          </Button>
        </Link>
        <Link to="/" className="block text-center text-sm text-slate-500 mt-4 hover:underline">
          Tillbaka till Parium
        </Link>
      </div>
    </div>
  );
};

export default Unsubscribe;
