import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';

type AddCVProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: any) => void;
};

type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export default function AddCV({ visible, onClose, onAdd }: AddCVProps) {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE';
  };

  const handlePickFile = async () => {
    try {
      // expo-document-picker handles permissions automatically
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Check file size (max 5MB)
        if (file.size && file.size > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 5MB.');
          return;
        }

        setSelectedFile({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'application/pdf',
          size: file.size || 0,
        });
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const handleAddCV = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'Authentication token not found. Please log in again.');
        return;
      }

      // Create FormData
      const formData = new FormData();
      
      // For React Native, we need to format the file properly
      const fileToUpload = {
        uri: selectedFile.uri,
        type: selectedFile.mimeType,
        name: selectedFile.name,
      } as any;

      formData.append('resume', fileToUpload);

      // Upload to server
      const response = await fetch(`${API_URL}/auth/profile/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type header - fetch will set it automatically with boundary
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Success', 'Resume uploaded successfully');
        onAdd?.({ 
          resumeFileName: result.data?.resumeFileName || selectedFile.name,
          resumeUrl: result.data?.resumeUrl 
        });
        setSelectedFile(null);
        onClose?.();
      } else {
        Alert.alert('Error', result.message || 'Failed to upload resume');
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      Alert.alert('Error', 'Failed to upload resume. Please check your connection and try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
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
          <Text style={styles.modalTitle}>Upload CV</Text>

          <View style={styles.content}>
            {/* File Picker */}
            <Text style={styles.label}>Select your CV file</Text>
            <TouchableOpacity 
              style={styles.filePicker} 
              onPress={handlePickFile}
              disabled={isUploading}
            >
              <Text style={styles.filePickerIcon}>📁</Text>
              <Text style={styles.filePickerText}>
                {selectedFile ? 'Change file' : 'Choose file'}
              </Text>
            </TouchableOpacity>

            {/* File Type Info */}
            <Text style={styles.info}>
              Supported formats: PDF, DOC, DOCX (Max 5MB)
            </Text>

            {/* Current File Display */}
            {selectedFile && (
              <View style={styles.selectedFile}>
                <View style={styles.fileIcon}>
                  <Text style={styles.fileIconText}>📄</Text>
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{selectedFile.name}</Text>
                  <Text style={styles.fileSize}>
                    {getFileExtension(selectedFile.name)} • {formatFileSize(selectedFile.size)}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedFile(null)}
                  disabled={isUploading}
                >
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Upload Button */}
            <TouchableOpacity 
              style={[
                styles.uploadButton, 
                (!selectedFile || isUploading) && styles.uploadButtonDisabled
              ]} 
              onPress={handleAddCV}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload CV</Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleClose}
              disabled={isUploading}
            >
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
