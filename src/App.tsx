/**
 * App.tsx  — updated for Round 2
 *
 * Changes:
 *   + Added /audit/:id/diff route → DiffPage
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SharedAuditPage from './pages/SharedAuditPage';
import DiffPage from './pages/DiffPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"               element={<HomePage />} />
        <Route path="/audit/:id"      element={<SharedAuditPage />} />
        <Route path="/audit/:id/diff" element={<DiffPage />} />
      </Routes>
    </BrowserRouter>
  );
}