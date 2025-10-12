import { useCallback, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface SoundWaveAnimationProps {
  isActive: boolean;
  color?: string;
}

export default function SoundWaveAnimation({
  isActive,
  color = "white",
}: SoundWaveAnimationProps) {
  const bar1Height = useRef(new Animated.Value(4)).current;
  const bar2Height = useRef(new Animated.Value(4)).current;
  const bar3Height = useRef(new Animated.Value(4)).current;
  const bar4Height = useRef(new Animated.Value(4)).current;
  const bar5Height = useRef(new Animated.Value(4)).current;

  const createWaveAnimation = useCallback(
    (animatedValue: Animated.Value, maxHeight: number, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: maxHeight,
            duration: 600,
            useNativeDriver: false,
            delay,
          }),
          Animated.timing(animatedValue, {
            toValue: 4,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      );
    },
    []
  );

  useEffect(() => {
    if (isActive) {
      const animations = [
        createWaveAnimation(bar1Height, 24, 0),
        createWaveAnimation(bar2Height, 32, 100),
        createWaveAnimation(bar3Height, 20, 200),
        createWaveAnimation(bar4Height, 28, 300),
        createWaveAnimation(bar5Height, 16, 400),
      ];

      for (const animation of animations) {
        animation.start();
      }

      return () => {
        for (const animation of animations) {
          animation.stop();
        }
      };
    } else {
      // Reset to inactive state
      Animated.timing(bar1Height, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
      Animated.timing(bar2Height, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
      Animated.timing(bar3Height, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
      Animated.timing(bar4Height, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
      Animated.timing(bar5Height, {
        toValue: 4,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [
    isActive,
    bar1Height,
    bar2Height,
    bar3Height,
    bar4Height,
    bar5Height,
    createWaveAnimation,
  ]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.bar, { height: bar1Height, backgroundColor: color }]}
      />
      <Animated.View
        style={[styles.bar, { height: bar2Height, backgroundColor: color }]}
      />
      <Animated.View
        style={[styles.bar, { height: bar3Height, backgroundColor: color }]}
      />
      <Animated.View
        style={[styles.bar, { height: bar4Height, backgroundColor: color }]}
      />
      <Animated.View
        style={[styles.bar, { height: bar5Height, backgroundColor: color }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    height: 32,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
});
