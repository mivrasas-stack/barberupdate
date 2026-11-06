import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { consumeAuthRedirect } from './services/liveBackend';

// Resolve one-use, same-origin invitation/recovery links before booting React.
void consumeAuthRedirect().catch(() => {
  sessionStorage.removeItem('barbernow_password_setup_v1');
}).finally(() => createRoot(document.getElementById('root')!).render(<App />));

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]