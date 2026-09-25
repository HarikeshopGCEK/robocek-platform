import React, { useEffect, useRef, useState } from 'react';
import { Logo } from './Logo';

interface SplashScreenProps {
  onComplete: () => void;
  videoSrc?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  videoSrc = '/splash_screen.mp4',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoSrc, setCurrentVideoSrc] = useState(videoSrc);
  const [useFallback, setUseFallback] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [statusText, setStatusText] = useState('Initializing ROBOCEK Core...');

  // Handle completion with smooth fade out
  const handleFinish = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  // Fallback animation timer if no video or video fails/finishes
  useEffect(() => {
    if (!useFallback) return;

    const statuses = [
      'Initializing ROBOCEK Engine...',
      'Loading ESP32 Toolchain Abstraction...',
      'Configuring PlatformIO Runtime...',
      'Establishing Serial Link Drivers...',
      'ROBOCEK Studio Ready',
    ];

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 8) + 4;
      if (currentProgress >= 100) {
        currentProgress = 100;
        setProgress(100);
        setStatusText(statuses[statuses.length - 1]);
        clearInterval(interval);
        setTimeout(handleFinish, 500);
      } else {
        setProgress(currentProgress);
        const statusIdx = Math.min(
          Math.floor((currentProgress / 100) * (statuses.length - 1)),
          statuses.length - 2
        );
        setStatusText(statuses[statusIdx]);
      }
    }, 90);

    return () => clearInterval(interval);
  }, [useFallback]);

  // Video load error handler with alt path try
  const handleVideoError = () => {
    if (currentVideoSrc === '/splash_screen.mp4') {
      setCurrentVideoSrc('/Flash_screen.mp4');
    } else if (currentVideoSrc === '/Flash_screen.mp4') {
      setCurrentVideoSrc('/splash.mp4');
    } else {
      console.log('Video splash not found or unsupported, falling back to animated logo.');
      setUseFallback(true);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#05070A',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,200,255,0.12) 0%, rgba(124,58,237,0.05) 50%, transparent 70%)',
          pointerEvents: 'none',
          animation: 'pulseGlow 3s ease-in-out infinite alternate',
        }}
      />

      {!useFallback ? (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video
            ref={videoRef}
            src={currentVideoSrc}
            autoPlay
            muted={isMuted}
            playsInline
            onError={handleVideoError}
            onEnded={handleFinish}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Sound & Skip Controls overlay for video */}
          <div
            style={{
              position: 'absolute',
              bottom: 30,
              right: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              zIndex: 10,
            }}
          >
            <button
              onClick={toggleMute}
              style={{
                background: 'rgba(14, 17, 24, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#E2E8F4',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                backdropFilter: 'blur(8px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              {isMuted ? '🔇 Muted' : '🔊 Audio On'}
            </button>

            <button
              onClick={handleFinish}
              style={{
                background: 'rgba(0, 200, 255, 0.15)',
                border: '1px solid rgba(0, 200, 255, 0.4)',
                color: '#00C8FF',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                backdropFilter: 'blur(8px)',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                transition: 'all 0.2s ease',
              }}
            >
              Skip Intro →
            </button>
          </div>
        </div>
      ) : (
        /* Animated Logo Fallback Screen */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            zIndex: 2,
            animation: 'fadeIn 0.5s ease-out',
          }}
        >
          {/* Logo with outer glow ring */}
          <div
            style={{
              position: 'relative',
              padding: 24,
              borderRadius: '24px',
              background: 'rgba(14, 17, 24, 0.6)',
              border: '1px solid rgba(0, 200, 255, 0.2)',
              boxShadow: '0 0 40px rgba(0, 200, 255, 0.15), inset 0 0 20px rgba(0, 200, 255, 0.05)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Logo size="xl" glow={true} />
          </div>

          {/* Progress Section */}
          <div style={{ width: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* Progress bar container */}
            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #00C8FF 0%, #7C3AED 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.1s linear',
                  boxShadow: '0 0 10px #00C8FF',
                }}
              />
            </div>

            {/* Status text */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', color: '#8A95A8', fontFamily: 'var(--font-code)' }}>
              <span>{statusText}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progress}%</span>
            </div>
          </div>

          {/* Skip button for fallback */}
          <button
            onClick={handleFinish}
            style={{
              position: 'absolute',
              bottom: 30,
              right: 30,
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#8A95A8',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Skip →
          </button>
        </div>
      )}
    </div>
  );
};
