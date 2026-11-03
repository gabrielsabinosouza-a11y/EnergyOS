import type { PropsWithChildren } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

type ScreenProps = PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
}>;

export function Screen({
  children,
  contentContainerStyle,
  refreshControl,
  scroll = true,
}: ScreenProps) {
  const theme = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, gap: 20, paddingHorizontal: 20, paddingBottom: 28, paddingTop: 12 },
  fill: { flex: 1 },
});
