import React, { createContext, useContext, useRef, useCallback } from 'react';
import { Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

interface TabBarVisibilityContextType {
  translateY: Animated.Value;
  headerTranslateY: Animated.Value;
  showTabBar: () => void;
  hideTabBar: () => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | null>(null);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);

  const showTabBar = useCallback(() => {
    if (!isVisibleRef.current) {
      isVisibleRef.current = true;
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.spring(headerTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    }
  }, [translateY, headerTranslateY]);

  const hideTabBar = useCallback(() => {
    if (isVisibleRef.current) {
      isVisibleRef.current = false;
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 120,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.spring(headerTranslateY, {
          toValue: -90,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    }
  }, [translateY, headerTranslateY]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const prevY = lastScrollYRef.current;
      const diff = currentY - prevY;

      // When near the top of the screen, always show tab bar and top header
      if (currentY <= 15) {
        showTabBar();
      } else if (diff > 4 && currentY > 40) {
        // Scrolling DOWN -> Hide both top header and tab bar
        hideTabBar();
      } else if (diff < -2) {
        // Scrolling UP -> Reveal both top header and tab bar
        showTabBar();
      }

      lastScrollYRef.current = Math.max(0, currentY);
    },
    [showTabBar, hideTabBar]
  );

  return (
    <TabBarVisibilityContext.Provider value={{ translateY, headerTranslateY, showTabBar, hideTabBar, handleScroll }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
  }
  return context;
}
