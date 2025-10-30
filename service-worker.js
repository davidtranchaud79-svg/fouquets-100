const CACHE_NAME="fsuite-v11-6";
const OFFLINE=[
  "/","/index.html","/style.css","/lang.js","/app.js","/chef_ai.js","/manifest.json",
  "/icons/icon-192.png","/icons/icon-512.png"
];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(OFFLINE)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener("fetch",e=>{e.respondWith(fetch(e.request).then(r=>{caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.match(e.request)));});