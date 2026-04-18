/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0A9E72';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#163126',
    background: '#F2FBF8',
    tint: tintColorLight,
    icon: '#5F7C70',
    tabIconDefault: '#6D877C',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'BeVietnamPro_400Regular',
    sansMedium: 'BeVietnamPro_500Medium',
    sansSemiBold: 'BeVietnamPro_600SemiBold',
    rounded: 'BeVietnamPro_700Bold',
    display: 'BeVietnamPro_800ExtraBold',
    serif: 'BeVietnamPro_400Regular',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'BeVietnamPro_400Regular',
    sansMedium: 'BeVietnamPro_500Medium',
    sansSemiBold: 'BeVietnamPro_600SemiBold',
    rounded: 'BeVietnamPro_700Bold',
    display: 'BeVietnamPro_800ExtraBold',
    serif: 'BeVietnamPro_400Regular',
    mono: 'monospace',
  },
  web: {
    sans: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    sansMedium: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    sansSemiBold: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    rounded: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    display: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    serif: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
