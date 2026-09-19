import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import AppHeader from '../../components/AppHeader';
import ScrollView from '../../components/ui/SmoothScrollView';
import { tokens } from '../../theme/tokens';

export default function About({ onBack }: { onBack?: () => void }) {
  const { t } = useTranslation('worker');
  return (
    <View style={styles.container}>
      <AppHeader title={t('about.headerTitle')} subtitle={t('about.headerSubtitle')} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('about.cardTitle')}</Text>
          <Text style={styles.subtitle}>{t('about.version')}</Text>
          <Text style={styles.body}>
            {t('about.body')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 112 },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.lg,
    padding: 16,
    ...tokens.shadow.card,
  },
  title: { fontSize: 18, fontWeight: '700', color: tokens.colors.text },
  subtitle: { fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 },
  body: { fontSize: 14, color: '#1f2937', marginTop: 12, lineHeight: 20 },
});
