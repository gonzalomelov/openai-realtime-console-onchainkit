'use client'

import { useEffect } from 'react';

export function NotificationManager() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(function(registration) {
          console.log('Service Worker registered with scope:', registration.scope);
          return registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'YOUR_PUBLIC_VAPID_KEY_HERE'
          });
        })
        .then(function(subscription) {
          // Send the subscription details to your server
          console.log('Push Notification subscription:', subscription);
        })
        .catch(function(error) {
          console.error('Service Worker error:', error);
        });
    }
  }, []);

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
    }
  };

  return (
    <button onClick={requestNotificationPermission}>
      Enable Notifications
    </button>
  );
}