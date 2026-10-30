import { TravelImage } from './TravelImage';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, borderRadius, shadows } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface DestinationCardProps {
  image: string;
  name: string;
  country: string;
  description?: string;
  tags?: string[];
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function DestinationCard({
  image,
  name,
  country,
  description,
  tags,
  onPress,
  size = 'medium',
}: DestinationCardProps) {
  const cardSizes = {
    small: { width: 160, height: 200 },
    medium: { width: width * 0.7, height: 280 },
    large: { width: width - 32, height: 380 },
  };

  const dimensions = cardSizes[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.cardContainer, dimensions, shadows.md]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${country}${description ? `. ${description}` : ''}`}
      accessibilityHint="Starts trip planning for this destination"
    >
      <LinearGradient
        colors={['#284D57', '#142D3B']}
        style={StyleSheet.absoluteFill}
        accessible={false}
      />
      <TravelImage source={{ uri: image }} style={styles.cardImage} accessible={false} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.gradient} />
      {/* Glassmorphic info overlay */}
      <View style={styles.cardContent}>
        <Text style={styles.cardCountry}>{country}</Text>
        <Text style={styles.cardName}>{name}</Text>
        {description && size !== 'small' && (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {description}
          </Text>
        )}
        {tags && tags.length > 0 && size === 'large' && (
          <View style={styles.tagsContainer}>
            {tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface TripCardProps {
  destination: string;
  country: string;
  dates: string;
  image: string;
  status: 'draft' | 'planned' | 'active' | 'completed';
  daysCount: number | null;
  onPress?: () => void;
}

export function TripCard({
  destination,
  country,
  dates,
  image,
  status,
  daysCount,
  onPress,
}: TripCardProps) {
  const displayDestination = !country ? destination.split(',')[0].trim() : destination;
  const displayCountry = country || destination.split(',').slice(1).join(',').trim();
  const durationLabel =
    daysCount === null
      ? 'Duration unavailable'
      : `${daysCount} ${daysCount === 1 ? 'day' : 'days'}`;
  const statusColors: Record<string, string> = {
    draft: colors.surface[500],
    planned: colors.action.primary,
    active: colors.accent[700],
    completed: colors.surface[600],
  };

  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    planned: 'Upcoming',
    active: 'In Progress',
    completed: 'Completed',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.tripCard}
      accessibilityRole="button"
      accessibilityLabel={`${country ? `${destination}, ${country}` : destination}. ${statusLabels[status]}. ${dates}. ${durationLabel}`}
    >
      <TravelImage source={{ uri: image }} style={styles.tripImage} accessible={false} />
      <View style={styles.tripContent}>
        <View style={styles.tripHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.tripDestination}>{displayDestination}</Text>
            {!!displayCountry && <Text style={styles.tripCountry}>{displayCountry}</Text>}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColors[status]}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[status] }]} />
            <Text style={[styles.statusText, { color: statusColors[status] }]}>
              {statusLabels[status]}
            </Text>
          </View>
        </View>
        <View style={styles.tripFooter}>
          <Text style={styles.tripDates}>{dates}</Text>
          <Text style={styles.tripDays}>{durationLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  cardCountry: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 4,
  },
  cardName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  tripCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tripImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#EFF5F3',
  },
  tripImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: '#EFF5F3',
  },
  tripContent: {
    padding: 16,
  },
  tripHeader: {
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripDestination: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  tripCountry: {
    fontSize: 14,
    color: colors.surface[500],
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tripDates: {
    fontSize: 14,
    color: colors.surface[500],
  },
  tripDays: {
    fontSize: 14,
    color: colors.action.primary,
    fontWeight: '600',
  },
});
