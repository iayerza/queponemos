import React, { useEffect } from 'react';
import {
  View, Modal, TouchableOpacity, StyleSheet,
  Dimensions, TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number;
}

export default function BottomSheet({
  visible, onClose, children, maxHeight = SCREEN_H * 0.85,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(maxHeight);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value    = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      opacity.value    = withTiming(0, { duration: 150 });
      translateY.value = withTiming(maxHeight, { duration: 250 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const bgStyle    = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, bgStyle]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { maxHeight, paddingBottom: insets.bottom + 16 }, sheetStyle]}>
        <TouchableOpacity style={styles.handleArea} onPress={onClose} activeOpacity={1}>
          <View style={styles.handle} />
        </TouchableOpacity>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.s1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  handleArea: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.faint },
});
