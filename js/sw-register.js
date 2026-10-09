if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('sw.js').catch(function(err) {
      console.error('SyncShift PWA Registration failed: ', err);
    });
  });
}
