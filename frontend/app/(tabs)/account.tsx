import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useAuthContext } from '@/src/modules/backend/context/auth-context';

type Mode = 'login' | 'register';

const palette = {
  screen: '#F4FBF8',
  card: '#FFFFFF',
  cardBorder: '#D2E7DE',
  textPrimary: '#163126',
  textSecondary: '#4B6B5E',
  accent: '#0BA372',
  accentSoft: '#E8F8F0',
  danger: '#B42318',
};

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString('vi-VN');
}

export default function AccountScreen() {
  const {
    session,
    isLoading,
    isSubmitting,
    backendHealth,
    error,
    login,
    register,
    logout,
    refreshCurrentUser,
    checkBackendHealth,
    clearError,
  } = useAuthContext();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    checkBackendHealth().catch(() => {
      // Error is exposed via auth context.
    });
  }, [checkBackendHealth]);

  const modeText = useMemo(() => {
    return mode === 'login'
      ? {
          title: 'Đăng nhập',
          subtitle: 'Sử dụng tài khoản để gửi và xem activity trên backend.',
          action: 'Đăng nhập',
          switchText: 'Chưa có tài khoản? Đăng ký',
        }
      : {
          title: 'Đăng ký',
          subtitle: 'Tạo tài khoản mới để đồng bộ activity giữa các thiết bị.',
          action: 'Tạo tài khoản',
          switchText: 'Đã có tài khoản? Đăng nhập',
        };
  }, [mode]);

  const handleSubmit = async () => {
    clearError();

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password.trim()) {
      return;
    }

    if (mode === 'register') {
      await register({
        email: normalizedEmail,
        password,
        fullName: fullName.trim() || undefined,
      });
      return;
    }

    await login({
      email: normalizedEmail,
      password,
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.screen }]}>
      <View style={[styles.backgroundBlobTop, { backgroundColor: '#DFF4EA' }]} />
      <View style={[styles.backgroundBlobBottom, { backgroundColor: '#D2F0E4' }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.headerBlock}>
              <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>KẾT NỐI</Text>
              <Text style={[styles.title, { color: palette.textPrimary }]}>Tài khoản người dùng</Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                Quản lý đăng nhập, kiểm tra trạng thái máy chủ và truy cập hồ sơ cá nhân.
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
              <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Trạng thái</Text>
              <View style={styles.rowBetween}>
                <Text style={[styles.healthText, { color: backendHealth ? palette.accent : palette.danger }]}>
                  {backendHealth ? `Kết nối OK (${backendHealth})` : 'Chưa kiểm tra hoặc backend lỗi'}
                </Text>
                <Pressable
                  onPress={() => {
                    checkBackendHealth().catch(() => {
                      // Error is exposed via auth context.
                    });
                  }}
                  style={({ pressed }) => [
                    styles.smallButton,
                    {
                      backgroundColor: palette.accentSoft,
                      borderColor: `${palette.accent}55`,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Text style={[styles.smallButtonText, { color: palette.accent }]}>Kiểm tra lại</Text>
                </Pressable>
              </View>
            </View>

            {session ? (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>Thông tin tài khoản</Text>
                <View style={styles.userInfoBlock}>
                  <Text style={[styles.userInfoLine, { color: palette.textPrimary }]}>ID: {session.user.id}</Text>
                  <Text style={[styles.userInfoLine, { color: palette.textPrimary }]}>Email: {session.user.email}</Text>
                  <Text style={[styles.userInfoLine, { color: palette.textPrimary }]}>Tên: {session.user.fullName ?? '--'}</Text>
                  <Text style={[styles.userInfoLine, { color: palette.textPrimary }]}>Trạng thái: {session.user.isActive ? 'Hoạt động' : 'Khóa'}</Text>
                  <Text style={[styles.userInfoLine, { color: palette.textSecondary }]}>Tạo lúc: {formatDateTime(session.user.createdAt)}</Text>
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => {
                      refreshCurrentUser().catch(() => {
                        // Error is exposed via auth context.
                      });
                    }}
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: palette.accent,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}>
                    <Text style={styles.actionButtonText}>Làm mới hồ sơ</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      logout().catch(() => {
                        // Local storage operation only.
                      });
                    }}
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: palette.danger,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}>
                    <Text style={styles.actionButtonText}>Đăng xuất</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                <Text style={[styles.cardTitle, { color: palette.textPrimary }]}>{modeText.title}</Text>
                <Text style={[styles.cardHint, { color: palette.textSecondary }]}>{modeText.subtitle}</Text>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Email</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    style={[styles.input, { borderColor: palette.cardBorder, color: palette.textPrimary }]}
                    placeholderTextColor="#8AA79A"
                  />
                </View>

                {mode === 'register' ? (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Họ tên</Text>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Nguyen Van A"
                      style={[styles.input, { borderColor: palette.cardBorder, color: palette.textPrimary }]}
                      placeholderTextColor="#8AA79A"
                    />
                  </View>
                ) : null}

                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Mật khẩu</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Nhập mật khẩu"
                    style={[styles.input, { borderColor: palette.cardBorder, color: palette.textPrimary }]}
                    placeholderTextColor="#8AA79A"
                  />
                </View>

                {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

                <Pressable
                  onPress={() => {
                    handleSubmit().catch(() => {
                      // Error is exposed via auth context.
                    });
                  }}
                  disabled={isSubmitting || isLoading}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    {
                      backgroundColor: palette.accent,
                      opacity: (() => {
                        if (isSubmitting || isLoading) {
                          return 0.6;
                        }

                        return pressed ? 0.9 : 1;
                      })(),
                    },
                  ]}>
                  <Text style={styles.primaryButtonText}>{isSubmitting ? 'Đang xử lý...' : modeText.action}</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setMode((previousMode) => (previousMode === 'login' ? 'register' : 'login'));
                    clearError();
                  }}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    {
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}>
                  <Text style={[styles.secondaryButtonText, { color: palette.textSecondary }]}>{modeText.switchText}</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    bottom: -180,
    left: -120,
    width: 330,
    height: 330,
    borderRadius: 165,
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
    fontSize: 33,
    lineHeight: 38,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 22,
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
  cardHint: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  healthText: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 20,
  },
  smallButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
  },
  userInfoBlock: {
    gap: 6,
  },
  userInfoLine: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  errorText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  secondaryButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 20,
  },
});
