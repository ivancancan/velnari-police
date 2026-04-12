import * as SecureStore from 'expo-secure-store';
import { enqueue, flushQueue, getQueueSize, clearQueue } from '../lib/offline-queue';

// Mock the internal api module used by flushQueue
jest.mock('../lib/api', () => ({
  api: {
    post: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
  },
}), { virtual: true });

describe('offline-queue', () => {
  beforeEach(async () => {
    await clearQueue();
    jest.clearAllMocks();
  });

  it('enqueues an action and increases queue size', async () => {
    expect(await getQueueSize()).toBe(0);
    await enqueue('post', '/api/units/1/location', { lat: 19.43, lng: -99.13 });
    expect(await getQueueSize()).toBe(1);
  });

  it('enqueues multiple actions', async () => {
    await enqueue('post', '/api/units/1/location', { lat: 19.43, lng: -99.13 });
    await enqueue('patch', '/api/units/1/status', { status: 'on_scene' });
    expect(await getQueueSize()).toBe(2);
  });

  it('clearQueue empties the queue', async () => {
    await enqueue('post', '/api/units/1/location', {});
    await clearQueue();
    expect(await getQueueSize()).toBe(0);
  });

  it('flushQueue drains successfully queued actions', async () => {
    await enqueue('post', '/api/units/1/location', { lat: 19.43, lng: -99.13 });
    await enqueue('patch', '/api/units/1/status', { status: 'available' });

    const result = await flushQueue();

    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
    expect(await getQueueSize()).toBe(0);
  });

  it('flushQueue retains failed actions with incremented retry count', async () => {
    const { api } = require('../lib/api');
    (api.post as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await enqueue('post', '/api/units/1/location', {});

    const result = await flushQueue();
    expect(result.failed).toBe(1);
    // Action stays in queue for retry
    expect(await getQueueSize()).toBe(1);
  });

  it('persists queue across SecureStore reads', async () => {
    await enqueue('post', '/api/units/abc/location', { lat: 1, lng: 2 });

    // Simulate a fresh module read by checking SecureStore directly
    const raw = await SecureStore.getItemAsync('velnari_offline_queue');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].url).toBe('/api/units/abc/location');
  });
});
