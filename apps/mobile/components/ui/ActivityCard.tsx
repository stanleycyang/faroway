import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TripActivity } from '../../stores/tripStore';
import { colors, borderRadius, shadows } from '../../constants/theme';

interface ActivityCardProps {
  activity: TripActivity;
  onBook?: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  showTimeline?: boolean;
  isLast?: boolean;
}

export function ActivityCard({
  activity,
  onBook,
  onSave,
  isSaved = false,
  showTimeline = true,
  isLast = false,
}: ActivityCardProps) {
  const [saved, setSaved] = useState(isSaved);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'restaurant':
        return 'restaurant';
      case 'transport':
        return 'car';
      case 'accommodation':
        return 'bed';
      case 'attraction':
        return 'camera';
      case 'experience':
        return 'sparkles';
      default:
        return 'location';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'restaurant':
        return '#ef4444';
      case 'transport':
        return '#3b82f6';
      case 'accommodation':
        return '#8b5cf6';
      case 'attraction':
        return '#f59e0b';
      case 'experience':
        return '#10b981';
      default:
        return colors.primary[500];
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'restaurant':
        return 'Restaurant';
      case 'transport':
        return 'Transport';
      case 'accommodation':
        return 'Stay';
      case 'attraction':
        return 'Attraction';
      case 'experience':
        return 'Experience';
      default:
        return 'Activity';
    }
  };

  const handleSave = () => {
    setSaved(!saved);
    onSave?.();
  };

  const typeColor = getTypeColor(activity.type);

  return (
    <View style={styles.container}>
      {/* Timeline */}
      {showTimeline && (
        <View style={styles.timeline}>
          <Text style={styles.timeText}>{activity.time}</Text>
          <View style={[styles.dot, { backgroundColor: typeColor }]} />
          {!isLast && <View style={styles.line} />}
        </View>
      )}

      {/* Card */}
      <View style={styles.card}>
        {/* Header with image */}
        {activity.image && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: activity.image }} style={styles.image} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.imageGradient}
            />
            {/* Type badge */}
            <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
              <Ionicons
                name={getTypeIcon(activity.type) as React.ComponentProps<typeof Ionicons>['name']}
                size={12}
                color="#fff"
              />
              <Text style={styles.typeBadgeText}>{getTypeLabel(activity.type)}</Text>
            </View>
            {/* Save button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={20}
                color={saved ? '#ef4444' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              {!activity.image && (
                <View style={[styles.iconCircle, { backgroundColor: `${typeColor}20` }]}>
                  <Ionicons
                    name={
                      getTypeIcon(activity.type) as React.ComponentProps<typeof Ionicons>['name']
                    }
                    size={16}
                    color={typeColor}
                  />
                </View>
              )}
              <View style={styles.titleText}>
                <Text style={styles.title} numberOfLines={1}>
                  {activity.title}
                </Text>
                <Text style={styles.duration}>{activity.duration}</Text>
              </View>
            </View>
            {activity.price && <Text style={styles.price}>{activity.price}</Text>}
          </View>

          {/* Description */}
          <Text style={styles.description} numberOfLines={2}>
            {activity.description}
          </Text>

          {/* Rating & Reviews */}
          {activity.rating && (
            <View style={styles.ratingRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#fbbf24" />
                <Text style={styles.ratingText}>{activity.rating}</Text>
              </View>
              {activity.reviewCount && (
                <Text style={styles.reviewCount}>
                  {activity.reviewCount.toLocaleString()} reviews
                </Text>
              )}
              {activity.topReview && (
                <Text style={styles.topReview} numberOfLines={1}>
                  "{activity.topReview}"
                </Text>
              )}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.bookButton} onPress={onBook} activeOpacity={0.8}>
              <LinearGradient
                colors={['#6366f1', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.bookButtonText}>Reserve Now</Text>
              {activity.freeCancellation && (
                <View style={styles.freeCancelBadge}>
                  <Text style={styles.freeCancelText}>Free cancellation</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.detailsButton} activeOpacity={0.8}>
              <Text style={styles.detailsButtonText}>Details</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.surface[400]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeline: {
    alignItems: 'center',
    width: 50,
    marginRight: 12,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.surface[400],
    marginBottom: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface[800],
    ...shadows.sm,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.surface[700],
    marginTop: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  imageContainer: {
    height: 140,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  saveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  duration: {
    fontSize: 13,
    color: colors.surface[400],
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary[400],
    marginLeft: 12,
  },
  description: {
    fontSize: 14,
    color: colors.surface[400],
    lineHeight: 20,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
  },
  reviewCount: {
    fontSize: 13,
    color: colors.surface[400],
  },
  topReview: {
    flex: 1,
    fontSize: 12,
    color: colors.surface[500],
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  bookButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  freeCancelBadge: {
    marginTop: 4,
  },
  freeCancelText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface[700],
    borderRadius: borderRadius.lg,
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.surface[300],
  },
});
