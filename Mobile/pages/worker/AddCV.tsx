import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';

type AddCVProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: any) => void;
};

export default function AddCV({ visible, onClose, onAdd }: AddCVProps) {
  const [cvFileName, setCvFileName] = useState('');

  const handlePickFile = () => {
    // In a real app, this would open file picker
    // For now, just trigger the upload
    setCvFileName('Resume.pdf');
  };

  const handleAddCV = () => {
    if (cvFileName) {
      onAdd?.({ cvFileName });
      setCvFileName('');
      onClose?.();
    }
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
          <Text style={styles.modalTitle}>Upload CV</Text>

          <View style={styles.content}>
            {/* File Picker */}
            <Text style={styles.label}>Select your CV file</Text>
            <TouchableOpacity style={styles.filePicker} onPress={handlePickFile}>
              <Text style={styles.filePickerIcon}>📁</Text>
              <Text style={styles.filePickerText}>
                {cvFileName || 'Choose file'}
              </Text>
            </TouchableOpacity>

            {/* File Type Info */}
            <Text style={styles.info}>
              Supported formats: PDF, DOC, DOCX (Max 5MB)
            </Text>

            {/* Current File Display */}
            {cvFileName && (
              <View style={styles.selectedFile}>
                <View style={styles.fileIcon}>
                  <Text style={styles.fileIconText}>📄</Text>
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{cvFileName}</Text>
                  <Text style={styles.fileSize}>PDF • 2MB</Text>
                </View>
                <TouchableOpacity onPress={() => setCvFileName('')}>
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Upload Button */}
            <TouchableOpacity 
              style={[styles.uploadButton, !cvFileName && styles.uploadButtonDisabled]} 
              onPress={handleAddCV}
              disabled={!cvFileName}
            >
              <Text style={styles.uploadButtonText}>Upload CV</Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 24,
  },
  content: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  filePicker: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
  },
  filePickerIcon: {
    fontSize: 32,
  },
  filePickerText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  info: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  selectedFile: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: 20,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6b7280',
  },
  removeIcon: {
    fontSize: 20,
    color: '#9ca3af',
    fontWeight: '700',
  },
  uploadButton: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
