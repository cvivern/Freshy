import * as Notifications from 'expo-notifications';
import type { InventoryItem } from './api';

const WEEKLY_SUMMARY_ID = 'freshy-weekly-summary';

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

/**
 * Schedules a repeating weekly summary notification.
 * Also fires one immediately so the user sees it working right away.
 * Call when the user enables "Resumen semanal".
 */
export async function scheduleWeeklySummary(items: InventoryItem[]): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // Cancel any existing weekly summary before rescheduling
  await cancelWeeklySummary();

  const total = items.length;
  const porVencer = items.filter(i => i.estado === 'por_vencer').length;
  const vencidos = items.filter(i => i.estado === 'vencido').length;

  const bodyParts: string[] = [`📦 ${total} producto${total !== 1 ? 's' : ''} en stock`];
  if (porVencer > 0) bodyParts.push(`⚠️ ${porVencer} por vencer`);
  if (vencidos > 0) bodyParts.push(`🔴 ${vencidos} vencido${vencidos !== 1 ? 's' : ''}`);

  const content: Notifications.NotificationContentInput = {
    title: '📊 Resumen semanal de tu despensa',
    body: bodyParts.join(' · '),
    data: { freshy: true, type: 'weekly' },
  };

  // Immediate notification so the user sees it right away
  await Notifications.scheduleNotificationAsync({ content, trigger: null });

  // Repeating every 7 days
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_SUMMARY_ID,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 7 * 24 * 60 * 60,
      repeats: true,
    },
  });
}

/** Cancels the repeating weekly summary notification. */
export async function cancelWeeklySummary(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_SUMMARY_ID).catch(() => {});
}
