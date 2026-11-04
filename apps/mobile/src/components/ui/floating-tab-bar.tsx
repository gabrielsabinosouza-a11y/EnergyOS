import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname, Tabs } from 'expo-router';
import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigationItems } from '@/shared/navigation-config';
import { colors, motion, radii, shadows } from '@/theme';
import { NavIcon } from '@/shared/components';
import { supportsBlur } from './platform';

type FloatingTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type NavId = (typeof navigationItems)[number]['id'];

const TAB_WIDTH = 76;
const TAB_ROUTE_NAMES: Partial<Record<NavId, string>> = {
  overview: 'index',
  planner: 'planner',
  focusRooms: 'focus',
  friends: 'social',
  profile: 'profile',
};

export function FloatingTabBar({ descriptors, navigation, state }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Partial<Record<NavId, { x: number; width: number }>>>({});
  const firstScroll = useRef(true);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollOffset = useSharedValue(0);
  const contentWidth = useSharedValue(0);
  const viewportWidthValue = useSharedValue(0);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const activeIndex = useSharedValue(0);

  const activeItem = navigationItems.find((item) => {
    const routePath = item.mobileRoute.replace(/^\//, '');
    const currentPath = pathname.replace(/^\//, '');
    if (!routePath) return !currentPath;
    return currentPath === routePath || currentPath.startsWith(`${routePath}/`);
  });
  const selectedIndex = activeItem ? navigationItems.indexOf(activeItem) : -1;

  useEffect(() => {
    if (selectedIndex < 0) return;
    const item = navigationItems[selectedIndex];
    const layout = layouts.current[item.id];
    if (!layout || viewportWidth <= 0) return;

    const targetX = Math.max(
      0,
      layout.x + layout.width / 2 - viewportWidth / 2,
    );
    scrollRef.current?.scrollTo({
      x: targetX,
      animated: !firstScroll.current && !reducedMotion,
    });
    firstScroll.current = false;
    activeIndex.value = reducedMotion
      ? withTiming(selectedIndex, { duration: 0 })
      : withSpring(selectedIndex, motion.spring.snappy);
    indicatorX.value = reducedMotion
      ? withTiming(layout.x, { duration: 0 })
      : withSpring(layout.x, motion.spring.snappy);
    indicatorWidth.value = reducedMotion
      ? withTiming(layout.width, { duration: 0 })
      : withSpring(layout.width, motion.spring.snappy);
  }, [
    activeIndex,
    indicatorWidth,
    indicatorX,
    layoutRevision,
    reducedMotion,
    selectedIndex,
    viewportWidth,
  ]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.x;
    },
  });

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorWidth.value > 0 ? 1 : 0,
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));
  const leftFadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(scrollOffset.value > 2 ? 1 : 0, { duration: 120 }),
  }));
  const rightFadeStyle = useAnimatedStyle(() => {
    const maxOffset = contentWidth.value - viewportWidthValue.value;
    const remaining = maxOffset - scrollOffset.value;
    return {
      opacity: withTiming(maxOffset > 2 && remaining > 8 ? 1 : 0, { duration: 120 }),
    };
  });

  function handleTabLayout(id: NavId, event: LayoutChangeEvent) {
    const { x, width } = event.nativeEvent.layout;
    const current = layouts.current[id];
    if (!current || Math.abs(current.x - x) > 1 || Math.abs(current.width - width) > 1) {
      layouts.current[id] = { x, width };
      setLayoutRevision((revision) => revision + 1);
    }
  }

  function handleViewportLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    setViewportWidth(width);
    viewportWidthValue.value = width;
  }

  function handleContentSizeChange(width: number) {
    contentWidth.value = width;
  }

  function handlePress(id: NavId, mobileRoute: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tabName = TAB_ROUTE_NAMES[id];
    const tabRoute = tabName && state.routes.find((route) => route.name === tabName);

    if (tabRoute) {
      const focused = state.routes[state.index]?.key === tabRoute.key;
      const event = navigation.emit({
        type: 'tabPress',
        target: tabRoute.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(tabRoute.name, tabRoute.params);
      }
      return;
    }
    
    // Fallback: try to find route by mobileRoute path
    const routeByPath = state.routes.find((route) => (
      route.name === mobileRoute ||
      route.name === mobileRoute.replace(/^\//, '')
    ));
    if (routeByPath) {
      const focused = state.routes[state.index]?.key === routeByPath.key;
      const event = navigation.emit({
        type: 'tabPress',
        target: routeByPath.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(routeByPath.name, routeByPath.params);
      }
      return;
    }
    
    // Last resort: use router.navigate with the mobile route
    router.navigate(mobileRoute as Href);
  }

  function handleLongPress(id: NavId) {
    const tabName = TAB_ROUTE_NAMES[id];
    const tabRoute = tabName && state.routes.find((route) => route.name === tabName);
    if (tabRoute) navigation.emit({ type: 'tabLongPress', target: tabRoute.key });
  }

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <LinearGradient
        colors={['rgba(113,212,255,0.38)', 'rgba(255,255,255,0.08)', 'rgba(113,212,255,0.18)']}
        style={styles.gradientBorder}
      >
        <View onLayout={handleViewportLayout} style={styles.bar}>
          {supportsBlur ? <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} /> : null}
          <View pointerEvents="none" style={styles.barTint} />
          <Animated.ScrollView
            ref={scrollRef}
            accessibilityLabel="Navegação principal"
            accessibilityRole="tablist"
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToAlignment="center"
            snapToInterval={TAB_WIDTH}
            decelerationRate="fast"
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: Math.max((viewportWidth - TAB_WIDTH) / 2, 6) },
            ]}
            onContentSizeChange={handleContentSizeChange}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            style={styles.scroll}
          >
            <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
            {navigationItems.map((item, index) => {
              const focused = activeItem?.id === item.id;
              const tabName = TAB_ROUTE_NAMES[item.id];
              const tabRoute = tabName && state.routes.find((route) => route.name === tabName);
              const options = tabRoute ? descriptors[tabRoute.key]?.options : undefined;
              return (
                <TabButton
                  accessibilityLabel={options?.tabBarAccessibilityLabel ?? item.label}
                  activeIndex={activeIndex}
                  focused={focused}
                  icon={item.icon}
                  index={index}
                  key={item.id}
                  label={item.shortLabel}
                  onLayout={(event) => handleTabLayout(item.id, event)}
                  onLongPress={() => handleLongPress(item.id)}
                  onPress={() => handlePress(item.id, item.mobileRoute)}
                />
              );
            })}
          </Animated.ScrollView>
          <Animated.View pointerEvents="none" style={[styles.edgeFade, styles.leftFade, leftFadeStyle]}>
            <LinearGradient
              colors={['rgba(10,20,36,0.9)', 'rgba(10,20,36,0)']}
              end={{ x: 1, y: 0.5 }}
              start={{ x: 0, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.edgeFade, styles.rightFade, rightFadeStyle]}>
            <LinearGradient
              colors={['rgba(10,20,36,0)', 'rgba(10,20,36,0.9)']}
              end={{ x: 1, y: 0.5 }}
              start={{ x: 0, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

type TabButtonProps = {
  accessibilityLabel: string;
  activeIndex: SharedValue<number>;
  focused: boolean;
  icon: (typeof navigationItems)[number]['icon'];
  index: number;
  label: string;
  onLayout: (event: LayoutChangeEvent) => void;
  onLongPress: () => void;
  onPress: () => void;
};

function TabButton({
  accessibilityLabel,
  activeIndex,
  focused,
  icon,
  index,
  label,
  onLayout,
  onLongPress,
  onPress,
}: TabButtonProps) {
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      activeIndex.value,
      [index - 1, index, index + 1],
      [0.72, 1, 0.72],
      Extrapolation.CLAMP,
    ),
    transform: [{
      scale: interpolate(
        activeIndex.value,
        [index - 1, index, index + 1],
        [1, 1.12, 1],
        Extrapolation.CLAMP,
      ),
    }],
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
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onLayout={onLayout}
      onLongPress={onLongPress}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <NavIcon color={focused ? colors.primary : colors.textMuted} name={icon} size={22} />
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
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  gradientBorder: {
    ...shadows.floating,
    borderRadius: radii.lg,
    padding: 1,
  },
  bar: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,20,36,0.82)',
    borderRadius: radii.lg - 1,
    height: 68,
    overflow: 'hidden',
  },
  barTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,20,36,0.28)',
    borderTopColor: 'rgba(255,255,255,0.10)',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scroll: {
    alignSelf: 'stretch',
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    height: 68,
  },
  indicator: {
    backgroundColor: 'rgba(113,212,255,0.13)',
    borderRadius: radii.md,
    height: 54,
    left: 0,
    position: 'absolute',
    top: 7,
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    height: 68,
    justifyContent: 'center',
    width: TAB_WIDTH,
    zIndex: 1,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '500',
    maxWidth: 68,
  },
  activeLabel: {
    fontWeight: '700',
  },
  edgeFade: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 26,
    zIndex: 2,
  },
  leftFade: { left: 0 },
  rightFade: { right: 0 },
});
