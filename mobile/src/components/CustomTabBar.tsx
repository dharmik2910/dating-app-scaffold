import React from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useNotification } from '@/context/NotificationContext';

const TAB_CONFIG: Record<
  string,
  { title: string; icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap }
> = {
  index: { title: 'Discover', icon: 'flame', iconOutline: 'flame-outline' },
  matches: { title: 'Matches', icon: 'heart', iconOutline: 'heart-outline' },
  chats: { title: 'Chats', icon: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
  profile: { title: 'Profile', icon: 'person', iconOutline: 'person-outline' },
};

type CustomTabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
};

export default function CustomTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { translateY } = useTabBarVisibility();
  const { unreadCount } = useNotification();
  const isWeb = Platform.OS === 'web';
  const bottomPadding = isWeb ? 8 : Math.max(insets.bottom, 6);
  const tabHeight = isWeb ? 68 : 60 + bottomPadding;

  const currentRoute = state.routes[state.index];
  const currentDescriptor = descriptors[currentRoute.key];

  // If current route specifies display: 'none' (e.g. auth, onboarding, chat detail), don't show tab bar
  if (currentDescriptor?.options?.tabBarStyle && (currentDescriptor.options.tabBarStyle as any).display === 'none') {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.tabBarContainer,
        {
          height: tabHeight,
          paddingBottom: bottomPadding,
          transform: [{ translateY }],
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const config = TAB_CONFIG[route.name];
        if (!config) return null; // Ignore hidden routes (like auth, chat/[id], onboarding)

        const isFocused = state.index === index;
        const iconName = isFocused ? config.icon : config.iconOutline;
        const color = isFocused ? '#f43f5e' : '#a1a1aa';
        const hasUnread = route.name === 'chats' && unreadCount > 0;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tabButton}
          >
            <View style={{ position: 'relative' }}>
              <Ionicons name={iconName} size={22} color={color} />
              {hasUnread && (
                <View style={styles.unreadBadgeDot} />
              )}
            </View>
            <Text style={[styles.tabLabel, { color }, isFocused && styles.tabLabelFocused]}>
              {config.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#09090b',
    borderTopColor: '#18181b',
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 999,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    marginTop: 3,
  },
  tabLabelFocused: {
    fontWeight: '700',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f43f5e',
    borderWidth: 1.5,
    borderColor: '#09090b',
  },
});
