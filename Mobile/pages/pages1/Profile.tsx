import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Navigation from '../../components/navigation';
import AddExperience from './AddExperience';
import AddEducation from './AddEducation';
import AddCV from './AddCV';

type ProfileProps = {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenSettings?: () => void;
  currentRole?: 'worker' | 'employer';
  onSwitchRole?: (role: 'worker' | 'employer') => void;
};

export default function Profile({
  activeTab = 'Profile',
  onTabPress,
  onOpenSettings,
  currentRole = 'worker',
  onSwitchRole,
}: ProfileProps) {
  const [profileTab, setProfileTab] = useState(activeTab || 'Profile');
  const [showAddExperience, setShowAddExperience] = useState(false);
  const [showAddEducation, setShowAddEducation] = useState(false);
  const [showAddCV, setShowAddCV] = useState(false);

  const handleTabPress = (tab: string) => {
    setProfileTab(tab);
    onTabPress?.(tab);
  };

  const handleRoleSwitch = (role: 'worker' | 'employer') => {
    if (role === currentRole) return;
    onSwitchRole?.(role);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Details</Text>
        <TouchableOpacity onPress={onOpenSettings}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>JD</Text>
            </View>
            <TouchableOpacity style={styles.cameraBtn}>
              <Text style={styles.cameraIcon}>📷</Text>
            </TouchableOpacity>
          </View>

          {/* Name */}
          <Text style={styles.name}>Jonas</Text>

          <View style={styles.roleSwitchRow}>
            <TouchableOpacity
              style={[styles.roleChip, currentRole === 'worker' && styles.roleChipActive]}
              onPress={() => handleRoleSwitch('worker')}
            >
              <Text style={[styles.roleChipText, currentRole === 'worker' && styles.roleChipTextActive]}>
                Worker
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleChip, currentRole === 'employer' && styles.roleChipActive]}
              onPress={() => handleRoleSwitch('employer')}
            >
              <Text style={[styles.roleChipText, currentRole === 'employer' && styles.roleChipTextActive]}>
                Employer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statCount}>5</Text>
              <Text style={styles.statLabel}>Applied</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>5</Text>
              <Text style={styles.statLabel}>Reviewed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statCount}>5</Text>
              <Text style={styles.statLabel}>Interview</Text>
            </View>
          </View>
        </View>

        {/* Experience Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Experience</Text>
            <TouchableOpacity onPress={() => setShowAddExperience(true)}>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          </View>

          {[1, 2].map((item) => (
            <View key={item} style={styles.experienceItem}>
              <View style={styles.expLogo}>
                <Text style={styles.expLogoText}>📦</Text>
              </View>
              <View style={styles.expInfo}>
                <Text style={styles.expTitle}>Mobile Developer Designer</Text>
                <Text style={styles.expCompany}>Company Name</Text>
                <Text style={styles.expDate}>Jan 22 - Feb 23</Text>
              </View>
              <Text style={styles.expLocation}>Pangasinan, PH</Text>
            </View>
          ))}
        </View>

        {/* Education Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Education</Text>
            <TouchableOpacity onPress={() => setShowAddEducation(true)}>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.educationItem}>
            <View style={styles.eduLogo}>
              <Text style={styles.eduLogoText}>🎓</Text>
            </View>
            <View style={styles.eduInfo}>
              <Text style={styles.eduTitle}>Information Technology</Text>
              <Text style={styles.eduSchool}>University's Name</Text>
              <Text style={styles.eduDate}>Jan 22 - Feb 23</Text>
            </View>
            <Text style={styles.eduLocation}>Pangasinan, PH</Text>
          </View>
        </View>

        {/* CV Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>CV</Text>
            <TouchableOpacity onPress={() => setShowAddCV(true)}>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cvFile}>
            <View style={styles.cvIcon}>
              <Text style={styles.cvIconText}>📄</Text>
            </View>
            <View style={styles.cvInfo}>
              <Text style={styles.cvFileName}>Enriquez, Jonas CV.PDF</Text>
              <Text style={styles.cvFileSize}>PDF • 2MB</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.downloadIcon}>⬇️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <Navigation activeTab={profileTab} onTabPress={handleTabPress} />

      {/* Modals */}
      <AddExperience 
        visible={showAddExperience} 
        onClose={() => setShowAddExperience(false)}
        onAdd={(data) => {
          console.log('Add experience:', data);
          setShowAddExperience(false);
        }}
      />
      <AddEducation 
        visible={showAddEducation} 
        onClose={() => setShowAddEducation(false)}
        onAdd={(data) => {
          console.log('Add education:', data);
          setShowAddEducation(false);
        }}
      />
      <AddCV 
        visible={showAddCV} 
        onClose={() => setShowAddCV(false)}
        onAdd={(data) => {
          console.log('Add CV:', data);
          setShowAddCV(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1e3a5f',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  settingsIcon: { fontSize: 24 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  profileCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    gap: 20,
  },
  avatarContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3b5a85',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#4a7ba7',
  },
  avatarText: { fontSize: 40, fontWeight: '700', color: '#fff' },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1e3a5f',
  },
  cameraIcon: { fontSize: 16 },
  name: { fontSize: 24, fontWeight: '700', color: '#fff' },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statCount: { fontSize: 20, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 12, color: '#b0c4de', marginTop: 4 },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#3b5a85',
  },
  roleSwitchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  roleChipActive: {
    backgroundColor: '#0a2847',
    borderColor: '#0a2847',
  },
  roleChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  roleChipTextActive: { color: '#ffffff' },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  editIcon: { fontSize: 18 },
  experienceItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  expLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expLogoText: { fontSize: 24 },
  expInfo: { flex: 1 },
  expTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  expCompany: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  expDate: { fontSize: 12, color: '#9ca3af' },
  expLocation: { fontSize: 12, color: '#6b7280' },
  educationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  eduLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eduLogoText: { fontSize: 24 },
  eduInfo: { flex: 1 },
  eduTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  eduSchool: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  eduDate: { fontSize: 12, color: '#9ca3af' },
  eduLocation: { fontSize: 12, color: '#6b7280' },
  cvFile: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  cvIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cvIconText: { fontSize: 24 },
  cvInfo: { flex: 1 },
  cvFileName: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  cvFileSize: { fontSize: 12, color: '#6b7280' },
  downloadIcon: { fontSize: 20 },
});
