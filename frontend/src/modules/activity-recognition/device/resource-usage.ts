import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { PredictionResourceUsage } from '@/src/modules/activity-recognition/types';

// Module lấy metrics của **app** (không phải toàn hệ thống)
type NativeAppMetricsModule = {
  getUsedMemory: () => Promise<number>;
  getMaxMemory: () => Promise<number>;
};

type NativeProcessCpuModule = {
  getProcessCpuUsagePercent: () => Promise<number | null>;
  getRuntimeMetrics?: () => Promise<NativeRuntimeMetrics | null>;
  resetCpuSampler?: () => Promise<boolean>;
};

type NativeRuntimeMetrics = {
  cpuCoreClockGhzList?: number[] | null;
  cpuCoreCount?: number | null;
  threadCount?: number | null;
  gpuUtilizationPercent?: number | null;
  vramUsedBytes?: number | null;
  batteryDrainMilliwatts?: number | null;
  batteryDrainMahPerHour?: number | null;
  batteryCurrentMilliamps?: number | null;
  batteryVoltageVolts?: number | null;
  batteryIsCharging?: boolean | null;
};

// Module lấy metrics của **toàn hệ thống** (dùng làm fallback)
type NativeDeviceInfoModule = {
  getTotalMemory: () => Promise<number>;
  getUsedMemory: () => Promise<number>;
  getTotalDiskCapacity: () => Promise<number>;
  getFreeDiskStorage: () => Promise<number>;
};

type RuntimePerformance = {
  now?: () => number;
  memory?: {
    usedJSHeapSize?: number;
  };
};

function getRuntimePerformance(): RuntimePerformance | undefined {
  return globalThis.performance as RuntimePerformance | undefined;
}

let nativeAppMetricsModulePromise: Promise<NativeAppMetricsModule | null> | null = null;
let nativeDeviceInfoModulePromise: Promise<NativeDeviceInfoModule | null> | null = null;
let nativeProcessCpuModulePromise: Promise<NativeProcessCpuModule | null> | null = null;
let cachedAppStorageMetrics: {
  appCacheBytes: number | null;
  appDocumentBytes: number | null;
  appStorageBytes: number | null;
} | null = null;
let lastAppStorageCollectedAt = 0;

const APP_STORAGE_REFRESH_MS = 15000;

function shouldUseNativeModules(): boolean {
  const isNativePlatform = Platform.OS === 'android' || Platform.OS === 'ios';
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  return isNativePlatform && !isExpoGo;
}

function isNativeAppMetricsModule(value: unknown): value is NativeAppMetricsModule {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NativeAppMetricsModule>;

  return (
    typeof candidate.getUsedMemory === 'function' &&
    typeof candidate.getMaxMemory === 'function'
  );
}

function extractNativeAppMetricsModule(value: unknown): NativeAppMetricsModule | null {
  if (isNativeAppMetricsModule(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidateWithDefault = value as { default?: unknown };
  if (isNativeAppMetricsModule(candidateWithDefault.default)) {
    return candidateWithDefault.default;
  }

  return null;
}

function isNativeDeviceInfoModule(value: unknown): value is NativeDeviceInfoModule {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NativeDeviceInfoModule>;

  return (
    typeof candidate.getTotalMemory === 'function' &&
    typeof candidate.getUsedMemory === 'function' &&
    typeof candidate.getTotalDiskCapacity === 'function' &&
    typeof candidate.getFreeDiskStorage === 'function'
  );
}

function extractNativeDeviceInfoModule(value: unknown): NativeDeviceInfoModule | null {
  if (isNativeDeviceInfoModule(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidateWithDefault = value as { default?: unknown };
  if (isNativeDeviceInfoModule(candidateWithDefault.default)) {
    return candidateWithDefault.default;
  }

  return null;
}

async function loadNativeAppMetricsModule(): Promise<NativeAppMetricsModule | null> {
  if (!shouldUseNativeModules()) {
    return null;
  }

  nativeAppMetricsModulePromise ??= import('react-native-device-info')
      .then((module) => {
        return extractNativeAppMetricsModule(module);
      })
      .catch(() => null);

  return nativeAppMetricsModulePromise;
}

function isNativeProcessCpuModule(value: unknown): value is NativeProcessCpuModule {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NativeProcessCpuModule>;
  return typeof candidate.getProcessCpuUsagePercent === 'function';
}

async function loadNativeProcessCpuModule(): Promise<NativeProcessCpuModule | null> {
  if (!shouldUseNativeModules() || Platform.OS !== 'android') {
    return null;
  }

  nativeProcessCpuModulePromise ??= import('expo-app-process-metrics')
    .then((module) => {
      const maybeDefault = (module as { default?: unknown }).default;

      if (isNativeProcessCpuModule(maybeDefault)) {
        return maybeDefault;
      }

      if (isNativeProcessCpuModule(module)) {
        return module;
      }

      return null;
    })
    .catch(() => null);

  return nativeProcessCpuModulePromise;
}

async function loadNativeDeviceInfoModule(): Promise<NativeDeviceInfoModule | null> {
  if (!shouldUseNativeModules()) {
    return null;
  }

  nativeDeviceInfoModulePromise ??= import('react-native-device-info')
      .then((module) => {
        return extractNativeDeviceInfoModule(module);
      })
      .catch(() => null);

  return nativeDeviceInfoModulePromise;
}

function normalizePositiveNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function normalizeNonNegativeNumber(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function normalizePositiveInteger(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
}

function normalizeBoolean(value: boolean | null | undefined): boolean | null {
  if (typeof value !== 'boolean') {
    return null;
  }

  return value;
}

function normalizeClockList(value: number[] | null | undefined): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((item) => normalizePositiveNumber(item))
    .filter((item): item is number => item !== null)
    .map((item) => Number(item.toFixed(3)));

  return normalized.length > 0 ? normalized : null;
}

function toPercent(value: number, total: number): number {
  return Math.max(0, Math.min(100, Number(((value / total) * 100).toFixed(1))));
}

async function readNativeDeviceMetrics(): Promise<{
  totalRamBytes: number | null;
  usedRamBytes: number | null;
  totalStorageBytes: number | null;
  freeStorageBytes: number | null;
} | null> {
  const module = await loadNativeDeviceInfoModule();

  if (!module) {
    return null;
  }

  const [totalRamResult, usedRamResult, totalStorageResult, freeStorageResult] = await Promise.allSettled([
    module.getTotalMemory(),
    module.getUsedMemory(),
    module.getTotalDiskCapacity(),
    module.getFreeDiskStorage(),
  ]);

  return {
    totalRamBytes:
      totalRamResult.status === 'fulfilled' ? normalizePositiveNumber(totalRamResult.value) : null,
    usedRamBytes: usedRamResult.status === 'fulfilled' ? normalizePositiveNumber(usedRamResult.value) : null,
    totalStorageBytes:
      totalStorageResult.status === 'fulfilled'
        ? normalizePositiveNumber(totalStorageResult.value)
        : null,
    freeStorageBytes:
      freeStorageResult.status === 'fulfilled'
        ? normalizePositiveNumber(freeStorageResult.value)
        : null,
  };
}

async function readAppSpecificMetrics(): Promise<{
  appMemoryUsageBytes: number | null;
  appMemoryLimitBytes: number | null;
  appCpuUsagePercent: number | null;
  cpuCoreClockGhzList: number[] | null;
  cpuCoreCount: number | null;
  threadCount: number | null;
  gpuUtilizationPercent: number | null;
  vramUsedBytes: number | null;
  batteryDrainMilliwatts: number | null;
  batteryDrainMahPerHour: number | null;
  batteryCurrentMilliamps: number | null;
  batteryVoltageVolts: number | null;
  batteryIsCharging: boolean | null;
} | null> {
  const module = await loadNativeAppMetricsModule();

  if (!module) {
    return null;
  }

  const processCpuModule = await loadNativeProcessCpuModule();

  const cpuReader = async (): Promise<number | null> => {
    if (!processCpuModule) {
      return null;
    }

    return processCpuModule.getProcessCpuUsagePercent();
  };

  const runtimeMetricsReader = async (): Promise<NativeRuntimeMetrics | null> => {
    if (!processCpuModule?.getRuntimeMetrics) {
      return null;
    }

    return processCpuModule.getRuntimeMetrics();
  };

  const [memUsageResult, memLimitResult, cpuResult, runtimeMetricsResult] = await Promise.allSettled([
    module.getUsedMemory(),
    module.getMaxMemory(),
    cpuReader(),
    runtimeMetricsReader(),
  ]);

  const runtimeMetrics =
    runtimeMetricsResult.status === 'fulfilled' ? runtimeMetricsResult.value : null;

  return {
    appMemoryUsageBytes: memUsageResult.status === 'fulfilled' ? normalizePositiveNumber(memUsageResult.value) : null,
    appMemoryLimitBytes: memLimitResult.status === 'fulfilled' ? normalizePositiveNumber(memLimitResult.value) : null,
    appCpuUsagePercent: cpuResult.status === 'fulfilled' ? normalizeNonNegativeNumber(cpuResult.value) : null,
    cpuCoreClockGhzList: normalizeClockList(runtimeMetrics?.cpuCoreClockGhzList),
    cpuCoreCount: normalizePositiveInteger(runtimeMetrics?.cpuCoreCount),
    threadCount: normalizePositiveInteger(runtimeMetrics?.threadCount),
    gpuUtilizationPercent: normalizeNonNegativeNumber(runtimeMetrics?.gpuUtilizationPercent),
    vramUsedBytes: normalizeNonNegativeNumber(runtimeMetrics?.vramUsedBytes),
    batteryDrainMilliwatts: normalizeNonNegativeNumber(runtimeMetrics?.batteryDrainMilliwatts),
    batteryDrainMahPerHour: normalizeNonNegativeNumber(runtimeMetrics?.batteryDrainMahPerHour),
    batteryCurrentMilliamps: normalizeNonNegativeNumber(runtimeMetrics?.batteryCurrentMilliamps),
    batteryVoltageVolts: normalizePositiveNumber(runtimeMetrics?.batteryVoltageVolts),
    batteryIsCharging: normalizeBoolean(runtimeMetrics?.batteryIsCharging),
  };
}

function bytesToMB(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return Number((value / (1024 * 1024)).toFixed(2));
}

function readFileSizeBytes(file: File): number {
  const inlineSize = normalizeNonNegativeNumber(file.size);
  if (inlineSize !== null) {
    return inlineSize;
  }

  try {
    return normalizeNonNegativeNumber(file.info().size) ?? 0;
  } catch {
    return 0;
  }
}

function readDirectorySizeBytes(directory: Directory): number {
  const inlineSize = normalizeNonNegativeNumber(directory.size);
  if (inlineSize !== null) {
    return inlineSize;
  }

  try {
    const infoSize = normalizeNonNegativeNumber(directory.info().size);
    if (infoSize !== null) {
      return infoSize;
    }
  } catch {
    // Directory metadata may fail for some locations; fallback to recursive listing.
  }

  try {
    const entries = directory.list();
    return entries.reduce((sum, entry) => {
      if (entry instanceof Directory) {
        return sum + readDirectorySizeBytes(entry);
      }

      return sum + readFileSizeBytes(entry);
    }, 0);
  } catch {
    return 0;
  }
}

async function readAppStorageMetrics(): Promise<{
  appCacheBytes: number | null;
  appDocumentBytes: number | null;
  appStorageBytes: number | null;
}> {
  const now = Date.now();
  if (cachedAppStorageMetrics && now - lastAppStorageCollectedAt < APP_STORAGE_REFRESH_MS) {
    return cachedAppStorageMetrics;
  }

  let appCacheBytes: number | null = null;
  let appDocumentBytes: number | null = null;

  try {
    appCacheBytes = normalizeNonNegativeNumber(readDirectorySizeBytes(Paths.cache));
  } catch {
    appCacheBytes = null;
  }

  try {
    appDocumentBytes = normalizeNonNegativeNumber(readDirectorySizeBytes(Paths.document));
  } catch {
    appDocumentBytes = null;
  }

  const appStorageBytes =
    appCacheBytes === null && appDocumentBytes === null
      ? null
      : (appCacheBytes ?? 0) + (appDocumentBytes ?? 0);

  cachedAppStorageMetrics = {
    appCacheBytes,
    appDocumentBytes,
    appStorageBytes,
  };
  lastAppStorageCollectedAt = now;

  return cachedAppStorageMetrics;
}

export function readHighResolutionNowMs(): number {
  const timestamp = getRuntimePerformance()?.now?.();

  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return timestamp;
  }

  return Date.now();
}

export async function createPredictionResourceUsageSnapshot(
  inferenceDurationMs: number,
  sampleIntervalMs: number
): Promise<PredictionResourceUsage> {
  const appMetrics = await readAppSpecificMetrics();
  const appStorageMetrics = await readAppStorageMetrics();
  const deviceMetrics = await readNativeDeviceMetrics();

  // Ưu tiên metrics của app, nếu không thì dùng metrics của device
  const appUsedRamMB = bytesToMB(appMetrics?.appMemoryUsageBytes ?? null);
  const appTotalRamMB = bytesToMB(appMetrics?.appMemoryLimitBytes ?? null);
  const appCpuUsagePercent = appMetrics?.appCpuUsagePercent ?? null;
  const appCacheBytes = appStorageMetrics.appCacheBytes;
  const appDocumentBytes = appStorageMetrics.appDocumentBytes;
  const appStorageBytes = appStorageMetrics.appStorageBytes;
  const cpuCoreClockGhzList = appMetrics?.cpuCoreClockGhzList ?? null;
  const cpuCoreCount = appMetrics?.cpuCoreCount ?? null;
  const appThreadCount = appMetrics?.threadCount ?? null;
  const gpuUtilizationPercent = appMetrics?.gpuUtilizationPercent ?? null;
  const vramUsedBytes = appMetrics?.vramUsedBytes ?? null;
  const batteryDrainMilliwatts = appMetrics?.batteryDrainMilliwatts ?? null;
  const batteryDrainMahPerHour = appMetrics?.batteryDrainMahPerHour ?? null;
  const batteryCurrentMilliamps = appMetrics?.batteryCurrentMilliamps ?? null;
  const batteryVoltageVolts = appMetrics?.batteryVoltageVolts ?? null;
  const batteryIsCharging = appMetrics?.batteryIsCharging ?? null;

  const appUsedRamPercent =
    appUsedRamMB !== null && appTotalRamMB !== null ? toPercent(appUsedRamMB, appTotalRamMB) : null;

  // Metrics của device (fallback nếu app metrics không available)
  const totalRamBytes =
    deviceMetrics?.totalRamBytes ?? normalizePositiveNumber(Device.totalMemory);
  const usedRamBytes =
    deviceMetrics?.usedRamBytes ?? normalizePositiveNumber(getRuntimePerformance()?.memory?.usedJSHeapSize);

  const totalStorageBytes =
    deviceMetrics?.totalStorageBytes ?? normalizePositiveNumber(Paths.totalDiskSpace);
  const freeStorageBytes =
    deviceMetrics?.freeStorageBytes ?? normalizePositiveNumber(Paths.availableDiskSpace);

  const usedStorageBytes =
    totalStorageBytes !== null && freeStorageBytes !== null
      ? Math.max(totalStorageBytes - freeStorageBytes, 0)
      : null;

  const normalizedDuration = Math.max(0, Number(inferenceDurationMs.toFixed(3)));

  const estimatedCpuLoadPercent =
    sampleIntervalMs <= 0 ? 0 : toPercent(normalizedDuration, sampleIntervalMs);

  return {
    timestamp: Date.now(),
    inferenceDurationMs: normalizedDuration,
    estimatedCpuLoadPercent,
    appUsedRamMB,
    appTotalRamMB,
    appUsedRamPercent,
    appCpuUsagePercent,
    appCacheBytes,
    appDocumentBytes,
    appStorageBytes,
    appStorageMB: bytesToMB(appStorageBytes),
    cpuCoreClockGhzList,
    cpuCoreCount,
    appThreadCount,
    gpuUtilizationPercent,
    vramUsedBytes,
    batteryDrainMilliwatts,
    batteryDrainMahPerHour,
    batteryCurrentMilliamps,
    batteryVoltageVolts,
    batteryIsCharging,
    usedRamBytes,
    totalRamBytes,
    usedRamPercent:
      usedRamBytes !== null && totalRamBytes !== null ? toPercent(usedRamBytes, totalRamBytes) : null,
    usedStorageBytes,
    totalStorageBytes,
    usedStoragePercent:
      usedStorageBytes !== null && totalStorageBytes !== null
        ? toPercent(usedStorageBytes, totalStorageBytes)
        : null,
  };
}
