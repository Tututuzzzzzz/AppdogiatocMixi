export declare function getProcessCpuUsagePercent(): Promise<number | null>;
export interface AppProcessRuntimeMetrics {
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
}

export declare function getRuntimeMetrics(): Promise<AppProcessRuntimeMetrics | null>;
export declare function resetCpuSampler(): Promise<boolean>;

declare const _default: {
  getProcessCpuUsagePercent: typeof getProcessCpuUsagePercent;
  getRuntimeMetrics: typeof getRuntimeMetrics;
  resetCpuSampler: typeof resetCpuSampler;
};

export default _default;
