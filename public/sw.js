/* Deliberately no API/document caching: career records stay behind the session. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let payload={title:'SteVie',body:'You have an update in your workspace.',url:'/'};
  try{Object.assign(payload,event.data?.json() || {});}catch{}
  event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/icon.svg',badge:'/icon.svg',tag:payload.tag || 'stevie',data:{url:payload.url}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url || '/',self.location.origin);
  if(target.origin!==self.location.origin) return;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    for(const client of clients){if(new URL(client.url).origin===target.origin){await client.navigate(target.href);return client.focus();}}
    return self.clients.openWindow(target.href);
  }));
});
