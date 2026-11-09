import { defineLocales } from '@k8ordo/i18n';
import { UIProvider } from '@k8ordo/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app';

import './styles/globals.css';

// 集合を定義しないと @k8ordo/ui が部品の中に持つ文言（閉じる など）が英語になる
defineLocales({ ja: { timeZone: 'Asia/Tokyo', dir: 'ltr' } });

const rootElement = document.querySelector('#root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <UIProvider>
      <App />
    </UIProvider>
  </StrictMode>,
);
