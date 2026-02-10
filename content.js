(function () {
  'use strict';
 
  if (window.__tweetsGrabInit) return;
  window.__tweetsGrabInit = true;
 
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'toggle-selection') {
      if (window.TweetsGrabSelector.isActive()) {
        window.TweetsGrabSelector.finishSelection();
      } else {
        window.TweetsGrabSelector.activate();
      }
      sendResponse({ ok: true });
    }
    return true;
  });

  console.log(
    '%c⚡ TweetsGrab%c loaded on %s',
    'color:#00d4ff;font-weight:700',
    'color:inherit',
    location.hostname
  );
})();
