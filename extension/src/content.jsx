import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// We need to inject our React app into the Twitter UI.
// Specifically, we want to add a tab next to "For you" and "Following".

const injectReactApp = () => {
  // Twitter's top navigation bar with tabs usually has a role="tablist".
  // We will find it and inject our own tab into it, or we inject our entire app
  // and manage the tabs ourselves if that's easier. However, native injection
  // is cleaner. We will mount our App which will use Portals or direct DOM manipulation
  // to insert the tab.
  
  // Actually, a simpler approach for a React content script:
  // Mount the React app in a hidden container in the body.
  // The React App component will use MutationObserver to find the tablist
  // and inject a React Portal into it for the Tab, and another Portal for the feed.
  
  const rootElement = document.createElement('div');
  rootElement.id = 'twitter-agent-root';
  document.body.appendChild(rootElement);
  
  const root = createRoot(rootElement);
  root.render(<App />);
};

// Check if already injected
if (!document.getElementById('twitter-agent-root')) {
  injectReactApp();
}
