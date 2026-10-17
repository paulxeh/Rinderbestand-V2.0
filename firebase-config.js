// ===== Firebase-Zugangsdaten =====
// Testversion (z. B. GitHub Pages, lokale Datei): kein Firebase, Daten bleiben
// nur im Browser dieses Geräts.
// Echte App auf Firebase Hosting (*.web.app / *.firebaseapp.com): Die
// Zugangsdaten werden automatisch von Firebase geladen (/__/firebase/init.json),
// sie müssen nirgends eingetragen werden.
window.FIREBASE_CONFIG = null;
(function () {
  if (!/\.(web\.app|firebaseapp\.com)$/i.test(location.hostname)) return;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/__/firebase/init.json", false); // bewusst synchron: muss vor der App feststehen
    xhr.send();
    if (xhr.status === 200) window.FIREBASE_CONFIG = JSON.parse(xhr.responseText);
  } catch (e) {
    console.error("Firebase-Zugangsdaten konnten nicht geladen werden", e);
  }
})();
