import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { AUTH_COLORS, clamp } from '../../theme/authTheme';

type AuthStepCardProps = {
  step: number | string;
  title: string;
  subtitle?: string;
  dark?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function AuthStepCard({
  step,
  title,
  subtitle,
  dark = false,
  children,
  style,
}: AuthStepCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardRadius = clamp(screenWidth * 0.07, 20, 24);
  const cardPadding = clamp(screenWidth * 0.052, 18, 24);
  const badgeSize = clamp(screenWidth * 0.078, 28, 32);
  const badgeTextSize = clamp(screenWidth * 0.034, 12, 14);
  const titleSize = clamp(screenWidth * 0.055, 18, 22);
  const subtitleSize = clamp(screenWidth * 0.042, 14, 16);

  return (
    <View
      style={[
        styles.card,
        dark ? styles.darkCard : styles.lightCard,
        {
          borderRadius: cardRadius,
          padding: cardPadding,
        },
        style,
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.stepBadge,
            dark ? styles.darkStepBadge : styles.lightStepBadge,
            {
              minWidth: badgeSize,
              minHeight: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          <Text
            style={[
              styles.stepBadgeText,
              dark ? styles.darkStepBadgeText : styles.lightStepBadgeText,
              { fontSize: badgeTextSize },
            ]}
          >
            {step}
          </Text>
        </View>
        <Text
          style={[styles.cardTitle, dark ? styles.darkCardTitle : styles.lightCardTitle, { fontSize: titleSize }]}
        >
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text
          style={[
            styles.cardSubtitle,
            dark ? styles.darkCardSubtitle : styles.lightCardSubtitle,
            { fontSize: subtitleSize, lineHeight: Math.round(subtitleSize * 1.45) },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
  },
  lightCard: {
    borderColor: AUTH_COLORS.cardBorder,
    backgroundColor: AUTH_COLORS.cardDark,
  },
  darkCard: {
    borderColor: AUTH_COLORS.cardBorderActive,
    backgroundColor: AUTH_COLORS.cardDarkAlt,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    flexWrap: 'wrap',
    rowGap: 8,
  },
  stepBadge: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  lightStepBadge: {
    borderColor: AUTH_COLORS.cardBorder,
    backgroundColor: AUTH_COLORS.primary,
  },
  darkStepBadge: {
    borderColor: AUTH_COLORS.cardBorderActive,
    backgroundColor: AUTH_COLORS.primary,
  },
  stepBadgeText: {
    fontWeight: '800',
  },
  lightStepBadgeText: {
    color: AUTH_COLORS.primaryText,
  },
  darkStepBadgeText: {
    color: AUTH_COLORS.primaryText,
  },
  cardTitle: {
    fontWeight: '700',
    flexShrink: 1,
  },
  lightCardTitle: {
    color: AUTH_COLORS.textPrimary,
  },
  darkCardTitle: {
    color: AUTH_COLORS.textPrimary,
  },
  cardSubtitle: {
    marginBottom: 14,
    fontWeight: '500',
  },
  lightCardSubtitle: {
    color: AUTH_COLORS.textSecondary,
  },
  darkCardSubtitle: {
    color: AUTH_COLORS.textMuted,
  },
});
