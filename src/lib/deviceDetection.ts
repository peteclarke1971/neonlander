/**
 * Detects if the current device is a desktop (not mobile/tablet)
 */
export function isDesktopDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  
  // Check for mobile/tablet indicators
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
  
  // Check for desktop OS indicators
  const isDesktop = /windows|mac os|linux|cros/i.test(ua);
  
  return !isMobile && isDesktop;
}

/**
 * Detects if the app is running as a PWA (installed to home screen)
 */
export function isPWA(): boolean {
  // Check if running in standalone mode (PWA installed)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // Check for iOS PWA
  if ((window.navigator as any).standalone === true) {
    return true;
  }
  
  return false;
}

/**
 * Determines if the fullscreen button should be shown
 * Shows only on desktop browsers (not PWA) that support Fullscreen API
 */
export function shouldShowFullscreenButton(): boolean {
  // Check Fullscreen API support
  const isSupported =
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled ||
    false;
  
  return isDesktopDevice() && !isPWA() && isSupported;
}
