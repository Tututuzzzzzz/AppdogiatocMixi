export type BehaviorLabel =
  | 'walking'
  | 'running'
  | 'upstairs'
  | 'downstairs'
  | 'sitting'
  | 'standing';

export interface MotionSample {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  timestamp: number;
}

export interface MotionFeatures {
  meanMagnitude: number;
  stdMagnitude: number;
  peakToPeakMagnitude: number;
  meanDeltaMagnitude: number;
  energy: number;
}

export interface BehaviorPrediction {
  label: BehaviorLabel;
  confidence: number;
  probabilities: Record<BehaviorLabel, number>;
  features: MotionFeatures;
}

export interface PredictionResourceUsage {
  timestamp: number;
  inferenceDurationMs: number;
  estimatedCpuLoadPercent: number;
  // App-specific metrics (priority)
  appUsedRamMB: number | null;
  appTotalRamMB: number | null;
  appUsedRamPercent: number | null;
  appCpuUsagePercent: number | null;
  appCacheBytes: number | null;
  appDocumentBytes: number | null;
  appStorageBytes: number | null;
  appStorageMB: number | null;
  cpuCoreClockGhzList: number[] | null;
  cpuCoreCount: number | null;
  appThreadCount: number | null;
  gpuUtilizationPercent: number | null;
  vramUsedBytes: number | null;
  batteryDrainMilliwatts: number | null;
  batteryDrainMahPerHour: number | null;
  batteryCurrentMilliamps: number | null;
  batteryVoltageVolts: number | null;
  batteryIsCharging: boolean | null;
  // Device-wide metrics (fallback)
  usedRamBytes: number | null;
  totalRamBytes: number | null;
  usedRamPercent: number | null;
  usedStorageBytes: number | null;
  totalStorageBytes: number | null;
  usedStoragePercent: number | null;
}

export interface BehaviorEvent {
  id: string;
  label: BehaviorLabel;
  confidence: number;
  timestamp: number;
  meanMagnitude: number;
}

export interface MeasurementSession {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  sampleCount: number;
  eventCount: number;
  averageMagnitude: number;
  minMagnitude: number;
  maxMagnitude: number;
  averageConfidence: number;
  dominantBehavior: BehaviorLabel;
  behaviorCounts: Record<BehaviorLabel, number>;
  events: BehaviorEvent[];
}

export const DEFAULT_PROBABILITIES: Record<BehaviorLabel, number> = {
  walking: 0,
  running: 0,
  upstairs: 0,
  downstairs: 0,
  sitting: 0,
  standing: 0,
};
