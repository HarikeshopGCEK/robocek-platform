import { useState } from 'react';
import './App.css';
import { Welcome } from './pages/Welcome';
import { NewProject } from './pages/NewProject';
import { Editor } from './pages/Editor';
import type { AppScreen } from './types';

function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [projectPath, setProjectPath] = useState<string | null>(null);

  const openEditor = (path: string) => {
    setProjectPath(path);
    setScreen('editor');
  };

  return (
    <>
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
