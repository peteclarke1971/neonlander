import { AsteroidsHUDSnapshot } from "./types/asteroids";

interface Props extends AsteroidsHUDSnapshot {}

// Mini lander icon component for lives display
const MiniLander: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" className="fill-none stroke-current stroke-[1.5]">
    <path d="M6 2 L10 8 L2 8 Z" />
    <path d="M4 7 L1 9" />
    <path d="M8 7 L11 9" />
  </svg>
);

export const AsteroidsHUD: React.FC<Props> = ({ score, lives, wave, difficulty }) => {
  return (
    <>
      {/* Score - Top Left */}
      <div className="pointer-events-none select-none fixed top-4 left-4 z-20 animate-fade-in">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-neon">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">SCORE</div>
          <div className="text-lg font-mono text-accent">{score.toLocaleString()}</div>
        </div>
      </div>

      {/* Wave - Top Center */}
      <div className="pointer-events-none select-none fixed top-4 left-1/2 transform -translate-x-1/2 z-20 animate-fade-in">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-neon">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 text-center">WAVE</div>
          <div className="text-lg font-mono text-accent text-center">{wave}</div>
        </div>
      </div>

      {/* Lives - Top Right */}
      <div className="pointer-events-none select-none fixed top-4 right-4 z-20 animate-fade-in">
        <div className="bg-card/60 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-neon">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 text-center">LIVES</div>
          <div className="flex gap-1 justify-center text-accent">
            {Array.from({ length: lives }).map((_, i) => (
              <MiniLander key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Game Title - Hidden for cleaner UI */}
      <div className="pointer-events-none select-none fixed top-4 left-4 z-10 opacity-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">NEON ASTEROIDS — {difficulty}</div>
      </div>
    </>
  );
};