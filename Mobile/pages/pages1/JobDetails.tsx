import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import Navigation from '../../components/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

type JobDetailsProps = {
  onBack?: () => void;
  job: any;
  onSaveJob?: (job: any) => void;
  isSaved?: boolean;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
};

export default function JobDetails({ job, onSaveJob, isSaved = false, activeTab = 'Jobs', onTabPress }: JobDetailsProps) {
  const [saved, setSaved] = useState(isSaved);
  const [showSuccess, setShowSuccess] = useState(false);
  const [jobDetails, setJobDetails] = useState(job);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTabPress = (tab: string) => {
    onTabPress?.(tab);
  };

  const handleSave = () => {
    setSaved(!saved);
    onSaveJob?.(job);
  };

  const handleApply = () => {
    applyForJob();
  };

  const handleFindMoreJobs = () => {
    setShowSuccess(false);
    onTabPress?.('Jobs');
  };

  const handleBackToHome = () => {
    setShowSuccess(false);
    onTabPress?.('Home');
  };

  const applyForJob = async () => {
    if (!jobDetails?._id) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/jobs/${jobDetails._id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to apply.');
      }
      setShowSuccess(true);
    } catch (error: any) {
      const message = error?.message || 'Failed to apply.';
      setErrorMessage(message);
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDetails = async () => {
    if (!job?._id) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_URL}/jobs/${job._id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load job.');
      }
      setJobDetails(data);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load job.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [job?._id]);

  if (showSuccess) {
    console.log('Rendering success screen');
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f7fa' }}>
        <View style={styles.successContainer}>
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Successful!</Text>
            <Text style={styles.successMessage}>
              Congratulations, your application has been sent. Good luck!
            </Text>
            <TouchableOpacity style={styles.findJobsBtn} onPress={handleFindMoreJobs}>
              <Text style={styles.findJobsBtnText}>Find more jobs</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBackToHome}>
              <Text style={styles.backToHomeText}>Back to home</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Navigation activeTab={activeTab} onTabPress={handleTabPress} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Job Title */}
        <Text style={styles.jobTitle}>{jobDetails?.title || 'Job Details'}</Text>
        <Text style={styles.jobMeta}>{jobDetails?.jobType || ''} {jobDetails?.location ? `• ${jobDetails.location}` : ''}</Text>
        {jobDetails?.urgent ? (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>Urgent</Text>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#1e3a5f" />
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📍</Text>
            <Text style={styles.statLabel}>LOCATION</Text>
            <Text style={styles.statValue}>{jobDetails?.location || 'N/A'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>⏰</Text>
            <Text style={styles.statLabel}>TYPE</Text>
            <Text style={styles.statValue}>{jobDetails?.jobType || 'N/A'}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statLabel}>SALARY</Text>
            <Text style={styles.statValue}>{jobDetails?.salary || 'N/A'}</Text>
          </View>
        </View>

        {/* Posted Info */}
        <Text style={styles.postedInfo}>
          This job post is managed by{' '}
          <Text style={styles.highlight}>
            {jobDetails?.jobPoster?.firstName ? `${jobDetails.jobPoster.firstName} ${jobDetails.jobPoster.lastName || ''}`.trim() : 'the employer'}
          </Text>
        </Text>

        {/* Skills */}
        <Text style={styles.sectionTitle}>Must have skills</Text>
        <View style={styles.skillsGrid}>
          {(jobDetails?.skills || []).map((skill: string, index: number) => (
            <View key={index} style={styles.skillTag}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>
          {jobDetails?.description || 'No description provided.'}
        </Text>

        {/* Requirements */}
        {jobDetails?.requirements?.length ? (
          <>
            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.requirementsList}>
              {jobDetails.requirements.map((req: string, index: number) => (
                <Text key={index} style={styles.requirementItem}>• {req}</Text>
              ))}
            </View>
          </>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.saveBtn, saved && styles.savedBtn]} 
            onPress={handleSave}
          >
            <Text style={[styles.actionBtnText, styles.saveBtnText, saved && styles.savedBtnText]}>
              {saved ? 'Saved ✓' : 'Saved job'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.applyBtn]} onPress={handleApply} disabled={isLoading}>
            <Text style={styles.actionBtnText}>{isLoading ? 'Applying...' : 'Apply now'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <Navigation activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },
  scroll: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 100 },
  jobTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  jobMeta: {
    fontSize: 14,
    color: '#b0c4de',
    textAlign: 'center',
    marginBottom: 24,
  },
  urgentBadge: {
    alignSelf: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  urgentText: { color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: { fontSize: 20, marginBottom: 8 },
  statLabel: { fontSize: 10, color: '#6b7280', marginBottom: 4, fontWeight: '600' },
  statValue: { fontSize: 12, color: '#1f2937', fontWeight: '700', textAlign: 'center' },
  postedInfo: {
    fontSize: 12,
    color: '#d1dce6',
    marginBottom: 24,
    lineHeight: 18,
  },
  highlight: { fontWeight: '700', color: '#fff' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  skillTag: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  skillText: { fontSize: 13, color: '#1f2937', fontWeight: '600' },
  description: {
    fontSize: 14,
    color: '#d1dce6',
    lineHeight: 22,
    marginBottom: 24,
  },
  loadingRow: {
    paddingVertical: 8,
  },
  errorText: {
    marginTop: 8,
    color: '#fca5a5',
    fontSize: 12,
    textAlign: 'center',
  },
  requirementsList: {
    marginBottom: 24,
  },
  requirementItem: {
    fontSize: 14,
    color: '#d1dce6',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
  },
  savedBtn: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  applyBtn: {
    backgroundColor: '#4a90e2',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtnText: {
    color: '#fff',
  },
  savedBtnText: {
    color: '#fff',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
    backgroundColor: '#f5f7fa',
  },
  successContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 48,
    color: '#fff',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  findJobsBtn: {
    width: '100%',
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  findJobsBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  backToHomeText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
});
