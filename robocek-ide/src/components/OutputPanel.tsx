import { useEffect, useRef, useState } from 'react';
import type { OutputLine } from '../types';

interface OutputPanelProps {
  outputLines: OutputLine[];
  monitorLines: OutputLine[];
  activeTab: 'output' | 'monitor';
  onTabChange: (tab: 'output' | 'monitor') => void;
  onClearOutput: () => void;
  onClearMonitor: () => void;
  isMonitoring: boolean;
  onSendSerial: (data: string) => void;
}

const LINE_COLORS: Record<OutputLine['type'], string> = {
  info:    'var(--accent)',
  error:   'var(--error)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  plain:   'var(--text-secondary)',
};

export function OutputPanel({
  outputLines,
  monitorLines,
  activeTab,
  onTabChange,
  onClearOutput,
  onClearMonitor,
  isMonitoring,
  onSendSerial,
}: OutputPanelProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const monitorRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLInputElement>(null);
  const [sendInput, setSendInput] = useState('');

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (outputRef.current && activeTab === 'output') {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines, activeTab]);

  useEffect(() => {
    if (monitorRef.current && activeTab === 'monitor') {
      monitorRef.current.scrollTop = monitorRef.current.scrollHeight;
    }
  }, [monitorLines, activeTab]);

  // Focus send input when switching to monitor tab while active
  useEffect(() => {
    if (activeTab === 'monitor' && isMonitoring) {
      sendRef.current?.focus();
    }
  }, [activeTab, isMonitoring]);

  const handleSend = () => {
    const text = sendInput.trim();
    if (!text) return;
    onSendSerial(text);
    setSendInput('');
  };

  const lines = activeTab === 'output' ? outputLines : monitorLines;
  const onClear = activeTab === 'output' ? onClearOutput : onClearMonitor;

  return (
    <div style={s.root}>
      {/* Tab bar */}
      <div style={s.tabBar}>
        <button
          style={{ ...s.tab, ...(activeTab === 'output' ? s.tabActive : s.tabInactive) }}
          onClick={() => onTabChange('output')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Output
          {outputLines.filter(l => l.type === 'error').length > 0 && (
            <span style={s.errorCount}>
              {outputLines.filter(l => l.type === 'error').length}
            </span>
          )}
        </button>

        <button
          style={{ ...s.tab, ...(activeTab === 'monitor' ? s.tabActive : s.tabInactive) }}
          onClick={() => onTabChange('monitor')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          Serial Monitor
          {monitorLines.length > 0 && (
            <span style={s.monitorCount}>{monitorLines.length}</span>
          )}
        </button>

        <div style={{ flex: 1 }} />

        <button
          style={s.clearBtn}
          onClick={onClear}
          title={`Clear ${activeTab}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          Clear
        </button>
      </div>

      {/* Content */}
      <div
        ref={activeTab === 'output' ? outputRef : monitorRef}
        style={s.content}
      >
        {lines.length === 0 ? (
          <div style={s.emptyHint}>
            {activeTab === 'output'
              ? 'Click Build or Upload to see output here'
              : 'Click Monitor to start serial communication'}
          </div>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              style={{
                ...s.line,
                color: LINE_COLORS[line.type],
                fontWeight: line.type === 'success' || line.type === 'error' ? 600 : 400,
              }}
            >
              {line.text || '\u00A0'}
            </div>
          ))
        )}
      </div>

      {/* Serial send bar — shown only in monitor tab while connected */}
      {activeTab === 'monitor' && (
        <div style={{ ...s.sendBar, opacity: isMonitoring ? 1 : 0.4, pointerEvents: isMonitoring ? 'auto' : 'none' }}>
          <span style={s.sendPrompt}>&gt;</span>
          <input
            ref={sendRef}
            style={s.sendInput}
            value={sendInput}
            onChange={e => setSendInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder={isMonitoring ? 'Send to device...' : 'Not connected'}
            disabled={!isMonitoring}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            style={{ ...s.sendBtn, opacity: sendInput.trim() ? 1 : 0.4 }}
            onClick={handleSend}
            disabled={!isMonitoring || !sendInput.trim()}
            title="Send (Enter)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    height: 32,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 14px',
    height: '100%',
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    transition: 'color var(--t), background var(--t)',
  },
  tabActive: {
    color: 'var(--text-primary)',
    borderBottom: '2px solid var(--accent)',
    background: 'var(--bg-panel)',
  },
  tabInactive: {
    color: 'var(--text-muted)',
  },
  errorCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 16,
    height: 16,
    borderRadius: 'var(--r-pill)',
    background: 'var(--error)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    padding: '0 4px',
  },
  monitorCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 16,
    height: 16,
    borderRadius: 'var(--r-pill)',
    background: 'var(--bg-raised)',
    color: 'var(--text-muted)',
    fontSize: 10,
    fontWeight: 600,
    padding: '0 4px',
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 12px',
    height: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    transition: 'color var(--t)',
    marginRight: 4,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 16px',
    fontFamily: 'var(--font-code)',
    fontSize: 12,
    lineHeight: 1.7,
  },
  line: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    minHeight: 20,
  },
  emptyHint: {
    padding: '12px 0',
    fontSize: 12,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    fontFamily: 'var(--font-ui)',
  },
  sendBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    flexShrink: 0,
    transition: 'opacity var(--t)',
  },
  sendPrompt: {
    fontFamily: 'var(--font-code)',
    fontSize: 13,
    color: 'var(--success)',
    userSelect: 'none',
    flexShrink: 0,
  },
  sendInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontFamily: 'var(--font-code)',
    fontSize: 12,
    color: 'var(--text-primary)',
    padding: '2px 0',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    border: 'none',
    borderRadius: 'var(--r-sm)',
    background: 'var(--success-dim)',
    color: 'var(--success)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity var(--t)',
  },
};
