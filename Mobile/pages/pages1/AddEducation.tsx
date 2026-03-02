import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';

type AddEducationProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: any) => void;
};

export default function AddEducation({ visible, onClose, onAdd }: AddEducationProps) {
  const [schoolName, setSchoolName] = useState('');
  const [degree, setDegree] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentlyStudying, setCurrentlyStudying] = useState(false);

  const handleAddEducation = () => {
    const data = {
      schoolName,
      degree,
      fieldOfStudy,
      startDate,
      endDate,
      currentlyStudying,
    };
    onAdd?.(data);
    // Reset form
    setSchoolName('');
    setDegree('');
    setFieldOfStudy('');
    setStartDate('');
    setEndDate('');
    setCurrentlyStudying(false);
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
          <Text style={styles.modalTitle}>Add Education</Text>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* School Name */}
            <View style={styles.section}>
              <Text style={styles.label}>School/University name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g University of the Philippines"
                placeholderTextColor="#9ca3af"
                value={schoolName}
                onChangeText={setSchoolName}
              />
            </View>

            {/* Degree */}
            <View style={styles.section}>
              <Text style={styles.label}>Degree</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g Bachelor of Science"
                placeholderTextColor="#9ca3af"
                value={degree}
                onChangeText={setDegree}
              />
            </View>

            {/* Field of Study */}
            <View style={styles.section}>
              <Text style={styles.label}>Field of study</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g Information Technology"
                placeholderTextColor="#9ca3af"
                value={fieldOfStudy}
                onChangeText={setFieldOfStudy}
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
                  editable={!currentlyStudying}
                />
              </View>
            </View>

            {/* Checkbox */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity 
                style={[styles.checkbox, currentlyStudying && styles.checkboxActive]}
                onPress={() => setCurrentlyStudying(!currentlyStudying)}
              >
                {currentlyStudying && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>I am currently studying</Text>
            </View>

            {/* Add Button */}
            <TouchableOpacity style={styles.addButton} onPress={handleAddEducation}>
              <Text style={styles.addButtonText}>Add Education</Text>
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
