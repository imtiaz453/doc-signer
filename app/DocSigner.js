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
  const [pdfPageSize, setPdfPageSize] = useState({ pw: 0, ph: 0 });
  const [tab, setTab] = useState('sign');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renderWidth, setRenderWidth] = useState(800);
  const [settings, setSettings] = useState({ showSignatures: false });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const mainRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const userMenuRef = useRef(null);

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

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentBoxSize?.[0]?.inlineSize || entries[0]?.contentRect?.width;
      if (w) setRenderWidth(Math.min(800, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfBuffer) return;
    (async () => {
      try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const page = pdfDoc.getPage(0);
        const { width, height } = page.getSize();
        setPdfPageSize({ pw: width, ph: height });
      } catch {}
    })();
  }, [pdfBuffer]);

  const pxToMm = useCallback((px, axis) => {
    const renderDim = axis === 'w' ? pageDims.w : pageDims.h;
    const pdfDim = axis === 'w' ? pdfPageSize.pw : pdfPageSize.ph;
    if (!renderDim || !pdfDim) return '0';
    return ((px * (pdfDim / renderDim) * 25.4) / 72).toFixed(1);
  }, [pageDims, pdfPageSize]);

  const mmToPx = useCallback((mm, axis) => {
    const renderDim = axis === 'w' ? pageDims.w : pageDims.h;
    const pdfDim = axis === 'w' ? pdfPageSize.pw : pdfPageSize.ph;
    if (!renderDim || !pdfDim) return 0;
    const points = mm * 72 / 25.4;
    return points * (renderDim / pdfDim);
  }, [pageDims, pdfPageSize]);

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

  const handlePresetUpload = useCallback(async (e, type) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    e.target.value = '';
    try {
      const results = await uploadFiles('imageUploader', { files });
      if (type === 'stamp' && isAdmin) {
        for (const r of results) {
          await fetch('/api/stamps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: r.name, imageUrl: r.ufsUrl }),
          });
        }
        const res = await fetch('/api/stamps');
        const data = await res.json();
        if (Array.isArray(data)) setDbStamps(data);
      } else {
        const newPresets = results.map(r => ({
          id: uid(),
          type,
          name: r.name,
          url: r.ufsUrl,
        }));
        persistLocalPresets([...localPresets, ...newPresets]);
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading(false);
  }, [localPresets, persistLocalPresets, isAdmin]);

  const deletePreset = useCallback(async (id, db) => {
    setPlaced(prev => prev.filter(i => i.presetId !== id));
    if (db) {
      if (!isAdmin) return;
      await fetch(`/api/stamps/${id}`, { method: 'DELETE' }).catch(() => {});
      const res = await fetch('/api/stamps');
      const data = await res.json();
      if (Array.isArray(data)) setDbStamps(data);
    } else {
      persistLocalPresets(localPresets.filter(p => p.id !== id));
    }
  }, [localPresets, persistLocalPresets, isAdmin]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const addItem = useCallback((preset) => {
    if (!pageDims.w) return;
    let w, h;
    if (preset.type === 'stamp') {
      w = Math.round(mmToPx(25, 'w'));
      h = Math.round(mmToPx(25, 'h'));
    } else {
      w = 180; h = 50;
    }
    const item = {
      id: uid(),
      presetId: preset.id,
      url: preset.url,
      x: (pageDims.w - w) / 2,
      y: (pageDims.h - h) / 2,
      w, h, page: pageNumber,
      stampId: preset.db ? preset.id : null,
    };
    setPlaced(prev => [...prev, item]);
    showToast(preset.name);
  }, [pageDims, pageNumber, mmToPx, showToast]);

  // ==================== DRAG & RESIZE (Mouse + Touch) ====================
  const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX;
  const getClientY = (e) => e.touches ? e.touches[0].clientY : e.clientY;

  const handleDragStart = useCallback((e, id) => {
    e.stopPropagation();
    if (e.touches) e.preventDefault();

    setActiveId(id);
    const item = placed.find(i => i.id === id);
    if (!item) return;

    dragRef.current = { id, sx: item.x, sy: item.y, mx: getClientX(e), my: getClientY(e) };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const { id, sx, sy, mx, my } = dragRef.current;
      const dx = getClientX(ev) - mx;
      const dy = getClientY(ev) - my;

      setPlaced(prev => prev.map(i =>
        i.id === id ? { ...i, x: sx + dx, y: sy + dy } : i
      ));
    };

    const onEnd = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, [placed]);

  const handleResizeStart = useCallback((e, id) => {
    e.stopPropagation();
    if (e.touches) e.preventDefault();

    const item = placed.find(i => i.id === id);
    if (!item) return;

    resizeRef.current = { id, sw: item.w, sh: item.h, mx: getClientX(e), my: getClientY(e) };

    const onMove = (ev) => {
      if (!resizeRef.current) return;
      const { id, sw, sh, mx, my } = resizeRef.current;
      const dw = getClientX(ev) - mx;
      const dh = getClientY(ev) - my;

      setPlaced(prev => prev.map(i =>
        i.id === id ? { ...i, w: Math.max(30, sw + dw), h: Math.max(30, sh + dh) } : i
      ));
    };

    const onEnd = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, [placed]);

  const deleteItem = useCallback((id) => {
    setPlaced(prev => prev.filter(i => i.id !== id));
    setActiveId(null);
  }, []);

  const renderEditControls = useCallback((item) => {
    if (activeId !== item.id) return null;
    return (
      <>
        <div className="size-label">
          {pxToMm(item.w, 'w')} × {pxToMm(item.h, 'h')} mm
        </div>
        <button className="item-delete" onClick={() => deleteItem(item.id)}>×</button>
        <div
          className="resize-handle"
          onMouseDown={(e) => handleResizeStart(e, item.id)}
          onTouchStart={(e) => handleResizeStart(e, item.id)}
        />
      </>
    );
  }, [activeId, deleteItem, handleResizeStart, pxToMm]);

  const getSignedPdf = useCallback(async () => {
    if (!pdfBuffer) return null;
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    for (const item of placed) {
      const pg = pages[item.page - 1];
      if (!pg) continue;
      const { width: pw, height: ph } = pg.getSize();
      const sx = pw / pageDims.w;
      const sy = ph / pageDims.h;

      let bytes, type;
      if (item.url.startsWith('data:')) {
        bytes = urlToBytes(item.url);
        type = item.url.includes('image/png') ? 'png' : 'jpg';
      } else {
        const result = await fetchAndDetect(item.url);
        bytes = result.bytes;
        type = result.type;
      }
      const img = type === 'png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      pg.drawImage(img, {
        x: item.x * sx,
        y: ph - item.y * sy - item.h * sy,
        width: item.w * sx,
        height: item.h * sy,
      });
    }
    return await pdfDoc.save();
  }, [pdfBuffer, placed, pageDims]);

  const logPlacedStamps = useCallback((action = 'save') => {
    const docName = pdfFile?.name || 'Untitled';
    for (const item of placed) {
      if (item.stampId) {
        fetch('/api/stamp-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stampId: item.stampId, documentName: docName, pageNumber: item.page, action }),
        }).catch(() => {});
      }
    }
  }, [placed, pdfFile]);

  const exportPdf = useCallback(async () => {
    setLoading(true);
    logPlacedStamps('save');
    try {
      const out = await getSignedPdf();
      if (!out) return;
      const blob = new Blob([out], { type: 'application/pdf' });
      const name = pdfFile?.name?.replace('.pdf', '_stamped.pdf') || 'document_stamped.pdf';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { alert('Export failed: ' + err.message); }
    setLoading(false);
  }, [getSignedPdf, pdfFile]);

  const sharePdf = useCallback(async () => {
    setLoading(true);
    logPlacedStamps('share');
    try {
      const out = await getSignedPdf();
      if (!out) return;
      const blob = new Blob([out], { type: 'application/pdf' });
      const shareName = pdfFile?.name?.replace('.pdf', '_stamped.pdf') || 'document_stamped.pdf';
      if (navigator.canShare?.({ files: [new File([blob], shareName, { type: 'application/pdf' })] })) {
        await navigator.share({ files: [new File([blob], shareName, { type: 'application/pdf' })], title: 'Stamped Document' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = shareName;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      if (err.name !== 'AbortError') alert('Share failed: ' + err.message);
    }
    setLoading(false);
  }, [getSignedPdf, pdfFile]);

  const getNameInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeId && !e.target.closest('input,textarea'))
        deleteItem(activeId);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeId, deleteItem]);

  return (
    <div className="app">
      {loading && <div className="loading-overlay">Processing PDF...</div>}
      {toast && <div className="toast">{toast}</div>}

      {/* Topbar */}
      <div className="topbar">
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

        <div className="topbar-right" ref={userMenuRef}>
          {session && (
            <>
              <button className="user-badge" onClick={() => setUserMenuOpen(o => !o)} title={session.user.name}>
                {getNameInitials(session.user.name)}
              </button>
              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{session.user.name}</div>
                    <div className="user-dropdown-role">{isAdmin ? 'Admin' : 'Salesman'}</div>
                  </div>
                  <div className="user-dropdown-items">
                    {isAdmin && <a href="/admin" className="user-dropdown-item" onClick={() => setUserMenuOpen(false)}>⚙️ Settings</a>}
                    <button className="user-dropdown-item" onClick={() => { setUserMenuOpen(false); signOut(); }}>🚶 Logout</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="body-layout">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-tabs">
            {settings.showSignatures !== 'false' && (
              <button className={`sidebar-tab ${tab === 'sign' ? 'active' : ''}`} onClick={() => setTab('sign')}>
                Signatures {sigPresets.length > 0 && <span className="tab-count">{sigPresets.length}</span>}
              </button>
            )}
            <button className={`sidebar-tab ${tab === 'stamp' ? 'active' : ''}`} onClick={() => setTab('stamp')}>
              Stamps {displayPresets.length > 0 && tab === 'stamp' && <span className="tab-count">{displayPresets.length}</span>}
            </button>
          </div>

          <div className="sidebar-content">
            {session && (
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{session.user.name}</div>
                <div className="sidebar-user-role">{isAdmin ? 'Admin' : 'Salesman'}</div>
              </div>
            )}
            <div className="presets-grid">
              {displayPresets.map(p => (
                <div key={p.id} className="preset-item" onClick={() => addItem(p)}>
                  <img src={p.url} alt={p.name} />
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

          {(pdfFile && placed.length > 0) && (
            <div className="sidebar-actions">
              <button className="btn-secondary sidebar-btn" onClick={exportPdf} disabled={!pdfFile || placed.length === 0}>💾 Save</button>
              <button className="btn-primary sidebar-btn" onClick={sharePdf} disabled={!pdfFile || placed.length === 0}>📤 Share</button>
            </div>
          )}
        </div>

        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

        {/* Main Content */}
        <div className="main-area" ref={mainRef}>
          {!pdfFile ? (
            <div className="empty-state">
              <h2>Upload a PDF to get started</h2>
              <p>Upload a PDF document, then click/tap on a signature or stamp from the sidebar to place it on the page.</p>
            </div>
          ) : (
            <div className="pdf-container">
              <Document file={pdfFile} onLoadSuccess={onDocLoad}>
                <Page
                  key={`page_${pageNumber}`}
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
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.w,
                    height: item.h,
                    touchAction: 'none'
                  }}
                  onMouseDown={(e) => handleDragStart(e, item.id)}
                  onTouchStart={(e) => handleDragStart(e, item.id)}
                >
                  <img src={item.url} alt="" draggable={false} />
                  {renderEditControls(item)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}