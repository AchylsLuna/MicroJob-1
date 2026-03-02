import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';

type Category = { _id: string; name: string };

type PostJobProps = {
  onPosted?: () => void;
  jobToEdit?: any;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
};

type FormData = {
  title: string;
  category: string;
  description: string;
  requirements: string;
  responsibilities: string;
  skills: string;
  salary: string;
  location: string;
  jobType: string;
};

export default function EmployerPostJob({ onPosted, jobToEdit, activeTab, onTabPress }: PostJobProps) {
  const [formData, setFormData] = useState<FormData>({
    title: '',
    category: '',
    description: '',
    requirements: '',
    responsibilities: '',
    skills: '',
    salary: '',
    location: '',
    jobType: 'Fulltime',
  });
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [deadlineTime, setDeadlineTime] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [positionsNeeded, setPositionsNeeded] = useState('1');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [showCategoryOptions, setShowCategoryOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isEditing = Boolean(jobToEdit?._id);

  useEffect(() => {
    if (!jobToEdit) return;
    const categoryName = typeof jobToEdit.category === 'object' ? jobToEdit.category?.name : '';
    const categoryId = typeof jobToEdit.category === 'object' ? jobToEdit.category?._id : jobToEdit.category;
    const deadline = jobToEdit.deadline ? new Date(jobToEdit.deadline) : null;
    const salaryMatch = typeof jobToEdit.salary === 'string'
      ? jobToEdit.salary.match(/\d[\d,]*/g)
      : null;
    const salaryValue = salaryMatch?.[0] ? salaryMatch[0].replace(/,/g, '') : '';
    setFormData({
      title: jobToEdit.title || '',
      category: categoryId || '',
      description: jobToEdit.description || '',
      requirements: Array.isArray(jobToEdit.requirements) ? jobToEdit.requirements.join('\n') : '',
      responsibilities: Array.isArray(jobToEdit.responsibilities) ? jobToEdit.responsibilities.join('\n') : '',
      skills: Array.isArray(jobToEdit.skills) ? jobToEdit.skills.join(', ') : '',
      salary: salaryValue,
      location: jobToEdit.location || '',
      jobType: jobToEdit.jobType || 'Fulltime',
    });
    setCategoryQuery(categoryName || '');
    setDeadlineDate(deadline);
    setDeadlineTime(deadline);
    setIsUrgent(Boolean(jobToEdit.urgent));
    setPositionsNeeded(String(jobToEdit.positionsNeeded || 1));
  }, [jobToEdit]);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const response = await fetch(`${API_URL}/categories`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || 'Failed to load categories.');
        setCategories(data || []);
      } catch (error: any) {
        setErrorMessage(error?.message || 'Failed to load categories.');
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!categoryQuery) {
      setFormData((prev) => {
        if (isEditing && prev.category) return prev;
        return { ...prev, category: '' };
      });
      return;
    }
    const match = categories.find(
      (category) => category.name.toLowerCase() === categoryQuery.toLowerCase()
    );
    setFormData((prev) => ({ ...prev, category: match?._id || prev.category }));
  }, [categoryQuery, categories, isEditing]);

  useEffect(() => {
    if (!isEditing || categoryQuery || !formData.category || categories.length === 0) return;
    const match = categories.find((category) => category._id === formData.category);
    if (match) {
      setCategoryQuery(match.name);
    }
  }, [categories, categoryQuery, formData.category, isEditing]);

  const filteredCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(query));
  }, [categories, categoryQuery]);

  const handleAddCategory = async () => {
    if (!categoryQuery.trim()) {
      setErrorMessage('Type a category name first.');
      return;
    }
    try {
      setErrorMessage('');
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: categoryQuery.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Failed to add category.');
      const newCategory = data?.category;
      if (newCategory) {
        setCategories((prev) => [newCategory, ...prev]);
        setFormData((prev) => ({ ...prev, category: newCategory._id }));
        setShowCategoryOptions(false);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to add category.');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage('');
    try {
      const trimmedTitle = formData.title.trim();
      const trimmedDescription = formData.description.trim();
      const trimmedLocation = formData.location.trim();
      const deadlineValue = deadlineDate;
      const rawSalary = formData.salary.replace(/[^0-9]/g, '');
      const normalizedSalary = rawSalary ? Number(rawSalary) : 0;

      const missingFields: string[] = [];
      if (!trimmedTitle) missingFields.push('title');
      if (!trimmedDescription) missingFields.push('description');
      if (!trimmedLocation) missingFields.push('location');
      if (!rawSalary) missingFields.push('salary');
      if (!formData.jobType) missingFields.push('job type');
      if (!deadlineValue) missingFields.push('application deadline');

      if (missingFields.length > 0) {
        setErrorMessage(`Missing required fields: ${missingFields.join(', ')}.`);
        setSubmitting(false);
        return;
      }

      const parsedDeadline = deadlineValue ? new Date(deadlineValue) : null;
      if (!parsedDeadline || Number.isNaN(parsedDeadline.getTime())) {
        setErrorMessage('Please provide a valid deadline date.');
        setSubmitting(false);
        return;
      }

      if (deadlineTime) {
        parsedDeadline.setHours(deadlineTime.getHours());
        parsedDeadline.setMinutes(deadlineTime.getMinutes());
      } else {
        parsedDeadline.setHours(0, 0, 0, 0);
      }

      if (!formData.category && !(isEditing && jobToEdit?.category)) {
        setErrorMessage('Please select a valid category from the list.');
        setSubmitting(false);
        return;
      }

      const payload = {
        title: trimmedTitle,
        category: formData.category || undefined,
        description: trimmedDescription,
        requirements: formData.requirements
          ? formData.requirements.split('\n').map((item) => item.trim()).filter(Boolean)
          : [],
        responsibilities: formData.responsibilities
          ? formData.responsibilities.split('\n').map((item) => item.trim()).filter(Boolean)
          : [],
        skills: formData.skills
          ? formData.skills.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
        salary: normalizedSalary,
        location: trimmedLocation,
        jobType: formData.jobType,
        deadline: parsedDeadline.toISOString(),
        urgent: isUrgent,
        positionsNeeded: Number(positionsNeeded) || 1,
      };

      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/jobs/${isEditing ? jobToEdit._id : ''}`.replace(/\/$/, ''), {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Failed to post job.');

      Alert.alert('Success', isEditing ? 'Job updated successfully.' : 'Job posted successfully.');
      onPosted?.();
      setFormData({
        title: '',
        category: '',
        description: '',
        requirements: '',
        responsibilities: '',
        skills: '',
        salary: '',
        location: '',
        jobType: 'Fulltime',
      });
      setDeadlineDate(null);
      setDeadlineTime(null);
      setIsUrgent(false);
      setCategoryQuery('');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to post job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Job' : 'Post a Job'}</Text>
          <Text style={styles.headerSubtitle}>Find the perfect talent for your project</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Text style={styles.label}>Job Title</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, title: value }))}
            placeholder="e.g. Senior React Developer"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            <View style={styles.categoryInputWrapper}>
              <TextInput
                style={styles.input}
                value={categoryQuery}
                onChangeText={(value) => {
                  setCategoryQuery(value);
                  setShowCategoryOptions(true);
                }}
                onFocus={() => setShowCategoryOptions(true)}
                placeholder="Type a category"
                placeholderTextColor="#9ca3af"
              />
              {showCategoryOptions && (
                <View style={styles.categoryDropdown}>
                  {loadingCategories ? (
                    <View style={styles.dropdownItem}>
                      <ActivityIndicator size="small" color="#0a2847" />
                    </View>
                  ) : (
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {filteredCategories.map((category) => (
                        <TouchableOpacity
                          key={category._id}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setCategoryQuery(category.name);
                            setFormData((prev) => ({ ...prev, category: category._id }));
                            setShowCategoryOptions(false);
                          }}
                        >
                          <Text style={styles.dropdownText}>{category.name}</Text>
                        </TouchableOpacity>
                      ))}
                      {filteredCategories.length === 0 && (
                        <View style={styles.dropdownItem}>
                          <Text style={styles.dropdownEmpty}>No categories found.</Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.addCategoryButton} onPress={handleAddCategory}>
              <Text style={styles.addCategoryText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, description: value }))}
            placeholder="Describe the job role and responsibilities"
            placeholderTextColor="#9ca3af"
            multiline
          />

          <Text style={styles.label}>Responsibilities (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.responsibilities}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, responsibilities: value }))}
            placeholder="List responsibilities"
            placeholderTextColor="#9ca3af"
            multiline
          />

          <Text style={styles.label}>Requirements (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.requirements}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, requirements: value }))}
            placeholder="List requirements"
            placeholderTextColor="#9ca3af"
            multiline
          />

          <Text style={styles.label}>Skills (Optional)</Text>
          <TextInput
            style={styles.input}
            value={formData.skills}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, skills: value }))}
            placeholder="React, TypeScript, GraphQL"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Salary (PHP)</Text>
          <TextInput
            style={styles.input}
            value={formData.salary}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, salary: value }))}
            placeholder="e.g. 20000"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={formData.location}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, location: value }))}
            placeholder="Dagupan City"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Positions Needed</Text>
          <TextInput
            style={styles.input}
            value={positionsNeeded}
            onChangeText={setPositionsNeeded}
            placeholder="1"
            placeholderTextColor="#9ca3af"
            keyboardType="number-pad"
          />
          <Text style={styles.helperText}>How many workers do you need? Job will auto-close when all positions are filled.</Text>

          <Text style={styles.label}>Job Type</Text>
          <View style={styles.chipRow}>
            {['Fulltime', 'Part-time', 'Contract'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, formData.jobType === type && styles.chipActive]}
                onPress={() => setFormData((prev) => ({ ...prev, jobType: type }))}
              >
                <Text style={[styles.chipText, formData.jobType === type && styles.chipTextActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Application Deadline</Text>
          <View style={styles.deadlineRow}>
            <TouchableOpacity style={styles.deadlineButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.deadlineText}>
                {deadlineDate ? deadlineDate.toLocaleDateString() : 'Select date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deadlineButton} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.deadlineText}>
                {deadlineTime
                  ? deadlineTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Select time'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.urgentRow}>
            <Text style={styles.urgentLabel}>Mark as urgent</Text>
            <Switch value={isUrgent} onValueChange={setIsUrgent} />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>{isEditing ? 'Update Job' : 'Post Job'}</Text>
            )}
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker ? (
        <DateTimePicker
          value={deadlineDate || new Date()}
          mode="date"
          display="default"
          onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setDeadlineDate(selectedDate);
            }
          }}
        />
      ) : null}

      {showTimePicker ? (
        <DateTimePicker
          value={deadlineTime || new Date()}
          mode="time"
          display="default"
          onChange={(_event: DateTimePickerEvent, selectedTime?: Date) => {
            setShowTimePicker(false);
            if (selectedTime) {
              setDeadlineTime(selectedTime);
            }
          }}
        />
      ) : null}

      <EmployerNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  flex: { flex: 1 },
  header: {
    backgroundColor: '#0a2847',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    gap: 12,
  },
  scroll: { padding: 20, paddingBottom: 90 },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#cbd5f0', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  helperText: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  categoryInputWrapper: { flex: 1 },
  categoryDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 180,
  },
  dropdownScroll: { maxHeight: 180 },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownText: { color: '#111827', fontSize: 13 },
  dropdownEmpty: { color: '#6b7280', fontSize: 12 },
  addCategoryButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0a2847',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#0a2847',
    borderColor: '#0a2847',
  },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#ffffff' },
  submitButton: {
    marginTop: 20,
    backgroundColor: '#0a2847',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deadlineRow: { flexDirection: 'row', gap: 10 },
  deadlineButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deadlineText: { color: '#111827', fontSize: 13, fontWeight: '600' },
  urgentRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgentLabel: { fontSize: 14, color: '#111827', fontWeight: '600' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 12, marginBottom: 6 },
});
