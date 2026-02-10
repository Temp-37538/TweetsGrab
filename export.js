window.TweetsGrabExport = (() => {
  'use strict';

  let overlay     = null;
  let currentJSON = '';

  function show(data) {
    if (overlay) hide(false);

    currentJSON = JSON.stringify(data, null, 2);
    const bytes = new Blob([currentJSON]).size;
    const size  = bytes > 1024
      ? (bytes / 1024).toFixed(1) + ' KB'
      : bytes + ' B';

    overlay = document.createElement('div');
    overlay.className = 'tg-export-overlay tg-ui';
    overlay.innerHTML = `
      <div class="tg-export-panel tg-ui">

        <!-- decorative scanline -->
        <div class="tg-export-scanline"></div>

        <div class="tg-export-header">
          <div class="tg-export-title">
            <svg class="tg-export-icon" width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4.09 12.5H11L10 22L18.91 11.5H12L13 2Z"
                    fill="#00d4ff" stroke="#00d4ff" stroke-width="1" stroke-linejoin="round"/>
            </svg>
            <span>Export Tweets</span>
          </div>
          <button class="tg-export-close tg-ui" title="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="tg-export-summary">
          <div class="tg-export-stat">
            <span class="tg-export-stat-num">${data.length}</span>
            <span class="tg-export-stat-label">tweet${data.length > 1 ? 's' : ''}</span>
          </div>
          <div class="tg-export-stat-divider"></div>
          <div class="tg-export-stat">
            <span class="tg-export-stat-num">${size}</span>
            <span class="tg-export-stat-label">JSON</span>
          </div>
        </div> 

        <div class="tg-export-buttons">
          <button class="tg-btn tg-btn-primary tg-btn-copy tg-ui">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy to Clipboard
          </button>
          <button class="tg-btn tg-btn-secondary tg-btn-download tg-ui">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download JSON
          </button>
        </div>

        <div class="tg-export-feedback tg-hidden"></div>
      </div>`;

    document.body.appendChild(overlay); 

    requestAnimationFrame(() => overlay.classList.add('tg-export-visible')); 

    overlay.querySelector('.tg-export-close')
      .addEventListener('click', () => hide(true));
    overlay.querySelector('.tg-btn-copy')
      .addEventListener('click', () => copyToClipboard());
    overlay.querySelector('.tg-btn-download')
      .addEventListener('click', () => downloadFile());
      
    document.addEventListener('keydown', overlayKeyHandler, true);
  }
  

  function hide(shouldClear = true) {
    document.removeEventListener('keydown', overlayKeyHandler, true);
    if (!overlay) return;

    overlay.classList.remove('tg-export-visible');
    overlay.classList.add('tg-export-exit');

    const ref = overlay;
    setTimeout(() => {
      if (ref.parentNode) ref.remove();
    }, 300);

    overlay     = null;
    currentJSON = '';

    if (shouldClear) window.TweetsGrabSelector.clearAll();
  }

  function overlayKeyHandler(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hide(true);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(currentJSON);
    } catch { 
      const ta = document.createElement('textarea');
      ta.value = currentJSON;
      Object.assign(ta.style, { position: 'fixed', opacity: '0' });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    feedback('Copied to clipboard', true);
    setTimeout(() => hide(true), 1000);
  }
 
  function downloadFile() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `tweets-export-${ts}.json`;
 
    chrome.runtime.sendMessage(
      { action: 'download-json', data: currentJSON, filename },
      (res) => {
        if (res?.success) {
          feedback('Download started', true);
          setTimeout(() => hide(true), 1000);
        } else { 
          try {
            const blob = new Blob([currentJSON], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
            feedback('Download started', true);
            setTimeout(() => hide(true), 1000);
          } catch {
            feedback('Download failed', false);
          }
        }
      }
    );
  } 

  function feedback(msg, ok) {
    if (!overlay) return;
    const el = overlay.querySelector('.tg-export-feedback');
    if (!el) return;
    el.textContent = (ok ? '✓ ' : '✗ ') + msg;
    el.className = 'tg-export-feedback tg-feedback-' + (ok ? 'success' : 'error');
  }

  function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { show, hide };
})();
