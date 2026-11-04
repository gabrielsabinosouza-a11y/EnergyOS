import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, motion, radii, shadows } from '@/theme';
import { supportsBlur } from './platform';

export function FloatingTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const routes = state.routes.filter((route) => route.name !== 'more');
  const selectedTab = routes.findIndex((route) => route.key === state.routes[state.index]?.key);
  const activeIndex = useSharedValue(Math.max(0, selectedTab));
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    if (selectedTab < 0) return;
    activeIndex.value = reducedMotion
      ? withTiming(selectedTab, { duration: 0 })
      : withSpring(selectedTab, motion.spring.snappy);
  }, [activeIndex, reducedMotion, selectedTab]);

  const handleLayout = (event: LayoutChangeEvent) => setBarWidth(event.nativeEvent.layout.width);
  const itemWidth = routes.length ? barWidth / routes.length : 0;
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: selectedTab < 0 ? 0 : 1,
    transform: [{ translateX: activeIndex.value * itemWidth }],
  }), [itemWidth, selectedTab]);

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View onLayout={handleLayout} style={styles.bar}>
        {supportsBlur ? <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} /> : null}
        <View pointerEvents="none" style={styles.barTint} />
        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, { width: itemWidth }, indicatorStyle]}
        />
        {routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.routes[state.index]?.key === route.key;
          const label = typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;
          return (
            <TabButton
              activeIndex={activeIndex}
              focused={focused}
              index={index}
              key={route.key}
              label={label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  void Haptics.selectionAsync();
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              options={options}
            />
          );
        })}
      </View>
    </View>
  );
}

type TabButtonProps = {
  activeIndex: Animated.SharedValue<number>;
  focused: boolean;
  index: number;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
  options: BottomTabBarProps['descriptors'][string]['options'];
};

function TabButton({
  activeIndex,
  focused,
  index,
  label,
  onLongPress,
  onPress,
  options,
}: TabButtonProps) {
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(
        activeIndex.value,
        [index - 1, index, index + 1],
        [1, 1.12, 1],
        Extrapolation.CLAMP,
      ),
    }],
    opacity: interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [0.72, 1, 0.72],
      Extrapolation.CLAMP,
    ),
  }), [index]);
  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeIndex.value,
      [index - 1, index, index + 1],
      [colors.textMuted, colors.primary, colors.textMuted],
    ),
  }), [index]);

  return (
    <Pressable
      accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}>
      <Animated.View style={iconStyle}>
        {options.tabBarIcon?.({
          focused,
          color: focused ? colors.primary : colors.textMuted,
          size: 22,
        })}
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, colorStyle, focused && styles.activeLabel]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  bar: {
    ...shadows.floating,
    alignItems: 'center',
    backgroundColor: 'rgba(10,20,36,0.82)',
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: 66,
    overflow: 'hidden',
  },
  barTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,20,36,0.32)',
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  indicator: {
    backgroundColor: 'rgba(113,212,255,0.13)',
    borderRadius: radii.md,
    height: 52,
    left: 0,
    position: 'absolute',
    top: 6,
  },
  tab: { alignItems: 'center', flex: 1, gap: 3, justifyContent: 'center', minHeight: 60, zIndex: 1 },
  label: { fontSize: 10, fontWeight: '500', maxWidth: '100%' },
  activeLabel: { fontWeight: '700' },
});
