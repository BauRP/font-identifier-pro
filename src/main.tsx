import { StrictMode, startTransition } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { StartClient } from '@tanstack/react-start/client';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { getRouter } from './router';

declare const __CAPACITOR_BUILD__: boolean;

const isCapacitorBuild = __CAPACITOR_BUILD__;

void defineCustomElements(window);

function showFatalError(title: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : '';
  const text = `${title}\n${message}${stack ? `\n\n${stack}` : ''}`;

  try {
    window.alert(text.slice(0, 1800));
  } catch {
    // Fallback rendering below still exposes the native WebView crash.
  }

  const target = document.getElementById('root') ?? document.body;
  target.innerHTML = `
    <div style="min-height:100vh;background:#05080d;color:#d8fff9;padding:24px;font-family:monospace;box-sizing:border-box;white-space:pre-wrap;overflow:auto;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#64fff0;">FontScan Elite runtime crash</h1>
      <p style="margin:0 0 12px;">${escapeHtml(title)}</p>
      <pre style="font-size:12px;line-height:1.5;">${escapeHtml(message)}${stack ? `\n\n${escapeHtml(stack)}` : ''}</pre>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[char] ?? char);
}

if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    showFatalError(
      `window.onerror at ${source ?? 'unknown'}:${lineno ?? 0}:${colno ?? 0}`,
      error ?? message,
    );
    return true;
  };

  window.onunhandledrejection = (event) => {
    showFatalError('window.onunhandledrejection', event.reason);
  };
}

startTransition(() => {
  try {
    if (isCapacitorBuild) {
      const root = document.getElementById('root');
      if (!root) throw new Error('Missing #root element in Capacitor index.html');

      createRoot(root).render(
        <StrictMode>
          <RouterProvider router={getRouter()} />
        </StrictMode>,
      );
      return;
    }

    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  } catch (error) {
    showFatalError('Client bootstrap failed', error);
  }
});