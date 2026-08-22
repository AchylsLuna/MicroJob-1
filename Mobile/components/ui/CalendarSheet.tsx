import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { motion } from '../../theme/motion';
import useReducedMotion from '../../hooks/useReducedMotion';
import AnimatedPressable from './AnimatedPressable';
import {
  buildMonths,
  dayState,
  getWeekdayLabels,
  nextRangeSelection,
  type DateRange,
  type MonthModel,
} from '../../lib/calendarModel';

type FooterConfig = {
  clearLabel?: string;
  onClear?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
};

type SingleProps = {
  mode?: 'single';
  value?: Date | null;
  range?: undefined;
  onChange: (next: Date | null) => void;
};

type RangeProps = {
  mode: 'range';
  value?: undefined;
  range?: DateRange;
  onChange: (next: DateRange) => void;
};

type Props = (SingleProps | RangeProps) & {
  open: boolean;
  onClose: () => void;
  minDate?: Date;
  maxDate?: Date;
  monthsToRender?: number;
  title?: string;
  footer?: FooterConfig;
};

const WEEKDAYS = getWeekdayLabels();
const CELL_SIZE = tokens.controls.minimumTouch;

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

export default function CalendarSheet(props: Props) {
  const { open, onClose, minDate, maxDate, monthsToRender = 12, title, footer } = props;
  const reducedMotion = useReducedMotion() === true;
  const translateY = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  const months = useMemo(() => buildMonths(minDate || new Date(), monthsToRender), [minDate, monthsToRender]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const duration = reducedMotion ? motion.duration.instant : motion.duration.modal;
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      const duration = reducedMotion ? motion.duration.instant : motion.duration.exit;
      Animated.parallel([
        Animated.timing(translateY, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reducedMotion]);

  if (!mounted) return null;

  const handleDayPress = (date: Date) => {
    if (props.mode === 'range') {
      const next = nextRangeSelection(props.range || { start: null, end: null }, date);
      props.onChange(next);
    } else {
      props.onChange(date);
    }
  };

  const renderMonth = ({ item }: { item: MonthModel }) => (
    <View style={styles.month}>
      <Text style={styles.monthLabel}>{item.label}</Text>
      <View style={styles.weeks}>
        {item.weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((date, dayIndex) => {
              if (!date) return <View key={dayIndex} style={styles.cell} />;

              const state =
                props.mode === 'range'
                  ? dayState(date, { mode: 'range', range: props.range || { start: null, end: null } }, { minDate, maxDate })
                  : dayState(date, { mode: 'single', value: props.value ?? null }, { minDate, maxDate });

              const disabled = state === 'disabled';
              const selected = state === 'selected' || state === 'range-start' || state === 'range-end';
              const inRange = state === 'in-range';
              const isToday = state === 'today';

              return (
                <View key={dayIndex} style={styles.cell}>
                  {inRange ? (
                    <View
                      style={[
                        styles.rangeBand,
                        dayIndex === 0 && styles.rangeBandStart,
                        dayIndex === 6 && styles.rangeBandEnd,
                      ]}
                    />
                  ) : null}
                  <Pressable
                    disabled={disabled}
                    onPress={() => handleDayPress(date)}
                    accessibilityRole="button"
                    accessibilityLabel={formatFullDate(date)}
                    accessibilityState={{ disabled, selected }}
                    style={[styles.day, selected && styles.daySelected, isToday && !selected && styles.dayToday]}
                    hitSlop={4}
                  >
                    <Text style={[styles.dayText, disabled && styles.dayTextDisabled, selected && styles.dayTextSelected]}>
                      {date.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );

  const primaryDisabled = footer?.primaryDisabled ?? false;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFillObject} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="Close calendar" accessibilityRole="button" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: translateY.interpolate({ inputRange: [0, 1], outputRange: [0, 480] }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title || 'Select a date'}</Text>
            <AnimatedPressable containerStyle={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={tokens.colors.textMuted} />
            </AnimatedPressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <FlatList
            data={months}
            keyExtractor={(item) => `${item.year}-${item.month}`}
            renderItem={renderMonth}
            showsVerticalScrollIndicator={false}
            style={styles.monthList}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
          />

          {footer ? (
            <View style={styles.footer}>
              {footer.onClear ? (
                <AnimatedPressable containerStyle={styles.clearBtn} onPress={footer.onClear} accessibilityRole="button" accessibilityLabel={footer.clearLabel || 'Clear'}>
                  <Text style={styles.clearText}>{footer.clearLabel || 'Clear'}</Text>
                </AnimatedPressable>
              ) : null}
              <AnimatedPressable
                containerStyle={[styles.primaryBtn, primaryDisabled && styles.primaryBtnDisabled]}
                onPress={footer.onPrimary}
                disabled={primaryDisabled}
                accessibilityRole="button"
                accessibilityLabel={footer.primaryLabel}
              >
                <Text style={styles.primaryText}>{footer.primaryLabel}</Text>
              </AnimatedPressable>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '86%',
    backgroundColor: tokens.colors.surface,
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    paddingTop: tokens.spacing.sm,
    ...tokens.shadow.card,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: tokens.colors.border, marginBottom: tokens.spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.sm },
  title: { fontSize: tokens.typography.h3, fontWeight: '800', color: tokens.colors.sectionText },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.surfaceMuted },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
  },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: tokens.colors.textSubtle },
  monthList: { flex: 1, paddingHorizontal: tokens.spacing.lg },
  month: { paddingTop: tokens.spacing.lg },
  monthLabel: { fontSize: tokens.typography.h3, fontWeight: '800', color: tokens.colors.sectionText, marginBottom: tokens.spacing.sm },
  weeks: { gap: 2 },
  week: { flexDirection: 'row' },
  cell: { width: `${100 / 7}%`, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  rangeBand: { position: 'absolute', left: 0, right: 0, top: 4, bottom: 4, backgroundColor: tokens.colors.brandSoft },
  rangeBandStart: { left: '15%', borderTopLeftRadius: 999, borderBottomLeftRadius: 999 },
  rangeBandEnd: { right: '15%', borderTopRightRadius: 999, borderBottomRightRadius: 999 },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: tokens.colors.brand },
  dayToday: { borderWidth: 1, borderColor: tokens.colors.brandMuted },
  dayText: { fontSize: 14, fontWeight: '600', color: tokens.colors.text },
  dayTextDisabled: { color: tokens.colors.textSubtle, textDecorationLine: 'line-through' },
  dayTextSelected: { color: tokens.colors.onBrand, fontWeight: '800' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  clearBtn: { minHeight: tokens.controls.compactHeight, justifyContent: 'center', paddingHorizontal: tokens.spacing.md, marginRight: 'auto' },
  clearText: { fontSize: 14, fontWeight: '700', color: tokens.colors.onCanvasMuted },
  primaryBtn: {
    minHeight: tokens.controls.buttonHeight,
    minWidth: 140,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  primaryBtnDisabled: { opacity: tokens.opacity.disabled },
  primaryText: { color: tokens.colors.onBrand, fontSize: 14, fontWeight: '800' },
});
