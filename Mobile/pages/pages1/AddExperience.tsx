import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';

type AddExperienceProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: any) => void;
};

export default function AddExperience({ visible, onClose, onAdd }: AddExperienceProps) {
  const [jobPosition, setJobPosition] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stillWorking, setStillWorking] = useState(false);

  const handleAddExperience = () => {
    const data = {
      jobPosition,
      companyName,
      startDate,
      endDate,
      stillWorking,
    };
    onAdd?.(data);
    // Reset form
    setJobPosition('');
    setCompanyName('');
    setStartDate('');
    setEndDate('');
    setStillWorking(false);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.overlay} />
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Add Experience</Text>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Add Logo */}
            <View style={styles.section}>
              <Text style={styles.label}>Add logo</Text>
              <TouchableOpacity style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>Add logo</Text>
              </TouchableOpacity>
            </View>

            {/* Job Position */}
            <View style={styles.section}>
              <Text style={styles.label}>Job position</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g UI/UX Designer"
                placeholderTextColor="#9ca3af"
                value={jobPosition}
                onChangeText={setJobPosition}
              />
            </View>

            {/* Company Name */}
            <View style={styles.section}>
              <Text style={styles.label}>Company name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g Google"
                placeholderTextColor="#9ca3af"
                value={companyName}
                onChangeText={setCompanyName}
              />
            </View>

            {/* Dates Row */}
            <View style={styles.datesRow}>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={styles.label}>Start date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="mm/dd/yyyy"
                  placeholderTextColor="#9ca3af"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={styles.label}>End date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="mm/dd/yyyy"
                  placeholderTextColor="#9ca3af"
                  value={endDate}
                  onChangeText={setEndDate}
                  editable={!stillWorking}
                />
              </View>
            </View>

            {/* Checkbox */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity 
                style={[styles.checkbox, stillWorking && styles.checkboxActive]}
                onPress={() => setStillWorking(!stillWorking)}
              >
                {stillWorking && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>I am still working in this role</Text>
            </View>

            {/* Add Button */}
            <TouchableOpacity style={styles.addButton} onPress={handleAddExperience}>
              <Text style={styles.addButtonText}>Add Experience</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  scroll: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  logoPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  logoText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  datesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  checkboxText: {
    fontSize: 14,
    color: '#1f2937',
  },
  addButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
