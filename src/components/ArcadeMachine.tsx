import React from 'react';

export type MachineStatus = 'available' | 'locked' | 'busy';

interface ArcadeMachineProps {
  gameId: string;
  title: string;
  status: MachineStatus;
  onClick: () => void;
}

export default function ArcadeMachine({ gameId, title, status, onClick }: ArcadeMachineProps) {
  const isClickable = status === 'available';
  const [pressed, setPressed] = React.useState(false);

  function handleClick() {
    if (!isClickable) return;
    setPressed(true);
    onClick();
  }

  return (
    <button
      className={`arcade-machine arcade-machine--${status}${pressed ? ' arcade-machine--pressed' : ''}`}
      onClick={handleClick}
      disabled={!isClickable}
      aria-label={`${title} - ${status === 'available' ? 'Click to play' : status === 'busy' ? 'Starting...' : 'Unavailable'}`}
      data-game-id={gameId}
      data-status={status}
    >
      {/* Floor light pool from this cabinet */}
      <div className="machine-floor-light" />
      
      {/* Cabinet body */}
      <div className="machine-cabinet">
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
      </div>

      {/* Glow effect container */}
      <div className="machine-glow" />
    </button>
  );
}
