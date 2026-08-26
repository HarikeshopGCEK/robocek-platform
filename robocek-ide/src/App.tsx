import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';
import { Welcome } from './pages/Welcome';
import { NewProject } from './pages/NewProject';
import { Editor } from './pages/Editor';
import { Bootstrap } from './pages/Bootstrap';
import type { AppScreen } from './types';

function App() {
  const [screen, setScreen] = useState<AppScreen | 'loading'>('loading');
  const [projectPath, setProjectPath] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await invoke<{ is_ready: boolean }>('check_bootstrap_status');
        if (status.is_ready) {
          setScreen('welcome');
        } else {
          setScreen('bootstrap');
        }
      } catch {
        setScreen('bootstrap');
      }
    };
    checkStatus();
  }, []);

  const openEditor = (path: string) => {
    setProjectPath(path);
    setScreen('editor');
  };

  return (
    <>
      {screen === 'loading' && (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
          <div className="spinner" />
        </div>
      )}
      {screen === 'bootstrap' && (
        <Bootstrap onDone={() => setScreen('welcome')} />
      )}
      {screen === 'welcome' && (
        <Welcome
          onNewProject={() => setScreen('new-project')}
          onOpenProject={openEditor}
        />
      )}
      {screen === 'new-project' && (
        <NewProject
          onBack={() => setScreen('welcome')}
          onDone={openEditor}
        />
      )}
      {screen === 'editor' && projectPath && (
        <Editor
          projectPath={projectPath}
          onBack={() => setScreen('welcome')}
        />
      )}
    </>
  );
}

export default App;
