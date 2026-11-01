import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Ensure clicking anywhere in a date or datetime input immediately pops open the native calendar
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement &&
      (target.type === 'date' || target.type === 'datetime-local')
    ) {
      try {
        target.showPicker?.();
      } catch {
        // Fallback gracefully if browser restricts showPicker
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

