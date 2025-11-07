import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ControlsSettings from "./pages/Controls";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
          <Route path="/seed-validation" element={<SeedValidation />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
