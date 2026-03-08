import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';

const YEAR_OPTIONS = [
  '1 year',
  '2 years',
  '3 years',
  '4 years',
  '5 years',
  '6 years',
  '7 years',
  '8 years',
  '9 years',
  '10+ years',
];

type AddExperienceProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: { totalExperience: string }) => void;
  initialTotalExperience?: string;
};

export default function AddExperience({ visible, onClose, onAdd, initialTotalExperience = '' }: AddExperienceProps) {
  const [selectedYears, setSelectedYears] = useState(initialTotalExperience);

  useEffect(() => {
    if (visible) {
      setSelectedYears(initialTotalExperience || '');
    }
  }, [visible, initialTotalExperience]);

  const handleAddExperience = () => {
    if (!selectedYears) return;
    const data = {
      totalExperience: selectedYears,
    };
    onAdd?.(data);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.overlay} />
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Add Experience</Text>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Select your experience</Text>
              <View style={styles.optionsGrid}>
                {YEAR_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      selectedYears === option && styles.optionButtonSelected,
                    ]}
                    onPress={() => setSelectedYears(option)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedYears === option && styles.optionTextSelected,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.addButton, !selectedYears && styles.addButtonDisabled]} 
              onPress={handleAddExperience}
              disabled={!selectedYears}
            >
              <Text style={styles.addButtonText}>Save Experience</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minWidth: '30%',
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  optionTextSelected: {
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
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
