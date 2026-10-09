import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {captureUrlConfig} from './config/lumenConfig';
import {locale} from './i18n/strings';
import {ListsProvider} from './ListsProvider';
import './styles.css';

// `?demo=1` works everywhere; `?ticktick.*` values are kept only in a regular
// browser (no window.lumen). Both are removed from the address bar.
captureUrlConfig(window.lumen?.config == null);
document.documentElement.lang = locale;

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root mount element');

createRoot(root).render(
  <StrictMode>
    <ListsProvider>
      <App />
    </ListsProvider>
  </StrictMode>,
);
