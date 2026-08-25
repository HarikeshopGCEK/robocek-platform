import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Template, Board, RecentProject } from '../types';

interface NewProjectProps {
  onBack: () => void;
  onDone: (projectPath: string) => void;
}

type Step = 1 | 2 | 3;

const RECENT_KEY = 'robocek-recent-projects';

const TEMPLATE_ICONS: Record<string, string> = {
  empty:             '📄',
  'line-follower':   '🏁',
  'obstacle-avoider':'🚧',
  'motor-test':      '⚙️',
  'line-sensor-test':'🔍',
  'ultrasonic-test': '📡',
};

export function NewProject({ onBack, onDone }: NewProjectProps) {
  const [step, setStep] = useState<Step>(1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);
  const [createdPath, setCreatedPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    Promise.all([
      invoke<Template[]>('list_templates'),
      invoke<Board[]>('list_boards'),
    ]).then(([t, b]) => {
      setTemplates(t);
      setBoards(b);
      if (b.length > 0) setSelectedBoard(b[0].id);
    }).catch(() => {});
  }, []);

  const handlePickFolder = async () => {
    const folder = await invoke<string | null>('open_folder_dialog');
    if (folder) setDestination(folder);
  };

  const validateName = (n: string) => {
    if (!n) return 'Project name is required';
    if (!/^[a-z0-9-_]+$/i.test(n)) return 'Use only letters, numbers, hyphens, or underscores';
    return '';
  };

  const handleCreate = async () => {
    const err = validateName(projectName);
    if (err) { setNameError(err); return; }
    if (!destination) { setError('Please select a destination folder'); return; }
    if (!selectedTemplate) return;

    setError(null);
    setCreating(true);
    setStep(3);
    setLogs([]);

    const appendLog = (line: string) => setLogs(prev => [...prev, line]);

    appendLog('⚡ Starting project creation...');
    appendLog(`   Template : ${selectedTemplate.name}`);
    appendLog(`   Board    : ${selectedBoard}`);
    appendLog(`   Location : ${destination}\\${projectName}`);
    appendLog('');

    try {
      appendLog('📁 Creating directory structure...');
      const path = await invoke<string>('create_project', {
        templateId: selectedTemplate.id,
        projectName: projectName,
        boardId: selectedBoard,
        destination,
      });

      appendLog('📋 Copying template source...');
      appendLog('📦 Copying ROBOCEK SDK...');
      appendLog('⚙️  Generating hardware configuration...');
      appendLog('📄 Writing platformio.ini...');
      appendLog('📄 Writing robocek.yaml...');
      appendLog('');
      appendLog('✅ Project created successfully!');
      appendLog(`   Path: ${path}`);

      // Save to recent
      const recent: RecentProject[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      const updated = [
        { name: projectName, path, board: selectedBoard, template: selectedTemplate.id, lastOpened: Date.now() },
        ...recent.filter(r => r.path !== path),
      ].slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));

      setCreatedPath(path);
      setDone(true);
    } catch (e) {
      appendLog('');
      appendLog(`❌ Error: ${e}`);
      setError(e as string);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={s.root}>
      {/* Top bar */}
      <div style={s.topBar}>
        <button className="btn btn-ghost" onClick={onBack} style={s.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <div style={s.title}>New Project</div>
        {/* Step indicator */}
        <div style={s.steps}>
          {([1, 2, 3] as Step[]).map(n => (
            <div key={n} style={{ ...s.step, ...(step >= n ? s.stepActive : {}) }}>
              <div style={{ ...s.stepDot, ...(step > n ? s.stepDone : step === n ? s.stepCurrent : {}) }}>
                {step > n ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : n}
              </div>
              <span style={s.stepLabel}>
                {n === 1 ? 'Template' : n === 2 ? 'Configure' : 'Create'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.content}>
        {/* ─── STEP 1: Choose template ─── */}
        {step === 1 && (
          <div style={s.stepContent}>
            <h2 style={s.stepHeading}>Choose a Template</h2>
            <p style={s.stepSub}>Select a starting point for your robot firmware</p>
            <div style={s.templateGrid}>
              {templates.map(t => (
                <button
                  key={t.id}
                  style={{
                    ...s.templateCard,
                    ...(selectedTemplate?.id === t.id ? s.templateCardSelected : {}),
                  }}
                  onClick={() => setSelectedTemplate(t)}
                >
                  <div style={s.templateTop}>
                    <span style={s.templateIcon}>{TEMPLATE_ICONS[t.id] ?? '📄'}</span>
                    <span className={`badge badge-${t.category}`}>{t.category}</span>
                  </div>
                  <div style={s.templateName}>{t.name}</div>
                  <div style={s.templateDesc}>{t.description}</div>
                  {selectedTemplate?.id === t.id && (
                    <div style={s.selectedCheck}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div style={s.stepFooter}>
              <div />
              <button
                className="btn btn-primary"
                disabled={!selectedTemplate}
                onClick={() => setStep(2)}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Configure ─── */}
        {step === 2 && (
          <div style={{ ...s.stepContent, maxWidth: 520 }}>
            <h2 style={s.stepHeading}>Configure Project</h2>
            <p style={s.stepSub}>Name your project and select a target board</p>

            <div style={s.formGroup}>
              <label className="form-label">Project Name</label>
              <input
                className="input"
                value={projectName}
                placeholder="my-robot"
                onChange={e => {
                  setProjectName(e.target.value);
                  setNameError(validateName(e.target.value));
                }}
                autoFocus
              />
              {nameError && <div style={s.fieldError}>{nameError}</div>}
            </div>

            <div style={s.formGroup}>
              <label className="form-label">Destination Folder</label>
              <div style={s.folderRow}>
                <input
                  className="input"
                  value={destination}
                  placeholder="Select a folder..."
                  onChange={e => setDestination(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={handlePickFolder}>Browse</button>
              </div>
              {destination && projectName && (
                <div style={s.pathPreview}>
                  📁 {destination}\{projectName}
                </div>
              )}
            </div>

            <div style={s.formGroup}>
              <label className="form-label">Target Board</label>
              <select
                className="select"
                value={selectedBoard}
                onChange={e => setSelectedBoard(e.target.value)}
              >
                {boards.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Summary card */}
            <div style={s.summaryCard}>
              <div style={s.summaryRow}>
                <span style={s.summaryKey}>Template</span>
                <span style={s.summaryVal}>{selectedTemplate?.name}</span>
              </div>
              <div style={s.summaryRow}>
                <span style={s.summaryKey}>Board</span>
                <span style={s.summaryVal}>{boards.find(b => b.id === selectedBoard)?.name}</span>
              </div>
              <div style={s.summaryRow}>
                <span style={s.summaryKey}>Framework</span>
                <span style={s.summaryVal}>Arduino / PlatformIO</span>
              </div>
            </div>

            {error && <div style={s.errorBox}>{error}</div>}

            <div style={s.stepFooter}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button
                className="btn btn-primary"
                disabled={!projectName || !destination || !selectedBoard || !!nameError}
                onClick={handleCreate}
              >
                Create Project
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Creating / Done ─── */}
        {step === 3 && (
          <div style={{ ...s.stepContent, maxWidth: 560 }}>
            <h2 style={s.stepHeading}>
              {creating ? 'Creating Project...' : done ? '🎉 Project Ready!' : '❌ Creation Failed'}
            </h2>

            {/* Log output */}
            <div style={s.logBox}>
              {logs.map((line, i) => (
                <div
                  key={i}
                  style={{
                    ...s.logLine,
                    color: line.startsWith('❌') ? 'var(--error)'
                         : line.startsWith('✅') ? 'var(--success)'
                         : line.startsWith('  ') ? 'var(--text-secondary)'
                         : 'var(--text-primary)',
                    animation: `fadeIn 0.2s ease ${i * 0.04}s both`,
                  }}
                >
                  {line || '\u00A0'}
                </div>
              ))}
              {creating && <div style={s.logLine}><span className="spinner spinner-sm" /></div>}
            </div>

            {done && (
              <div style={s.stepFooter}>
                <button className="btn btn-secondary" onClick={onBack}>Back to Home</button>
                <button
                  className="btn btn-primary"
                  onClick={() => onDone(createdPath)}
                >
                  Open in Editor
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-base)',
    animation: 'fadeIn 0.3s ease',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 24px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  },
  backBtn: { color: 'var(--text-secondary)' },
  title: { fontSize: 15, fontWeight: 600, flex: 1 },
  steps: { display: 'flex', gap: 24, alignItems: 'center' },
  step: { display: 'flex', alignItems: 'center', gap: 6, opacity: 0.4 },
  stepActive: { opacity: 1 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  stepDone: {
    background: 'var(--success)',
    border: '1px solid var(--success)',
    color: '#000',
  },
  stepCurrent: {
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    color: '#000',
  },
  stepLabel: { fontSize: 12, fontWeight: 500 },
  content: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    overflow: 'auto',
    padding: '32px 24px',
  },
  stepContent: {
    width: '100%',
    maxWidth: 800,
    animation: 'slideUp 0.3s ease',
  },
  stepHeading: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  stepSub: { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  templateCard: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--text-primary)',
    transition: 'all var(--t)',
  },
  templateCardSelected: {
    borderColor: 'var(--accent)',
    background: 'var(--bg-panel-hover)',
    boxShadow: '0 0 0 1px var(--accent), 0 0 20px var(--accent-glow)',
  },
  templateTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  templateIcon: { fontSize: 24 },
  templateName: { fontSize: 14, fontWeight: 600 },
  templateDesc: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 },
  selectedCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#000',
  },
  stepFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 24,
    borderTop: '1px solid var(--border)',
    marginTop: 8,
  },
  formGroup: { marginBottom: 20 },
  fieldError: { fontSize: 11, color: 'var(--error)', marginTop: 4 },
  folderRow: { display: 'flex', gap: 8 },
  pathPreview: {
    marginTop: 6,
    fontSize: 11,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-code)',
    background: 'var(--bg-raised)',
    padding: '4px 10px',
    borderRadius: 'var(--r-sm)',
  },
  summaryCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
    marginBottom: 20,
  },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12 },
  summaryKey: { color: 'var(--text-muted)' },
  summaryVal: { color: 'var(--text-primary)', fontWeight: 500 },
  errorBox: {
    padding: '10px 14px',
    background: 'var(--error-dim)',
    border: '1px solid rgba(255,82,82,0.25)',
    borderRadius: 'var(--r)',
    color: 'var(--error)',
    fontSize: 13,
    marginBottom: 16,
  },
  logBox: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r)',
    padding: '16px',
    fontFamily: 'var(--font-code)',
    fontSize: 12,
    lineHeight: 1.8,
    minHeight: 200,
    marginBottom: 24,
    overflow: 'auto',
  },
  logLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 20,
  },
};
