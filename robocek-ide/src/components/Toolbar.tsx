import type { ProjectInfo, SerialDevice } from '../types';

interface ToolbarProps {
  projectInfo: ProjectInfo | null;
  isBuilding: boolean;
  isUploading: boolean;
  isMonitoring: boolean;
  devices: SerialDevice[];
  onBuild: () => void;
  onUpload: () => void;
  onMonitor: () => void;
  onBack: () => void;
}

export function Toolbar({
  projectInfo,
  isBuilding,
  isUploading,
  isMonitoring,
  devices,
  onBuild,
  onUpload,
  onMonitor,
  onBack,
}: ToolbarProps) {
  const busy = isBuilding || isUploading || isMonitoring;

  return (
    <div style={s.bar}>
      {/* Left: back + project name */}
      <div style={s.left}>
        <button style={s.backBtn} onClick={onBack} title="Back to Home">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div style={s.logoMark}>⚡</div>

        <div style={s.projectInfo}>
          <span style={s.projectName}>{projectInfo?.name ?? '...'}</span>
          {projectInfo && (
            <span style={s.boardBadge}>{projectInfo.board}</span>
          )}
        </div>
      </div>

      {/* Center: action buttons */}
      <div style={s.center}>
        <button
          style={{ ...s.actionBtn, ...(isBuilding ? s.actionBtnActive : {}) }}
          onClick={onBuild}
          disabled={busy}
          title="Build project (pio run)"
        >
          {isBuilding ? (
            <div className="spinner spinner-sm" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
            </svg>
          )}
          Build
        </button>

        <button
          style={{ ...s.actionBtn, ...s.uploadBtn, ...(isUploading ? s.actionBtnActive : {}) }}
          onClick={onUpload}
          disabled={busy}
          title="Build and upload firmware"
        >
          {isUploading ? (
            <div className="spinner spinner-sm" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
            </svg>
          )}
          Upload
        </button>

        <button
          style={{ ...s.actionBtn, ...s.monitorBtn, ...(isMonitoring ? s.monitorActive : {}) }}
          onClick={onMonitor}
          disabled={isBuilding || isUploading}
          title="Open serial monitor"
        >
          {isMonitoring ? (
            <>
              <span style={s.monitorDot} />
              Monitoring
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
              Monitor
            </>
          )}
        </button>
      </div>

      {/* Right: device indicator */}
      <div style={s.right}>
        {devices.length > 0 ? (
          <div style={s.devicePill} title={devices.map(d => `${d.port}: ${d.description}`).join('\n')}>
            <span style={s.deviceDot} />
            {devices.length === 1 ? devices[0].port : `${devices.length} devices`}
          </div>
        ) : (
          <div style={s.noDevice} title="No serial devices detected">
            <span style={s.noDeviceDot} />
            No device
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 46,
    padding: '0 12px',
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    gap: 12,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    borderRadius: 'var(--r-sm)',
    transition: 'color var(--t), background var(--t)',
    flexShrink: 0,
  },
  logoMark: {
    fontSize: 16,
    filter: 'drop-shadow(0 0 6px rgba(0,200,255,0.5))',
    flexShrink: 0,
  },
  projectInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  projectName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  boardBadge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: 'var(--accent)',
    background: 'var(--accent-dim)',
    border: '1px solid rgba(0,200,255,0.15)',
    borderRadius: 'var(--r-pill)',
    padding: '1px 7px',
    flexShrink: 0,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    background: 'var(--bg-raised)',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all var(--t)',
    fontFamily: 'var(--font-ui)',
  },
  actionBtnActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
  },
  uploadBtn: {
    borderColor: 'rgba(124,58,237,0.3)',
    background: 'var(--purple-dim)',
    color: 'var(--purple-soft)',
  },
  monitorBtn: {
    borderColor: 'rgba(0,230,118,0.2)',
    background: 'rgba(0,230,118,0.06)',
    color: 'var(--success)',
  },
  monitorActive: {
    borderColor: 'var(--success)',
    background: 'var(--success-dim)',
    color: 'var(--success)',
    animation: 'pulseGlow 2s ease infinite',
  },
  monitorDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--success)',
    animation: 'blink 1.2s ease infinite',
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  devicePill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--success)',
    background: 'var(--success-dim)',
    border: '1px solid rgba(0,230,118,0.2)',
    borderRadius: 'var(--r-pill)',
    padding: '3px 10px',
    cursor: 'default',
    fontFamily: 'var(--font-code)',
  },
  deviceDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--success)',
    flexShrink: 0,
    animation: 'blink 2s ease infinite',
  },
  noDevice: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-pill)',
    padding: '3px 10px',
    cursor: 'default',
  },
  noDeviceDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--text-muted)',
    flexShrink: 0,
  },
};
