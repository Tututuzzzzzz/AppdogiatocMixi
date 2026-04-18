import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { BEHAVIOR_TEXT } from '@/src/modules/activity-recognition/ai/behavior-model';
import { useActivityMonitorContext } from '@/src/modules/activity-recognition/context/activity-monitor-context';
import type { BehaviorLabel, MeasurementSession } from '@/src/modules/activity-recognition/types';

const BEHAVIOR_ORDER: BehaviorLabel[] = ['walking', 'running', 'upstairs', 'downstairs', 'sitting', 'standing'];

type HistoryPalette = {
  screen: string;
  card: string;
  border: string;
  title: string;
  text: string;
  accent: string;
  accentSoft: string;
  warning: string;
  danger: string;
  track: string;
};

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('vi-VN');
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} giây`;
  }

  return `${minutes} phút ${seconds} giây`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildSessionSubtitle(session: MeasurementSession): string {
  return `Thời gian: ${formatDuration(session.durationMs)} | Mẫu: ${session.sampleCount}`;
}

type SessionListProps = {
  sessions: MeasurementSession[];
  palette: HistoryPalette;
  isHistoryLoading: boolean;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
};

function SessionList({
  sessions,
  palette,
  isHistoryLoading,
  selectedSessionId,
  onSelectSession,
}: Readonly<SessionListProps>) {
  const totalSessionCount = sessions.length;

  if (isHistoryLoading) {
    return <Text style={[styles.emptyText, { color: palette.text }]}>Đang tải lịch sử đo từ máy chủ...</Text>;
  }

  if (totalSessionCount === 0) {
    return (
      <Text style={[styles.emptyText, { color: palette.text }]}>
        Chưa có lần đo nào. Hãy bắt đầu đo ở tab Theo dõi để tạo lịch sử.
      </Text>
    );
  }

  return (
    <View style={styles.sessionList}>
      {sessions.map((session, index) => {
        const isSelected = selectedSessionId === session.id;

        return (
          <Pressable
            key={session.id}
            onPress={() => onSelectSession(session.id)}
            style={({ pressed }) => [
              styles.sessionItem,
              {
                borderColor: isSelected ? palette.accent : palette.border,
                backgroundColor: isSelected ? palette.accentSoft : palette.card,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <View style={styles.sessionHeader}>
              <Text style={[styles.sessionTitle, { color: palette.title }]}>Lần đo #{totalSessionCount - index}</Text>
              <Text style={[styles.sessionBehavior, { color: palette.accent }]}>
                {BEHAVIOR_TEXT[session.dominantBehavior]}
              </Text>
            </View>
            <Text style={[styles.sessionMeta, { color: palette.text }]}>{buildSessionSubtitle(session)}</Text>
            <Text style={[styles.sessionMeta, { color: palette.text }]}>{formatDateTime(session.startedAt)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type SessionDetailsProps = {
  selectedSession: MeasurementSession | null;
  palette: HistoryPalette;
};

function SessionDetails({ selectedSession, palette }: Readonly<SessionDetailsProps>) {
  if (selectedSession === null) {
    return (
      <Text style={[styles.emptyText, { color: palette.text }]}>Chọn một lần đo để xem thông số chi tiết.</Text>
    );
  }

  return (
    <>
      <View style={styles.detailGrid}>
        <View style={[styles.detailCell, { backgroundColor: palette.accentSoft }]}> 
          <Text style={[styles.detailLabel, { color: palette.text }]}>Bắt đầu</Text>
          <Text style={[styles.detailValue, { color: palette.title }]}>{formatDateTime(selectedSession.startedAt)}</Text>
        </View>
        <View style={[styles.detailCell, { backgroundColor: palette.accentSoft }]}> 
          <Text style={[styles.detailLabel, { color: palette.text }]}>Kết thúc</Text>
          <Text style={[styles.detailValue, { color: palette.title }]}>{formatDateTime(selectedSession.endedAt)}</Text>
        </View>
        <View style={[styles.detailCell, { backgroundColor: palette.accentSoft }]}> 
          <Text style={[styles.detailLabel, { color: palette.text }]}>Thời gian đo</Text>
          <Text style={[styles.detailValue, { color: palette.title }]}>{formatDuration(selectedSession.durationMs)}</Text>
        </View>
        <View style={[styles.detailCell, { backgroundColor: palette.accentSoft }]}> 
          <Text style={[styles.detailLabel, { color: palette.text }]}>Hành vi chủ đạo</Text>
          <Text style={[styles.detailValue, { color: palette.title }]}>
            {BEHAVIOR_TEXT[selectedSession.dominantBehavior]}
          </Text>
        </View>
      </View>

      <View style={styles.metricsList}>
        <Text style={[styles.metricLine, { color: palette.text }]}>Số mẫu thu: {selectedSession.sampleCount}</Text>
        <Text style={[styles.metricLine, { color: palette.text }]}>Số mốc sự kiện: {selectedSession.eventCount}</Text>
        <Text style={[styles.metricLine, { color: palette.text }]}>Độ lớn gia tốc trung bình: {selectedSession.averageMagnitude.toFixed(3)}</Text>
        <Text style={[styles.metricLine, { color: palette.text }]}>Độ lớn gia tốc nhỏ nhất: {selectedSession.minMagnitude.toFixed(3)}</Text>
        <Text style={[styles.metricLine, { color: palette.text }]}>Độ lớn gia tốc lớn nhất: {selectedSession.maxMagnitude.toFixed(3)}</Text>
        <Text style={[styles.metricLine, { color: palette.text }]}>Độ tin cậy trung bình: {formatPercent(selectedSession.averageConfidence)}</Text>
      </View>

      <View style={styles.distributionBlock}>
        <Text style={[styles.sectionTitle, { color: palette.title }]}>Phân bố dự đoán hành vi</Text>
        {BEHAVIOR_ORDER.map((label) => {
          const count = selectedSession.behaviorCounts[label];
          const ratio =
            selectedSession.sampleCount === 0 ? 0 : count / Math.max(selectedSession.sampleCount, 1);

          return (
            <View key={label} style={styles.distributionRow}>
              <Text style={[styles.distributionLabel, { color: palette.text }]}>{BEHAVIOR_TEXT[label]}</Text>
              <View style={[styles.distributionTrack, { backgroundColor: palette.track }]}> 
                <View
                  style={[
                    styles.distributionFill,
                    {
                      backgroundColor: palette.accent,
                      width: `${Math.round(ratio * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.distributionValue, { color: palette.text }]}>{count}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.eventBlock}>
        <Text style={[styles.sectionTitle, { color: palette.title }]}>Chi tiết các mốc sự kiện</Text>
        {selectedSession.events.length === 0 ? (
          <Text style={[styles.emptyText, { color: palette.text }]}>Phiên đo này không có mốc sự kiện nào.</Text>
        ) : (
          selectedSession.events.map((event) => (
            <View key={event.id} style={styles.eventItem}>
              <View style={[styles.eventDot, { backgroundColor: palette.warning }]} />
              <View style={styles.eventContent}>
                <Text style={[styles.eventTitle, { color: palette.title }]}>
                  {BEHAVIOR_TEXT[event.label]} ({formatPercent(event.confidence)})
                </Text>
                <Text style={[styles.eventMeta, { color: palette.text }]}> 
                  {formatDateTime(event.timestamp)} · |a| TB {event.meanMagnitude.toFixed(3)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );
}

export default function HistoryScreen() {
  const { sessions, isRunning, isHistoryLoading, clearSessionHistory } = useActivityMonitorContext();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const palette: HistoryPalette = {
    screen: '#F0FAF6',
    card: '#FFFFFF',
    border: '#D2E7DD',
    title: '#193528',
    text: '#4E6E60',
    accent: '#0BA372',
    accentSoft: '#E5F8EE',
    warning: '#B86100',
    danger: '#B42318',
    track: '#E4F0EA',
  };

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionId(null);
      return;
    }

    const hasSelectedSession = sessions.some((session) => session.id === selectedSessionId);
    if (!hasSelectedSession) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  const selectedSession = useMemo(() => {
    return sessions.find((session) => session.id === selectedSessionId) ?? null;
  }, [selectedSessionId, sessions]);

  const totalSessionCount = sessions.length;
  const hasSessions = totalSessionCount > 0;

  return (
    <View style={[styles.screen, { backgroundColor: palette.screen }]}>
      <View style={[styles.backgroundBlobTop, { backgroundColor: '#DFF4EA' }]} />
      <View style={[styles.backgroundBlobBottom, { backgroundColor: '#D0EFE2' }]} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={[styles.heroTag, { color: palette.accent }]}>LỊCH SỬ ĐO</Text>
          <Text style={[styles.heroTitle, { color: palette.title }]}>Theo dõi các lần đo và xem chi tiết</Text>
          <Text style={[styles.heroBody, { color: palette.text }]}>Chọn từng phiên đo để xem đầy đủ thông số về gia tốc, hành vi dự đoán và mốc sự kiện.</Text>
          {isRunning ? (
            <View style={[styles.runningBadge, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}> 
              <Text style={[styles.runningBadgeText, { color: palette.accent }]}>Hệ thống đang đo trực tiếp</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: palette.title }]}>Danh sách phiên đo ({totalSessionCount})</Text>
            {hasSessions ? (
              <Pressable onPress={() => clearSessionHistory()} style={({ pressed }) => [styles.clearButton, { borderColor: palette.danger, opacity: pressed ? 0.8 : 1 }]}> 
                <Text style={[styles.clearButtonText, { color: palette.danger }]}>Xóa lịch sử</Text>
              </Pressable>
            ) : null}
          </View>

          {hasSessions ? (
            <View style={styles.rangeActionsRow}>
              <Pressable
                onPress={() =>
                  clearSessionHistory({
                    startTimestamp: Date.now() - 24 * 60 * 60 * 1000,
                    endTimestamp: Date.now(),
                  })
                }
                style={({ pressed }) => [
                  styles.rangeButton,
                  {
                    borderColor: palette.accent,
                    backgroundColor: palette.accentSoft,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Text style={[styles.rangeButtonText, { color: palette.accent }]}>Xóa 24h gần nhất</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  clearSessionHistory({
                    startTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
                    endTimestamp: Date.now(),
                  })
                }
                style={({ pressed }) => [
                  styles.rangeButton,
                  {
                    borderColor: palette.accent,
                    backgroundColor: palette.accentSoft,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Text style={[styles.rangeButtonText, { color: palette.accent }]}>Xóa 7 ngày gần nhất</Text>
              </Pressable>
            </View>
          ) : null}

          <SessionList
            sessions={sessions}
            palette={palette}
            isHistoryLoading={isHistoryLoading}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSessionId}
          />
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}> 
          <Text style={[styles.cardTitle, { color: palette.title }]}>Chi tiết thông số phiên đo</Text>
          <SessionDetails selectedSession={selectedSession} palette={palette} />
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
    left: -100,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: -180,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  content: {
    paddingTop: 62,
    paddingHorizontal: 18,
    paddingBottom: 34,
    gap: 14,
  },
  hero: {
    gap: 8,
  },
  heroTag: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: Fonts.display,
    fontSize: 29,
    lineHeight: 35,
  },
  heroBody: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  runningBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  runningBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
  },
  clearButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
  rangeActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rangeButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  sessionList: {
    gap: 10,
  },
  sessionItem: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sessionTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },
  sessionBehavior: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  sessionMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailCell: {
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  detailLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  detailValue: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  metricsList: {
    gap: 4,
  },
  metricLine: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    marginBottom: 8,
  },
  distributionBlock: {
    gap: 8,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distributionLabel: {
    width: 80,
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
  distributionTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  distributionFill: {
    height: '100%',
    borderRadius: 999,
  },
  distributionValue: {
    width: 28,
    textAlign: 'right',
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  eventBlock: {
    gap: 8,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 7,
  },
  eventContent: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
  },
  eventMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
  },
});
