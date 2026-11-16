import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initVersionControl} from './utils/versionControl';

initVersionControl();

createRoot(document.getElementById('root')!).render(<App />);
