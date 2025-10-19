'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import type { PannellumViewer as PannellumViewerType } from '../types/panorama';

interface PannellumViewerProps {
  imageUrl: string | null;
  loading: boolean;
  isDirectionLockEnabled?: boolean;
  onDirectionLockChange?: (enabled: boolean) => void;
}

export interface PannellumViewerRef {
  resetView: () => void;
  enableDirectionLock: () => void;
  disableDirectionLock: () => void;
  isMotionControlSupported: () => boolean;
}

// Type definitions for DeviceOrientationEvent
interface DeviceOrientationEventWithPermission extends DeviceOrientationEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface DeviceOrientationEventConstructor {
  prototype: DeviceOrientationEventWithPermission;
  new(type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEventWithPermission;
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

declare global {
  interface Window {
    DeviceOrientationEvent: DeviceOrientationEventConstructor;
  }
}

const PannellumViewer = forwardRef<PannellumViewerRef, PannellumViewerProps>(
  ({ imageUrl, loading, isDirectionLockEnabled = false, onDirectionLockChange }, ref) => {
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const viewerInstance = useRef<PannellumViewerType | null>(null);
    const [isLockEnabled, setIsLockEnabled] = useState(isDirectionLockEnabled);
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const isMountedRef = useRef(true);

    // Device orientation state
    const alphaRef = useRef<number | null>(null);
    const orientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

    // Check if device is mobile and supports motion control
    useEffect(() => {
      const checkDevice = () => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setIsMobileDevice(isMobile);
      };
      checkDevice();
    }, []);

    const isMotionControlSupported = useCallback(() => {
      return isMobileDevice && 'DeviceOrientationEvent' in window;
    }, [isMobileDevice]);

    // Completely disable direction lock and clean up
    const disableDirectionLock = useCallback(() => {
      if (orientationHandlerRef.current) {
        window.removeEventListener('deviceorientation', orientationHandlerRef.current);
        orientationHandlerRef.current = null;
      }
      alphaRef.current = null;
      setIsLockEnabled(false);
      onDirectionLockChange?.(false);
    }, [onDirectionLockChange]);

    // Safe viewer destruction
    const safeDestroyViewer = useCallback(() => {
      disableDirectionLock();
      
      if (viewerInstance.current) {
        try {
          if (viewerContainerRef.current) {
            viewerContainerRef.current.innerHTML = '';
          }
        } catch (error) {
          console.warn('Error during viewer cleanup:', error);
        }
        viewerInstance.current = null;
      }
    }, [disableDirectionLock]);

    // Initialize viewer
    const initializeViewer = useCallback(() => {
      if (!imageUrl || !viewerContainerRef.current || !isMountedRef.current) return;

      safeDestroyViewer();

      const initTimer = setTimeout(() => {
        if (!isMountedRef.current || !viewerContainerRef.current) return;

        try {
          viewerInstance.current = pannellum.viewer(viewerContainerRef.current, {
            type: 'equirectangular',
            panorama: imageUrl,
            autoLoad: true,
            showZoomCtrl: false,
            mouseZoom: true,
            draggable: true,
            compass: false,
            showControls: false,
            showFullscreenCtrl: false,
          });
        } catch (error) {
          console.error('Error initializing Pannellum viewer:', error);
        }
      }, 50);

      return () => clearTimeout(initTimer);
    }, [imageUrl, safeDestroyViewer]);

    // Device orientation handler
    const startDeviceOrientation = useCallback(() => {
      if (!isMountedRef.current || !viewerInstance.current || !isMotionControlSupported()) {
        return;
      }

      if (orientationHandlerRef.current) {
        window.removeEventListener('deviceorientation', orientationHandlerRef.current);
      }

      const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
        if (!isMountedRef.current || !viewerInstance.current || !viewerContainerRef.current) {
          disableDirectionLock();
          return;
        }

        const { alpha } = event;

        if (alpha !== null) {
          if (alphaRef.current === null) {
            alphaRef.current = alpha;
          }

          const yaw = -((alpha - (alphaRef.current || 0)) * Math.PI / 180);
          try {
            viewerInstance.current.setYaw(yaw);
          } catch (error) {
            console.warn('Failed to set yaw, disabling motion control:', error);
            disableDirectionLock();
          }
        }
      };

      orientationHandlerRef.current = handleDeviceOrientation;
      window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    }, [disableDirectionLock, isMotionControlSupported]);

    const enableDirectionLock = useCallback(() => {
      if (!isMountedRef.current || !viewerInstance.current) {
        console.warn('Cannot enable motion control: viewer not ready');
        return false;
      }

      // Check if motion control is supported
      if (!isMotionControlSupported()) {
        alert('Motion control is only available on mobile devices with gyroscope support.');
        return false;
      }

      const checkIOSPermission = async () => {
        try {
          const deviceOrientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventConstructor | undefined;
          
          if (deviceOrientationEvent?.requestPermission) {
            const permission = await deviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
              startDeviceOrientation();
              setIsLockEnabled(true);
              onDirectionLockChange?.(true);
            } else {
              console.warn('Device orientation permission denied');
              alert('Device orientation permission is required for motion control.');
            }
          } else if ('DeviceOrientationEvent' in window) {
            startDeviceOrientation();
            setIsLockEnabled(true);
            onDirectionLockChange?.(true);
          }
        } catch (error) {
          console.error('Error requesting device orientation permission:', error);
          alert('Failed to enable motion control. Please check your device settings.');
        }
      };

      checkIOSPermission();
      return true;
    }, [startDeviceOrientation, onDirectionLockChange, isMotionControlSupported]);

    useImperativeHandle(ref, () => ({
      resetView: () => {
        if (viewerInstance.current && isMountedRef.current) {
          try {
            viewerInstance.current.setYaw(0);
            viewerInstance.current.setPitch(0);
            viewerInstance.current.setHfov(100);
          } catch (error) {
            console.warn('Error resetting view:', error);
          }
          alphaRef.current = null;
        }
      },
      enableDirectionLock: () => {
        if (viewerInstance.current && isMountedRef.current) {
          return enableDirectionLock();
        }
        return false;
      },
      disableDirectionLock: () => {
        if (isMountedRef.current) {
          disableDirectionLock();
        }
      },
      isMotionControlSupported: () => {
        return isMotionControlSupported();
      }
    }));

    // Initialize viewer on mount and imageUrl changes
    useEffect(() => {
      isMountedRef.current = true;
      initializeViewer();

      return () => {
        isMountedRef.current = false;
        safeDestroyViewer();
      };
    }, [initializeViewer, safeDestroyViewer]);

    // Auto-disable motion control when image changes
    useEffect(() => {
      if (isLockEnabled) {
        disableDirectionLock();
      }
    }, [imageUrl, isLockEnabled, disableDirectionLock]);

    return (
      <div 
        ref={viewerContainerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'relative',
          zIndex: 1
        }}
      >
        {!imageUrl && !loading && (
          <div style={{ 
            color: '#999', 
            textAlign: 'center', 
            lineHeight: '500px',
            width: '100%',
            height: '100%'
          }}>
            No image loaded
          </div>
        )}
        {loading && (
          <div style={{ 
            color: '#999', 
            textAlign: 'center', 
            lineHeight: '500px',
            width: '100%',
            height: '100%'
          }}>
            Loading panorama...
          </div>
        )}
        
        {isLockEnabled && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 255, 0, 0.8)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '15px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 10
          }}>
            Motion Control ON
          </div>
        )}
      </div>
    );
  }
);

PannellumViewer.displayName = 'PannellumViewer';

export default PannellumViewer;