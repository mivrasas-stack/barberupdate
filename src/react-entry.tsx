import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { consumeAuthRedirect } from './services/liveBackend';

consumeAuthRedirect();
createRoot(document.getElementById('root')!).render(<App />);
