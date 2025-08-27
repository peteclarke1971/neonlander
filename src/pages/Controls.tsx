import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { anyGamepad, getLastDeviceId, getPlatformFromId, loadProfile, readGamepad, saveProfile, setLastDeviceId } from "@/hooks/use-gamepad";

export default function ControlsSettings() {
  const [deviceId, setDeviceId] = useState<string | null>(getLastDeviceId());
  const [platform, setPlatform] = useState<string>(() => getPlatformFromId(deviceId || ""));
  const [profile, setProfile] = useState(() => loadProfile(deviceId || undefined));
  const [listening, setListening] = useState<{ field: keyof typeof profile.map | null; type: "button" | "axis" | null }>({ field: null, type: null });

  // SEO
  useEffect(() => {
    document.title = "Controls Settings — Neon Lunar Lander";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Configure controller mappings, deadzone, invert options, and vibration for Neon Lunar Lander.");
    const link = document.querySelector('link[rel="canonical"]') || document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", window.location.origin + "/settings/controls");
    if (!link.parentElement) document.head.appendChild(link);
  }, []);

  // Hot-swap detection
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (deviceId !== gp.id) {
        setLastDeviceId(gp.id);
        setDeviceId(gp.id);
        setPlatform(getPlatformFromId(gp.id));
        setProfile(loadProfile(gp.id));
      }
};
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [deviceId]);

  // Gamepad UI navigation: map D-pad and left stick to arrow keys; thrustBtn as Enter
  useEffect(() => {
    let raf = 0;
    let lastId: string | null = getLastDeviceId();
    let gpProfile = loadProfile(lastId || undefined);
    let prev = { up: false, down: false, left: false, right: false, select: false, back: false };
    const fire = (key: string) => {
      const target = (document.activeElement as HTMLElement) || containerRef.current || document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp || !gp.connected) return;
      if (lastId !== gp.id) {
        lastId = gp.id;
        setLastDeviceId(gp.id);
        gpProfile = loadProfile(gp.id);
      }
      const input = readGamepad(gp, gpProfile);
      if (input.ui.up && !prev.up) fire("ArrowUp");
      if (input.ui.down && !prev.down) fire("ArrowDown");
      if (input.ui.left && !prev.left) fire("ArrowLeft");
      if (input.ui.right && !prev.right) fire("ArrowRight");
      if (input.ui.select && !prev.select) fire("Enter");
      if (input.ui.back && !prev.back) fire("Escape");
      prev = input.ui;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (deviceId) saveProfile(deviceId, profile);
  }, [deviceId, profile]);

  const startListen = (field: keyof typeof profile.map, type: "button" | "axis") => {
    setListening({ field, type });
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const gp = anyGamepad?.();
      if (!gp) return;
      const input = readGamepad(gp, profile);
      // Check input raw values
      const rawGp = navigator.getGamepads?.()?.find(g => g && g.connected) as Gamepad | undefined;
      if (!rawGp) return;
      if (type === "button") {
        const idx = rawGp.buttons.findIndex(b => !!b?.pressed);
        if (idx >= 0) {
          setProfile(p => ({ ...p, map: { ...p.map, [field]: idx } }));
          setListening({ field: null, type: null });
          cancelAnimationFrame(raf);
        }
      } else {
        // axis
        let bestIdx = -1; let bestVal = 0;
        for (let i = 0; i < rawGp.axes.length; i++) {
          const v = Math.abs(rawGp.axes[i] ?? 0);
          if (v > bestVal) { bestVal = v; bestIdx = i; }
        }
        if (bestIdx >= 0 && bestVal > 0.5) {
          setProfile(p => ({ ...p, map: { ...p.map, [field]: bestIdx } }));
          setListening({ field: null, type: null });
          cancelAnimationFrame(raf);
        }
      }
    };
    raf = requestAnimationFrame(loop);
  };

  const FieldRow = ({ label, value, onRebind, type }: { label: string; value?: number; onRebind: () => void; type: "button" | "axis" }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{type === "button" ? "Button" : "Axis"} index: {value ?? "—"}</div>
      </div>
      <Button variant="outline" onClick={onRebind} disabled={!!listening.field}>
        {listening.field ? (listening.field === (label as any) ? "Listening…" : "Listening…") : "Rebind"}
      </Button>
    </div>
  );

  const Glyphs = () => {
    const plat = platform;
    const Chip = ({ children }: { children: React.ReactNode }) => (
      <span className="px-2 py-0.5 rounded border border-border/60 text-xs text-foreground/80">{children}</span>
    );
    if (plat === "playstation") return (
      <div className="flex gap-2 flex-wrap">
        <Chip>Triangle</Chip><Chip>Options</Chip><Chip>L1</Chip><Chip>R1</Chip><Chip>R2</Chip><Chip>L3</Chip><Chip>D‑Pad</Chip>
      </div>
    );
    if (plat === "nintendo") return (
      <div className="flex gap-2 flex-wrap">
        <Chip>X</Chip><Chip>+</Chip><Chip>L</Chip><Chip>R</Chip><Chip>ZR</Chip><Chip>L3</Chip><Chip>D‑Pad</Chip>
      </div>
    );
    return (
      <div className="flex gap-2 flex-wrap">
        <Chip>Y</Chip><Chip>Start</Chip><Chip>LB</Chip><Chip>RB</Chip><Chip>RT</Chip><Chip>LS</Chip><Chip>D‑Pad</Chip>
      </div>
    );
  };

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { containerRef.current?.focus(); }, []);


  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (e) => {
    const key = e.key;
    if (!(key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight" || key === "Enter")) return;
    e.preventDefault();
    const root = e.currentTarget as HTMLElement;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
    const active = document.activeElement as HTMLElement | null;
    if (key === "Enter") { active?.click(); return; }
    const dir = (key === "ArrowUp" || key === "ArrowLeft") ? -1 : 1;
    const idx = Math.max(0, focusables.indexOf(active || focusables[0]));
    const next = focusables[(idx + dir + focusables.length) % focusables.length];
    next?.focus();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section ref={containerRef} className="max-w-2xl mx-auto p-6" onKeyDown={handleKeyDown} tabIndex={0}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-display font-bold">Controls</h1>
          <Link to="/"><Button variant="outline">Back</Button></Link>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Detected device: <span className="font-medium">{platform || "—"}</span> {deviceId ? "(saved per device)" : "(connect a controller to customize)"}</p>
        <Glyphs />

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Analog Settings</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="deadzone">Deadzone</Label>
              <div className="flex items-center gap-3">
                <div className="w-56"><Slider id="deadzone" value={[profile.deadzone]} min={0.05} max={0.25} step={0.005} onValueChange={(v) => setProfile(p => ({ ...p, deadzone: v[0] }))} /></div>
                <span className="text-xs text-muted-foreground">{profile.deadzone.toFixed(3)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Invert Rotation</Label>
              <Switch checked={profile.invertRotation} onCheckedChange={(v) => setProfile(p => ({ ...p, invertRotation: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Invert Thrust</Label>
              <Switch checked={profile.invertThrust} onCheckedChange={(v) => setProfile(p => ({ ...p, invertThrust: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Vibration</Label>
              <Switch checked={profile.vibration} onCheckedChange={(v) => setProfile(p => ({ ...p, vibration: v }))} />
            </div>
          </div>
        </div>

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Gameplay Settings</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Rotation Boost</Label>
                <div className="text-xs text-muted-foreground">2× rotation speed while held (RT/Shift)</div>
              </div>
              <Switch 
                checked={true} // Always enabled for now
                onCheckedChange={() => {}}
                disabled={true}
              />
            </div>
            <div>
              <Label htmlFor="rotmultiplier">Rotation Multiplier</Label>
              <div className="flex items-center gap-3">
                <div className="w-56"><Slider id="rotmultiplier" value={[2.0]} min={1.5} max={3.0} step={0.1} onValueChange={() => {}} disabled /></div>
                <span className="text-xs text-muted-foreground">2.0×</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Moving Pads</Label>
                <div className="text-xs text-muted-foreground">Rare, high-value moving landing pads on hard difficulty</div>
              </div>
              <select 
                className="px-3 py-2 rounded border border-border bg-background text-foreground"
                defaultValue="default"
                onChange={(e) => {
                  // This would integrate with the moving pad system settings
                  console.log('Moving pads setting:', e.target.value);
                }}
              >
                <option value="off">Off</option>
                <option value="default">Default</option>
                <option value="more">More</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 border rounded-lg border-border/60 p-4 bg-card/50">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Remap Controls</h2>
          <FieldRow label="rotateLeftBtn" value={profile.map.rotateLeftBtn} type="button" onRebind={() => startListen("rotateLeftBtn", "button")} />
          <FieldRow label="rotateRightBtn" value={profile.map.rotateRightBtn} type="button" onRebind={() => startListen("rotateRightBtn", "button")} />
          <FieldRow label="rotateBoostBtn" value={profile.map.rotateBoostBtn} type="button" onRebind={() => startListen("rotateBoostBtn", "button")} />
          <FieldRow label="abortBtn" value={profile.map.abortBtn} type="button" onRebind={() => startListen("abortBtn", "button")} />
          <FieldRow label="pauseBtn" value={profile.map.pauseBtn} type="button" onRebind={() => startListen("pauseBtn", "button")} />
          <FieldRow label="thrustBtn" value={profile.map.thrustBtn} type="button" onRebind={() => startListen("thrustBtn", "button")} />
          <FieldRow label="rotationAxis" value={profile.map.rotationAxis} type="axis" onRebind={() => startListen("rotationAxis", "axis")} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <FieldRow label="dpadUp" value={profile.map.dpadUp} type="button" onRebind={() => startListen("dpadUp", "button")} />
            <FieldRow label="dpadDown" value={profile.map.dpadDown} type="button" onRebind={() => startListen("dpadDown", "button")} />
            <FieldRow label="dpadLeft" value={profile.map.dpadLeft} type="button" onRebind={() => startListen("dpadLeft", "button")} />
            <FieldRow label="dpadRight" value={profile.map.dpadRight} type="button" onRebind={() => startListen("dpadRight", "button")} />
          </div>
        </div>
      </section>
    </main>
  );
}
