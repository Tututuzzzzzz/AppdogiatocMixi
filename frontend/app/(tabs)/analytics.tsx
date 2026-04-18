import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import {
  fetchActivityHistory,
  fetchActivityStats,
} from '@/src/modules/backend/api/mobile-backend-api';
import { useAuthContext } from '@/src/modules/backend/context/auth-context';
import type {
  ActivityLogItem,
  ActivityStatsResponse,
} from '@/src/modules/backend/types';

const palette = {
  screen: '#F2FBF8',
  card: '#FFFFFF',
  cardBorder: '#D2E7DE',
  textPrimary: '#163126',
  textSecondary: '#4B6B5E',
  accent: '#0BA372',
  accentSoft: '#E7F8EF',
  warning: '#B86100',
  danger: '#B42318',
  track: '#E5F1EC',
};

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('vi-VN');
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function toPercentWidth(value: number): `${number}%` {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  return `${normalized}%`;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function computeAverageConfidence(items: ActivityLogItem[]): number {
  if (items.length === 0) {
    return 0;
  }

  const total = items.reduce((sum, item) => sum + clampConfidence(item.confidence), 0);
  return total / items.length;
}

export default function AnalyticsScreen() {
  const { session } = useAuthContext();
  const hasSession = session !== null;

  const [history, setHistory] = useState<ActivityLogItem[]>([]);
  const [stats, setStats] = useState<ActivityStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!session) {
      setHistory([]);
      setStats(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [historyResponse, statsResponse] = await Promise.all([
        fetchActivityHistory(session.accessToken, session.user.id, 80, 0),
        fetchActivityStats(session.accessToken, session.user.id),
      ]);

      setHistory(historyResponse.items);
      setStats(statsResponse);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu analytics.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData().catch(() => {
      setError('Không thể tải dữ liệu analytics.');
      setIsLoading(false);
    });
  }, [loadData]);

  const topActivity = useMemo(() => {
    if (!stats || stats.activities.length === 0) {
      return null;
    }

    return stats.activities[0];
  }, [stats]);

  return (
    <View style={[styles.screen, { backgroundColor: palette.screen }]}>
      <View style={[styles.backgroundBlobTop, { backgroundColor: '#DDF5EA' }]} />
      <View style={[styles.backgroundBlobBottom, { backgroundColor: '#D0EEE2' }]} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>ANALYTICS</Text>
          <Text style={[styles.title, { color: palette.textPrimary }]}>Thống kê hoạt động</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Dữ liệu được lấy trực tiếp</Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Tổng quan</Text>
            <Pressable
              onPress={() => {
                loadData().catch(() => {
                  setError('Không thể tải dữ liệu analytics.');
                });
              }}
              style={({ pressed }) => [
                styles.refreshButton,
                {
                  backgroundColor: palette.accentSoft,
                  borderColor: `${palette.accent}66`,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <Text style={[styles.refreshButtonText, { color: palette.accent }]}>
                {isLoading ? 'Đang tải...' : 'Làm mới'}
              </Text>
            </Pressable>
          </View>

          {hasSession ? (
            <>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Tổng logs</Text>
                  <Text style={[styles.summaryValue, { color: palette.textPrimary }]}>{stats?.totalLogs ?? 0}</Text>
                </View>
                <View style={[styles.summaryCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Lịch sử đã tải</Text>
                  <Text style={[styles.summaryValue, { color: palette.textPrimary }]}>{history.length}</Text>
                </View>
                <View style={[styles.summaryCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Hoạt động phổ biến</Text>
                  <Text style={[styles.summaryValue, { color: palette.textPrimary }]}>{topActivity?.activity ?? '--'}</Text>
                </View>
                <View style={[styles.summaryCell, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Độ tin cậy TB</Text>
                  <Text style={[styles.summaryValue, { color: palette.textPrimary }]}>
                    {formatPercent(computeAverageConfidence(history))}
                  </Text>
                </View>
              </View>

              {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}
            </>
          ) : (
            <Text style={[styles.emptyText, { color: palette.warning }]}>Hãy đăng nhập ở tab Tài khoản để xem thống kê backend.</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Phân bố activity</Text>
          {!stats || stats.activities.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>Chưa có dữ liệu thống kê từ backend.</Text>
          ) : (
            <View style={styles.statsList}>
              {stats.activities.map((item) => {
                const ratio = stats.totalLogs === 0 ? 0 : (item.count / stats.totalLogs) * 100;

                return (
                  <View key={item.activity} style={styles.statsRow}>
                    <Text style={[styles.statsLabel, { color: palette.textPrimary }]}>{item.activity}</Text>
                    <View style={[styles.statsTrack, { backgroundColor: palette.track }]}>
                      <View
                        style={[
                          styles.statsFill,
                          {
                            backgroundColor: palette.accent,
                            width: toPercentWidth(ratio),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.statsMeta, { color: palette.textSecondary }]}>{item.count}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
          <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Lịch sử activity gần đây</Text>
          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>Chưa có history từ backend.</Text>
          ) : (
            <View style={styles.historyList}>
              {history.slice(0, 30).map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={[styles.historyDot, { backgroundColor: palette.accent }]} />
                  <View style={styles.historyBody}>
                    <Text style={[styles.historyTitle, { color: palette.textPrimary }]}>
                      {item.activity} ({formatPercent(Math.max(0, Math.min(1, item.confidence)))})
                    </Text>
                    <Text style={[styles.historyMeta, { color: palette.textSecondary }]}>Timestamp: {formatDateTime(item.timestamp)}</Text>
                  </View>
                </View>
              ))}
            </View>
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
    top: -110,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: -170,
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
    fontSize: 32,
    lineHeight: 37,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#103225',
    shadowOpacity: 0.07,
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
  refreshButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryCell: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  summaryLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  summaryValue: {
    fontFamily: Fonts.rounded,
    fontSize: 17,
  },
  errorText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 22,
  },
  statsList: {
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statsLabel: {
    width: 90,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  statsTrack: {
    flex: 1,
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
  },
  statsFill: {
    height: '100%',
    borderRadius: 999,
  },
  statsMeta: {
    width: 32,
    textAlign: 'right',
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 8,
  },
  historyBody: {
    flex: 1,
    gap: 3,
  },
  historyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
  },
  historyMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
});
