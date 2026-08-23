import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import { useToast } from '../../contexts/ToastContext';
import { apiRequest } from '../../lib/api';
import { validateMobileResume } from '../../lib/profileValidation';
import { Ionicons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

type AddCVProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: any) => Promise<void> | void;
};

type SelectedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export default function AddCV({ visible, onClose, onAdd }: AddCVProps) {
  const { t } = useTranslation('worker');
  const insets = useSafeAreaInsets();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

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
        const validation = validateMobileResume({
          fileName: file.name,
          mimeType: file.mimeType,
          fileSize: file.size,
        });
        if (validation.error) {
          setError(validation.error);
          toast.error(validation.error);
          return;
        }

        setError('');
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          mimeType: validation.mimeType,
          size: file.size || 0,
        });
      }
    } catch (error) {
      console.error('Error picking file:', error);
      const message = t('addCv.toast.pickFailed');
      setError(message);
      toast.error(message);
    }
  };

  const handleAddCV = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        toast.error(t('addCv.toast.authMissing'));
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
      const result = await apiRequest<{ resumeFileName?: string; resumeUrl?: string }>(
        `${API_URL}/auth/profile/resume`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData },
        t('addCv.apiFallback.uploadFailed'),
      );

      if (!result.ok) throw new Error(result.message);
      await onAdd?.({
        resumeFileName: result.data?.resumeFileName || selectedFile.name,
        resumeUrl: result.data?.resumeUrl,
      });
      toast.success(t('addCv.toast.uploadSuccess'));
      setSelectedFile(null);
      onClose?.();
    } catch (uploadError) {
      console.error('Error uploading resume:', uploadError);
      const message = uploadError instanceof Error && uploadError.message
        ? uploadError.message
        : t('addCv.toast.uploadFailed');
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError('');
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}
      >
        <View style={styles.overlay} accessible={false} />
        <View style={[styles.modal, { paddingBottom: 30 + Math.max(insets.bottom, 8) }]} accessibilityViewIsModal accessibilityLabel={t('addCv.modalTitle')}>
          <Text style={styles.modalTitle} accessibilityRole="header">{t('addCv.modalTitle')}</Text>

          <View style={styles.content}>
            {/* File Picker */}
            <Text style={styles.label}>{t('addCv.selectLabel')}</Text>
            <TouchableOpacity
              style={styles.filePicker}
              onPress={handlePickFile}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel={selectedFile ? t('addCv.filePicker.changeAccessibility') : t('addCv.filePicker.chooseAccessibility')}
              accessibilityHint={t('addCv.filePicker.hint')}
              accessibilityState={{ disabled: isUploading }}
            >
              <Ionicons name="folder-open-outline" size={32} color="#64748B" accessibilityElementsHidden />
              <Text style={styles.filePickerText}>
                {selectedFile ? t('addCv.filePicker.changeLabel') : t('addCv.filePicker.chooseLabel')}
              </Text>
            </TouchableOpacity>

            {/* File Type Info */}
            <Text style={styles.info}>
              {t('addCv.info')}
            </Text>

            {error ? <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="assertive">{error}</Text> : null}

            {/* Current File Display */}
            {selectedFile && (
              <View style={styles.selectedFile} accessible accessibilityLabel={t('addCv.selectedFile.accessibilityLabel', { name: selectedFile.name, extension: getFileExtension(selectedFile.name), size: formatFileSize(selectedFile.size) })}>
                <View style={styles.fileIcon}>
                  <Ionicons name="document-text-outline" size={22} color="#475569" accessibilityElementsHidden />
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
                  accessibilityRole="button"
                  accessibilityLabel={t('addCv.selectedFile.removeAccessibility', { name: selectedFile.name })}
                  accessibilityState={{ disabled: isUploading }}
                >
                  <Ionicons name="close" size={24} color="#64748B" />
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
              accessibilityRole="button"
              accessibilityLabel={t('addCv.upload.accessibilityLabel')}
              accessibilityState={{ disabled: !selectedFile || isUploading, busy: isUploading }}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.uploadButtonText}>{t('addCv.upload.button')}</Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isUploading}
              accessibilityRole="button"
              accessibilityLabel={t('addCv.cancel.accessibilityLabel')}
              accessibilityState={{ disabled: isUploading }}
            >
              <Text style={styles.cancelButtonText}>{t('addCv.cancel.button')}</Text>
            </TouchableOpacity>
          </View>
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
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: tokens.colors.surface,
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
  errorText: {
    color: '#991B1B',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 18,
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
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
  uploadButton: {
    backgroundColor: tokens.colors.brand,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: tokens.colors.surface,
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
