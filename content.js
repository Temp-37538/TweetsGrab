(function () {
  'use strict';

  if (window.__tweetsGrabInit) return;
  window.__tweetsGrabInit = true;

  const HANDLERS = {
    'toggle-selection': () => {
      if (window.TweetsGrabSelector.isActive()) {
        window.TweetsGrabSelector.finishSelection();
      } else {
        window.TweetsGrabSelector.activate('manual');
      }
    },
    'select-thread': () => {
      if (window.TweetsGrabSelector.isActive()) {
        window.TweetsGrabSelector.deactivate();
        window.TweetsGrabSelector.clearAll();
      }
      window.TweetsGrabSelector.activate('thread');
    },
    'cancel-selection': () => {
      if (window.TweetsGrabSelector.isActive()) {
        window.TweetsGrabSelector.deactivate();
        window.TweetsGrabSelector.clearAll();
      }
    },
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const handler = HANDLERS[msg?.action];
    if (!handler) return false;

    try {
      handler();
      sendResponse({ ok: true });
    } catch (e) {
      console.error('[TweetsGrab] Erreur lors du traitement de', msg.action, e);
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  });

  console.log(
    '%c⚡ TweetsGrab%c loaded on %s',
    'color:#ffc933;font-weight:700',
    'color:inherit',
    location.hostname
  );
})();
