import { useState } from 'react';
import type { FileNode } from '../types';

interface SidebarProps {
  fileTree: FileNode[];
  activeFilePath: string | null;
  onFileClick: (node: FileNode) => void;
}

const FILE_ICONS: Record<string, string> = {
  '.cpp': '🔵',
  '.c':   '🔵',
  '.h':   '🔷',
  '.hpp': '🔷',
  '.yaml':'⚙️',
  '.yml': '⚙️',
  '.ini': '📋',
  '.md':  '📝',
  '.json':'📦',
  '.txt': '📄',
};

function fileIcon(name: string): string {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] ?? '📄';
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
          <span style={s.arrow}>{expanded ? '▾' : '▸'}</span>
          <span style={s.dirIcon}>{expanded ? '📂' : '📁'}</span>
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
      <span style={s.fileIconSpan}>{fileIcon(node.name)}</span>
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
  arrow: {
    fontSize: 9,
    color: 'var(--text-muted)',
    width: 10,
    flexShrink: 0,
  },
  dirIcon: { fontSize: 13, flexShrink: 0 },
  fileIconSpan: { fontSize: 11, flexShrink: 0, marginLeft: 14 },
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
