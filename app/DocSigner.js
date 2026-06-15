'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { uploadFiles } from '@/lib/uploadthing';
import { useSession, signOut } from 'next-auth/react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const uid = () => Math.random().toString(36).substring(2, 9);
const STORAGE_KEY = 'docsigner_presets';

function loadLocalPresets() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveLocalPresets(presets) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {}
}

function urlToBytes(url) {
  const base64 = url.split(',')[1];
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function fetchAndDetect(url) {
  const res = await fetch(url);
  const buf = new Uint8Array(await res.arrayBuffer());
  const type = (buf[0] === 0x89 && buf[1] === 0x50) ? 'png' : 'jpg';
  return { bytes: buf, type };
}

export default function DocSigner() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [localPresets, setLocalPresets] = useState([]);
  const [dbStamps, setDbStamps] = useState([]);
  const [placed, setPlaced] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [pageDims, setPageDims] = useState({ w: 0, h: 0 });
  const [tab, setTab] = useState('sign');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renderWidth, setRenderWidth] = useState(800);
  const [settings, setSettings] = useState({ showSignatures: true });
  const mainRef = useRef(null);

  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => { setLocalPresets(loadLocalPresets()); }, []);

  useEffect(() => {
    fetch('/api/stamps').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setDbStamps(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data) setSettings(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (settings.showSignatures === 'false' && tab === 'sign') setTab('stamp');
  }, [settings.showSignatures, tab]);

  // Resize observer for PDF width
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width || 800;
      setRenderWidth(Math.min(800, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allPresets = [
    ...localPresets,
    ...dbStamps.map(s => ({
      id: s.id,
      type: 'stamp',
      name: s.name,
      url: s.imageUrl,
      db: true,
    })),
  ];

  const displayPresets = tab === 'sign'
    ? allPresets.filter(p => p.type === 'sign')
    : allPresets.filter(p => p.type === 'stamp');

  const sigPresets = localPresets.filter(p => p.type === 'sign');
  const pageItems = placed.filter(i => i.page === pageNumber);

  const persistLocalPresets = useCallback((newPresets) => {
    setLocalPresets(newPresets);
    saveLocalPresets(newPresets);
  }, []);

  const onDocLoad = useCallback(({ numPages }) => setNumPages(numPages), []);
  const onPageRender = useCallback((page) => {
    setPageDims({ w: page.width, h: page.height });
  }, []);

  const handlePdfUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setPdfBuffer(await file.arrayBuffer());
    setPlaced([]);
    setActiveId(null);
    setPageNumber(1);
  }, []);

  // ... (rest of the functions remain the same: handlePresetUpload, deletePreset, addItem, etc.)

  const handleMouseDown = useCallback((e, id) => { /* same as before */ }, [placed]);
  const handleResizeDown = useCallback((e, id) => { /* same as before */ }, [placed]);
  const deleteItem = useCallback((id) => {
    setPlaced(prev => prev.filter(i => i.id !== id));
    setActiveId(null);
  }, []);

  const renderEditControls = useCallback((id) => {
    if (!activeId || activeId !== id) return null;
    return (
      <>
        <button className="item-delete" onClick={() => deleteItem(id)}>×</button>
        <div className="resize-handle" onMouseDown={(e) => handleResizeDown(e, id)} />
      </>
    );
  }, [activeId, deleteItem, handleResizeDown]);

  const getSignedPdf = useCallback(async () => { /* same as before */ }, [pdfBuffer, placed, pageDims]);

  const exportPdf = useCallback(async () => { /* same */ }, [getSignedPdf, pdfFile]);
  const sharePdf = useCallback(async () => { /* same */ }, [getSignedPdf, pdfFile]);

  // Keyboard delete
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeId && 
          !e.target.closest('input,textarea')) deleteItem(activeId);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeId, deleteItem]);

  return (
    <div className="app">
      {loading && <div className="loading-overlay">Processing PDF...</div>}

      <div className="topbar">
        {/* topbar content same as before */}
        <div className="topbar-left">
          <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>
            <span /><span /><span />
          </button>
          <h1>DocSigner</h1>
          <label className="upload-label">
            📄 Upload PDF
            <input type="file" accept=".pdf" onChange={handlePdfUpload} hidden />
          </label>
        </div>

        <div className="topbar-center">
          <button disabled={!pdfFile || pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)}>◀</button>
          <span>{pdfFile ? `${pageNumber} / ${numPages}` : 'No PDF'}</span>
          <button disabled={!pdfFile || pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)}>▶</button>
        </div>

        <div className="topbar-right">
          {session && (
            <span style={{ fontSize: 12, color: '#666' }}>
              👤 {session.user.name} ({isAdmin ? 'Admin' : 'Salesman'})
            </span>
          )}
          {isAdmin && <a href="/admin" className="btn-link">⚙️ Admin</a>}
          <button className="btn-secondary" onClick={() => signOut()}>🚪 Logout</button>
        </div>
      </div>

      <div className="body-layout">
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-tabs">
            {settings.showSignatures !== 'false' && (
              <button className={`sidebar-tab ${tab === 'sign' ? 'active' : ''}`} onClick={() => setTab('sign')}>
                Signatures {sigPresets.length > 0 && <span className="tab-count">{sigPresets.length}</span>}
              </button>
            )}
            <button className={`sidebar-tab ${tab === 'stamp' ? 'active' : ''}`} onClick={() => setTab('stamp')}>
              Stamps {displayPresets.length > 0 && <span className="tab-count">{displayPresets.length}</span>}
            </button>
          </div>

          <div className="sidebar-content">
            <div className="presets-grid">
              {displayPresets.map(p => (
                <div key={p.id} className="preset-item" onClick={() => addItem(p)}>
                  <img src={p.url} alt={p.name} />
                  {(!p.db || isAdmin) && (
                    <button className="preset-delete" onClick={(e) => { e.stopPropagation(); deletePreset(p.id, !!p.db); }}>×</button>
                  )}
                </div>
              ))}
              {(tab !== 'stamp' || isAdmin) && (
                <label className={`preset-upload-area ${uploading ? 'uploading' : ''}`}>
                  {uploading ? '⏳ Uploading...' : `+ Add ${tab === 'sign' ? 'Signature' : 'Stamp'} Image`}
                  <input type="file" accept="image/png,image/jpeg,image/gif" hidden
                    onChange={(e) => handlePresetUpload(e, tab)} multiple disabled={uploading} />
                </label>
              )}
            </div>
          </div>

          {/* Always show action buttons when PDF is loaded */}
          {pdfFile && (
            <div className="sidebar-actions">
              <button 
                className="btn-secondary sidebar-btn" 
                onClick={exportPdf}
                disabled={placed.length === 0}
              >
                💾 Save Signed PDF
              </button>
              <button 
                className="btn-primary sidebar-btn" 
                onClick={sharePdf}
                disabled={placed.length === 0}
              >
                📤 Share
              </button>
              {placed.length === 0 && (
                <p style={{ fontSize: '11px', color: '#888', textAlign: 'center', marginTop: 8 }}>
                  Place at least one stamp or signature to enable Save/Share
                </p>
              )}
            </div>
          )}
        </div>

        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

        <div className="main-area" ref={mainRef}>
          {!pdfFile ? (
            <div className="empty-state">
              <h2>Upload a PDF to get started</h2>
              <p>Upload a PDF document, then click on a signature or stamp from the sidebar to place it.</p>
            </div>
          ) : (
            <div className="pdf-container">
              <Document file={pdfFile} onLoadSuccess={onDocLoad}>
                <Page
                  pageNumber={pageNumber}
                  width={renderWidth}
                  onRenderSuccess={onPageRender}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {pageItems.map(item => (
                <div
                  key={item.id}
                  className={`placed-item ${activeId === item.id ? 'active' : ''}`}
                  style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
                  onMouseDown={(e) => handleMouseDown(e, item.id)}
                >
                  <img src={item.url} alt="" draggable={false} />
                  {renderEditControls(item.id)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}