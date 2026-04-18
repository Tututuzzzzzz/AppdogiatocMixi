import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';

function TrackingTabIcon({ color }: Readonly<{ color: string }>) {
  return <IconSymbol size={28} name="house.fill" color={color} />;
}

function HistoryTabIcon({ color }: Readonly<{ color: string }>) {
  return <IconSymbol size={28} name="clock.fill" color={color} />;
}

function AnalyticsTabIcon({ color }: Readonly<{ color: string }>) {
  return <IconSymbol size={28} name="chart.bar.fill" color={color} />;
}

function AccountTabIcon({ color }: Readonly<{ color: string }>) {
  return <IconSymbol size={28} name="person.crop.circle.fill" color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#D5EAE2',
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.sansSemiBold,
          fontSize: 12,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Theo dõi',
          tabBarIcon: TrackingTabIcon,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Lịch sử',
          tabBarIcon: HistoryTabIcon,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Thống kê',
          tabBarIcon: AnalyticsTabIcon,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarIcon: AccountTabIcon,
        }}
      />
    </Tabs>
  );
}
