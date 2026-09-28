// Shared TypeScript types matching the Rust backend structs

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'starter' | 'autonomous' | 'diagnostic';
}

export interface Board {
  id: string;
  name: string;
}

export interface SerialDevice {
  port: string;
  description: string;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface ProjectInfo {
  name: string;
  board: string;
  template: string;
  path: string;
}

export interface CommandOutput {
  line: string;
  is_error: boolean;
  is_done: boolean;
  exit_code: number | null;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  modified: boolean;
}

export interface OutputLine {
  text: string;
  type: 'info' | 'error' | 'warning' | 'success' | 'plain';
  timestamp: number;
}

export interface RecentProject {
  name: string;
  path: string;
  board: string;
  template: string;
  lastOpened: number;
}

export type AppScreen = 'bootstrap' | 'welcome' | 'new-project' | 'editor';

export interface BootstrapStatus {
  is_ready: boolean;
  python_ok: boolean;
  venv_ok: boolean;
  pio_ok: boolean;
  cli_ok: boolean;
  sdk_ok: boolean;
  message: string;
}
