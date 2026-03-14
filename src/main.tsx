import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { FileSystemProvider } from '@/contexts/FileSystemContext';

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <FileSystemProvider>
          <App />
        </FileSystemProvider>
      </React.StrictMode>,
    );
  } else {
    console.error('Failed to find root element for React hydration.');
  }
};

// Ensure the DOM is fully loaded before rendering the application.
// This is critical for inline scripts that run before the <body> is fully parsed.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
