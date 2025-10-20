'use client';

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';

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

// -- Pannellum Types --
interface PannellumConfig {
  type: string;
  panorama: string;
  autoLoad: boolean;
  showZoomCtrl: boolean;
  mouseZoom: boolean;
  draggable: boolean;
  compass: boolean;
  showControls: boolean;
  showFullscreenCtrl: boolean;
  orientationOnByDefault: boolean;
  autoRotate: boolean;
}

interface PannellumViewerInstance {
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setHfov: (hfov: number) => void;
  startOrientation?: () => void;
  stopOrientation?: () => void;
  getYaw?: () => number;
  getPitch?: () => number;
  getRenderer?: () => unknown;
}

interface PannellumGlobal {
  viewer: (container: HTMLElement, config: PannellumConfig) => PannellumViewerInstance;
}

// ✅ Get pannellum safely without using `any`
const getPannellum = (): PannellumGlobal | null => {
  if (typeof window !== 'undefined' && 'pannellum' in window) {
    return (window as unknown as { pannellum: PannellumGlobal }).pannellum;
  }
  return null;
};

const PannellumViewer = forwardRef<PannellumViewerRef, PannellumViewerProps>(
  ({ imageUrl, loading, isDirectionLockEnabled = false, onDirectionLockChange }, ref) => {
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const viewerInstance = useRef<PannellumViewerInstance | null>(null);
    const [isLockEnabled, setIsLockEnabled] = useState(isDirectionLockEnabled);
    const [error, setError] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    // 🧹 Cleanup function
    const safeDestroyViewer = useCallback(() => {
      if (viewerInstance.current) {
        try {
          if (viewerContainerRef.current) {
            viewerContainerRef.current.innerHTML = '';
          }
        } catch (cleanupError) {
          console.warn('Error during viewer cleanup:', cleanupError);
        }
        viewerInstance.current = null;
      }
    }, []);

    // 🧭 Initialize viewer
    const initializeViewer = useCallback(() => {
      if (!imageUrl || !viewerContainerRef.current || !isMountedRef.current) return;

      safeDestroyViewer();

      const initTimer = setTimeout(() => {
        if (!isMountedRef.current || !viewerContainerRef.current) return;

        try {
          const pannellum = getPannellum();
          if (pannellum) {
            viewerInstance.current = pannellum.viewer(viewerContainerRef.current, {
              type: 'equirectangular',
              panorama: imageUrl,
              autoLoad: true,
              showZoomCtrl: false,
              mouseZoom: true,
              draggable: true,
              compass: true,
              showControls: false,
              showFullscreenCtrl: false,
              orientationOnByDefault: false,
              autoRotate: false,
            });
            console.log('✅ Pannellum viewer initialized');
          } else {
            console.error('❌ Pannellum library not loaded');
            setError('Pannellum viewer library not available');
          }
        } catch (initError: unknown) {
          console.error('Error initializing Pannellum viewer:', initError);
          setError('Failed to initialize viewer');
        }
      }, 50);

      return () => clearTimeout(initTimer);
    }, [imageUrl, safeDestroyViewer]);

    // 🌐 Motion support check
    const isMotionControlSupported = useCallback(() => {
      try {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
        const isHTTPS = window.location.protocol === 'https:';

        console.log('Motion control check:', { isMobile, isHTTPS });

        if (isMobile && !isHTTPS) {
          console.log('Development (HTTP) mode detected');
          return true;
        }
        return isMobile && isHTTPS;
      } catch (checkError: unknown) {
        console.error('Error checking motion control support:', checkError);
        return false;
      }
    }, []);

    // 🧲 Enable Direction Lock
    const enableDirectionLock = useCallback(async () => {
      if (!isMountedRef.current) return;

      console.log('Attempting to enable motion control...');
      setError(null);

      try {
        const isMobile = isMotionControlSupported();
        if (!isMobile) {
          setError('Motion control only works on mobile devices');
          return;
        }

        const isHTTPS = window.location.protocol === 'https:';
        if (!isHTTPS) {
          setIsLockEnabled(true);
          onDirectionLockChange?.(true);
          setError('Motion control requires HTTPS. Use ngrok or SSL for testing.');
          console.log('Development mode: HTTPS required');
          return;
        }

        if (viewerInstance.current?.startOrientation) {
          viewerInstance.current.startOrientation();
          setTimeout(() => {
            if (isMountedRef.current) {
              setIsLockEnabled(true);
              onDirectionLockChange?.(true);
              console.log('Motion control enabled');
            }
          }, 100);
          return;
        }

        // ✅ Safe check for iOS permission API
        if (
          typeof DeviceOrientationEvent !== 'undefined' &&
          'requestPermission' in DeviceOrientationEvent
        ) {
          const requestPermission = (DeviceOrientationEvent as unknown as {
            requestPermission: () => Promise<PermissionState>;
          }).requestPermission;

          const permission = await requestPermission();
          if (permission === 'granted') {
            setIsLockEnabled(true);
            onDirectionLockChange?.(true);
            console.log('iOS permission granted');
          } else {
            setError('Motion control permission was denied');
          }
        } else {
          setIsLockEnabled(true);
          onDirectionLockChange?.(true);
          console.log('Motion control enabled (fallback)');
        }
      } catch (unexpectedError: unknown) {
        console.error('Unexpected motion control error:', unexpectedError);
        setError('Unexpected error enabling motion control');
      }
    }, [isMotionControlSupported, onDirectionLockChange]);

    // ❎ Disable Direction Lock
    const disableDirectionLock = useCallback(() => {
      console.log('Disabling motion control...');
      try {
        viewerInstance.current?.stopOrientation?.();
      } catch (stopError: unknown) {
        console.warn('Error stopping orientation:', stopError);
      }

      setIsLockEnabled(false);
      setError(null);
      onDirectionLockChange?.(false);
    }, [onDirectionLockChange]);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      resetView: () => {
        if (viewerInstance.current && isMountedRef.current) {
          try {
            viewerInstance.current.setYaw(0);
            viewerInstance.current.setPitch(0);
            viewerInstance.current.setHfov(100);
          } catch (resetError: unknown) {
            console.warn('Error resetting view:', resetError);
          }
        }
      },
      enableDirectionLock,
      disableDirectionLock,
      isMotionControlSupported,
    }));

    // Initialize on mount
    useEffect(() => {
      isMountedRef.current = true;
      initializeViewer();

      return () => {
        isMountedRef.current = false;
        safeDestroyViewer();
      };
    }, [initializeViewer, safeDestroyViewer]);

    // Sync external lock state
    useEffect(() => {
      if (isDirectionLockEnabled && !isLockEnabled) {
        enableDirectionLock();
      } else if (!isDirectionLockEnabled && isLockEnabled) {
        disableDirectionLock();
      }
    }, [isDirectionLockEnabled, isLockEnabled, enableDirectionLock, disableDirectionLock]);

    return (
      <div
        ref={viewerContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {!imageUrl && !loading && (
          <div
            style={{
              color: '#999',
              textAlign: 'center',
              lineHeight: '500px',
              width: '100%',
              height: '100%',
            }}
          >
            No image loaded
          </div>
        )}
        {loading && (
          <div
            style={{
              color: '#999',
              textAlign: 'center',
              lineHeight: '500px',
              width: '100%',
              height: '100%',
            }}
          >
            Loading panorama...
          </div>
        )}

        {/* Motion control status indicator */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: isLockEnabled
              ? 'rgba(0, 200, 0, 0.8)'
              : 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '15px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 10,
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {isLockEnabled ? '🎯 Motion Control ON' : '🧭 Tap 📱 to Enable'}
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              left: '10px',
              right: '10px',
              backgroundColor: 'rgba(255, 0, 0, 0.8)',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: 10,
              textAlign: 'center',
            }}
          >
            {error}
            {error.includes('HTTPS') && (
              <div style={{ marginTop: '5px', fontSize: '10px', opacity: 0.9 }}>
                Try: <strong>ngrok http 3000</strong> or enable HTTPS locally
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

PannellumViewer.displayName = 'PannellumViewer';

export default PannellumViewer;
