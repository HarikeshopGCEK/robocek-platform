import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CommandOutput, FileNode, OpenFile, OutputLine, ProjectInfo, SerialDevice } from '../types';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';
import { CodeEditor } from '../components/CodeEditor';
import { OutputPanel } from '../components/OutputPanel';

interface EditorProps {
  projectPath: string;
  onBack: () => void;
}

function classifyLine(line: string, isError: boolean): OutputLine['type'] {
  if (isError) return 'error';
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('failed') || l.includes('✗')) return 'error';
  if (l.includes('warning') || l.includes('warn')) return 'warning';
  if (l.includes('success') || l.includes('done') || l.includes('✓') || l.includes('built in')) return 'success';
  return 'plain';
}

// Strip common ANSI escape codes from PlatformIO output
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[mGKHFJ]/g, '').replace(/\r/g, '');
}

export function Editor({ projectPath, onBack }: EditorProps) {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [monitorLines, setMonitorLines] = useState<OutputLine[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activePanel, setActivePanel] = useState<'output' | 'monitor'>('output');
  const [devices, setDevices] = useState<SerialDevice[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [panelHeight, setPanelHeight] = useState(220);
  const cmdRunning = useRef(false);

  // Load project data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [info, tree, devs] = await Promise.all([
          invoke<ProjectInfo>('get_project_info', { projectDir: projectPath }),
          invoke<FileNode[]>('list_project_files', { projectDir: projectPath }),
          invoke<SerialDevice[]>('list_devices'),
        ]);
        setProjectInfo(info);
        setFileTree(tree);
        setDevices(devs);
      } catch (e) {
        appendOutput(`Error loading project: ${e}`, 'error');
      }
    };
    load();
  }, [projectPath]);

  // Poll serial devices every 5s
  useEffect(() => {
    const id = setInterval(async () => {
      const devs = await invoke<SerialDevice[]>('list_devices').catch(() => []);
      setDevices(devs);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const appendOutput = (text: string, type: OutputLine['type'] = 'plain') => {
    setOutputLines(prev => [...prev, { text: stripAnsi(text), type, timestamp: Date.now() }]);
  };

  const appendMonitor = (text: string, type: OutputLine['type'] = 'plain') => {
    setMonitorLines(prev => [...prev, { text: stripAnsi(text), type, timestamp: Date.now() }]);
  };

  const refreshFileTree = async () => {
    const tree = await invoke<FileNode[]>('list_project_files', { projectDir: projectPath }).catch(() => []);
    setFileTree(tree);
  };

  const handleFileClick = async (node: FileNode) => {
    if (node.is_dir) return;
    const existing = openFiles.find(f => f.path === node.path);
    if (existing) {
      setActiveFilePath(node.path);
      return;
    }
    try {
      const content = await invoke<string>('read_file', { path: node.path });
      setOpenFiles(prev => [...prev, { path: node.path, name: node.name, content, modified: false }]);
      setActiveFilePath(node.path);
    } catch (e) {
      appendOutput(`Cannot open file: ${e}`, 'error');
    }
  };

  const handleFileChange = (path: string, content: string) => {
    setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, content, modified: true } : f));
  };

  const handleFileSave = async (path: string) => {
    const file = openFiles.find(f => f.path === path);
    if (!file) return;
    try {
      await invoke('write_file', { path, content: file.content });
      setOpenFiles(prev => prev.map(f => f.path === path ? { ...f, modified: false } : f));
    } catch (e) {
      appendOutput(`Save failed: ${e}`, 'error');
    }
  };

  const handleFileClose = (path: string) => {
    const idx = openFiles.findIndex(f => f.path === path);
    const newFiles = openFiles.filter(f => f.path !== path);
    setOpenFiles(newFiles);
    if (activeFilePath === path) {
      setActiveFilePath(newFiles[Math.max(0, idx - 1)]?.path ?? null);
    }
  };

  const runCommand = async (
    program: string,
    args: string[],
    onLine: (text: string, isError: boolean) => void,
  ): Promise<number> => {
    const eventId = `robocek-cmd-${Date.now()}`;
    return new Promise(async (resolve) => {
      const unlisten = await listen<CommandOutput>(eventId, (e) => {
        const out = e.payload;
        if (out.is_done) {
          unlisten();
          resolve(out.exit_code ?? -1);
        } else {
          onLine(out.line, out.is_error);
        }
      });
      invoke('run_command', { program, args, cwd: projectPath, eventId: eventId })
        .catch(err => {
          unlisten();
          onLine(`Error: ${err}`, true);
          resolve(-1);
        });
    });
  };

  const handleBuild = async () => {
    if (cmdRunning.current) return;
    cmdRunning.current = true;
    setIsBuilding(true);
    setActivePanel('output');
    appendOutput('', 'plain');
    appendOutput('──────────────────────────────────────────────', 'plain');
    appendOutput('  🔨 Build started', 'info');
    appendOutput('──────────────────────────────────────────────', 'plain');

    const code = await runCommand('robocek', ['build'], (text, isErr) => {
      appendOutput(text, classifyLine(text, isErr));
    });

    appendOutput('──────────────────────────────────────────────', 'plain');
    appendOutput(
      code === 0 ? '  ✅ Build successful' : `  ❌ Build failed (exit ${code})`,
      code === 0 ? 'success' : 'error',
    );
    appendOutput('──────────────────────────────────────────────', 'plain');
    setIsBuilding(false);
    cmdRunning.current = false;
    refreshFileTree();
  };

  const handleUpload = async () => {
    if (cmdRunning.current) return;
    cmdRunning.current = true;
    setIsUploading(true);
    setActivePanel('output');
    appendOutput('', 'plain');
    appendOutput('──────────────────────────────────────────────', 'plain');
    appendOutput('  ⬆ Upload started', 'info');
    appendOutput('──────────────────────────────────────────────', 'plain');

    const code = await runCommand('robocek', ['upload'], (text, isErr) => {
      appendOutput(text, classifyLine(text, isErr));
    });

    appendOutput('──────────────────────────────────────────────', 'plain');
    appendOutput(
      code === 0 ? '  ✅ Upload successful' : `  ❌ Upload failed (exit ${code})`,
      code === 0 ? 'success' : 'error',
    );
    appendOutput('──────────────────────────────────────────────', 'plain');
    setIsUploading(false);
    cmdRunning.current = false;
  };

  const handleMonitor = async () => {
    if (isMonitoring) return;
    setIsMonitoring(true);
    setActivePanel('monitor');
    appendMonitor('📡 Serial monitor started...', 'info');

    const code = await runCommand('pio', ['device', 'monitor'], (text, isErr) => {
      appendMonitor(text, classifyLine(text, isErr));
    });

    appendMonitor(`Monitor exited (code ${code})`, code === 0 ? 'info' : 'error');
    setIsMonitoring(false);
  };

  return (
    <div style={styles.root}>
      <Toolbar
        projectInfo={projectInfo}
        isBuilding={isBuilding}
        isUploading={isUploading}
        isMonitoring={isMonitoring}
        devices={devices}
        onBuild={handleBuild}
        onUpload={handleUpload}
        onMonitor={handleMonitor}
        onBack={onBack}
      />

      <div style={styles.body}>
        {/* Sidebar */}
        <div style={{ ...styles.sidebar, width: sidebarWidth }}>
          <Sidebar
            fileTree={fileTree}
            activeFilePath={activeFilePath}
            onFileClick={handleFileClick}
          />
        </div>

        {/* Resize handle */}
        <SidebarResizer onResize={setSidebarWidth} />

        {/* Main column: editor + output */}
        <div style={styles.main}>
          <div style={{ ...styles.editorArea, height: `calc(100% - ${panelHeight}px)` }}>
            <CodeEditor
              openFiles={openFiles}
              activeFilePath={activeFilePath}
              onFileSelect={setActiveFilePath}
              onFileChange={handleFileChange}
              onFileSave={handleFileSave}
              onFileClose={handleFileClose}
            />
          </div>

          {/* Panel resize handle */}
          <PanelResizer onResize={setPanelHeight} />

          <div style={{ ...styles.panelArea, height: panelHeight }}>
            <OutputPanel
              outputLines={outputLines}
              monitorLines={monitorLines}
              activeTab={activePanel}
              onTabChange={setActivePanel}
              onClearOutput={() => setOutputLines([])}
              onClearMonitor={() => setMonitorLines([])}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Draggable sidebar resize handle
function SidebarResizer({ onResize }: { onResize: (w: number) => void }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(160, Math.min(400, ev.clientX));
      onResize(newW);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return <div style={styles.sidebarResizer} onMouseDown={handleMouseDown} />;
}

// Draggable panel resize handle
function PanelResizer({ onResize }: { onResize: (h: number) => void }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-h') || '220');
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      onResize(Math.max(100, Math.min(500, startH + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return <div style={styles.panelResizer} onMouseDown={handleMouseDown} />;
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-base)',
    overflow: 'hidden',
    animation: 'fadeIn 0.25s ease',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    flexShrink: 0,
    overflow: 'hidden',
    borderRight: '1px solid var(--border)',
    background: 'var(--bg-surface)',
  },
  sidebarResizer: {
    width: 4,
    cursor: 'col-resize',
    background: 'transparent',
    flexShrink: 0,
    transition: 'background var(--t)',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden',
  },
  editorArea: {
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  panelResizer: {
    height: 4,
    cursor: 'row-resize',
    background: 'var(--border)',
    flexShrink: 0,
    transition: 'background var(--t)',
  },
  panelArea: {
    flexShrink: 0,
    overflow: 'hidden',
    borderTop: '1px solid var(--border)',
  },
};
