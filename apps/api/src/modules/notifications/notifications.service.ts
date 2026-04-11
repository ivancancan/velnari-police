import { Injectable, Logger } from '@nestjs/common';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPush(token: string | null | undefined, message: Omit<ExpoMessage, 'to'>): Promise<void> {
    if (!token || !token.startsWith('ExponentPushToken[')) {
      return; // not a valid expo token — skip silently
    }

    const payload: ExpoMessage = { to: token, ...message };

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: { status: string; message?: string } };
      if (json.data?.status === 'error') {
        this.logger.warn(`Expo push error for token ${token.slice(0, 30)}: ${json.data.message}`);
      }
    } catch (err) {
      // Push is best-effort — never throw
      this.logger.error(`Failed to send push notification: ${(err as Error).message}`);
    }
  }
}
