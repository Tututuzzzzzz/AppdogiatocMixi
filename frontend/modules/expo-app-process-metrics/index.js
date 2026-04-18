import { requireOptionalNativeModule } from 'expo-modules-core';

const nativeModule = requireOptionalNativeModule('ExpoAppProcessMetrics');

export async function getProcessCpuUsagePercent() {
  if (!nativeModule?.getProcessCpuUsagePercent) {
    return null;
  }

  try {
    return await nativeModule.getProcessCpuUsagePercent();
  } catch {
    return null;
  }
}

export async function getRuntimeMetrics() {
  if (!nativeModule?.getRuntimeMetrics) {
    return null;
  }

  try {
    return await nativeModule.getRuntimeMetrics();
  } catch {
    return null;
  }
}

export async function resetCpuSampler() {
  if (!nativeModule?.resetCpuSampler) {
    return false;
  }

  try {
    return await nativeModule.resetCpuSampler();
  } catch {
    return false;
  }
}

export default {
  getProcessCpuUsagePercent,
  getRuntimeMetrics,
  resetCpuSampler,
};
