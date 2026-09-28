import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Logo } from '../components/Logo';
import type { CommandOutput, BootstrapStatus } from '../types';

interface BootstrapProps {
  onDone: () => void;
}

type SetupStep = 'idle' | 'python' | 'venv' | 'pio' | 'cli' | 'verify' | 'done' | 'failed';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function Bootstrap({ onDone }: BootstrapProps) {
  const [step, setStep] = useState<SetupStep>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('Checking environment...');
  const [running, setRunning] = useState(false);
  const [failedComponents, setFailedComponents] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Check current status on mount to show what's already working
  useEffect(() => {
    invoke<BootstrapStatus>('check_bootstrap_status')
      .then((status) => {
        if (status.is_ready) {
          setStatusMessage('Environment is ready.');
        } else {
          const missing: string[] = [];
          if (!status.python_ok) missing.push('Python');
          if (!status.venv_ok) missing.push('Virtual environment');
          if (!status.pio_ok) missing.push('PlatformIO');
          if (!status.cli_ok) missing.push('ROBOCEK CLI');
          if (!status.sdk_ok) missing.push('SDK');
          setFailedComponents(missing);
          setStatusMessage(`Setup required: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing or broken.`);
        }
      })
      .catch(() => {
        setStatusMessage('Unable to check environment status.');
      });
  }, []);

  const startSetup = async () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    setStep('python');
    setStatusMessage('Setting up environment...');

    const appendLog = (line: string) => {
      setLogs(prev => [...prev, line]);
    };

    // Listen to bootstrap logs from Rust backend
    const unlisten = await listen<CommandOutput>('bootstrap-progress', (event) => {
      const out = event.payload;
      if (out.is_done) {
        unlisten();
        if (out.exit_code === 0) {
          setStep('done');
          setStatusMessage('Setup completed successfully!');
          setRunning(false);
        } else {
          setStep('failed');
          setStatusMessage('Setup failed. Check the logs below for details.');
          setRunning(false);
        }
      } else {
        const line = out.line;
        appendLog(line);

        // Update steps based on log messages
        if (line.includes('Virtual environment')) {
          setStep('venv');
        } else if (line.includes('PlatformIO')) {
          setStep('pio');
        } else if (line.includes('ROBOCEK CLI')) {
          setStep('cli');
        } else if (line.includes('Verifying')) {
          setStep('verify');
        }
      }
    });

    try {
      await invoke('run_bootstrap');
    } catch (e) {
      unlisten();
      appendLog(`[ERROR] Unhandled Error: ${e}`);
      setStep('failed');
      setStatusMessage('Setup failed.');
      setRunning(false);
    }
  };

  const steps = [
    { key: 'python', label: 'Python 3.10+ Environment', desc: 'Verify Python installation' },
    { key: 'venv', label: 'Virtual Environment', desc: 'Create ~/.robocek/penv' },
    { key: 'pio', label: 'PlatformIO Core', desc: 'Install compilation toolchain' },
    { key: 'cli', label: 'ROBOCEK CLI & SDK', desc: 'Install CLI and SDK' },
    { key: 'verify', label: 'Verification', desc: 'Verify all components' },
  ] as const;

  return (
    <div style={s.root}>
      {/* Ambient background glows */}
      <div style={s.glowLeft} />
      <div style={s.glowRight} />

      <div style={s.container}>
        <div style={s.header}>
          <Logo size="lg" glow={true} style={{ marginBottom: 12 }} />
          <h1 style={s.title}>System Setup</h1>
          <p style={s.subtitle}>{statusMessage}</p>
        </div>

        {/* Missing components hint */}
        {failedComponents.length > 0 && step === 'idle' && (
          <div style={s.missingHint}>
            The following components need attention: {failedComponents.join(', ')}
          </div>
        )}

        {/* Steps Card */}
        <div style={s.card}>
          {steps.map((st, i) => {
            const stepOrder = ['python', 'venv', 'pio', 'cli', 'verify'];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = stepOrder.indexOf(st.key);
            const isCompleted = step === 'done' || (currentIdx > thisIdx && step !== 'idle' && step !== 'failed');
            const isActive = step === st.key;
            const isFailed = step === 'failed' && isActive;

            return (
              <div key={st.key} style={s.stepRow}>
                <div style={{
                  ...s.stepIcon,
                  ...(isActive ? s.stepActive : {}),
                  ...(isCompleted ? s.stepCompleted : {}),
                  ...(isFailed ? s.stepFailed : {}),
                }}>
                  {isCompleted ? <CheckIcon /> : isFailed ? <XIcon /> : i + 1}
                </div>
                <div style={s.stepText}>
                  <div style={s.stepTitle}>{st.label}</div>
                  <div style={s.stepDesc}>{st.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Logs console */}
        {logs.length > 0 && (
          <div style={s.logBox}>
            {logs.map((line, i) => (
              <div
                key={i}
                style={{
                  ...s.logLine,
                  color: line.startsWith('[ERROR]') ? 'var(--error)'
                       : line.includes('READY') || line.includes('OK') ? 'var(--success)'
                       : line.startsWith('  ') ? 'var(--text-secondary)'
                       : 'var(--text-primary)',
                }}
              >
                {line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {/* Controls */}
        <div style={s.controls}>
          {step === 'idle' && (
            <button className="btn btn-primary" onClick={startSetup} style={s.btn}>
              Start Setup
            </button>
          )}

          {running && (
            <div style={s.runningLoader}>
              <div className="spinner" style={{ marginRight: 12 }} />
              <span>Setting up environment... Please do not close the window.</span>
            </div>
          )}

          {step === 'failed' && (
            <button className="btn btn-primary" onClick={startSetup} style={s.btn}>
              Retry Setup
            </button>
          )}

          {step === 'done' && (
            <button className="btn btn-primary" onClick={onDone} style={s.btn}>
              Continue to IDE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: 'var(--bg-base)',
    overflow: 'auto',
    padding: '40px 24px',
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
  container: {
    width: '100%',
    maxWidth: 620,
    zIndex: 1,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 28,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    background: 'linear-gradient(135deg, #E2E8F4 0%, var(--accent) 70%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    maxWidth: 420,
    lineHeight: 1.5,
  },
  missingHint: {
    padding: '10px 16px',
    background: 'var(--warning-dim)',
    border: '1px solid rgba(255,179,0,0.25)',
    borderRadius: 'var(--r)',
    color: 'var(--warning)',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  card: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    marginBottom: 20,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: 'var(--bg-raised)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    transition: 'all var(--t)',
  },
  stepActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    boxShadow: '0 0 10px rgba(0,200,255,0.15)',
  },
  stepCompleted: {
    borderColor: 'var(--success)',
    background: 'var(--success)',
    color: '#000',
  },
  stepFailed: {
    borderColor: 'var(--error)',
    background: 'var(--error)',
    color: '#fff',
  },
  stepText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  stepDesc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  logBox: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '14px 16px',
    fontFamily: 'var(--font-code)',
    fontSize: 11,
    lineHeight: 1.8,
    maxHeight: 180,
    overflowY: 'auto',
    marginBottom: 24,
  },
  logLine: {
    minHeight: 18,
    wordBreak: 'break-all',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
  },
  btn: {
    padding: '12px 32px',
    fontSize: 14,
    borderRadius: 'var(--r-lg)',
  },
  runningLoader: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: 'var(--text-secondary)',
    background: 'var(--bg-panel)',
    padding: '12px 20px',
    borderRadius: 'var(--r-lg)',
    border: '1px solid var(--border)',
  },
};
