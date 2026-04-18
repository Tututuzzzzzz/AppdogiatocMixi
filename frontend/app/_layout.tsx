import { BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold, BeVietnamPro_800ExtraBold, useFonts } from '@expo-google-fonts/be-vietnam-pro';
import { DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { ActivityMonitorProvider } from '@/src/modules/activity-recognition/context/activity-monitor-context';
import { AuthProvider } from '@/src/modules/backend/context/auth-context';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

const BrightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.background,
    border: '#D5EAE2',
    card: '#FFFFFF',
    primary: Colors.light.tint,
    text: Colors.light.text,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontLoadingError] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    BeVietnamPro_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontLoadingError) {
      void SplashScreen.hideAsync();
    }
  }, [fontLoadingError, fontsLoaded]);

  if (!fontsLoaded && !fontLoadingError) {
    return null;
  }

  return (
    <AuthProvider>
      <ActivityMonitorProvider>
        <ThemeProvider value={BrightTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Cửa sổ nổi' }} />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </ActivityMonitorProvider>
    </AuthProvider>
  );
}
