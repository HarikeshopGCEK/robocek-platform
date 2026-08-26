import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CommandOutput } from '../types';

interface BootstrapProps {
  onDone: () => void;
}

type SetupStep = 'idle' | 'python' | 'venv' | 'pio' | 'cli' | 'done' | 'failed';

export function Bootstrap({ onDone }: BootstrapProps) {
  const [step, setStep] = useState<SetupStep>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('ROBOCEK IDE requires system setup before starting.');
  const [running, setRunning] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startSetup = async () => {
    if (running) return;
    setRunning(true);
    setLogs([]);
    setStep('python');
    setStatusMessage('Setting up Python 3 environment...');

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
          setStatusMessage('Setup failed. Check the logs below.');
          setRunning(false);
        }
      } else {
        const line = out.line;
        appendLog(line);

        // Update steps based on log messages
        if (line.includes('📁 Creating isolated virtual environment')) {
          setStep('venv');
          setStatusMessage('Creating private virtual environment...');
        } else if (line.includes('📦 Installing PlatformIO Core')) {
          setStep('pio');
          setStatusMessage('Installing PlatformIO compiler toolchain...');
        } else if (line.includes('📦 Bundling and installing robocek-cli')) {
          setStep('cli');
          setStatusMessage('Installing ROBOCEK CLI & SDK...');
        }
      }
    });

    try {
      await invoke('run_bootstrap');
    } catch (e) {
      unlisten();
      appendLog(`❌ Unhandled Error: ${e}`);
      setStep('failed');
      setStatusMessage('Setup failed.');
      setRunning(false);
    }
  };

  return (
    <div style={s.root}>
      {/* Ambient background glows */}
      <div style={s.glowLeft} />
      <div style={s.glowRight} />

      <div style={s.container}>
        <div style={s.header}>
          <div style={s.logoMark}>⚡</div>
          <h1 style={s.title}>System Setup</h1>
          <p style={s.subtitle}>{statusMessage}</p>
        </div>

        {/* Steps Card */}
        <div style={s.card}>
          <div style={s.stepRow}>
            <div style={{ ...s.stepIcon, ...(step === 'python' ? s.stepActive : ['venv', 'pio', 'cli', 'done'].includes(step) ? s.stepCompleted : {}) }}>
              {['venv', 'pio', 'cli', 'done'].includes(step) ? '✓' : '1'}
            </div>
            <div style={s.stepText}>
              <div style={s.stepTitle}>Python 3.10+ Environment</div>
              <div style={s.stepDesc}>Verify Python installation or download portable Windows version.</div>
            </div>
          </div>

          <div style={s.stepRow}>
            <div style={{ ...s.stepIcon, ...(step === 'venv' ? s.stepActive : ['pio', 'cli', 'done'].includes(step) ? s.stepCompleted : {}) }}>
              {['pio', 'cli', 'done'].includes(step) ? '✓' : '2'}
            </div>
            <div style={s.stepText}>
              <div style={s.stepTitle}>Virtual Environment Setup</div>
              <div style={s.stepDesc}>Create private local python virtual environment to prevent system conflicts.</div>
            </div>
          </div>

          <div style={s.stepRow}>
            <div style={{ ...s.stepIcon, ...(step === 'pio' ? s.stepActive : ['cli', 'done'].includes(step) ? s.stepCompleted : {}) }}>
              {['cli', 'done'].includes(step) ? '✓' : '3'}
            </div>
            <div style={s.stepText}>
              <div style={s.stepTitle}>PlatformIO Core Compilation Toolchain</div>
              <div style={s.stepDesc}>Install core library builders, compilers, and serial uploaders.</div>
            </div>
          </div>

          <div style={s.stepRow}>
            <div style={{ ...s.stepIcon, ...(step === 'cli' ? s.stepActive : step === 'done' ? s.stepCompleted : {}) }}>
              {step === 'done' ? '✓' : '4'}
            </div>
            <div style={s.stepText}>
              <div style={s.stepTitle}>ROBOCEK CLI & SDK</div>
              <div style={s.stepDesc}>Install the robot configuration generator and standard library SDK.</div>
            </div>
          </div>
        </div>

        {/* Logs console */}
        {logs.length > 0 && (
          <div style={s.logBox}>
            {logs.map((line, i) => (
              <div
                key={i}
                style={{
                  ...s.logLine,
                  color: line.startsWith('❌') ? 'var(--error)'
                       : line.startsWith('✅') || line.startsWith('🎉') ? 'var(--success)'
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
              <span>Installing dependencies... Please do not close the window.</span>
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
  logoMark: {
    fontSize: 44,
    marginBottom: 12,
    filter: 'drop-shadow(0 0 20px rgba(0,200,255,0.5))',
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
