

# Live Starfield Preview in Settings

## What We're Doing

Adding a live preview of the starfield effect directly in the Controls/Settings page so users can see changes in real-time without navigating back to the Player Menu.

## Approach

A preview box will appear whenever the user interacts with the starfield section -- either by selecting a style or expanding the customization settings. The preview will be a rounded container with the selected starfield rendering inside it, positioned just below the style selector and above the customization sliders.

## How It Works

- A preview container (rounded box, ~300px tall, full width) will render the currently selected starfield component
- The preview appears when:
  - The user changes the starfield style via the dropdown, OR
  - The user expands the "Starfield Customization" collapsible
- The preview stays visible while either condition is true
- Each starfield style change immediately swaps the rendered component
- Customization slider changes (density, speed, glow, etc.) will update in real-time because the starfield components already read from localStorage via `loadStarfieldConfig()` and use a storage listener refresh mechanism

## Technical Details

### File: `src/pages/Controls.tsx`

**1. Add starfield component imports** (top of file)

Import all 7 starfield components, matching the imports from `PlayerMenu.tsx`:
- `HyperspaceStarfield`
- `MobileStarfield`
- `NeonVortexStarfield`
- `PrismaticWavesStarfield`
- `CosmicTunnelStarfield`
- `NebulaDriftStarfield`
- `IntoTheVoidStarfield`

**2. Add a `showPreview` state**

Track whether to show the preview based on the user having interacted with the starfield section. It will be `true` when:
- `starfieldStyle` has been changed from its initial value during this session, OR
- `starfieldSettingsOpen` is `true`

A simple approach: add a `starfieldTouched` state (starts `false`, set to `true` on first style change). Show preview when `starfieldTouched || starfieldSettingsOpen`.

**3. Add a `renderStarfieldPreview` function**

Mirrors the `renderStarfield` switch from `PlayerMenu.tsx`, mapping each style value to its component:

| Style Value | Component | Props |
|-------------|-----------|-------|
| `hyperspace` | `HyperspaceStarfield` | speed=0.28, density=1600, focalLength=480, trail=0.55, style="glow" |
| `mobile` | `MobileStarfield` | starCount=180, speed=0.5 |
| `vortex` | `NeonVortexStarfield` | starCount=280 |
| `waves` | `PrismaticWavesStarfield` | starCount=320 |
| `tunnel` | `CosmicTunnelStarfield` | starCount=280 |
| `nebula` | `NebulaDriftStarfield` | starCount=250 |
| `void` | `IntoTheVoidStarfield` | ringCount=40 |
| `auto`/default | `NebulaDriftStarfield` | starCount=250 |

**4. Add the preview container in JSX**

Insert between the Starfield Style selector (line ~1041) and the Starfield Customization collapsible (line ~1043). The container will be:

```
<div style={{
  position: "relative",
  width: "100%",
  height: 300,
  borderRadius: 12,
  overflow: "hidden",
  background: "#000"
}}>
  {renderStarfieldPreview()}
</div>
```

The preview renders in a black container with `overflow: hidden` and `border-radius`, so the canvas stays clipped within the box. The starfield components use `position: absolute` inside their parent, so they will fill this container naturally.

**5. Force re-mount on customization changes**

The starfield components load config on mount. To ensure slider changes are reflected live, we add a `key` prop based on a counter that increments on each config change. This forces React to re-mount the canvas component, picking up the latest localStorage values.

Alternatively (and more efficiently), we can dispatch a `storage` event after saving config changes, since the starfield components already listen for storage changes. We'll use a simple approach: add a `previewKey` state that increments when the style changes, so the component re-mounts only on style switch. Config slider changes will be picked up via the existing storage listener mechanism already built into the starfield components.

**6. Wrap style change handler**

When `setStarfieldStyle` is called, also set `starfieldTouched = true` to show the preview.

### Summary of Changes

| Change | Location |
|--------|----------|
| Import 7 starfield components | Top of Controls.tsx |
| Add `starfieldTouched` state | State declarations section |
| Add `renderStarfieldPreview()` function | Before return JSX |
| Add preview container div | Between style selector and customization collapsible |
| Set `starfieldTouched` on style change | `onValueChange` of the Select |
| Show preview when touched or settings open | Conditional render around preview div |

