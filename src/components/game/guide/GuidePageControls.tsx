import React from 'react';
import { LanderAnimation } from './LanderAnimation';

export const GuidePageControls: React.FC = () => {
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Animated lander demo */}
      <div className="flex justify-center">
        <LanderAnimation showThrust showRotation size={100} />
      </div>

      {/* Control descriptions */}
      <div className="space-y-3 text-sm" style={{ color: 'hsl(var(--foreground) / 0.9)' }}>
        <div className="flex items-start gap-3">
          <div 
            className="w-16 text-right font-bold shrink-0"
            style={{ color: 'hsl(var(--neon))' }}
          >
            THRUST
          </div>
          <div>
            {isTouch ? (
              'Tap and hold the bottom center of the screen'
            ) : (
              <>
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">W</kbd> / 
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs ml-1">↑</kbd> / 
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs ml-1">Space</kbd>
              </>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div 
            className="w-16 text-right font-bold shrink-0"
            style={{ color: 'hsl(var(--neon))' }}
          >
            ROTATE
          </div>
          <div>
            {isTouch ? (
              'Tap left/right sides of the screen'
            ) : (
              <>
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">D</kbd> / 
                <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs ml-1">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">→</kbd>
              </>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div 
            className="w-16 text-right font-bold shrink-0"
            style={{ color: 'hsl(180, 100%, 50%)' }}
          >
            BOOST
          </div>
          <div>
            {isTouch ? (
              'Hold rotation button for faster spin'
            ) : (
              <>
                Hold <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Shift</kbd> while rotating for 2× speed
              </>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div 
            className="w-16 text-right font-bold shrink-0"
            style={{ color: 'hsl(0, 100%, 65%)' }}
          >
            ABORT
          </div>
          <div>
            {isTouch ? (
              'Double-tap thrust when in danger'
            ) : (
              <>
                Double-tap <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">W</kbd> for emergency boost
              </>
            )}
          </div>
        </div>
      </div>

      {/* Gamepad note */}
      <div 
        className="text-xs text-center mt-2 opacity-60"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        🎮 Gamepad supported: D-pad/stick to rotate, A/trigger to thrust
      </div>
    </div>
  );
};
