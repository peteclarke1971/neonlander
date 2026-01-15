import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ControlsSettings from "./pages/Controls";
import AudioSettings from "./pages/AudioSettings";
import Asteroids from "./pages/Asteroids";
import AsteroidsColor from "./pages/AsteroidsColor";
import AsteroidsRemix from "./pages/AsteroidsRemix";
import LightCycles from "./pages/LightCycles";
import CavernFXDemo from "./pages/CavernFXDemo";
import NeonRacing from "./pages/NeonRacing";
import NeonDocking from "./pages/NeonDocking";
import Duel from "./pages/Duel";
import Survival from "./pages/Survival";
import SeedValidation from "./pages/SeedValidation";

const queryClient = new QueryClient();

const App = () => {
  const [scanlinesEnabled, setScanlinesEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ll-scanlines-enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [scanlineSettings, setScanlineSettings] = useState(() => ({
    spacing: 2,
    opacity: 0.15,
    intensity: 0.5,
    blendMode: 'multiply'
  }));

  const loadScanlineSettings = () => {
    try {
      setScanlineSettings({
        spacing: JSON.parse(localStorage.getItem('ll-scanline-spacing') || '2'),
        opacity: JSON.parse(localStorage.getItem('ll-scanline-opacity') || '0.15'),
        intensity: JSON.parse(localStorage.getItem('ll-scanline-intensity') || '0.5'),
        blendMode: JSON.parse(localStorage.getItem('ll-scanline-blend-mode') || '"multiply"')
      });
    } catch {}
  };

  // Listen for changes from Controls page
  useEffect(() => {
    const handleScanlinesChange = (e: CustomEvent) => {
      setScanlinesEnabled(e.detail);
    };
    const handleSettingsChange = () => {
      loadScanlineSettings();
    };
    window.addEventListener('scanlinesChanged', handleScanlinesChange as EventListener);
    window.addEventListener('scanlineSettingsChanged', handleSettingsChange);
    return () => {
      window.removeEventListener('scanlinesChanged', handleScanlinesChange as EventListener);
      window.removeEventListener('scanlineSettingsChanged', handleSettingsChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* Global Scanline Overlay */}
        {scanlinesEnabled && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 9999,
              background: `repeating-linear-gradient(0deg, rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) ${scanlineSettings.spacing - 1}px, rgba(0, 0, 0, ${scanlineSettings.opacity}) ${scanlineSettings.spacing - 1}px, rgba(0, 0, 0, ${scanlineSettings.opacity}) ${scanlineSettings.spacing}px)`,
              opacity: scanlineSettings.intensity,
              mixBlendMode: scanlineSettings.blendMode as any
            }}
            aria-hidden="true"
          />
        )}
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/asteroids" element={<Asteroids />} />
          <Route path="/asteroids-color" element={<AsteroidsColor />} />
          <Route path="/asteroids-remix" element={<AsteroidsRemix />} />
          <Route path="/duel" element={<Duel />} />
          <Route path="/lightcycles" element={<LightCycles />} />
          <Route path="/neon-racing" element={<NeonRacing />} />
          <Route path="/neon-docking" element={<NeonDocking />} />
          <Route path="/survival" element={<Survival />} />
          <Route path="/cavern-fx-demo" element={<CavernFXDemo />} />
          <Route path="/settings/controls" element={<ControlsSettings />} />
          <Route path="/settings/audio" element={<AudioSettings />} />
          <Route path="/seed-validation" element={<SeedValidation />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
