import { useState, useEffect, useRef, useCallback } from 'react';

export interface GyroscopeConfig {
  enabled: boolean;
  sensitivity: number; // 0.5 - 2.0
  deadZone: number; // degrees (e.g., 10)
  maxTilt: number; // degrees (e.g., 45)
  smoothing: number; // 0-1, higher = more smoothing
}

export const DEFAULT_GYROSCOPE_CONFIG: GyroscopeConfig = {
  enabled: false,
  sensitivity: 1.0,
  deadZone: 10,
  maxTilt: 45,
  smoothing: 0.3,
};

export interface GyroscopeState {
  permission: 'pending' | 'granted' | 'denied' | 'unsupported';
  isActive: boolean;
  rotationInput: number; // -1 to 1
  tiltAngle: number; // current tilt in degrees
}

export function useGyroscope(config: GyroscopeConfig = DEFAULT_GYROSCOPE_CONFIG) {
  const [state, setState] = useState<GyroscopeState>({
    permission: 'pending',
    isActive: false,
    rotationInput: 0,
    tiltAngle: 0,
  });

  const configRef = useRef(config);
  const smoothedRotationRef = useRef(0);
  const calibrationOffsetRef = useRef(0);

  // Update config ref when it changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Check if DeviceOrientation API is supported
  useEffect(() => {
    if (typeof window === 'undefined') {
      setState(prev => ({ ...prev, permission: 'unsupported' }));
      return;
    }

    if (!window.DeviceOrientationEvent) {
      setState(prev => ({ ...prev, permission: 'unsupported' }));
      return;
    }

    // Check if permission API exists (iOS 13+)
    const hasPermissionAPI = typeof (DeviceOrientationEvent as any).requestPermission === 'function';
    
    if (!hasPermissionAPI) {
      // Android or older iOS - permission is auto-granted
      setState(prev => ({ ...prev, permission: 'granted' }));
    }
  }, []);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!configRef.current.enabled) return;

    // gamma is the left-to-right tilt in degrees (-90 to 90)
    // positive = tilted right, negative = tilted left
    const gamma = event.gamma;
    
    if (gamma === null) return;

    // Apply calibration offset
    const adjustedGamma = gamma - calibrationOffsetRef.current;
    
    // Apply dead zone
    const { deadZone, maxTilt, sensitivity, smoothing } = configRef.current;
    let rotationInput = 0;
    
    if (Math.abs(adjustedGamma) > deadZone) {
      // Map tilt to rotation input (-1 to 1)
      const effectiveTilt = adjustedGamma - Math.sign(adjustedGamma) * deadZone;
      const effectiveMax = maxTilt - deadZone;
      rotationInput = Math.max(-1, Math.min(1, (effectiveTilt / effectiveMax) * sensitivity));
    }

    // Apply smoothing
    smoothedRotationRef.current = 
      smoothedRotationRef.current * smoothing + 
      rotationInput * (1 - smoothing);

    setState(prev => ({
      ...prev,
      rotationInput: smoothedRotationRef.current,
      tiltAngle: adjustedGamma,
    }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) {
      setState(prev => ({ ...prev, permission: 'unsupported' }));
      return false;
    }

    // Check if permission API exists (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        
        if (permissionState === 'granted') {
          setState(prev => ({ ...prev, permission: 'granted', isActive: true }));
          window.addEventListener('deviceorientation', handleOrientation as any, true);
          return true;
        } else {
          setState(prev => ({ ...prev, permission: 'denied' }));
          return false;
        }
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        setState(prev => ({ ...prev, permission: 'denied' }));
        return false;
      }
    } else {
      // Auto-granted on Android/older iOS
      setState(prev => ({ ...prev, permission: 'granted', isActive: true }));
      window.addEventListener('deviceorientation', handleOrientation as any, true);
      return true;
    }
  }, [handleOrientation]);

  const disable = useCallback(() => {
    window.removeEventListener('deviceorientation', handleOrientation as any, true);
    setState(prev => ({ ...prev, isActive: false, rotationInput: 0 }));
    smoothedRotationRef.current = 0;
  }, [handleOrientation]);

  const calibrate = useCallback(() => {
    // Set current tilt as the new zero point
    calibrationOffsetRef.current = state.tiltAngle;
    smoothedRotationRef.current = 0;
    setState(prev => ({ ...prev, rotationInput: 0 }));
  }, [state.tiltAngle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation as any, true);
    };
  }, [handleOrientation]);

  return {
    ...state,
    requestPermission,
    disable,
    calibrate,
  };
}
