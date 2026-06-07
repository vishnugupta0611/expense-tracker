import { getToken, isSupported } from 'firebase/messaging';
import { messaging } from './firebase';

const vapidKey = 'BLHDSsHr0C7OYPUm_3d-Orc23mj7NnT5yz_a_WvTmVjs1ErR5OhKybUFuOrrp5jWTFBGJ-yRYwpoPpaNXroGd3M';

let tokenRequestPromise = null;

const getMessagingServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  return registration;
};

export async function getNotificationToken() {
  if (tokenRequestPromise) {
    return tokenRequestPromise;
  }

  tokenRequestPromise = (async () => {
    try {
      const supported = await isSupported();

      if (!supported || !('Notification' in window)) {
        console.log('Firebase messaging is not supported in this browser');
        return null;
      }

      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.log('Notification Permission Denied');
        return null;
      }

      const serviceWorkerRegistration = await getMessagingServiceWorker();

      if (!serviceWorkerRegistration) {
        console.log('Service worker is not available for notifications');
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      });

      console.log('FCM TOKEN:', token);
       const updateResponse = await fetch('https://manage-everythin.onrender.com/api/users/update-fcm-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ fcmtoken: token }),
      });

        if (!updateResponse.ok) {
            console.error('Failed to update FCM token on server');
        } else {
            console.log('FCM token updated on server successfully');
        }
      return token;
    } catch (error) {
      console.error(error);
      return null;
    } finally {
      tokenRequestPromise = null;
    }
  })();

  return tokenRequestPromise;
}
