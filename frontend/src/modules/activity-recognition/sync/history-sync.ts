import {
  deleteActivityHistory,
  fetchActivityHistory,
  postActivityLog,
} from '@/src/modules/backend/api/mobile-backend-api';
import { readStoredAuthSession } from '@/src/modules/backend/storage/auth-session';
import type {
  ActivityDeleteHistoryRange,
  ActivityLogItem,
  ActivityLogPayload,
} from '@/src/modules/backend/types';
import type {
  BehaviorEvent,
  BehaviorLabel,
  MeasurementSession,
} from '@/src/modules/activity-recognition/types';

function normalizeBehaviorLabel(activity: string): BehaviorLabel {
  if (
    activity === 'walking' ||
    activity === 'running' ||
    activity === 'upstairs' ||
    activity === 'downstairs' ||
    activity === 'sitting' ||
    activity === 'standing'
  ) {
    return activity;
  }

  return 'standing';
}

function createBehaviorCounts(label: BehaviorLabel): Record<BehaviorLabel, number> {
  return {
    walking: label === 'walking' ? 1 : 0,
    running: label === 'running' ? 1 : 0,
    upstairs: label === 'upstairs' ? 1 : 0,
    downstairs: label === 'downstairs' ? 1 : 0,
    sitting: label === 'sitting' ? 1 : 0,
    standing: label === 'standing' ? 1 : 0,
  };
}

function toSyntheticSession(item: ActivityLogItem): MeasurementSession {
  const label = normalizeBehaviorLabel(item.activity);
  const event: BehaviorEvent = {
    id: item.id,
    label,
    confidence: item.confidence,
    timestamp: item.timestamp,
    meanMagnitude: 0,
  };

  return {
    id: item.id,
    startedAt: item.timestamp,
    endedAt: item.timestamp,
    durationMs: 0,
    sampleCount: 1,
    eventCount: 1,
    averageMagnitude: 0,
    minMagnitude: 0,
    maxMagnitude: 0,
    averageConfidence: item.confidence,
    dominantBehavior: label,
    behaviorCounts: createBehaviorCounts(label),
    events: [event],
  };
}

function toActivityPayloads(session: MeasurementSession, userId: string): ActivityLogPayload[] {
  const items = session.events.map((event) => ({
    userId,
    activity: event.label,
    confidence: event.confidence,
    timestamp: event.timestamp,
  }));

  if (items.length > 0) {
    return items;
  }

  return [
    {
      userId,
      activity: session.dominantBehavior,
      confidence: session.averageConfidence,
      timestamp: session.endedAt,
    },
  ];
}

export async function pushSessionsToBackend(sessions: MeasurementSession[]): Promise<void> {
  if (sessions.length === 0) {
    return;
  }

  const authSession = await readStoredAuthSession();
  if (!authSession) {
    console.warn('[Activity Sync] Không có phiên xác thực. Dữ liệu sẽ không được lưu. Vui lòng đăng nhập trước!');
    throw new Error('Chưa đăng nhập. Vui lòng đăng nhập trước khi đo để lưu dữ liệu vào máy chủ.');
  }

  const payloads = sessions.flatMap((session) => toActivityPayloads(session, authSession.user.id));
  if (payloads.length === 0) {
    return;
  }

  console.log(`[Activity Sync] Đang đồng bộ ${payloads.length} hoạt động lên máy chủ...`);

  const results = await Promise.allSettled(
    payloads.map((payload) => postActivityLog(authSession.accessToken, payload))
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  if (fulfilled.length > 0) {
    console.log(`[Activity Sync] Đã đồng bộ ${fulfilled.length}/${payloads.length} hoạt động thành công`);
  }

  if (rejected.length > 0) {
    console.error(`[Activity Sync] Lỗi khi đồng bộ ${rejected.length} hoạt động:`, rejected);
    throw new Error('Không thể đồng bộ activity lên máy chủ.');
  }
}

export async function fetchSessionHistoryFromBackend(limit: number): Promise<MeasurementSession[]> {
  const authSession = await readStoredAuthSession();
  if (!authSession) {
    return [];
  }

  const historyResponse = await fetchActivityHistory(
    authSession.accessToken,
    authSession.user.id,
    limit,
    0
  );

  return historyResponse.items.map(toSyntheticSession).sort((left, right) => right.endedAt - left.endedAt);
}

export async function clearSessionHistoryOnBackend(
  range?: ActivityDeleteHistoryRange
): Promise<number> {
  const authSession = await readStoredAuthSession();
  if (!authSession) {
    return 0;
  }

  const response = await deleteActivityHistory(authSession.accessToken, authSession.user.id, range);
  return response.deletedCount;
}
