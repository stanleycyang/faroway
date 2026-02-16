import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
  Pressable,
} from 'react-native';
import { colors, borderRadius, typography } from '../../constants/theme';
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
  const getButtonStyles = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.lg,
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      sm: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 36 },
      md: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 48 },
      lg: { paddingVertical: 16, paddingHorizontal: 32, minHeight: 56 },
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: { backgroundColor: colors.primary[500] },
      secondary: { backgroundColor: colors.neutral[800] },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.neutral[300],
      },
      ghost: { backgroundColor: 'transparent' },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      opacity: disabled ? 0.5 : 1,
      width: fullWidth ? '100%' : undefined,
    };
  };

  const getTextStyles = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: '600',
    };

    const sizeStyles: Record<string, TextStyle> = {
      sm: { fontSize: 14 },
      md: { fontSize: 16 },
      lg: { fontSize: 18 },
    };

    const variantStyles: Record<string, TextStyle> = {
      primary: { color: '#fff' },
      secondary: { color: '#fff' },
      outline: { color: colors.neutral[900] },
      ghost: { color: colors.neutral[900] },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          getButtonStyles(),
          { transform: [{ scale: scaleAnim }] },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' || variant === 'secondary' ? '#fff' : colors.primary[500]}
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
      </Animated.View>
    </Pressable>
  );
}
