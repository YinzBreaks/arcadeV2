import React from 'react';

export type MachineStatus = 'available' | 'locked' | 'busy';

// Cabinet art configuration type
export interface CabinetArt {
  marqueeArt?: string; // URL for marquee image
  sideLeft?: string; // URL for left side art
  sideRight?: string; // URL for right side art
  wear?: string; // URL for wear/grime overlay
  accentColor?: string; // CSS color for cabinet accent (fallback when no art)
}

interface ArcadeMachineProps {
  gameId: string;
  title: string;
  status: MachineStatus;
  onClick: () => void;
  art?: CabinetArt;
}

export default function ArcadeMachine({
  gameId,
  title,
  status,
  onClick,
  art,
}: ArcadeMachineProps) {
  const isClickable = status === 'available';
  const [pressed, setPressed] = React.useState(false);

  function handleClick() {
    if (!isClickable) return;
    setPressed(true);
    onClick();
  }

  // Inline style for accent color (used when no art provided)
  const accentStyle = art?.accentColor
    ? ({ '--cabinet-accent': art.accentColor } as React.CSSProperties)
    : undefined;

  return (
    <button
      className={`arcade-machine arcade-machine--${status}${pressed ? ' arcade-machine--pressed' : ''}`}
      onClick={handleClick}
      disabled={!isClickable}
      aria-label={`${title} - ${status === 'available' ? 'Click to play' : status === 'busy' ? 'Starting...' : 'Unavailable'}`}
      data-game-id={gameId}
      data-status={status}
      style={accentStyle}
    >
      {/* Floor light pool from this cabinet */}
      <div className="machine-floor-light" />

      {/* Cabinet body */}
      <div className="machine-cabinet">
        {/* Side art overlays - left */}
        {art?.sideLeft && (
          <div
            className="cabinet-side-art cabinet-side-art--left"
            style={{ backgroundImage: `url(${art.sideLeft})` }}
          />
        )}

        {/* Side art overlays - right */}
        {art?.sideRight && (
          <div
            className="cabinet-side-art cabinet-side-art--right"
            style={{ backgroundImage: `url(${art.sideRight})` }}
          />
        )}

        {/* Marquee area with optional art */}
        <div className="machine-marquee">
          {art?.marqueeArt ? (
            <div
              className="marquee-art"
              style={{ backgroundImage: `url(${art.marqueeArt})` }}
            />
          ) : (
            <span className="marquee-title">{title}</span>
          )}
        </div>

        {/* Screen area */}
        <div className="machine-screen">
          <span className="machine-title">{title}</span>
          {status === 'locked' && <span className="machine-locked-icon">🔒</span>}
          {status === 'busy' && <span className="machine-busy-text">STARTING...</span>}
        </div>

        {/* Control panel */}
        <div className="machine-controls">
          <div className="machine-joystick" />
          <div className="machine-buttons">
            <div className="machine-btn machine-btn--red" />
            <div className="machine-btn machine-btn--blue" />
          </div>
        </div>

        {/* Wear overlay - scratches/grime effect */}
        {art?.wear && (
          <div
            className="cabinet-wear-overlay"
            style={{ backgroundImage: `url(${art.wear})` }}
          />
        )}

        {/* Default wear texture (CSS-only, no image) */}
        <div className="cabinet-wear-default" />
      </div>

      {/* Glow effect container */}
      <div className="machine-glow" />
    </button>
  );
}
