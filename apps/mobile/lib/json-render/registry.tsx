import React from "react";
import {
  View,
  Text as RNText,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import {
  colors,
  borderRadius,
  shadows,
  spacing,
  typography,
} from "../../constants/theme";
import { z } from "zod";
import {
  TripSummarySchema,
  HeroImageSchema,
  SectionSchema,
  TextSchema,
  HotelCardSchema,
  ItineraryDaySchema,
  ActivityCardSchema,
  RestaurantCardSchema,
  DayTimelineSchema,
  BookingButtonSchema,
  PriceTagSchema,
  RatingStarsSchema,
  MapPreviewSchema,
} from "./catalog";

// =============================================================================
// Helper Functions
// =============================================================================

const openURL = async (url: string) => {
  try {
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        controlsColor: colors.primary[600],
      });
    }
  } catch (error) {
    console.error("Failed to open URL:", error);
    Linking.openURL(url);
  }
};

// =============================================================================
// TripSummary Component
// =============================================================================

type TripSummaryProps = z.infer<typeof TripSummarySchema>;

export const TripSummary: React.FC<TripSummaryProps> = ({
  destination,
  dates,
  travelers,
  budget,
}) => {
  return (
    <View style={styles.tripSummary}>
      <LinearGradient
        colors={[colors.primary[500], colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tripSummaryGradient}
      >
        <View style={styles.tripSummaryIcon}>
          <Ionicons name="airplane" size={32} color="#fff" />
        </View>
        <RNText style={styles.tripSummaryDestination}>{destination}</RNText>
        <View style={styles.tripSummaryDetails}>
          <View style={styles.tripSummaryDetail}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color="rgba(255,255,255,0.9)"
            />
            <RNText style={styles.tripSummaryDetailText}>{dates}</RNText>
          </View>
          <View style={styles.tripSummaryDetail}>
            <Ionicons
              name="people-outline"
              size={16}
              color="rgba(255,255,255,0.9)"
            />
            <RNText style={styles.tripSummaryDetailText}>
              {travelers} traveler{travelers > 1 ? "s" : ""}
            </RNText>
          </View>
          {budget && (
            <View style={styles.tripSummaryDetail}>
              <Ionicons
                name="wallet-outline"
                size={16}
                color="rgba(255,255,255,0.9)"
              />
              <RNText style={styles.tripSummaryDetailText}>{budget}</RNText>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

// =============================================================================
// HeroImage Component
// =============================================================================

type HeroImageProps = z.infer<typeof HeroImageSchema>;

export const HeroImage: React.FC<HeroImageProps> = ({
  url,
  alt,
  overlay = true,
}) => {
  return (
    <View style={styles.heroImage}>
      <Image
        source={{ uri: url }}
        style={styles.heroImageImg}
        accessibilityLabel={alt}
      />
      {overlay && (
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.3)"]}
          style={styles.heroImageOverlay}
        />
      )}
    </View>
  );
};

// =============================================================================
// Section Component
// =============================================================================

type SectionProps = z.infer<typeof SectionSchema>;

export const Section: React.FC<SectionProps> = ({ title }) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLine} />
      <RNText style={styles.sectionTitle}>{title}</RNText>
      <View style={styles.sectionLine} />
    </View>
  );
};

// =============================================================================
// Text Component
// =============================================================================

type TextProps = z.infer<typeof TextSchema>;

export const Text: React.FC<TextProps> = ({ content, variant = "body" }) => {
  const textStyles = {
    body: styles.textBody,
    caption: styles.textCaption,
    subtitle: styles.textSubtitle,
    title: styles.textTitle,
  };

  return <RNText style={[styles.text, textStyles[variant]]}>{content}</RNText>;
};

// =============================================================================
// HotelCard Component
// =============================================================================

type HotelCardProps = z.infer<typeof HotelCardSchema>;

export const HotelCard: React.FC<HotelCardProps> = ({
  name,
  rating,
  pricePerNight,
  image,
  bookingUrl,
  amenities,
  description,
  reviewCount,
}) => {
  return (
    <View style={[styles.card, styles.hotelCard]}>
      {image && <Image source={{ uri: image }} style={styles.hotelCardImage} />}
      <View style={styles.hotelCardContent}>
        <View style={styles.hotelCardHeader}>
          <RNText style={styles.hotelCardName}>{name}</RNText>
          <View style={styles.hotelCardRating}>
            <Ionicons name="star" size={16} color="#fbbf24" />
            <RNText style={styles.hotelCardRatingText}>
              {rating.toFixed(1)}
            </RNText>
            {reviewCount && (
              <RNText style={styles.hotelCardReviewCount}>
                ({reviewCount})
              </RNText>
            )}
          </View>
        </View>

        {description && (
          <RNText style={styles.hotelCardDescription} numberOfLines={3}>
            {description}
          </RNText>
        )}

        <View style={styles.hotelCardPrice}>
          <RNText style={styles.hotelCardPriceLabel}>From</RNText>
          <RNText style={styles.hotelCardPriceAmount}>${pricePerNight}</RNText>
          <RNText style={styles.hotelCardPricePeriod}>/ night</RNText>
        </View>

        {amenities.length > 0 && (
          <View style={styles.amenitiesContainer}>
            {amenities.slice(0, 6).map((amenity, index) => (
              <View key={index} style={styles.amenityPill}>
                <RNText style={styles.amenityText}>{amenity}</RNText>
              </View>
            ))}
            {amenities.length > 6 && (
              <View style={styles.amenityPill}>
                <RNText style={styles.amenityText}>
                  +{amenities.length - 6} more
                </RNText>
              </View>
            )}
          </View>
        )}

        {bookingUrl && (
          <TouchableOpacity
            style={styles.hotelCardButton}
            onPress={() => openURL(bookingUrl)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary[500], colors.primary[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.hotelCardButtonGradient}
            >
              <RNText style={styles.hotelCardButtonText}>Book Now</RNText>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// =============================================================================
// ItineraryDay Component
// =============================================================================

type ItineraryDayProps = z.infer<typeof ItineraryDaySchema>;

export const ItineraryDay: React.FC<ItineraryDayProps> = ({
  dayNumber,
  date,
  title,
}) => {
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.itineraryDay}>
      <View style={styles.itineraryDayBadge}>
        <RNText style={styles.itineraryDayNumber}>Day {dayNumber}</RNText>
      </View>
      <RNText style={styles.itineraryDayDate}>{formattedDate}</RNText>
      <RNText style={styles.itineraryDayTitle}>{title}</RNText>
    </View>
  );
};

// =============================================================================
// ActivityCard Component
// =============================================================================

type ActivityCardProps = z.infer<typeof ActivityCardSchema>;

export const ActivityCard: React.FC<ActivityCardProps> = ({
  name,
  description,
  duration,
  price,
  rating,
  reviewCount,
  image,
  bookingUrl,
  time,
  location,
}) => {
  return (
    <View style={[styles.card, styles.activityCard]}>
      <View style={styles.activityCardTime}>
        <Ionicons name="time-outline" size={16} color={colors.primary[600]} />
        <RNText style={styles.activityCardTimeText}>{time}</RNText>
      </View>

      <View style={styles.activityCardBody}>
        {image && (
          <Image source={{ uri: image }} style={styles.activityCardImage} />
        )}
        <View style={styles.activityCardContent}>
          <RNText style={styles.activityCardName}>{name}</RNText>

          {location && (
            <View style={styles.activityCardLocation}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.neutral[500]}
              />
              <RNText style={styles.activityCardLocationText}>
                {location}
              </RNText>
            </View>
          )}

          <RNText style={styles.activityCardDescription} numberOfLines={2}>
            {description}
          </RNText>

          <View style={styles.activityCardMeta}>
            <View style={styles.activityCardMetaItem}>
              <Ionicons name="time" size={14} color={colors.neutral[500]} />
              <RNText style={styles.activityCardMetaText}>{duration}</RNText>
            </View>
            {rating && (
              <View style={styles.activityCardMetaItem}>
                <Ionicons name="star" size={14} color="#fbbf24" />
                <RNText style={styles.activityCardMetaText}>
                  {rating.toFixed(1)}
                </RNText>
                {reviewCount && (
                  <RNText style={styles.activityCardReviewCount}>
                    ({reviewCount})
                  </RNText>
                )}
              </View>
            )}
            <RNText style={styles.activityCardPrice}>${price}</RNText>
          </View>

          {bookingUrl && (
            <TouchableOpacity
              style={styles.activityCardButton}
              onPress={() => openURL(bookingUrl)}
              activeOpacity={0.8}
            >
              <RNText style={styles.activityCardButtonText}>
                View Details
              </RNText>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={colors.primary[600]}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// =============================================================================
// RestaurantCard Component
// =============================================================================

type RestaurantCardProps = z.infer<typeof RestaurantCardSchema>;

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  name,
  cuisine,
  priceLevel,
  rating,
  reviewCount,
  image,
  reservationUrl,
  description,
  time,
}) => {
  const priceLevelString = "$".repeat(priceLevel);

  return (
    <View style={[styles.card, styles.restaurantCard]}>
      {time && (
        <View style={styles.restaurantCardTime}>
          <Ionicons name="restaurant-outline" size={16} color="#ef4444" />
          <RNText style={styles.restaurantCardTimeText}>{time}</RNText>
        </View>
      )}

      <View style={styles.restaurantCardBody}>
        {image && (
          <Image source={{ uri: image }} style={styles.restaurantCardImage} />
        )}
        <View style={styles.restaurantCardContent}>
          <RNText style={styles.restaurantCardName}>{name}</RNText>

          <View style={styles.restaurantCardCuisine}>
            <RNText style={styles.restaurantCardCuisineText}>{cuisine}</RNText>
            <RNText style={styles.restaurantCardPriceLevel}>
              {priceLevelString}
            </RNText>
          </View>

          {description && (
            <RNText style={styles.restaurantCardDescription} numberOfLines={2}>
              {description}
            </RNText>
          )}

          {rating && (
            <View style={styles.restaurantCardRating}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <RNText style={styles.restaurantCardRatingText}>
                {rating.toFixed(1)}
              </RNText>
              {reviewCount && (
                <RNText style={styles.restaurantCardReviewCount}>
                  ({reviewCount} reviews)
                </RNText>
              )}
            </View>
          )}

          {reservationUrl && (
            <TouchableOpacity
              style={styles.restaurantCardButton}
              onPress={() => openURL(reservationUrl)}
              activeOpacity={0.8}
            >
              <RNText style={styles.restaurantCardButtonText}>
                Reserve Table
              </RNText>
              <Ionicons name="arrow-forward" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// =============================================================================
// DayTimeline Component
// =============================================================================

type DayTimelineProps = z.infer<typeof DayTimelineSchema>;

export const DayTimeline: React.FC<DayTimelineProps> = ({ items }) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "restaurant":
        return "#ef4444";
      case "transport":
        return "#3b82f6";
      case "rest":
        return "#8b5cf6";
      default:
        return colors.primary[500];
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "restaurant":
        return "restaurant";
      case "transport":
        return "car";
      case "rest":
        return "bed";
      default:
        return "location";
    }
  };

  return (
    <View style={styles.dayTimeline}>
      {items.map((item, index) => (
        <View key={index} style={styles.timelineItem}>
          <View style={styles.timelineTime}>
            <RNText style={styles.timelineTimeText}>{item.time}</RNText>
          </View>
          <View style={styles.timelineDot}>
            <View
              style={[
                styles.timelineDotInner,
                { backgroundColor: getTypeColor(item.type) },
              ]}
            />
            {index < items.length - 1 && <View style={styles.timelineLine} />}
          </View>
          <View style={styles.timelineContent}>
            <View
              style={[
                styles.timelineIcon,
                { backgroundColor: `${getTypeColor(item.type)}15` },
              ]}
            >
              <Ionicons
                name={getTypeIcon(item.type) as any}
                size={16}
                color={getTypeColor(item.type)}
              />
            </View>
            <RNText style={styles.timelineTitle}>{item.title}</RNText>
          </View>
        </View>
      ))}
    </View>
  );
};

// =============================================================================
// BookingButton Component
// =============================================================================

type BookingButtonProps = z.infer<typeof BookingButtonSchema>;

export const BookingButton: React.FC<BookingButtonProps> = ({
  label,
  url,
  provider,
  price,
}) => {
  return (
    <TouchableOpacity
      style={styles.bookingButton}
      onPress={() => openURL(url)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[colors.primary[500], colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bookingButtonGradient}
      >
        <View style={styles.bookingButtonContent}>
          <RNText style={styles.bookingButtonLabel}>{label}</RNText>
          {provider && (
            <RNText style={styles.bookingButtonProvider}>via {provider}</RNText>
          )}
        </View>
        {price && <RNText style={styles.bookingButtonPrice}>${price}</RNText>}
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
};

// =============================================================================
// PriceTag Component
// =============================================================================

type PriceTagProps = z.infer<typeof PriceTagSchema>;

export const PriceTag: React.FC<PriceTagProps> = ({
  amount,
  currency = "USD",
  period,
}) => {
  const currencySymbol = currency === "USD" ? "$" : currency;

  return (
    <View style={styles.priceTag}>
      <RNText style={styles.priceTagAmount}>
        {currencySymbol}
        {amount.toLocaleString()}
      </RNText>
      {period && <RNText style={styles.priceTagPeriod}>{period}</RNText>}
    </View>
  );
};

// =============================================================================
// RatingStars Component
// =============================================================================

type RatingStarsProps = z.infer<typeof RatingStarsSchema>;

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  reviewCount,
}) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <View style={styles.ratingStars}>
      <View style={styles.stars}>
        {[...Array(fullStars)].map((_, i) => (
          <Ionicons key={`full-${i}`} name="star" size={16} color="#fbbf24" />
        ))}
        {hasHalfStar && <Ionicons name="star-half" size={16} color="#fbbf24" />}
        {[...Array(5 - fullStars - (hasHalfStar ? 1 : 0))].map((_, i) => (
          <Ionicons
            key={`empty-${i}`}
            name="star-outline"
            size={16}
            color="#fbbf24"
          />
        ))}
      </View>
      <RNText style={styles.ratingValue}>{rating.toFixed(1)}</RNText>
      {reviewCount && (
        <RNText style={styles.reviewCount}>
          ({reviewCount.toLocaleString()} reviews)
        </RNText>
      )}
    </View>
  );
};

// =============================================================================
// MapPreview Component
// =============================================================================

type MapPreviewProps = z.infer<typeof MapPreviewSchema>;

export const MapPreview: React.FC<MapPreviewProps> = ({
  markers,
  center,
  zoom = 13,
}) => {
  // For now, we'll show a placeholder for maps
  // In production, you might want to use react-native-maps or Google Maps Static API
  const centerCoords = center || markers[0];

  return (
    <View style={styles.mapPreview}>
      <View style={styles.mapPreviewPlaceholder}>
        <Ionicons name="map" size={48} color={colors.neutral[300]} />
        <RNText style={styles.mapPreviewPlaceholderText}>Map View</RNText>
      </View>
      <View style={styles.mapPreviewOverlay}>
        <Ionicons name="location" size={24} color={colors.primary[600]} />
        <RNText style={styles.mapPreviewLabel}>
          {markers.length} location{markers.length > 1 ? "s" : ""}
        </RNText>
      </View>
    </View>
  );
};

// =============================================================================
// Component Registry
// =============================================================================

export const registry = {
  TripSummary,
  HeroImage,
  Section,
  Text,
  HotelCard,
  ItineraryDay,
  ActivityCard,
  RestaurantCard,
  DayTimeline,
  BookingButton,
  PriceTag,
  RatingStars,
  MapPreview,
};

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // TripSummary
  tripSummary: {
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.md,
  },
  tripSummaryGradient: {
    padding: spacing.lg,
    alignItems: "center",
  },
  tripSummaryIcon: {
    marginBottom: spacing.sm,
  },
  tripSummaryDestination: {
    ...typography.h1,
    color: "#fff",
    marginBottom: spacing.md,
    textAlign: "center",
  },
  tripSummaryDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
  },
  tripSummaryDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  tripSummaryDetailText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
  },

  // HeroImage
  heroImage: {
    height: 250,
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  heroImageImg: {
    width: "100%",
    height: "100%",
  },
  heroImageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },

  // Section
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.neutral[900],
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Text
  text: {
    marginVertical: spacing.xs,
  },
  textBody: {
    ...typography.body,
    color: colors.neutral[700],
  },
  textCaption: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  textSubtitle: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    fontWeight: "600",
  },
  textTitle: {
    ...typography.h3,
    color: colors.neutral[900],
  },

  // Shared Card
  card: {
    backgroundColor: "#fff",
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
    overflow: "hidden",
    ...shadows.md,
  },

  // HotelCard
  hotelCard: {},
  hotelCardImage: {
    width: "100%",
    height: 200,
  },
  hotelCardContent: {
    padding: spacing.lg,
  },
  hotelCardHeader: {
    marginBottom: spacing.sm,
  },
  hotelCardName: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  hotelCardRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  hotelCardRatingText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  hotelCardReviewCount: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  hotelCardDescription: {
    ...typography.body,
    color: colors.neutral[600],
    marginBottom: spacing.md,
  },
  hotelCardPrice: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: spacing.md,
  },
  hotelCardPriceLabel: {
    fontSize: 14,
    color: colors.neutral[500],
    marginRight: spacing.xs,
  },
  hotelCardPriceAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary[600],
  },
  hotelCardPricePeriod: {
    fontSize: 14,
    color: colors.neutral[500],
    marginLeft: spacing.xs,
  },
  amenitiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  amenityPill: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  amenityText: {
    fontSize: 12,
    color: colors.neutral[700],
    fontWeight: "500",
  },
  hotelCardButton: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  hotelCardButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  hotelCardButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // ItineraryDay
  itineraryDay: {
    marginVertical: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary[500],
  },
  itineraryDayBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.xs,
  },
  itineraryDayNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  itineraryDayDate: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing.xs,
  },
  itineraryDayTitle: {
    ...typography.h2,
    color: colors.neutral[900],
  },

  // ActivityCard
  activityCard: {},
  activityCardTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  activityCardTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary[700],
  },
  activityCardBody: {
    flexDirection: "row",
    padding: spacing.md,
  },
  activityCardImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  activityCardContent: {
    flex: 1,
  },
  activityCardName: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  activityCardLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  activityCardLocationText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  activityCardDescription: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginBottom: spacing.sm,
  },
  activityCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  activityCardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  activityCardMetaText: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  activityCardReviewCount: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  activityCardPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary[600],
    marginLeft: "auto",
  },
  activityCardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  activityCardButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary[600],
  },

  // RestaurantCard
  restaurantCard: {},
  restaurantCardTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  restaurantCardTimeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
  },
  restaurantCardBody: {
    flexDirection: "row",
    padding: spacing.md,
  },
  restaurantCardImage: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  restaurantCardContent: {
    flex: 1,
  },
  restaurantCardName: {
    ...typography.h3,
    color: colors.neutral[900],
    marginBottom: spacing.xs,
  },
  restaurantCardCuisine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  restaurantCardCuisineText: {
    fontSize: 14,
    color: colors.neutral[600],
  },
  restaurantCardPriceLevel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary[600],
  },
  restaurantCardDescription: {
    ...typography.bodySmall,
    color: colors.neutral[600],
    marginBottom: spacing.sm,
  },
  restaurantCardRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  restaurantCardRatingText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  restaurantCardReviewCount: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  restaurantCardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: "#fef2f2",
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  restaurantCardButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },

  // DayTimeline
  dayTimeline: {
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineTime: {
    width: 60,
    paddingTop: spacing.xs,
  },
  timelineTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[500],
  },
  timelineDot: {
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  timelineDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.neutral[200],
    marginTop: spacing.xs,
  },
  timelineContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineTitle: {
    ...typography.body,
    color: colors.neutral[800],
    flex: 1,
  },

  // BookingButton
  bookingButton: {
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.md,
  },
  bookingButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  bookingButtonContent: {
    flex: 1,
  },
  bookingButtonLabel: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  bookingButtonProvider: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  bookingButtonPrice: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginRight: spacing.md,
  },

  // PriceTag
  priceTag: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
  },
  priceTagAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary[600],
  },
  priceTagPeriod: {
    fontSize: 14,
    color: colors.neutral[500],
  },

  // RatingStars
  ratingStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.neutral[700],
  },
  reviewCount: {
    fontSize: 14,
    color: colors.neutral[500],
  },

  // MapPreview
  mapPreview: {
    height: 200,
    marginVertical: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    ...shadows.md,
  },
  mapPreviewPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.neutral[100],
    justifyContent: "center",
    alignItems: "center",
  },
  mapPreviewPlaceholderText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: "500",
  },
  mapPreviewOverlay: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    ...shadows.sm,
  },
  mapPreviewLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.neutral[900],
  },
});
