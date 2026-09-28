import { useState } from 'react';
import type { FileNode } from '../types';

interface SidebarProps {
  fileTree: FileNode[];
  activeFilePath: string | null;
  onFileClick: (node: FileNode) => void;
}

const FILE_COLORS: Record<string, string> = {
  '.cpp': '#00C8FF',
  '.c': '#00C8FF',
  '.h': '#7C3AED',
  '.hpp': '#7C3AED',
  '.yaml': '#FFB300',
  '.yml': '#FFB300',
  '.ini': '#8A95A8',
  '.md': '#8A95A8',
  '.json': '#00E676',
  '.txt': '#8A95A8',
};

function fileColor(name: string): string {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return FILE_COLORS[ext] ?? '#8A95A8';
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const color = fileColor(name);
  const label = ext.length > 4 ? ext.slice(0, 4) : ext;

  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        fontFamily: 'var(--font-code)',
        color: color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 3,
        padding: '1px 4px',
        flexShrink: 0,
        marginLeft: 14,
        lineHeight: 1.4,
        letterSpacing: '0.02em',
      }}
    >
      {label}
    </span>
  );
}

function FolderIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      {expanded ? (
        <>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <polyline points="12 10 12 16" />
          <polyline points="9 13 12 16 15 13" />
        </>
      ) : (
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      )}
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        flexShrink: 0,
        transition: 'transform var(--t)',
        transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FileEntry({
  node,
  depth,
  activeFilePath,
  onFileClick,
}: {
  node: FileNode;
  depth: number;
  activeFilePath: string | null;
  onFileClick: (node: FileNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0 ? true : node.name === 'src');

  if (node.is_dir) {
    return (
      <div>
        <button
          style={{ ...s.entry, paddingLeft: 8 + depth * 14 }}
          onClick={() => setExpanded(e => !e)}
        >
          <ChevronIcon expanded={expanded} />
          <span style={s.dirIcon}><FolderIcon expanded={expanded} /></span>
          <span style={s.entryName}>{node.name}</span>
          {node.children.length > 0 && (
            <span style={s.childCount}>{node.children.length}</span>
          )}
        </button>
        {expanded && node.children.map(child => (
          <FileEntry
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            onFileClick={onFileClick}
          />
        ))}
      </div>
    );
  }

  const isActive = activeFilePath === node.path;

  return (
    <button
      style={{
        ...s.entry,
        ...s.fileEntry,
        paddingLeft: 8 + depth * 14,
        ...(isActive ? s.fileActive : {}),
      }}
      onClick={() => onFileClick(node)}
      title={node.path}
    >
      <FileTypeIcon name={node.name} />
      <span style={{ ...s.entryName, ...(isActive ? { color: 'var(--accent)' } : {}) }}>
        {node.name}
      </span>
    </button>
  );
}

export function Sidebar({ fileTree, activeFilePath, onFileClick }: SidebarProps) {
  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerLabel}>EXPLORER</span>
      </div>

      {/* File tree */}
      <div style={s.tree}>
        {fileTree.length === 0 ? (
          <div style={s.empty}>No files</div>
        ) : (
          fileTree.map(node => (
            <FileEntry
              key={node.path}
              node={node}
              depth={0}
              activeFilePath={activeFilePath}
              onFileClick={onFileClick}
            />
          ))
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
    overflow: 'hidden',
  },
  header: {
    padding: '10px 12px 6px',
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  tree: {
    flex: 1,
    overflow: 'auto',
    paddingBottom: 12,
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    width: '100%',
    height: 26,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 12,
    fontFamily: 'var(--font-ui)',
    transition: 'background var(--t), color var(--t)',
    borderRadius: 0,
    paddingRight: 8,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  fileEntry: {
    color: 'var(--text-secondary)',
  },
  fileActive: {
    background: 'var(--accent-dim)',
    borderLeft: '2px solid var(--accent)',
  },
  dirIcon: {
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
  },
  entryName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  childCount: {
    fontSize: 10,
    color: 'var(--text-muted)',
    background: 'var(--bg-raised)',
    borderRadius: 'var(--r-pill)',
    padding: '0 5px',
    flexShrink: 0,
    marginRight: 4,
  },
  empty: {
    padding: '16px',
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
};
