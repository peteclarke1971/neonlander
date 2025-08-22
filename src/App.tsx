import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ControlsSettings from "./pages/Controls";
import Asteroids from "./pages/Asteroids";
import LightCycles from "./pages/LightCycles";
import CavernFXDemo from "./pages/CavernFXDemo";
import NeonRacing from "./pages/NeonRacing";

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
          <Route path="/lightcycles" element={<LightCycles />} />
          <Route path="/neon-racing" element={<NeonRacing />} />
          <Route path="/cavern-fx-demo" element={<CavernFXDemo />} />
          <Route path="/settings/controls" element={<ControlsSettings />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
