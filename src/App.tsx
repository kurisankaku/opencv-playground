import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { OpenCvProvider } from './context/OpenCvContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { DemoListPage } from './pages/DemoListPage';
import { DemoDetailPage } from './pages/DemoDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

// Isolation switch: add `nocv` anywhere in the URL (e.g. /#/?nocv) to stop
// OpenCV.js from auto-loading. If the UI is responsive with `nocv` but frozen
// without it, OpenCV/WASM loading is the cause; if frozen either way, it isn't.
const noCv = typeof window !== 'undefined' && window.location.href.includes('nocv');

export default function App() {
  return (
    <OpenCvProvider autoLoad={!noCv}>
      <HashRouter>
        <ScrollToTop />
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/demos" element={<DemoListPage />} />
            <Route path="/demo/:slug" element={<DemoDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </OpenCvProvider>
  );
}
