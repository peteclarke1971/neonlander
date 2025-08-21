import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameEngine } from '@/components/game/GameEngine';
import { CavernFXControls } from '@/components/game/CavernFXControls';
import { CavernFXParams, CavernFXPresets } from '@/components/game/systems/cavernFX';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CavernFXDemo() {
  const navigate = useNavigate();
  const [level, setLevel] = useState(1);
  const [difficulty, setDifficulty] = useState<'easy' | 'hard'>('easy');
  const [showFX, setShowFX] = useState(true);
  const [fxParams, setFXParams] = useState<CavernFXParams>(CavernFXPresets[1].params); // Normal preset
  const [gameKey, setGameKey] = useState(0);

  const handleGameOver = () => {
    // Restart the level
    setGameKey(prev => prev + 1);
  };

  const handleParamsChange = (newParams: Partial<CavernFXParams>) => {
    setFXParams(prev => ({ ...prev, ...newParams }));
  };

  const regenerateLevel = () => {
    setGameKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Cavern FX Demo</h1>
                <p className="text-sm text-muted-foreground">
                  Test and configure visual effects for cavern levels
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFX(!showFX)}
              >
                FX: {showFX ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateLevel}
              >
                New Level
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 space-y-6">
            {/* Level Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Level Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Level</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLevel(Math.max(1, level - 1))}
                      disabled={level <= 1}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center font-mono">{level}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLevel(level + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <div className="flex gap-2">
                    <Button
                      variant={difficulty === 'easy' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDifficulty('easy')}
                    >
                      Easy
                    </Button>
                    <Button
                      variant={difficulty === 'hard' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDifficulty('hard')}
                    >
                      Hard
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* FX Controls */}
            {showFX && (
              <CavernFXControls
                params={fxParams}
                onParamsChange={handleParamsChange}
              />
            )}
          </div>

          {/* Game Area */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-0">
                <div className="aspect-[4/3] relative bg-black rounded-lg overflow-hidden">
                  <GameEngine
                    key={gameKey}
                    level={level}
                    difficulty={difficulty}
                    mode="caverns"
                    onExit={() => navigate('/')}
                    onGameOver={handleGameOver}
                    showCavernFX={showFX}
                    cavernFXParams={{
                      ...fxParams,
                      intensity: fxParams.intensity * 2.0, // 100% brighter for demo
                      colorMode: 'match'
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Instructions */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Controls</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Mouse/Touch: Thrust direction</li>
                      <li>• Hold to thrust</li>
                      <li>• Navigate from start to end pad</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">FX Features</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Breathing walls (subtle pulsing)</li>
                      <li>• Gravity ripples (wave effects)</li>
                      <li>• Edge glow (cavern outlines)</li>
                      <li>• Lens warp (mild distortion)</li>
                      <li>• Ambient dust particles</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}