import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { consumeAuthRedirect } from './services/liveBackend';

// Resolve one-use, same-origin invitation/recovery links before booting React.
void consumeAuthRedirect().catch(() => {
  sessionStorage.removeItem('barbernow_password_setup_v1');
}).finally(() => createRoot(document.getElementById('root')!).render(<App />));