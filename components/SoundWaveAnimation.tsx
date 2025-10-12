import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface SoundWaveAnimationProps {
  isActive: boolean;
  amplitudeData?: number[];
  color?: string;
}

export default function SoundWaveAnimation({
  isActive,
  amplitudeData,
  color = "white",
}: SoundWaveAnimationProps) {
  const bar1Height = useRef(new Animated.Value(4)).current;
  const bar2Height = useRef(new Animated.Value(4)).current;
  const bar3Height = useRef(new Animated.Value(4)).current;
  const bar4Height = useRef(new Animated.Value(4)).current;
  const bar5Height = useRef(new Animated.Value(4)).current;

  const barHeights = useMemo(
    () => [bar1Height, bar2Height, bar3Height, bar4Height, bar5Height],
    [bar1Height, bar2Height, bar3Height, bar4Height, bar5Height]
  );

  // Update bar heights based on real-time amplitude data
  useEffect(() => {
    if (isActive && amplitudeData && amplitudeData.length >= 5) {
      // Use real amplitude data for responsive animation
      const minHeight = 4;
      const maxHeight = 42; // A little taller for even better visibility

      const heights = amplitudeData.map(
        (amplitude) => minHeight + (maxHeight - minHeight) * amplitude
      );

      // Smooth but responsive animation
      Animated.parallel(
        barHeights.map((barHeight, index) =>
          Animated.timing(barHeight, {
            toValue: heights[index],
            duration: 50, // A little faster for more responsiveness
            useNativeDriver: false,
          })
        )
      ).start();
    } else if (isActive) {
      // Fallback to static animation when no amplitude data is available
      const staticHeights = [32, 42, 28, 36, 24]; // A little taller static heights
      const delays = [0, 100, 200, 300, 400];

      const staticAnimations = barHeights.map((barHeight, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(barHeight, {
              toValue: staticHeights[index],
              duration: 600,
              useNativeDriver: false,
              delay: delays[index],
            }),
            Animated.timing(barHeight, {
              toValue: 4,
              duration: 600,
              useNativeDriver: false,
            }),
          ])
        )
      );

      for (const animation of staticAnimations) {
        animation.start();
      }

      return () => {
        for (const animation of staticAnimations) {
          animation.stop();
        }
      };
    } else {
      // Reset to inactive state
      Animated.parallel(
        barHeights.map((barHeight) =>
          Animated.timing(barHeight, {
            toValue: 4,
            duration: 200,
            useNativeDriver: false,
          })
        )
      ).start();
    }
  }, [isActive, amplitudeData, barHeights]);

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
    height: 44, // A little taller to accommodate larger bars
  },
  bar: {
    width: 4, // Slightly wider bars
    borderRadius: 2,
  },
});
