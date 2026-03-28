import * as Notifications from 'expo-notifications';
import type { InventoryItem } from './api';

// Show notifications in foreground too
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function getDaysLeft(fechaVencimiento: string | null): number {
  if (!fechaVencimiento) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(fechaVencimiento);
  expiry.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Cancels all previously scheduled Freshy notifications, then reschedules
 * one immediate notification per item that expires in exactly 2 days (or less, down to 0).
 * Call this every time the inventory is loaded/refreshed.
 */
export async function scheduleExpiryNotifications(items: InventoryItem[]): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Cancel existing Freshy notifications to avoid duplicates
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.freshy) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const expiringSoon = items.filter(item => {
    const d = getDaysLeft(item.fecha_vencimiento);
    return d >= 0 && d <= 2;
  });

  if (expiringSoon.length === 0) return;

  // Group into one notification if multiple items expire soon
  if (expiringSoon.length === 1) {
    const item = expiringSoon[0];
    const d = getDaysLeft(item.fecha_vencimiento);
    const when = d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'en 2 días';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${item.emoji ?? '📦'} ${item.nombre} vence ${when}`,
        body: 'Revisá tu inventario antes de que se venza.',
        data: { freshy: true, itemId: item.id },
      },
      trigger: null, // immediate
    });
  } else {
    const names = expiringSoon.map(i => `${i.emoji ?? '📦'} ${i.nombre}`).join(', ');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${expiringSoon.length} productos están por vencer`,
        body: names,
        data: { freshy: true },
      },
      trigger: null, // immediate
    });
  }
}
