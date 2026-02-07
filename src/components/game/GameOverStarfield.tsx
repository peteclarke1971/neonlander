import React, { useState } from "react";
import { HyperspaceStarfield } from "./HyperspaceStarfield";
import { MobileStarfield } from "./MobileStarfield";
import { NeonVortexStarfield } from "./NeonVortexStarfield";
import { PrismaticWavesStarfield } from "./PrismaticWavesStarfield";
import { CosmicTunnelStarfield } from "./CosmicTunnelStarfield";
import { NebulaDriftStarfield } from "./NebulaDriftStarfield";
import { IntoTheVoidStarfield } from "./IntoTheVoidStarfield";

/**
 * Renders the user's chosen starfield style (from Settings/Player Menu)
 * on game over / mission failed screens.
 * Falls back to Nebula Drift if no preference is set.
 * Customization settings (density, speed, glow, etc.) are automatically
 * picked up by each starfield component via loadStarfieldConfig().
 */
export const GameOverStarfield: React.FC = () => {
  const [style] = useState(() => {
    try {
      const saved = localStorage.getItem('ll-starfield-style');
      if (saved === 'hyperspace' || saved === 'mobile' || saved === 'vortex' ||
          saved === 'waves' || saved === 'tunnel' || saved === 'nebula' || saved === 'void') {
        return saved;
      }
    } catch {}
    return 'nebula';
  });

  const renderStarfield = () => {
    switch (style) {
      case 'hyperspace':
        return (
          <HyperspaceStarfield
            speed={0.28}
            density={1600}
            focalLength={480}
            trail={0.55}
            style="glow"
          />
        );
      case 'mobile':
        return <MobileStarfield starCount={180} speed={0.5} />;
      case 'vortex':
        return <NeonVortexStarfield starCount={280} />;
      case 'waves':
        return <PrismaticWavesStarfield starCount={320} />;
      case 'tunnel':
        return <CosmicTunnelStarfield starCount={280} />;
      case 'nebula':
        return <NebulaDriftStarfield starCount={250} />;
      case 'void':
        return <IntoTheVoidStarfield ringCount={40} />;
      default:
        return <NebulaDriftStarfield starCount={250} />;
    }
  };

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {renderStarfield()}
    </div>
  );
};
