import type { NotificationAnswer, NotificationIntegration } from './types';

/** The browser Notification API as a `NotificationIntegration` (unsupported → `supported: false`). */
export function browserNotifications(): NotificationIntegration {
  const N = typeof window !== 'undefined' ? window.Notification : undefined;
  return {
    supported: typeof N === 'function',
    permission: () => (N ? (N.permission as NotificationAnswer) : 'denied'),
    async request() {
      if (!N) return 'denied';
      try {
        return (await N.requestPermission()) as NotificationAnswer;
      } catch {
        return 'denied';
      }
    },
  };
}
