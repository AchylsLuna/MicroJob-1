import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import ScrollView from '../components/ui/SmoothScrollView';
import { tokens } from '../theme/tokens';
import { LEGAL_DOCUMENTS, type LegalDocId } from '../lib/legalDocuments';
import { LEGAL_INFO } from '../lib/legal';

type Props = {
  initialDocId?: LegalDocId;
  onBack?: () => void;
};

/**
 * Reachable from sign-up's "Terms of Service" / "Privacy Policy" links (and
 * directly via the AuthStack route). Renders the same document content as
 * the web `/legal` page — `lib/legalDocuments.ts` mirrors
 * `client/src/constants/legalDocuments.ts` — with an in-screen switcher so
 * all three documents are one tap apart instead of three separate screens.
 */
export default function LegalDocument({ initialDocId = 'terms', onBack }: Props) {
  const { t } = useTranslation('auth');
  const [activeId, setActiveId] = useState<LegalDocId>(initialDocId);
  const activeDoc = useMemo(
    () => LEGAL_DOCUMENTS.find((doc) => doc.id === activeId) ?? LEGAL_DOCUMENTS[0],
    [activeId],
  );

  return (
    <View style={styles.container}>
      <AppHeader title={activeDoc.title} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.tabRow} accessibilityRole="tablist">
          {LEGAL_DOCUMENTS.map((doc) => {
            const selected = doc.id === activeDoc.id;
            return (
              <TouchableOpacity
                key={doc.id}
                onPress={() => setActiveId(doc.id)}
                style={[styles.tab, selected && styles.tabSelected]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={doc.label}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{doc.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.effectiveDate}>
          {t('legalDocument.effectiveDate', { date: LEGAL_INFO.effectiveDate })}
        </Text>

        <View style={styles.sections}>
          {activeDoc.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.paragraphs.map((paragraph, index) => (
                <Text key={index} style={styles.paragraph}>{paragraph}</Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactHeading}>{activeDoc.contactHeading}</Text>
          {activeDoc.showLegalEntity ? <Text style={styles.contactEntity}>{LEGAL_INFO.legalEntity}</Text> : null}
          <View style={styles.contactLinks}>
            <TouchableOpacity
              style={styles.contactLink}
              onPress={() => void Linking.openURL(`mailto:${LEGAL_INFO.supportEmail}`)}
              accessibilityRole="link"
              accessibilityLabel={LEGAL_INFO.supportEmail}
            >
              <Feather name="mail" size={14} color={tokens.colors.brand} />
              <Text style={styles.contactLinkText}>{LEGAL_INFO.supportEmail}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactLink}
              onPress={() => void Linking.openURL(LEGAL_INFO.supportPhoneHref)}
              accessibilityRole="link"
              accessibilityLabel={LEGAL_INFO.supportPhone}
            >
              <Feather name="phone" size={14} color={tokens.colors.brand} />
              <Text style={styles.contactLinkText}>{LEGAL_INFO.supportPhone}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.signedInCanvas },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48, gap: 16 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
  },
  tabSelected: {
    borderColor: tokens.colors.brand,
    backgroundColor: tokens.colors.brandSoft,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: tokens.colors.textMuted },
  tabTextSelected: { color: tokens.colors.brand },
  effectiveDate: { fontSize: 13, color: tokens.colors.textMuted },
  sections: { gap: 18 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.text },
  paragraph: { fontSize: 14, lineHeight: 21, color: '#374151' },
  contactCard: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceMuted,
    padding: 16,
    gap: 8,
  },
  contactHeading: { fontSize: 14, fontWeight: '700', color: tokens.colors.text },
  contactEntity: { fontSize: 13, color: tokens.colors.textMuted },
  contactLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  contactLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  contactLinkText: { fontSize: 13, fontWeight: '700', color: tokens.colors.brand },
});
