const C='btc-board-v2';const F=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
// Network-first for this app's own files only. Live data (prices, weather, geocoding) goes straight to the network so it is
// never stored or replayed offline as if it were current, and the cache can't grow with every API call. Error responses
// aren't cached, so a 404/500 can't replace a good offline copy.
self.addEventListener('fetch',e=>{const q=e.request;if(q.method!=='GET'||new URL(q.url).origin!==location.origin)return;
e.respondWith(fetch(q).then(r=>{if(r.ok&&r.type==='basic'){const cp=r.clone();caches.open(C).then(c=>c.put(q,cp));}return r;}).catch(()=>caches.match(q,{ignoreSearch:true}).then(m=>m||Response.error())));});
