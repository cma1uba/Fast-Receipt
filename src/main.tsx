import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Generate or retrieve a persistent anonymous visitor ID
const VISITOR_KEY = 'nf_visitor_id';
let visitorId = localStorage.getItem(VISITOR_KEY);
if (!visitorId) {
  visitorId = 'anon-' + crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, visitorId);
}

pendo.initialize({
  visitor: {
    id: visitorId
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
