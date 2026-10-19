// This runs before the app bundle, so a failed startup has a visible recovery path.
(function () {
  var ready = false;
  var panel = document.getElementById('am-startup');
  var message = document.getElementById('am-startup-message');
  var retry = document.getElementById('am-startup-retry');
  if (!panel || !message || !retry) return;
  var fresh = new URL(window.location.href);
  fresh.searchParams.set('am-reload', String(Date.now()));
  retry.href = fresh.href;
  function failed(code) {
    if (ready) return;
    message.textContent = 'The app could not finish opening. Check your connection, then tap Reload app. If this continues, tell AM Investments this code: ' + code + '.';
    retry.hidden = false;
  }
  var timer = window.setTimeout(function () { failed('AM-START-03'); }, 20000);
  function onError(event) {
    if (event.target && event.target.tagName === 'SCRIPT') failed('AM-LOAD-01');
    else if (event instanceof ErrorEvent) failed('AM-START-02');
  }
  window.addEventListener('error', onError, true);
  window.addEventListener('am-app-ready', function () {
    ready = true;
    window.clearTimeout(timer);
    window.removeEventListener('error', onError, true);
    panel.remove();
  }, { once: true });
}());
