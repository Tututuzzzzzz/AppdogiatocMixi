import { Accelerometer } from 'expo-sensors';

import type { MotionSample } from '@/src/modules/activity-recognition/types';

export interface AccelerometerStreamOptions {
  updateIntervalMs?: number;
}

export type MotionSampleListener = (sample: MotionSample) => void;

export async function checkAccelerometerAvailability(): Promise<boolean> {
  return Accelerometer.isAvailableAsync();
}

export function startAccelerometerStream(
  listener: MotionSampleListener,
  options?: AccelerometerStreamOptions
): () => void {
  const interval = options?.updateIntervalMs ?? 80;
  Accelerometer.setUpdateInterval(interval);

  const subscription = Accelerometer.addListener((reading) => {
    const magnitude = Math.hypot(reading.x, reading.y, reading.z);

    listener({
      x: reading.x,
      y: reading.y,
      z: reading.z,
      magnitude,
      timestamp: Date.now(),
    });
  });

  return () => subscription.remove();
}
