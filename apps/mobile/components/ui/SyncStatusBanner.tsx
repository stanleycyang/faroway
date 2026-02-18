/**
 * SyncStatusBanner
 * Shows sync status indicators (offline mode, syncing, pending changes)
 */

import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSyncStatus, useNetworkStatus } from '../../hooks/useOfflineSync';
import { syncService } from '../../lib/offline';

interface SyncStatusBannerProps {
  /**
   * Show only when offline or has pending changes
   * @default true
   */
  autoHide?: boolean;
  /**
   * Position of the banner
   * @default 'top'
   */
  position?: 'top' | 'bottom';
  /**
   * Allow manual sync trigger
   * @default true
   */
  allowManualSync?: boolean;
}

export function SyncStatusBanner({
  autoHide = true,
  position = 'top',
  allowManualSync = true,
}: SyncStatusBannerProps) {
  const { isOffline } = useNetworkStatus();
  const { status, pendingCount, isSyncing, hasPending } = useSyncStatus();
  
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Determine if banner should be visible
  const shouldShow = !autoHide || isOffline || hasPending || status === 'syncing';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: shouldShow ? 0 : position === 'top' ? -100 : 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shouldShow, position]);

  const handleManualSync = async () => {
    if (!isSyncing) {
      await syncService.sync(true);
    }
  };

  // Get banner content based on state
  const getBannerContent = () => {
    if (isOffline) {
      return {
        icon: 'cloud-offline-outline' as const,
        text: 'You\'re offline',
        subtext: hasPending ? `${pendingCount} changes pending` : 'Changes will sync when online',
        color: '#f97316', // orange
        bgColor: 'rgba(249, 115, 22, 0.15)',
      };
    }
    
    if (isSyncing) {
      return {
        icon: 'sync' as const,
        text: 'Syncing...',
        subtext: hasPending ? `${pendingCount} items remaining` : '',
        color: '#6366f1', // indigo
        bgColor: 'rgba(99, 102, 241, 0.15)',
        showSpinner: true,
      };
    }
    
    if (hasPending) {
      return {
        icon: 'cloud-upload-outline' as const,
        text: `${pendingCount} pending ${pendingCount === 1 ? 'change' : 'changes'}`,
        subtext: 'Tap to sync now',
        color: '#f59e0b', // amber
        bgColor: 'rgba(245, 158, 11, 0.15)',
        canSync: true,
      };
    }
    
    if (status === 'error') {
      return {
        icon: 'warning-outline' as const,
        text: 'Sync failed',
        subtext: 'Tap to retry',
        color: '#ef4444', // red
        bgColor: 'rgba(239, 68, 68, 0.15)',
        canSync: true,
      };
    }
    
    // Success or idle - don't show anything if autoHide
    return {
      icon: 'checkmark-circle-outline' as const,
      text: 'All changes synced',
      subtext: '',
      color: '#22c55e', // green
      bgColor: 'rgba(34, 197, 94, 0.15)',
    };
  };

  const content = getBannerContent();

  if (!shouldShow && autoHide) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'bottom' && styles.bottomPosition,
        {
          backgroundColor: content.bgColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={content.canSync && allowManualSync ? handleManualSync : undefined}
        disabled={!content.canSync || !allowManualSync || isSyncing}
        activeOpacity={content.canSync ? 0.7 : 1}
      >
        <View style={styles.iconContainer}>
          {content.showSpinner ? (
            <ActivityIndicator size="small" color={content.color} />
          ) : (
            <Ionicons name={content.icon} size={20} color={content.color} />
          )}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.mainText, { color: content.color }]}>
            {content.text}
          </Text>
          {content.subtext ? (
            <Text style={[styles.subText, { color: content.color }]}>
              {content.subtext}
            </Text>
          ) : null}
        </View>

        {content.canSync && allowManualSync && !isSyncing && (
          <Ionicons 
            name="refresh-outline" 
            size={20} 
            color={content.color} 
            style={styles.actionIcon}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * Compact sync indicator for headers/toolbars
 */
export function SyncIndicator() {
  const { isOffline } = useNetworkStatus();
  const { isSyncing, hasPending, pendingCount } = useSyncStatus();

  if (!isOffline && !isSyncing && !hasPending) {
    return null;
  }

  return (
    <View style={styles.indicator}>
      {isSyncing ? (
        <ActivityIndicator size="small" color="#6366f1" />
      ) : isOffline ? (
        <Ionicons name="cloud-offline-outline" size={16} color="#f97316" />
      ) : hasPending ? (
        <View style={styles.pendingBadge}>
          <Ionicons name="cloud-upload-outline" size={14} color="#f59e0b" />
          <Text style={styles.pendingCount}>{pendingCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Offline badge for list items
 */
interface OfflineBadgeProps {
  isPending?: boolean;
  isLocal?: boolean;
}

export function OfflineBadge({ isPending, isLocal }: OfflineBadgeProps) {
  if (!isPending && !isLocal) return null;

  return (
    <View style={[
      styles.badge,
      isPending && styles.pendingBadgeSmall,
      isLocal && styles.localBadgeSmall,
    ]}>
      <Ionicons 
        name={isPending ? 'time-outline' : 'phone-portrait-outline'} 
        size={10} 
        color="#fff" 
      />
      <Text style={styles.badgeText}>
        {isPending ? 'Pending' : 'Local'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: 50, // Account for status bar
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bottomPosition: {
    top: undefined,
    bottom: 0,
    paddingTop: 12,
    paddingBottom: 30, // Account for bottom safe area
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  mainText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subText: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  actionIcon: {
    marginLeft: 8,
  },
  indicator: {
    padding: 4,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pendingCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f59e0b',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  pendingBadgeSmall: {
    backgroundColor: '#f59e0b',
  },
  localBadgeSmall: {
    backgroundColor: '#6366f1',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
});
