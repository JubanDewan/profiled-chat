// Naikkan VERSION setiap kali file aplikasi diubah agar cache lama dibuang
const VERSION = "v4";
const SHELL = "shell-" + VERSION, RUNTIME = "runtime-" + VERSION;
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Halaman: ambil dari jaringan dulu supaya pembaruan langsung terlihat; cache jadi cadangan offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put("./index.html", copy)); } return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // File aplikasi, SDK Firebase, dan font: cache dulu, perbarui di latar belakang.
  // Permintaan data (Firestore, Auth) tidak disentuh.
  const sdkOrFont =
    (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) ||
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin === location.origin || sdkOrFont) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req)
          .then(res => { if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); } return res; })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});

// Ketuk notifikasi: fokuskan jendela yang sudah terbuka, atau buka baru, lalu menuju room-nya
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const room = e.notification.data && e.notification.data.room;
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ("focus" in c) { c.postMessage({ type: "open-room", room }); return c.focus(); }
      }
      return clients.openWindow(new URL("./" + (room ? "#" + room : ""), self.registration.scope).href);
    })
  );
});
