import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cavernFX, CavernFXParams, CavernFXPresets } from './systems/cavernFX';

interface CavernFXControlsProps {
  params: CavernFXParams;
  onParamsChange: (params: Partial<CavernFXParams>) => void;
  className?: string;
}

export const CavernFXControls: React.FC<CavernFXControlsProps> = ({
  params,
  onParamsChange,
  className = ""
}) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const debugInfo = cavernFX.getDebugInfo();

  const handlePresetChange = (presetName: string) => {
    const preset = CavernFXPresets.find(p => p.name === presetName);
    if (preset) {
      onParamsChange(preset.params);
    }
  };

  const handleParameterChange = (param: keyof CavernFXParams, value: any) => {
    onParamsChange({ [param]: value });
    cavernFX.set(param, value);
  };

  const getPerformanceColor = (fps: number) => {
    if (fps >= 55) return 'bg-green-500';
    if (fps >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Cavern FX Settings
          <div className="flex items-center gap-2">
            {debugInfo.performanceGoverned && (
              <Badge variant="destructive" className="text-xs">
                Performance Governor Active
              </Badge>
            )}
            {showDebugInfo && (
              <div className={`w-3 h-3 rounded-full ${getPerformanceColor(debugInfo.currentFPS)}`} 
                   title={`${debugInfo.currentFPS} FPS`} />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Presets */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Preset</label>
          <Select onValueChange={handlePresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select preset..." />
            </SelectTrigger>
            <SelectContent>
              {CavernFXPresets.map(preset => (
                <SelectItem key={preset.name} value={preset.name}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Global Intensity */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Intensity: {(params.intensity * 100).toFixed(0)}%
          </label>
          <Slider
            value={[params.intensity]}
            onValueChange={([value]) => handleParameterChange('intensity', value)}
            min={0}
            max={1}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Breathing Walls */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Breathing Walls: {(params.breathDepth * 100).toFixed(0)}%
          </label>
          <Slider
            value={[params.breathDepth]}
            onValueChange={([value]) => handleParameterChange('breathDepth', value)}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
        </div>

        {/* Gravity Ripples */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Gravity Ripples: {(params.rippleStrength * 100).toFixed(0)}%
          </label>
          <Slider
            value={[params.rippleStrength]}
            onValueChange={([value]) => handleParameterChange('rippleStrength', value)}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
        </div>

        {/* Lens Warp */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Lens Warp: {(params.lensWarp * 100).toFixed(0)}%
            <span className="text-xs text-muted-foreground ml-2">
              (Max: {(debugInfo.maxUVDisplacement * 100).toFixed(1)}% displacement)
            </span>
          </label>
          <Slider
            value={[params.lensWarp]}
            onValueChange={([value]) => handleParameterChange('lensWarp', value)}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
        </div>

        {/* Edge Glow */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Edge Glow: {(params.glow * 100).toFixed(0)}%
          </label>
          <Slider
            value={[params.glow]}
            onValueChange={([value]) => handleParameterChange('glow', value)}
            min={0}
            max={1}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Dust Density */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Dust Density: {(params.dustDensity * 100).toFixed(0)}%
            {params.motionReduction && (
              <span className="text-xs text-yellow-600 ml-2">(Disabled - Motion Reduction)</span>
            )}
          </label>
          <Slider
            value={[params.dustDensity]}
            onValueChange={([value]) => handleParameterChange('dustDensity', value)}
            min={0}
            max={1}
            step={0.1}
            className="w-full"
            disabled={params.motionReduction}
          />
        </div>

        {/* Color Mode */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Color Mode</label>
          <Select value={params.colorMode} onValueChange={(value) => handleParameterChange('colorMode', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cyan">Cyan</SelectItem>
              <SelectItem value="green">Green</SelectItem>
              <SelectItem value="amber">Amber</SelectItem>
              <SelectItem value="two-tone">Two-tone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Motion Reduction */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Motion Reduction</label>
          <Switch
            checked={params.motionReduction}
            onCheckedChange={(checked) => handleParameterChange('motionReduction', checked)}
          />
        </div>

        {/* Debug Controls */}
        <div className="pt-4 border-t border-border">
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebugInfo(!showDebugInfo)}
            >
              {showDebugInfo ? 'Hide' : 'Show'} Debug
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cavernFX.setSeed(Math.random() * 0xFFFFFF)}
            >
              Random Seed
            </Button>
          </div>

          {showDebugInfo && (
            <div className="text-xs space-y-1 font-mono bg-muted p-2 rounded">
              <div>FPS: {debugInfo.currentFPS}</div>
              <div>FX Seed: 0x{debugInfo.fxSeed.toString(16).toUpperCase()}</div>
              <div>Ripple Period: {debugInfo.ripplePeriod.toFixed(1)}s</div>
              <div>Dust Particles: {debugInfo.dustParticleCount}</div>
              <div>Performance Governor: {debugInfo.performanceGoverned ? 'ON' : 'OFF'}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};