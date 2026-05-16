import React from 'react';
import { createRoot } from 'react-dom/client';
import DetailsView from './components/details/DetailsView';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<DetailsView />);
}
