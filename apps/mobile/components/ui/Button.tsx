import React, { useRef } from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled && !loading) {
      hapticFeedback.light();
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const sizeStyles: Record<string, ViewStyle> = {
    sm: { paddingVertical: 10, paddingHorizontal: 18, minHeight: 38 },
    md: { paddingVertical: 14, paddingHorizontal: 28, minHeight: 50 },
    lg: { paddingVertical: 18, paddingHorizontal: 36, minHeight: 58 },
  };

  const textSizeStyles: Record<string, TextStyle> = {
    sm: { fontSize: 14 },
    md: { fontSize: 16 },
    lg: { fontSize: 18 },
  };

  const isPrimary = variant === 'primary';

  const getButtonStyles = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      ...sizeStyles[size],
    };

    const variantStyles: Record<string, ViewStyle> = {
      primary: {},
      secondary: { backgroundColor: colors.surface[100] },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
      },
      ghost: { backgroundColor: 'transparent' },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
      opacity: disabled ? 0.4 : 1,
      width: fullWidth ? '100%' : undefined,
    };
  };

  const getTextStyles = (): TextStyle => {
    const variantStyles: Record<string, TextStyle> = {
      primary: { color: '#fff' },
      secondary: { color: '#0f172a' },
      outline: { color: '#0f172a' },
      ghost: { color: colors.surface[600] },
    };

    return {
      fontWeight: '700',
      letterSpacing: 0.3,
      ...textSizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'secondary' ? '#fff' : colors.primary[400]}
          size="small"
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text style={[getTextStyles(), icon ? { marginLeft: 8 } : undefined, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      testID={testID}
      accessibilityLabel={accessibilityLabel || title}
    >
      <Animated.View
        style={[
          getButtonStyles(),
          isPrimary && !disabled && styles.primaryGlow,
          { transform: [{ scale: scaleAnim }] },
          style,
        ]}
      >
        {isPrimary ? (
          <LinearGradient
            colors={disabled ? ['#cbd5e1', '#cbd5e1'] : ['#F97066', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
          />
        ) : null}
        {content}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryGlow: {
    shadowColor: '#FA8C84',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
});
