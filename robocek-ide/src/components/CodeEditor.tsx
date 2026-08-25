import MonacoEditor from '@monaco-editor/react';
import type { OpenFile } from '../types';

interface CodeEditorProps {
  openFiles: OpenFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileChange: (path: string, content: string) => void;
  onFileSave: (path: string) => void;
  onFileClose: (path: string) => void;
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'cpp': case 'cc': case 'cxx': return 'cpp';
    case 'c':   return 'c';
    case 'h':   case 'hpp': return 'cpp';
    case 'yaml':case 'yml': return 'yaml';
    case 'json': return 'json';
    case 'ini':  return 'ini';
    case 'md':   return 'markdown';
    case 'rs':   return 'rust';
    case 'py':   return 'python';
    default:     return 'plaintext';
  }
}

export function CodeEditor({
  openFiles,
  activeFilePath,
  onFileSelect,
  onFileChange,
  onFileSave,
  onFileClose,
}: CodeEditorProps) {
  const activeFile = openFiles.find(f => f.path === activeFilePath);

  return (
    <div style={s.root}>
      {/* Tab bar */}
      <div style={s.tabBar}>
        {openFiles.length === 0 && (
          <div style={s.noTabsHint}>Open a file from the sidebar</div>
        )}
        {openFiles.map(f => (
          <div
            key={f.path}
            style={{
              ...s.tab,
              ...(f.path === activeFilePath ? s.tabActive : s.tabInactive),
            }}
            onClick={() => onFileSelect(f.path)}
            title={f.path}
          >
            <span style={s.tabName}>{f.name}</span>
            {f.modified && <span style={s.tabDot} title="Unsaved changes" />}
            <button
              style={s.tabClose}
              onClick={e => { e.stopPropagation(); onFileClose(f.path); }}
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Editor */}
      {activeFile ? (
        <div style={s.monacoWrapper}>
          <MonacoEditor
            height="100%"
            language={getLanguage(activeFile.name)}
            value={activeFile.content}
            theme="vs-dark"
            onChange={val => onFileChange(activeFile.path, val ?? '')}
            onMount={(editor, monaco) => {
              // Override the default vs-dark with our custom background
              monaco.editor.defineTheme('robocek-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                  { token: 'comment', foreground: '4A5568', fontStyle: 'italic' },
                  { token: 'keyword', foreground: '00C8FF' },
                  { token: 'string', foreground: 'A8C7FA' },
                  { token: 'number', foreground: 'FFB300' },
                  { token: 'type', foreground: '7C3AED' },
                ],
                colors: {
                  'editor.background':           '#0E1118',
                  'editor.foreground':           '#E2E8F4',
                  'editorLineNumber.foreground': '#2D3748',
                  'editorLineNumber.activeForeground': '#4A5568',
                  'editor.lineHighlightBackground': '#141720',
                  'editorCursor.foreground':     '#00C8FF',
                  'editor.selectionBackground':  '#00C8FF22',
                  'editorGutter.background':     '#0E1118',
                  'editorWidget.background':     '#141720',
                  'editorSuggestWidget.background': '#141720',
                  'editorSuggestWidget.border':  '#2A2D3A',
                },
              });
              monaco.editor.setTheme('robocek-dark');

              // Save on Ctrl+S
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                onFileSave(activeFile.path);
              });
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              lineNumbers: 'on',
              wordWrap: 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              insertSpaces: true,
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              bracketPairColorization: { enabled: true },
              padding: { top: 12, bottom: 12 },
              lineDecorationsWidth: 4,
              overviewRulerBorder: false,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
            }}
          />
        </div>
      ) : (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>⚡</div>
          <div style={s.emptyTitle}>ROBOCEK IDE</div>
          <div style={s.emptyHint}>Select a file from the explorer to start editing</div>
          <div style={s.emptyShortcut}>
            <kbd style={s.kbd}>Ctrl</kbd><span>+</span><kbd style={s.kbd}>S</kbd>
            <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>to save</span>
          </div>
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
    overflow: 'hidden',
    background: 'var(--bg-panel)',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'stretch',
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
    overflowX: 'auto',
    overflowY: 'hidden',
    flexShrink: 0,
    minHeight: 34,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    cursor: 'pointer',
    border: 'none',
    borderRight: '1px solid var(--border)',
    fontSize: 12,
    whiteSpace: 'nowrap',
    transition: 'background var(--t)',
    minWidth: 0,
    position: 'relative',
  },
  tabActive: {
    background: 'var(--bg-panel)',
    color: 'var(--text-primary)',
    borderBottom: '2px solid var(--accent)',
  },
  tabInactive: {
    background: 'transparent',
    color: 'var(--text-muted)',
  },
  tabName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontFamily: 'var(--font-code)',
    fontSize: 12,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
  },
  tabClose: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 2,
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
    fontFamily: 'var(--font-ui)',
  },
  noTabsHint: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  monacoWrapper: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    color: 'var(--text-muted)',
    userSelect: 'none',
  },
  emptyIcon: {
    fontSize: 40,
    filter: 'grayscale(1) opacity(0.3)',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  emptyHint: {
    fontSize: 12,
  },
  emptyShortcut: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    marginTop: 4,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: 'var(--font-code)',
    color: 'var(--text-secondary)',
  },
};
