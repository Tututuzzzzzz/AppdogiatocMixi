import { useCallback, useEffect, useRef, useState } from 'react';

import { classifyBehavior } from '@/src/modules/activity-recognition/ai/behavior-model';
import {
  createPredictionResourceUsageSnapshot,
  readHighResolutionNowMs,
} from '@/src/modules/activity-recognition/device/resource-usage';
import {
  checkAccelerometerAvailability,
  startAccelerometerStream,
} from '@/src/modules/activity-recognition/sensor/accelerometer-stream';
import {
  clearSessionHistoryOnBackend,
  fetchSessionHistoryFromBackend,
  pushSessionsToBackend,
} from '@/src/modules/activity-recognition/sync/history-sync';
import { readStoredAuthSession } from '@/src/modules/backend/storage/auth-session';
import type {
  BehaviorEvent,
  BehaviorPrediction,
  BehaviorLabel,
  MeasurementSession,
  MotionSample,
  PredictionResourceUsage,
} from '@/src/modules/activity-recognition/types';

type ClearRange = {
  startTimestamp?: number;
  endTimestamp?: number;
};

const WINDOW_SIZE = 40;
const LIVE_EVENT_LIMIT = 24;
const SESSION_LIMIT = 40;
const SESSION_EVENT_LIMIT = 300;
const EVENT_THROTTLE_MS = 1800;
const SENSOR_UPDATE_INTERVAL_MS = 80;
const RESOURCE_USAGE_REFRESH_MS = 1000;

function createBehaviorCountMap(): Record<BehaviorLabel, number> {
  return {
    walking: 0,
    running: 0,
    upstairs: 0,
    downstairs: 0,
    sitting: 0,
    standing: 0,
  };
}

function getDominantBehavior(behaviorCounts: Record<BehaviorLabel, number>): BehaviorLabel {
  const [label] = Object.entries(behaviorCounts).reduce<readonly [BehaviorLabel, number]>(
    (best, [key, count]) => {
      if (count > best[1]) {
        return [key as BehaviorLabel, count];
      }

      return best;
    },
    ['standing', -1]
  );

  return label;
}

function mergeSessions(
  existingSessions: MeasurementSession[],
  incomingSessions: MeasurementSession[]
): MeasurementSession[] {
  const uniqueMap = new Map<string, MeasurementSession>();

  for (const session of existingSessions) {
    uniqueMap.set(session.id, session);
  }

  for (const session of incomingSessions) {
    if (!uniqueMap.has(session.id)) {
      uniqueMap.set(session.id, session);
    }
  }

  return Array.from(uniqueMap.values()).sort((left, right) => right.endedAt - left.endedAt);
}

export function useActivityMonitor() {
  const [isSensorAvailable, setIsSensorAvailable] = useState<boolean | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [latestSample, setLatestSample] = useState<MotionSample | null>(null);
  const [prediction, setPrediction] = useState<BehaviorPrediction | null>(null);
  const [resourceUsage, setResourceUsage] = useState<PredictionResourceUsage | null>(null);
  const [events, setEvents] = useState<BehaviorEvent[]>([]);
  const [sessions, setSessions] = useState<MeasurementSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stopStreamRef = useRef<(() => void) | null>(null);
  const bufferRef = useRef<MotionSample[]>([]);
  const lastLabelRef = useRef<BehaviorLabel | null>(null);
  const lastEventTimeRef = useRef(0);
  const lastResourceUsageAtRef = useRef(0);

  const currentSessionStartedAtRef = useRef<number | null>(null);
  const sessionLastSampleAtRef = useRef<number | null>(null);
  const sessionSampleCountRef = useRef(0);
  const sessionMagnitudeSumRef = useRef(0);
  const sessionMinMagnitudeRef = useRef(Number.POSITIVE_INFINITY);
  const sessionMaxMagnitudeRef = useRef(0);
  const sessionPredictionCountRef = useRef(0);
  const sessionConfidenceSumRef = useRef(0);
  const sessionBehaviorCountsRef = useRef<Record<BehaviorLabel, number>>(createBehaviorCountMap());
  const sessionEventsRef = useRef<BehaviorEvent[]>([]);

  const resetSessionRefs = useCallback(() => {
    currentSessionStartedAtRef.current = null;
    sessionLastSampleAtRef.current = null;
    sessionSampleCountRef.current = 0;
    sessionMagnitudeSumRef.current = 0;
    sessionMinMagnitudeRef.current = Number.POSITIVE_INFINITY;
    sessionMaxMagnitudeRef.current = 0;
    sessionPredictionCountRef.current = 0;
    sessionConfidenceSumRef.current = 0;
    sessionBehaviorCountsRef.current = createBehaviorCountMap();
    sessionEventsRef.current = [];
  }, []);

  const finalizeSession = useCallback(() => {
    const startedAt = currentSessionStartedAtRef.current;
    const endedAt = sessionLastSampleAtRef.current;
    const sampleCount = sessionSampleCountRef.current;

    if (!startedAt || !endedAt || sampleCount === 0) {
      return;
    }

    const averageMagnitude = sessionMagnitudeSumRef.current / sampleCount;
    const averageConfidence =
      sessionPredictionCountRef.current === 0
        ? 0
        : sessionConfidenceSumRef.current / sessionPredictionCountRef.current;

    const behaviorCounts = { ...sessionBehaviorCountsRef.current };
    const dominantBehavior = getDominantBehavior(behaviorCounts);

    const session: MeasurementSession = {
      id: `${startedAt}-${endedAt}`,
      startedAt,
      endedAt,
      durationMs: Math.max(endedAt - startedAt, 0),
      sampleCount,
      eventCount: sessionEventsRef.current.length,
      averageMagnitude,
      minMagnitude:
        sessionMinMagnitudeRef.current === Number.POSITIVE_INFINITY
          ? averageMagnitude
          : sessionMinMagnitudeRef.current,
      maxMagnitude: sessionMaxMagnitudeRef.current,
      averageConfidence,
      dominantBehavior,
      behaviorCounts,
      events: [...sessionEventsRef.current],
    };

    setSessions((previous) => [session, ...previous].slice(0, SESSION_LIMIT));

    pushSessionsToBackend([session]).catch(() => {
      setError((previousError) => {
        if (previousError) {
          return previousError;
        }

        return 'Không thể đồng bộ phiên đo lên máy chủ.';
      });
    });
  }, []);

  const stopMonitoring = useCallback(() => {
    stopStreamRef.current?.();
    stopStreamRef.current = null;
    finalizeSession();

    bufferRef.current = [];
    lastLabelRef.current = null;
    lastEventTimeRef.current = 0;
    resetSessionRefs();
    setIsRunning(false);
  }, [finalizeSession, resetSessionRefs]);

  useEffect(() => {
    let isMounted = true;

    checkAccelerometerAvailability()
      .then((available) => {
        if (isMounted) {
          setIsSensorAvailable(available);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsSensorAvailable(false);
          setError('Không thể kiểm tra trạng thái cảm biến gia tốc.');
        }
      });

    return () => {
      isMounted = false;
      stopMonitoring();
    };
  }, [stopMonitoring]);

  useEffect(() => {
    let isMounted = true;

    setIsHistoryLoading(true);

    fetchSessionHistoryFromBackend(SESSION_LIMIT)
      .then((remoteSessions) => {
        if (!isMounted) {
          return;
        }

        setSessions((previous) => mergeSessions(previous, remoteSessions).slice(0, SESSION_LIMIT));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setError((previousError) => {
          if (previousError) {
            return previousError;
          }

          return 'Không thể tải lịch sử đo từ máy chủ.';
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const startMonitoring = useCallback(async () => {
    setError(null);

    const available = await checkAccelerometerAvailability();
    setIsSensorAvailable(available);

    if (!available) {
      setError('Cảm biến gia tốc không khả dụng trên thiết bị này.');
      return;
    }

    // Kiểm tra xác thực trước khi bắt đầu đo
    const authSession = await readStoredAuthSession();
    if (!authSession) {
      setError('Bạn cần đăng nhập trước khi bắt đầu đo. Dữ liệu đo sẽ được lưu vào máy chủ sau khi bạn đăng nhập.');
      return;
    }

    stopMonitoring();
    setEvents([]);
    setPrediction(null);
    setResourceUsage(null);
    setLatestSample(null);
    lastResourceUsageAtRef.current = 0;

    resetSessionRefs();
    currentSessionStartedAtRef.current = Date.now();

    stopStreamRef.current = startAccelerometerStream(
      (sample) => {
        setLatestSample(sample);

        sessionSampleCountRef.current += 1;
        sessionMagnitudeSumRef.current += sample.magnitude;
        sessionMinMagnitudeRef.current = Math.min(sessionMinMagnitudeRef.current, sample.magnitude);
        sessionMaxMagnitudeRef.current = Math.max(sessionMaxMagnitudeRef.current, sample.magnitude);
        sessionLastSampleAtRef.current = sample.timestamp;

        const nextWindow = [...bufferRef.current, sample].slice(-WINDOW_SIZE);
        bufferRef.current = nextWindow;

        const predictionStartedAt = readHighResolutionNowMs();
        const nextPrediction = classifyBehavior(nextWindow);
        const predictionDurationMs = Math.max(readHighResolutionNowMs() - predictionStartedAt, 0);
        setPrediction(nextPrediction);

        sessionPredictionCountRef.current += 1;
        sessionConfidenceSumRef.current += nextPrediction.confidence;
        sessionBehaviorCountsRef.current[nextPrediction.label] += 1;

        const now = Date.now();
        if (now - lastResourceUsageAtRef.current >= RESOURCE_USAGE_REFRESH_MS) {
          lastResourceUsageAtRef.current = now;
          createPredictionResourceUsageSnapshot(predictionDurationMs, SENSOR_UPDATE_INTERVAL_MS)
            .then((snapshot) => {
              setResourceUsage(snapshot);
            })
            .catch(() => {
              // Keep the previous snapshot when resource metrics are temporarily unavailable.
            });
        }

        const shouldStoreEvent =
          nextPrediction.label !== lastLabelRef.current ||
          now - lastEventTimeRef.current >= EVENT_THROTTLE_MS;

        if (shouldStoreEvent) {
          lastLabelRef.current = nextPrediction.label;
          lastEventTimeRef.current = now;

          const event: BehaviorEvent = {
            id: `${now}-${nextPrediction.label}`,
            label: nextPrediction.label,
            confidence: nextPrediction.confidence,
            timestamp: now,
            meanMagnitude: nextPrediction.features.meanMagnitude,
          };

          sessionEventsRef.current = [event, ...sessionEventsRef.current].slice(0, SESSION_EVENT_LIMIT);
          setEvents((previous) => [event, ...previous].slice(0, LIVE_EVENT_LIMIT));
        }
      },
      { updateIntervalMs: SENSOR_UPDATE_INTERVAL_MS }
    );

    setIsRunning(true);
  }, [resetSessionRefs, stopMonitoring]);

  const toggleMonitoring = useCallback(() => {
    if (isRunning) {
      stopMonitoring();
      return;
    }

    startMonitoring().catch(() => {
      setError('Không thể bắt đầu luồng dữ liệu cảm biến gia tốc.');
    });
  }, [isRunning, startMonitoring, stopMonitoring]);

  const clearSessionHistory = useCallback((range?: ClearRange) => {
    setError(null);

    const hasStart = typeof range?.startTimestamp === 'number';
    const hasEnd = typeof range?.endTimestamp === 'number';
    const start = hasStart ? Number(range?.startTimestamp) : 0;
    const end = hasEnd ? Number(range?.endTimestamp) : Number.MAX_SAFE_INTEGER;

    if (hasStart && hasEnd && start > end) {
      setError('Khoảng thời gian xóa không hợp lệ.');
      return;
    }

    const clearOnServer = async () => {
      try {
        await clearSessionHistoryOnBackend(range);

        if (!hasStart && !hasEnd) {
          setSessions([]);
          return;
        }

        const refreshedSessions = await fetchSessionHistoryFromBackend(SESSION_LIMIT);
        setSessions(refreshedSessions.slice(0, SESSION_LIMIT));
      } catch {
        setError((previousError) => {
          if (previousError) {
            return previousError;
          }

          return 'Không thể xóa lịch sử đo trên máy chủ.';
        });
      }
    };

    void clearOnServer();
  }, []);

  return {
    isSensorAvailable,
    isRunning,
    isHistoryLoading,
    latestSample,
    prediction,
    resourceUsage,
    events,
    sessions,
    error,
    startMonitoring,
    stopMonitoring,
    toggleMonitoring,
    clearSessionHistory,
  };
}
