import { ColorOrderHUDSnapshot } from "./types/asteroidsColor";

interface Props extends ColorOrderHUDSnapshot {}

// Mini spaceship icon component for lives display
const MiniShip: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" className="fill-none stroke-current stroke-[1.5]">
    <path d="M6 2 L10 8 L2 8 Z" />
  </svg>
);

export const AsteroidsColorHUD: React.FC<Props> = ({ score, lives, wave, difficulty, target, ammo }) => {
  const getTargetColor = (target: "green" | "amber" | "red") => {
    switch (target) {
      case "green": return "text-green-400";
      case "amber": return "text-amber-400";
      case "red": return "text-red-400";
      default: return "text-accent";
    }
  };

  return (
    <>
      {/* Score - Top Left */}
      <div className="pointer-events-none select-none fixed top-4 left-4 z-20 animate-fade-in">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-neon">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">SCORE</div>
          <div className="text-lg font-mono text-accent">{score.toLocaleString()}</div>
        </div>
      </div>

      {/* Wave - Top Center Left */}
      <div className="pointer-events-none select-none fixed top-4 left-1/2 transform -translate-x-1/2 -translate-x-16 z-20 animate-fade-in">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-neon">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 text-center">WAVE</div>
          <div className="text-lg font-mono text-accent text-center">{wave}</div>
        </div>
      </div>

      {/* Target Color - Top Center Right */}
      <div className="pointer-events-none select-none fixed top-4 left-1/2 transform -translate-x-1/2 translate-x-16 z-20 animate-fade-in">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-neon">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 text-center">TARGET</div>
          <div className={`text-lg font-mono uppercase text-center ${getTargetColor(target)}`}>
            {target}
          </div>
        </div>
      </div>

      {/* Lives - Top Right */}
      <div className="pointer-events-none select-none fixed top-4 right-4 z-20 animate-fade-in">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-neon">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 text-center">LIVES</div>
          <div className="flex gap-1 justify-center text-accent">
            {Array.from({ length: lives }).map((_, i) => (
              <MiniShip key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Game Title - Hidden for cleaner UI */}
      <div className="pointer-events-none select-none fixed top-4 left-4 z-10 opacity-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">COLOR ORDER ASTEROIDS — {difficulty}</div>
      </div>
    </>
  );
};