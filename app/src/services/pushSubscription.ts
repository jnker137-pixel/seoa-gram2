const VAPID_PUBLIC_KEY = 'BKMCVDQ4x3TccDE1Oi3MfrY-4i2fGWA0mPrdqf0DgaLX6movUljKBlMlMuzcp-kArUGydXRIYIeKZAXoPas-LEo';
const SUPABASE_URL = 'https://uxiymaeobmleshekvqvl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aXltYWVvYm1sZXNoZWt2cXZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTQ3OTYsImV4cCI6MjA4NzEzMDc5Nn0.cAltB-U4B7-38M065Cn30uwoPu-wzh62IkuDUT4rrAQ';

export async function subscribeToPush(clientId: string): Promise<string> {
  if (!('serviceWorker' in navigator)) throw new Error('serviceWorker 미지원');
  if (!('PushManager' in window)) throw new Error('PushManager 미지원');

  // 이미 등록된 SW 재사용 (매번 register 하면 SW 업데이트 중 앱 reload 가능성)
  let registration = await navigator.serviceWorker.getRegistration('/seoa-gram2/');
  if (!registration) {
    registration = await navigator.serviceWorker.register('/seoa-gram2/sw-push.js');
  }
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(`알림 권한 거부: ${permission}`);

  // 기존 구독 해제 후 항상 새로 구독 (만료된 엔드포인트 재사용 방지)
  const existing = await registration.pushManager.getSubscription();
  if (existing) await existing.unsubscribe();

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });

  const sub = subscription.toJSON();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      client_id: clientId,
      endpoint: subscription.endpoint,
      p256dh: sub.keys?.p256dh,
      auth: sub.keys?.auth,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase 저장 실패 (${res.status}): ${body}`);
  }

  return subscription.endpoint.slice(0, 40) + '...';
}
