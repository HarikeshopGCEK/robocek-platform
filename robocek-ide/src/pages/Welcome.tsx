import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RecentProject } from '../types';

interface WelcomeProps {
  onNewProject: () => void;
  onOpenProject: (path: string) => void;
}

const RECENT_KEY = 'robocek-recent-projects';

function getRecent(): RecentProject[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function Welcome({ onNewProject, onOpenProject }: WelcomeProps) {
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    setRecent(getRecent().slice(0, 8));
  }, []);

  const handleOpenFolder = async () => {
    setError(null);
    setOpening(true);
    try {
      const folder = await invoke<string | null>('open_folder_dialog');
      if (!folder) { setOpening(false); return; }

      const info = await invoke<{ name: string; path: string; board: string; template: string }>(
        'get_project_info',
        { projectDir: folder }
      );

      // Save to recent
      const updated: RecentProject[] = [
        { name: info.name, path: folder, board: info.board, template: info.template, lastOpened: Date.now() },
        ...getRecent().filter(r => r.path !== folder),
      ].slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));

      onOpenProject(folder);
    } catch (err) {
      setError(err as string);
    } finally {
      setOpening(false);
    }
  };

  const handleOpenRecent = async (project: RecentProject) => {
    setError(null);
    setOpening(true);
    try {
      await invoke('get_project_info', { projectDir: project.path });
      const updated: RecentProject[] = [
        { ...project, lastOpened: Date.now() },
        ...getRecent().filter(r => r.path !== project.path),
      ].slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      onOpenProject(project.path);
    } catch {
      setError(`Project not found: ${project.path}`);
      const cleaned = getRecent().filter(r => r.path !== project.path);
      localStorage.setItem(RECENT_KEY, JSON.stringify(cleaned));
      setRecent(cleaned.slice(0, 8));
    } finally {
      setOpening(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={styles.root}>
      {/* Ambient background glows */}
      <div style={styles.glowLeft} />
      <div style={styles.glowRight} />

      {/* Header strip */}
      <div style={styles.header}>
        <span style={styles.headerTag}>v0.1.0</span>
      </div>

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.logoMark}>⚡</div>
        <h1 style={styles.logo}>ROBOCEK IDE</h1>
        <p style={styles.tagline}>Embedded Robotics Development Platform for ESP32</p>
      </div>

      {/* Action cards */}
      <div style={styles.actions}>
        <button style={styles.actionCard} onClick={onNewProject} className="action-card-btn">
          <div style={styles.cardIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <div style={styles.cardTitle}>New Project</div>
            <div style={styles.cardDesc}>Create from a template</div>
          </div>
          <svg style={styles.cardArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>

        <button
          style={{ ...styles.actionCard, ...styles.actionCardSecondary }}
          onClick={handleOpenFolder}
          disabled={opening}
          className="action-card-btn-secondary"
        >
          <div style={{ ...styles.cardIcon, ...styles.cardIconSecondary }}>
            {opening ? (
              <div className="spinner" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </div>
          <div>
            <div style={styles.cardTitle}>Open Project</div>
            <div style={styles.cardDesc}>Browse for a ROBOCEK project</div>
          </div>
          <svg style={styles.cardArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Recent projects */}
      {recent.length > 0 && (
        <div style={styles.recent}>
          <div style={styles.recentHeader}>Recent Projects</div>
          <div style={styles.recentList}>
            {recent.map((p) => (
              <button key={p.path} style={styles.recentItem} onClick={() => handleOpenRecent(p)}>
                <div style={styles.recentDot} />
                <div style={styles.recentInfo}>
                  <span style={styles.recentName}>{p.name}</span>
                  <span style={styles.recentMeta}>{p.board} · {p.template}</span>
                </div>
                <span style={styles.recentTime}>{formatDate(p.lastOpened)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    background: 'var(--bg-base)',
    overflow: 'auto',
    padding: '0 24px 40px',
    animation: 'fadeIn 0.4s ease',
  },
  glowLeft: {
    position: 'fixed',
    top: '20%',
    left: '-10%',
    width: '40vw',
    height: '40vw',
    background: 'radial-gradient(circle, rgba(0,200,255,0.07) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  glowRight: {
    position: 'fixed',
    top: '30%',
    right: '-10%',
    width: '40vw',
    height: '40vw',
    background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  header: {
    width: '100%',
    maxWidth: 720,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '16px 0 0',
  },
  headerTag: {
    fontSize: 11,
    color: 'var(--text-muted)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-pill)',
    padding: '2px 10px',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 0 44px',
    animation: 'slideUp 0.5s ease',
  },
  logoMark: {
    fontSize: 48,
    marginBottom: 16,
    filter: 'drop-shadow(0 0 20px rgba(0,200,255,0.6))',
  },
  logo: {
    fontSize: 42,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, #E2E8F4 0%, var(--accent) 60%, var(--purple-soft) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    textAlign: 'center',
    maxWidth: 400,
  },
  actions: {
    display: 'flex',
    gap: 16,
    width: '100%',
    maxWidth: 620,
    animation: 'slideUp 0.5s ease 0.1s both',
  },
  actionCard: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '20px 20px 20px 20px',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--text-primary)',
    transition: 'all var(--t-slow)',
    position: 'relative',
    overflow: 'hidden',
  },
  actionCardSecondary: {
    background: 'var(--bg-surface)',
  },
  cardIcon: {
    width: 52,
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--accent-dim)',
    border: '1px solid rgba(0,200,255,0.2)',
    borderRadius: 'var(--r-lg)',
    color: 'var(--accent)',
    flexShrink: 0,
  },
  cardIconSecondary: {
    background: 'var(--purple-dim)',
    border: '1px solid rgba(124,58,237,0.2)',
    color: 'var(--purple-soft)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  cardArrow: {
    marginLeft: 'auto',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: '10px 16px',
    background: 'var(--error-dim)',
    border: '1px solid rgba(255,82,82,0.25)',
    borderRadius: 'var(--r)',
    color: 'var(--error)',
    fontSize: 13,
    width: '100%',
    maxWidth: 620,
    animation: 'fadeIn 0.2s ease',
  },
  recent: {
    width: '100%',
    maxWidth: 620,
    marginTop: 36,
    animation: 'slideUp 0.5s ease 0.2s both',
  },
  recentHeader: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 10,
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--r)',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    transition: 'all var(--t)',
    textAlign: 'left',
    width: '100%',
  },
  recentDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
    opacity: 0.6,
    flexShrink: 0,
  },
  recentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  recentName: {
    fontSize: 13,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recentMeta: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  recentTime: {
    fontSize: 11,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
};
