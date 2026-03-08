import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SKILL_CATEGORIES = [
  { id: 'academic', label: 'Academic', icon: 'school-outline' as const },
  { id: 'construction', label: 'Construction', icon: 'hammer-outline' as const },
  { id: 'shopping', label: 'Shopping', icon: 'cart-outline' as const },
  { id: 'speaking', label: 'Speaking', icon: 'mic-outline' as const },
  { id: 'tutoring', label: 'Tutoring', icon: 'book-outline' as const },
  { id: 'custom', label: 'Custom', icon: 'add-circle-outline' as const },
];

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

type AddSkillsProps = {
  visible: boolean;
  onClose?: () => void;
  onAdd?: (data: { category: string; skillName: string; level: string }) => void;
};

export default function AddSkills({ visible, onClose, onAdd }: AddSkillsProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customSkillName, setCustomSkillName] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('Intermediate');

  const handleAddSkill = () => {
    if (!selectedCategory) return;
    
    // For predefined categories, use the category label as skill name
    // For custom, use the user input
    const skillName = selectedCategory === 'custom' 
      ? customSkillName.trim() 
      : SKILL_CATEGORIES.find(c => c.id === selectedCategory)?.label || '';
    
    if (!skillName) return;
    
    onAdd?.({
      category: selectedCategory,
      skillName,
      level: selectedLevel,
    });
    
    // Reset form
    setSelectedCategory('');
    setCustomSkillName('');
    setSelectedLevel('Intermediate');
    onClose?.();
  };

  const isFormValid = selectedCategory && (selectedCategory !== 'custom' || customSkillName.trim());

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
          <Text style={styles.modalTitle}>Add Skill</Text>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.label}>Select a category</Text>
              <View style={styles.categoriesGrid}>
                {SKILL_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      selectedCategory === category.id && styles.categoryCardSelected,
                    ]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Ionicons
                      name={category.icon}
                      size={28}
                      color={selectedCategory === category.id ? '#fff' : '#1e3a5f'}
                    />
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === category.id && styles.categoryTextSelected,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom skill name input - only show if "Custom" is selected */}
            {selectedCategory === 'custom' && (
              <View style={styles.section}>
                <Text style={styles.label}>Enter skill name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Graphic Design"
                  placeholderTextColor="#9ca3af"
                  value={customSkillName}
                  onChangeText={setCustomSkillName}
                  autoFocus
                />
              </View>
            )}

            {/* Skill level selector - only show if a category is selected */}
            {selectedCategory && (
              <View style={styles.section}>
                <Text style={styles.label}>Select your level</Text>
                <View style={styles.levelRow}>
                  {SKILL_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelChip,
                        selectedLevel === level && styles.levelChipSelected,
                      ]}
                      onPress={() => setSelectedLevel(level)}
                    >
                      <Text
                        style={[
                          styles.levelText,
                          selectedLevel === level && styles.levelTextSelected,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.addButton, !isFormValid && styles.addButtonDisabled]} 
              onPress={handleAddSkill}
              disabled={!isFormValid}
            >
              <Text style={styles.addButtonText}>Add Skill</Text>
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
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  categoryCardSelected: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textAlign: 'center',
  },
  categoryTextSelected: {
    color: '#fff',
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
  levelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  levelChipSelected: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  levelTextSelected: {
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
