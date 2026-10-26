// frontend/src/components/UI/ExportMenu.jsx
// Enterprise Report Export Dropdown Menu
// Triggers CSV, XLSX, and PDF downloads with blob handling, loading state, and error handling.

import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Button from './Button';

export function ExportMenu({
  report = 'overview',
  filters = {},
  buttonText = 'Export',
  variant = 'secondary',
  size = 'sm',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingFormat, setLoadingFormat] = useState(null);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = async (format) => {
    if (loadingFormat) return;
    setLoadingFormat(format);
    setIsOpen(false);

    try {
      // Build clean query params omitting empty strings
      const params = { report, format };
      Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          params[k] = v;
        }
      });

      const response = await api.get('/reports/export', {
        params,
        responseType: 'blob',
      });

      // Extract filename from Content-Disposition header
      const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      let filename = `luxestay-${report}-${filters.from || 'report'}_${filters.to || 'export'}.${format}`;
      if (disposition && typeof disposition === 'string') {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1].trim();
        }
      }

      // Determine proper MIME type
      let mimeType = 'text/csv; charset=utf-8';
      if (format === 'xlsx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (format === 'pdf') {
        mimeType = 'application/pdf';
      }

      // Download file to client
      const blob = new Blob([response.data], { type: mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`${format.toUpperCase()} export downloaded`);
    } catch (err) {
      let errorMessage = 'Failed to download export file';

      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) errorMessage = parsed.message;
        } catch {
          // If unparseable, keep fallback
        }
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }

      toast.error(errorMessage);
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <div
      ref={menuRef}
      className={`export-menu-container ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={Boolean(loadingFormat)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 500,
        }}
      >
        {loadingFormat ? (
          <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Download size={14} />
        )}
        <span>{loadingFormat ? `Exporting ${loadingFormat.toUpperCase()}...` : buttonText}</span>
        <ChevronDown size={13} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </Button>

      {isOpen && (
        <div
          className="export-dropdown slide-down"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            minWidth: 175,
            padding: '6px 0',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            className="export-option-btn"
            onClick={() => handleExport('csv')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 14px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '0.84rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--input)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FileText size={15} style={{ color: '#60a5fa' }} />
            <span>CSV File (.csv)</span>
          </button>

          <button
            type="button"
            className="export-option-btn"
            onClick={() => handleExport('xlsx')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 14px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '0.84rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--input)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FileSpreadsheet size={15} style={{ color: '#34d399' }} />
            <span>Excel Workbook (.xlsx)</span>
          </button>

          <button
            type="button"
            className="export-option-btn"
            onClick={() => handleExport('pdf')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 14px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '0.84rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--input)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <FileDown size={15} style={{ color: '#f87171' }} />
            <span>PDF Document (.pdf)</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
