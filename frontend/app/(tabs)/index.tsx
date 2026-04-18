import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { BEHAVIOR_TEXT } from '@/src/modules/activity-recognition/ai/behavior-model';
import { useActivityMonitorContext } from '@/src/modules/activity-recognition/context/activity-monitor-context';
import type { BehaviorLabel } from '@/src/modules/activity-recognition/types';

type Palette = {
  screen: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  muted: string;
  chartTrack: string;
  chartFill: string;
};

const LIGHT_PALETTE: Palette = {
  screen: '#F1FBF7',
  card: '#FFFFFF',
  cardBorder: '#D2E7DE',
  textPrimary: '#183428',
  textSecondary: '#507163',
  accent: '#0BA372',
  accentSoft: '#E6F8EF',
  success: '#0BA372',
  warning: '#B86100',
  muted: '#85A699',
  chartTrack: '#E5F1EC',
  chartFill: '#0BA372',
};

const BEHAVIOR_ORDER: BehaviorLabel[] = ['walking', 'running', 'upstairs', 'downstairs', 'sitting', 'standing'];

function resolveSensorStatus(
  isSensorAvailable: boolean | null,
  isRunning: boolean,
  palette: Palette
): { text: string; color: string } {
  if (isSensorAvailable === false) {
    return {
      text: 'Cảm biến không khả dụng',
      color: palette.warning,
    };
  }

  if (isRunning) {
    return {
      text: 'Đang đo trực tiếp',
      color: palette.success,
    };
  }

  if (isSensorAvailable) {
    return {
      text: 'Sẵn sàng',
      color: palette.muted,
    };
  }

  return {
    text: 'Đang kiểm tra cảm biến',
    color: palette.muted,
  };
}

function getCpuUsageMetaText(appCpuUsagePercent: number | null): string {
  if (appCpuUsagePercent === null) {
    return 'Ước tính theo độ trễ suy luận';
  }

  return 'Process-level từ native module';
}

function getBatteryMetaText(resourceUsage: {
  batteryIsCharging: boolean | null;
  batteryDrainMahPerHour: number | null;
  batteryCurrentMilliamps: number | null;
  batteryVoltageVolts: number | null;
}): string {
  if (resourceUsage.batteryIsCharging) {
    return 'Đang sạc';
  }

  return `${formatDrainMahPerHour(resourceUsage.batteryDrainMahPerHour)} | ${formatCurrentMilliamps(resourceUsage.batteryCurrentMilliamps)} @ ${formatVoltageVolts(resourceUsage.batteryVoltageVolts)}`;
}

function formatAxisValue(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return value.toFixed(3);
}

function formatPercentage(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return '0%';
  }

  return `${Math.round(value * 100)}%`;
}

function formatSystemPercentage(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(1)}%`;
}

function formatInferenceDuration(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(2)} ms`;
}

function formatBytes(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value) || value < 0) {
    return '--';
  }

  if (value === 0) {
    return '0 B';
  }

  const gib = value / (1024 ** 3);
  if (gib >= 1) {
    return `${gib.toFixed(2)} GB`;
  }

  const mib = value / (1024 ** 2);
  return `${mib.toFixed(0)} MB`;
}

function formatBytesPair(used?: number | null, total?: number | null): string {
  return `${formatBytes(used)} / ${formatBytes(total)}`;
}

function formatMegabytes(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value) || value < 0) {
    return '--';
  }

  if (value === 0) {
    return '0 MB';
  }

  return `${value.toFixed(2)} MB`;
}

function formatMegabytesPair(used?: number | null, total?: number | null): string {
  return `${formatMegabytes(used)} / ${formatMegabytes(total)}`;
}

function formatThreadCount(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${Math.floor(value)}`;
}

function formatClockSpeedMain(values?: number[] | null): string {
  if (!values || values.length === 0) {
    return '--';
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return `${average.toFixed(2)} GHz`;
}

function formatClockSpeedMeta(values?: number[] | null, coreCount?: number | null): string {
  if (!values || values.length === 0) {
    return '--';
  }

  const preview = values.slice(0, 4).map((value) => value.toFixed(2)).join(' | ');
  const suffix = values.length > 4 ? ' ...' : '';
  const resolvedCoreCount = coreCount ?? values.length;

  return `${resolvedCoreCount} core: ${preview}${suffix}`;
}

function formatPowerMilliwatts(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(1)} mW`;
}

function formatCurrentMilliamps(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(1)} mA`;
}

function formatDrainMahPerHour(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(1)} mAh/h`;
}

function formatVoltageVolts(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toFixed(3)} V`;
}

function toPercentWidth(value?: number): `${number}%` {
  if (value === undefined || Number.isNaN(value)) {
    return '0%';
  }

  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  return `${percent}%`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('vi-VN');
}

export default function HomeScreen() {
  const palette = LIGHT_PALETTE;

  const {
    isSensorAvailable,
    isRunning,
    latestSample,
    prediction,
    resourceUsage,
    events,
    error,
    toggleMonitoring,
  } = useActivityMonitorContext();

  const orderedProbabilities = useMemo(() => {
    return BEHAVIOR_ORDER.map((label) => ({
      label,
      probability: prediction?.probabilities[label] ?? 0,
    }));
  }, [prediction]);

  const sensorStatus = resolveSensorStatus(isSensorAvailable, isRunning, palette);

  return (
    <View style={[styles.screen, { backgroundColor: palette.screen }]}>
      <View style={[styles.backgroundBlobTop, { backgroundColor: palette.accentSoft }]} />
      <View style={[styles.backgroundBlobBottom, { backgroundColor: '#D7F3E8' }]} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>AI NHẬN DIỆN HÀNH VI</Text>
          <Text style={[styles.title, { color: palette.textPrimary }]}>Theo dõi gia tốc kế</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Đo chuyển động và phân loại hành vi ngay trên thiết bị bằng mô hình AI gọn nhẹ.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Trạng thái cảm biến</Text>
            <View style={[styles.badge, { backgroundColor: `${sensorStatus.color}22`, borderColor: `${sensorStatus.color}66` }]}>
              <Text style={[styles.badgeText, { color: sensorStatus.color }]}>{sensorStatus.text}</Text>
            </View>
          </View>

          <Pressable
            onPress={toggleMonitoring}
            style={({ pressed }) => [
              styles.toggleButton,
              {
                backgroundColor: isRunning ? '#B42318' : palette.accent,
                opacity: pressed ? 0.9 : 1,
              },
            ]}>
            <Text style={styles.toggleButtonText}>{isRunning ? 'Dừng đo' : 'Bắt đầu đo'}</Text>
          </Pressable>

          <Text style={[styles.helpText, { color: palette.textSecondary }]}>Cầm điện thoại trên tay hoặc để trong túi và di chuyển tự nhiên để xem cập nhật hành vi.</Text>
          {error ? <Text style={[styles.errorText, { color: '#B42318' }]}>{error}</Text> : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Hành vi hiện tại</Text>
          <Text style={[styles.behaviorText, { color: palette.textPrimary }]}>
            {prediction ? BEHAVIOR_TEXT[prediction.label] : 'Chưa có dự đoán'}
          </Text>

          <View style={styles.progressBlock}>
            <View style={[styles.progressTrack, { backgroundColor: palette.chartTrack }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: palette.chartFill,
                    width: toPercentWidth(prediction?.confidence),
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
              Độ tin cậy {formatPercentage(prediction?.confidence)}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Tài nguyên khi dự đoán</Text>
          {resourceUsage ? (
            <>
              <View style={styles.systemMetricGrid}>
                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>CPU app</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}>
                    {formatSystemPercentage(
                      resourceUsage.appCpuUsagePercent ?? resourceUsage.estimatedCpuLoadPercent
                    )}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}> 
                    {getCpuUsageMetaText(resourceUsage.appCpuUsagePercent)}
                  </Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>Độ trễ suy luận</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}>
                    {formatInferenceDuration(resourceUsage.inferenceDurationMs)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}>Cập nhật ~1 giây/lần</Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>RAM app đã dùng</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}>
                    {resourceUsage.appUsedRamMB !== null && resourceUsage.appTotalRamMB !== null
                      ? formatMegabytesPair(resourceUsage.appUsedRamMB, resourceUsage.appTotalRamMB)
                      : formatBytesPair(resourceUsage.usedRamBytes, resourceUsage.totalRamBytes)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}>
                    {resourceUsage.appUsedRamPercent === null
                      ? formatSystemPercentage(resourceUsage.usedRamPercent)
                      : formatSystemPercentage(resourceUsage.appUsedRamPercent)}
                  </Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>Storage app</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}>
                    {formatBytes(resourceUsage.appStorageBytes)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}>
                    Cache {formatBytes(resourceUsage.appCacheBytes)} | Doc {formatBytes(resourceUsage.appDocumentBytes)}
                  </Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}> 
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>Clock Speed</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}> 
                    {formatClockSpeedMain(resourceUsage.cpuCoreClockGhzList)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}> 
                    {formatClockSpeedMeta(resourceUsage.cpuCoreClockGhzList, resourceUsage.cpuCoreCount)}
                  </Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}> 
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>Thread Count</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}> 
                    {formatThreadCount(resourceUsage.appThreadCount)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}> 
                    CPU cores {resourceUsage.cpuCoreCount ?? '--'}
                  </Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}> 
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>GPU Utilization</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}> 
                    {formatSystemPercentage(resourceUsage.gpuUtilizationPercent)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}> 
                    Driver-level metric (best effort)
                  </Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}> 
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>VRAM</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}> 
                    {formatBytes(resourceUsage.vramUsedBytes)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}> 
                    Graphics memory used by app
                  </Text>
                </View>

                <View style={[styles.systemMetricCell, { backgroundColor: palette.accentSoft }]}> 
                  <Text style={[styles.systemMetricLabel, { color: palette.textSecondary }]}>Battery Drain</Text>
                  <Text style={[styles.systemMetricValue, { color: palette.textPrimary }]}> 
                    {formatPowerMilliwatts(resourceUsage.batteryDrainMilliwatts)}
                  </Text>
                  <Text style={[styles.systemMetricMeta, { color: palette.textSecondary }]}> 
                    {getBatteryMetaText(resourceUsage)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.systemMetricHint, { color: palette.textSecondary }]}>
                Một số thông số GPU/clock phụ thuộc quyền truy cập driver của thiết bị; nếu nhà sản xuất chặn sysfs thì sẽ hiển thị --.
              </Text>
            </>
          ) : (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              Bắt đầu đo để thu thập CPU, RAM và ROM khi mô hình dự đoán.
            </Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Giá trị gia tốc theo thời gian thực</Text>
          <View style={styles.metricGrid}>
            <View style={[styles.metricCell, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>X</Text>
              <Text style={[styles.metricValue, { color: palette.textPrimary }]}>{formatAxisValue(latestSample?.x)}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>Y</Text>
              <Text style={[styles.metricValue, { color: palette.textPrimary }]}>{formatAxisValue(latestSample?.y)}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>Z</Text>
              <Text style={[styles.metricValue, { color: palette.textPrimary }]}>{formatAxisValue(latestSample?.z)}</Text>
            </View>
            <View style={[styles.metricCell, { backgroundColor: palette.accentSoft }]}>
              <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>|a|</Text>
              <Text style={[styles.metricValue, { color: palette.textPrimary }]}>
                {formatAxisValue(latestSample?.magnitude)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Xác suất hành vi</Text>
          <View style={styles.probabilityList}>
            {orderedProbabilities.map((item) => (
              <View key={item.label} style={styles.probabilityRow}>
                <Text style={[styles.probabilityLabel, { color: palette.textPrimary }]}>
                  {BEHAVIOR_TEXT[item.label]}
                </Text>
                <View style={[styles.probabilityTrack, { backgroundColor: palette.chartTrack }]}>
                  <View
                    style={[
                      styles.probabilityFill,
                      {
                        backgroundColor: palette.chartFill,
                        width: `${Math.round(item.probability * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.probabilityPercent, { color: palette.textSecondary }]}>
                  {formatPercentage(item.probability)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Mốc thời gian gần đây</Text>
          {events.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>Chưa có sự kiện. Hãy bắt đầu đo để tạo lịch sử.</Text>
          ) : (
            events.slice(0, 8).map((event) => (
              <View key={event.id} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: palette.accent }]} />
                <View style={styles.timelineBody}>
                  <Text style={[styles.timelineTitle, { color: palette.textPrimary }]}>
                    {BEHAVIOR_TEXT[event.label]} ({formatPercentage(event.confidence)})
                  </Text>
                  <Text style={[styles.timelineMeta, { color: palette.textSecondary }]}>
                    {formatTime(event.timestamp)} · Giá trị trung bình |a| {event.meanMagnitude.toFixed(3)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  backgroundBlobTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: -160,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  content: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 62,
    paddingBottom: 42,
  },
  headerBlock: {
    gap: 6,
    marginBottom: 2,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 34,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#103225',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
  toggleButton: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  helpText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 20,
  },
  behaviorText: {
    fontFamily: Fonts.display,
    fontSize: 31,
    lineHeight: 36,
  },
  progressBlock: {
    gap: 6,
  },
  progressTrack: {
    width: '100%',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCell: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  metricLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  metricValue: {
    fontFamily: Fonts.rounded,
    fontSize: 22,
  },
  systemMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  systemMetricCell: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  systemMetricLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  systemMetricValue: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 20,
  },
  systemMetricMeta: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    lineHeight: 16,
  },
  systemMetricHint: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  probabilityList: {
    gap: 10,
  },
  probabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  probabilityLabel: {
    width: 104,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  probabilityTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
    borderRadius: 999,
  },
  probabilityPercent: {
    width: 36,
    textAlign: 'right',
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 22,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  timelineBody: {
    flex: 1,
    gap: 3,
  },
  timelineTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
  },
  timelineMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
});
