# TripGenie UX Developer Guide

This guide explains the UX improvements made to TripGenie and how to extend them.

---

## 🚀 Quick Start

### New Dependencies Installed
```bash
npm install expo-haptics
```

### New Files Created
```
utils/haptics.ts                      # Haptic feedback utility
components/ui/LoadingSkeleton.tsx     # Skeleton loading components
UX_POLISH_SUMMARY.md                  # This summary
UX_TESTING_CHECKLIST.md              # Testing checklist
UX_DEVELOPER_GUIDE.md                # You are here
```

---

## 📁 File Structure

```
tripgenie-mobile/
├── utils/
│   └── haptics.ts                    # Haptic feedback wrapper
├── components/
│   └── ui/
│       ├── Button.tsx                # Enhanced with scale animation + haptics
│       ├── VibeSelector.tsx          # Enhanced with haptics + max validation
│       ├── LoadingSkeleton.tsx       # NEW: Skeleton components
│       └── index.ts                  # Exports all UI components
├── app/
│   ├── _layout.tsx                   # Updated with smooth transitions
│   ├── onboarding/index.tsx          # Enhanced with haptics
│   ├── auth/
│   │   ├── login.tsx                 # Inline errors + haptics
│   │   └── signup.tsx                # Inline errors + haptics
│   ├── (tabs)/
│   │   ├── index.tsx                 # Scroll tracking + haptics
│   │   ├── trips.tsx                 # Tab selection haptics
│   │   └── profile.tsx               # Menu haptics
│   ├── create/index.tsx              # Full haptics + animations
│   └── trip/[id].tsx                 # Parallax + pull-to-refresh + haptics
```

---

## 🎯 Key Patterns

### 1. Adding Haptic Feedback

**Import the utility:**
```typescript
import { hapticFeedback } from '../../utils/haptics';
```

**Use in handlers:**
```typescript
const handlePress = () => {
  hapticFeedback.light();  // Add haptic feedback
  // ... rest of your logic
};
```

**Available haptics:**
- `light()` - Subtle, for selections/taps
- `medium()` - Standard interactions
- `heavy()` - Strong emphasis
- `success()` - Positive action completion
- `error()` - Errors/warnings
- `selection()` - Tab/option changes

**When to use which:**
```typescript
// Light: Regular taps, selections
<TouchableOpacity onPress={() => {
  hapticFeedback.light();
  selectItem();
}}>

// Selection: Tab changes, filters
<TouchableOpacity onPress={() => {
  hapticFeedback.selection();
  setActiveTab(tab);
}}>

// Medium: Primary actions
<Button onPress={() => {
  hapticFeedback.medium();
  createTrip();
}}>

// Success: Completion
try {
  await submitForm();
  hapticFeedback.success();  // Form submitted!
} catch {
  hapticFeedback.error();    // Something went wrong
}

// Error: Max reached, validation failed
if (selectedVibes.length >= MAX) {
  hapticFeedback.error();  // Can't select more!
}
```

---

### 2. Button Scale Animation

**The Button component now automatically:**
- Scales to 0.96 on press
- Springs back to 1.0 on release
- Gives haptic feedback
- Works with all variants

**Usage (no changes needed):**
```typescript
<Button
  title="Create Trip"
  onPress={handleCreate}
  variant="primary"
  size="lg"
/>
```

**The component handles:**
- Press animation
- Haptic feedback
- Disabled state
- Loading state

---

### 3. Inline Error Handling

**OLD way (don't do this):**
```typescript
if (!email) {
  Alert.alert('Error', 'Please enter email');  // ❌ Disruptive
}
```

**NEW way (do this):**
```typescript
const [error, setError] = useState('');

if (!email) {
  setError('Please enter email');  // ✅ Inline
  hapticFeedback.error();
  return;
}

// In JSX:
{error && (
  <View style={styles.errorContainer}>
    <Ionicons name="alert-circle" size={16} color="#ef4444" />
    <Text style={styles.errorText}>{error}</Text>
  </View>
)}
```

**Error styles:**
```typescript
errorContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#fef2f2',
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 8,
  gap: 8,
},
errorText: {
  flex: 1,
  color: '#ef4444',
  fontSize: 14,
},
```

---

### 4. Parallax Scrolling

**Setup (Trip Detail example):**

```typescript
const scrollY = useRef(new Animated.Value(0)).current;

const headerTranslate = scrollY.interpolate({
  inputRange: [0, HEADER_HEIGHT],
  outputRange: [0, -HEADER_HEIGHT / 2],
  extrapolate: 'clamp',
});

const imageScale = scrollY.interpolate({
  inputRange: [-100, 0],
  outputRange: [1.5, 1],
  extrapolate: 'clamp',
});

<Animated.ScrollView
  onScroll={Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  )}
  scrollEventThrottle={16}
>
  <Animated.View style={{ transform: [{ translateY: headerTranslate }] }}>
    <Animated.Image style={{ transform: [{ scale: imageScale }] }} />
  </Animated.View>
</Animated.ScrollView>
```

**Key points:**
- Always use `useNativeDriver: true`
- Use `scrollEventThrottle={16}` for 60fps
- `extrapolate: 'clamp'` prevents over-scrolling artifacts
- Negative inputRange for pull-down scale

---

### 5. Pull-to-Refresh

**Setup:**
```typescript
const [refreshing, setRefreshing] = useState(false);

const onRefresh = async () => {
  setRefreshing(true);
  hapticFeedback.light();
  
  // Fetch new data
  await refetchData();
  
  setRefreshing(false);
  hapticFeedback.success();
};

<Animated.ScrollView
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
>
```

---

### 6. Loading Skeletons

**Import:**
```typescript
import { Skeleton, TripCardSkeleton } from '../../components/ui';
```

**Usage:**
```typescript
{loading ? (
  <>
    <TripCardSkeleton />
    <TripCardSkeleton />
    <TripCardSkeleton />
  </>
) : (
  trips.map(trip => <TripCard {...trip} />)
)}
```

**Custom skeleton:**
```typescript
<Skeleton width="80%" height={20} borderRadius={8} />
<Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
```

---

### 7. Screen Transitions

**Configure in `_layout.tsx`:**
```typescript
<Stack.Screen
  name="screenName"
  options={{
    animation: 'slide_from_right',  // or 'fade', 'slide_from_bottom'
    animationDuration: 300,
    presentation: 'modal',          // for modals
  }}
/>
```

**Available animations:**
- `slide_from_right` - Standard push
- `slide_from_bottom` - Modals
- `fade` - Cross-fade
- `none` - No animation

---

## 🎨 Design System

### Colors
```typescript
import { colors } from '../../constants/theme';

// Primary (orange)
colors.primary[50]    // Very light
colors.primary[500]   // Main color
colors.primary[700]   // Dark

// Neutral (grays)
colors.neutral[50]    // Almost white
colors.neutral[500]   // Medium gray
colors.neutral[900]   // Almost black

// Semantic
colors.success        // Green
colors.error          // Red
colors.warning        // Yellow
colors.info           // Blue
```

### Spacing
```typescript
import { spacing } from '../../constants/theme';

spacing.xs    // 4px
spacing.sm    // 8px
spacing.md    // 16px
spacing.lg    // 24px
spacing.xl    // 32px
spacing['2xl'] // 48px
```

### Border Radius
```typescript
import { borderRadius } from '../../constants/theme';

borderRadius.sm    // 8px
borderRadius.md    // 12px
borderRadius.lg    // 16px
borderRadius.xl    // 24px
borderRadius.full  // 9999px (pill shape)
```

### Shadows
```typescript
import { shadows } from '../../constants/theme';

...shadows.sm   // Subtle depth
...shadows.md   // Standard cards
...shadows.lg   // Modals, important elements
```

---

## 🔧 Common Tasks

### Adding a New Screen

1. **Create the screen file**
```typescript
// app/new-screen.tsx
import { hapticFeedback } from '../utils/haptics';
import { colors, spacing, borderRadius } from '../constants/theme';

export default function NewScreen() {
  // Your component
}
```

2. **Add to navigation**
```typescript
// app/_layout.tsx
<Stack.Screen
  name="new-screen"
  options={{
    animation: 'slide_from_right',
    animationDuration: 300,
  }}
/>
```

3. **Add haptics to interactions**
```typescript
<TouchableOpacity onPress={() => {
  hapticFeedback.light();
  navigate();
}}>
```

---

### Adding a New Interactive Component

```typescript
import { useState, useRef } from 'react';
import { TouchableOpacity, Animated } from 'react-native';
import { hapticFeedback } from '../../utils/haptics';

export function InteractiveCard({ onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    hapticFeedback.light();
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {/* Your content */}
      </Animated.View>
    </TouchableOpacity>
  );
}
```

---

### Adding Loading States

```typescript
import { Skeleton } from '../../components/ui';

function MyComponent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then((result) => {
      setData(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <>
        <Skeleton width="100%" height={200} />
        <Skeleton width="80%" height={20} style={{ marginTop: 16 }} />
        <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
      </>
    );
  }

  return <DataView data={data} />;
}
```

---

## 🐛 Debugging

### Haptics Not Working?

1. **Check device support:**
   - iOS: All devices with Taptic Engine (iPhone 6s+)
   - Android: Devices with haptic motor

2. **Check device settings:**
   - iOS: Settings → Sounds & Haptics → System Haptics (enabled)
   - Android: Settings → Sound → Vibrate on touch (enabled)

3. **Test in real device:**
   - Simulators may not support haptics
   - Use physical device for testing

### Animations Janky?

1. **Always use `useNativeDriver: true`**
```typescript
Animated.timing(value, {
  useNativeDriver: true,  // ✅ Runs on UI thread
})
```

2. **Optimize scroll events:**
```typescript
<ScrollView
  scrollEventThrottle={16}  // 60fps
  onScroll={...}
>
```

3. **Profile with Flipper:**
```bash
npx react-native log-ios  # Watch for performance warnings
```

---

## 📚 Best Practices

### 1. Haptic Consistency
- ✅ Use `light()` for most taps
- ✅ Use `selection()` for tabs/filters
- ✅ Use `success()`/`error()` for results
- ❌ Don't overuse - every 3rd interaction is enough

### 2. Animation Performance
- ✅ Always `useNativeDriver: true`
- ✅ Animate transform/opacity only
- ❌ Don't animate layout properties (width, height, padding)
- ✅ Use `interpolate()` for derived values

### 3. Error Handling
- ✅ Inline errors for forms
- ✅ Toast/banner for global errors
- ❌ Never use Alert.alert() for validation
- ✅ Combine visual + haptic feedback

### 4. Loading States
- ✅ Skeleton screens for initial load
- ✅ Spinners for short actions (<2s)
- ✅ Progress bars for long processes
- ❌ Don't show blank screens

### 5. Touch Targets
- ✅ Minimum 44x44 points
- ✅ Add padding if content is small
- ✅ Visual feedback on press
- ✅ Haptic feedback

---

## 🎯 Extending the System

### Adding New Haptic Type

```typescript
// utils/haptics.ts
export const hapticFeedback = {
  // ... existing haptics
  customHeavy: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Could add vibration pattern here
  },
};
```

### Adding New Loading Skeleton

```typescript
// components/ui/LoadingSkeleton.tsx
export function CustomSkeleton() {
  return (
    <View style={styles.custom}>
      <Skeleton width={60} height={60} borderRadius={30} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Skeleton width="100%" height={18} />
        <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}
```

### Adding Theme Variants

```typescript
// constants/theme.ts
export const darkTheme = {
  colors: {
    background: '#0a0a0a',
    foreground: '#ffffff',
    primary: colors.primary,
    // ...
  },
};

// Use with context
export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const theme = isDark ? darkTheme : lightTheme;
  
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
```

---

## 🚀 Performance Tips

### 1. Memoization
```typescript
const MemoizedComponent = React.memo(({ data }) => {
  // Component logic
});
```

### 2. Lazy Loading
```typescript
const ExpensiveComponent = lazy(() => import('./ExpensiveComponent'));

<Suspense fallback={<Skeleton />}>
  <ExpensiveComponent />
</Suspense>
```

### 3. Image Optimization
```typescript
<Image
  source={{ uri: imageUrl }}
  style={styles.image}
  resizeMode="cover"
  progressiveRenderingEnabled  // Shows low-res first
  defaultSource={require('./placeholder.png')}
/>
```

---

## 📖 Resources

- [Expo Haptics Docs](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [React Native Animated](https://reactnative.dev/docs/animated)
- [Expo Router Animations](https://docs.expo.dev/router/advanced/stack/#animation)
- [TripGenie UX Summary](./UX_POLISH_SUMMARY.md)
- [Testing Checklist](./UX_TESTING_CHECKLIST.md)

---

## ❓ FAQ

**Q: Why aren't my haptics working in Expo Go?**  
A: Some haptics may be limited in Expo Go. Build a development build for full haptic support.

**Q: Can I disable haptics for testing?**  
A: Yes, modify `utils/haptics.ts` to add a global flag:
```typescript
const HAPTICS_ENABLED = true;  // Toggle this

export const hapticFeedback = {
  light: () => HAPTICS_ENABLED && Haptics.impactAsync(...),
  // ...
};
```

**Q: How do I test parallax on simulator?**  
A: Use trackpad/mouse to scroll. On device, it's much smoother.

**Q: Should I add haptics to every button?**  
A: The Button component already includes haptics. Only add manually for custom components.

---

## 🎉 You're Ready!

The TripGenie UX system is now fully set up. Follow these patterns when adding new features, and you'll maintain the award-winning quality throughout the app.

**Remember the golden rules:**
1. **Haptics on every interaction** (but not too much!)
2. **Smooth animations** (always use native driver)
3. **Inline errors** (never alerts)
4. **Loading states** (skeletons > spinners)
5. **Consistent design** (use theme constants)

Happy coding! ✨
