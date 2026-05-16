import React from 'react';
import { createRoot } from 'react-dom/client';
import SidebarView from './components/sidebar/SidebarView';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SidebarView />);
}
