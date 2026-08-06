import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '../../lib/storage';
import { API_URL } from '../../config';
import EmployerNavigation from '../../components/employerNavigation';
import { tokens } from '../../theme/tokens';
import TabTopNav from '../../components/TabTopNav';
import { useToast } from '../../contexts/ToastContext';

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
  province: string;
  city: string;
  barangay: string;
  addressType: 'home' | 'office' | 'place';
  address: string;
  jobType: string;
};

type ProvinceOption = { code: string; name: string };
type CityOption = { code: string; name: string; provinceCode?: string };
type BarangayOption = { code: string; name: string };

const PSGC_BASE_URL = 'https://psgc.gitlab.io/api';

const parseLocationToParts = (locationText?: string) => {
  const raw = String(locationText || '').trim();
  if (!raw) {
    return { address: '', barangay: '', city: '', province: '' };
  }

  const parts = raw.split(',').map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 4) {
    return {
      address: parts.slice(0, parts.length - 3).join(', '),
      barangay: parts[parts.length - 3],
      city: parts[parts.length - 2],
      province: parts[parts.length - 1],
    };
  }

  if (parts.length === 3) {
    return {
      address: '',
      barangay: parts[0],
      city: parts[1],
      province: parts[2],
    };
  }

  return { address: raw, barangay: '', city: '', province: '' };
};

const composeLocation = (form: FormData) =>
  [form.address.trim(), form.barangay.trim(), form.city.trim(), form.province.trim()].filter(Boolean).join(', ');

export default function EmployerPostJob({
  onPosted,
  jobToEdit,
  activeTab,
  onTabPress,
}: PostJobProps) {
  const insets = useSafeAreaInsets();
  const [formData, setFormData] = useState<FormData>({
    title: '',
    category: '',
    description: '',
    requirements: '',
    responsibilities: '',
    skills: '',
    salary: '',
    province: '',
    city: '',
    barangay: '',
    addressType: 'place',
    address: '',
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
  const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [barangayOptions, setBarangayOptions] = useState<BarangayOption[]>([]);
  const [provinceQuery, setProvinceQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [barangayQuery, setBarangayQuery] = useState('');
  const [showProvinceOptions, setShowProvinceOptions] = useState(false);
  const [showCityOptions, setShowCityOptions] = useState(false);
  const [showBarangayOptions, setShowBarangayOptions] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const toast = useToast();

  const isEditing = Boolean(jobToEdit?._id);

  useEffect(() => {
    if (!jobToEdit) return;
    const categoryName = typeof jobToEdit.category === 'object' ? jobToEdit.category?.name : '';
    const categoryId = typeof jobToEdit.category === 'object' ? jobToEdit.category?._id : jobToEdit.category;
    const deadline = jobToEdit.deadline ? new Date(jobToEdit.deadline) : null;
    const locationParts = parseLocationToParts(jobToEdit.location);
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
      province: locationParts.province,
      city: locationParts.city,
      barangay: locationParts.barangay,
      addressType: 'place',
      address: locationParts.address,
      jobType: jobToEdit.jobType || 'Fulltime',
    });
    setProvinceQuery(locationParts.province);
    setCityQuery(locationParts.city);
    setBarangayQuery(locationParts.barangay);
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
    let isMounted = true;

    const loadLocationData = async () => {
      setIsLoadingLocations(true);
      try {
        const [provinceResponse, cityResponse] = await Promise.all([
          fetch(`${PSGC_BASE_URL}/provinces/`),
          fetch(`${PSGC_BASE_URL}/cities-municipalities/`),
        ]);

        const provinceJson = await provinceResponse.json().catch(() => []);
        const cityJson = await cityResponse.json().catch(() => []);

        if (!provinceResponse.ok || !cityResponse.ok) {
          throw new Error('Failed to load location options.');
        }

        if (!isMounted) return;

        const provinces: ProvinceOption[] = (provinceJson || [])
          .map((item: any) => ({ code: String(item.code || ''), name: String(item.name || '').trim() }))
          .filter((item: ProvinceOption) => item.code && item.name)
          .sort((a: ProvinceOption, b: ProvinceOption) => a.name.localeCompare(b.name));

        const cities: CityOption[] = (cityJson || [])
          .map((item: any) => ({
            code: String(item.code || ''),
            name: String(item.name || '').trim(),
            provinceCode: item.provinceCode ? String(item.provinceCode) : undefined,
          }))
          .filter((item: CityOption) => item.code && item.name)
          .sort((a: CityOption, b: CityOption) => a.name.localeCompare(b.name));

        setProvinceOptions(provinces);
        setCityOptions(cities);
      } catch (error: any) {
        if (isMounted) {
          setErrorMessage(error?.message || 'Failed to load location options.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingLocations(false);
        }
      }
    };

    loadLocationData();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedProvince = useMemo(
    () => provinceOptions.find((item) => item.name.toLowerCase() === provinceQuery.trim().toLowerCase()),
    [provinceOptions, provinceQuery],
  );

  const filteredCities = useMemo(() => {
    if (selectedProvince?.code) {
      return cityOptions.filter((item) => item.provinceCode === selectedProvince.code);
    }
    return cityOptions;
  }, [cityOptions, selectedProvince?.code]);

  const selectedCity = useMemo(
    () => filteredCities.find((item) => item.name.toLowerCase() === cityQuery.trim().toLowerCase()),
    [filteredCities, cityQuery],
  );

  useEffect(() => {
    let isMounted = true;

    const loadBarangays = async () => {
      if (!selectedCity?.code) {
        setBarangayOptions([]);
        return;
      }

      setIsLoadingBarangays(true);
      try {
        const response = await fetch(`${PSGC_BASE_URL}/cities-municipalities/${selectedCity.code}/barangays/`);
        const json = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error('Failed to load barangays.');
        }

        if (!isMounted) return;

        const items: BarangayOption[] = (json || [])
          .map((item: any) => ({ code: String(item.code || ''), name: String(item.name || '').trim() }))
          .filter((item: BarangayOption) => item.code && item.name)
          .sort((a: BarangayOption, b: BarangayOption) => a.name.localeCompare(b.name));

        setBarangayOptions(items);
      } catch {
        if (isMounted) {
          setBarangayOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingBarangays(false);
        }
      }
    };

    loadBarangays();

    return () => {
      isMounted = false;
    };
  }, [selectedCity?.code]);

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
      const composedLocation = composeLocation(formData);
      const deadlineValue = deadlineDate;
      const rawSalary = formData.salary.replace(/[^0-9]/g, '');
      const normalizedSalary = rawSalary ? Number(rawSalary) : 0;

      const missingFields: string[] = [];
      if (!trimmedTitle) missingFields.push('title');
      if (!trimmedDescription) missingFields.push('description');
      if (!formData.province || !formData.city || !formData.barangay) missingFields.push('location');
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
        location: composedLocation,
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

      toast.success(isEditing ? 'Job updated successfully.' : 'Job posted successfully.');
      onPosted?.();
      setFormData({
        title: '',
        category: '',
        description: '',
        requirements: '',
        responsibilities: '',
        skills: '',
        salary: '',
        province: '',
        city: '',
        barangay: '',
        addressType: 'place',
        address: '',
        jobType: 'Fulltime',
      });
      setDeadlineDate(null);
      setDeadlineTime(null);
      setIsUrgent(false);
      setCategoryQuery('');
      setProvinceQuery('');
      setCityQuery('');
      setBarangayQuery('');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to post job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TabTopNav title={isEditing ? 'Edit Job' : 'Post a Job'} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 96 + Math.max(insets.bottom, 10) }]}
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
                      <ActivityIndicator size="small" color="#1C4D8D" />
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

          <Text style={styles.label}>Location Type</Text>
          <View style={styles.chipRow}>
            {[
              { value: 'home', label: 'Home' },
              { value: 'office', label: 'Office' },
              { value: 'place', label: 'Place' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.chip, formData.addressType === item.value && styles.chipActive]}
                onPress={() =>
                  setFormData((prev) => ({
                    ...prev,
                    addressType: item.value as FormData['addressType'],
                  }))
                }
              >
                <Text style={[styles.chipText, formData.addressType === item.value && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Province</Text>
          <View style={styles.categoryInputWrapper}>
            <TextInput
              style={styles.input}
              value={provinceQuery}
              onChangeText={(value) => {
                setProvinceQuery(value);
                setShowProvinceOptions(true);
              }}
              onFocus={() => setShowProvinceOptions(true)}
              placeholder={isLoadingLocations ? 'Loading provinces...' : 'Type or select province'}
              placeholderTextColor="#9ca3af"
            />
            {showProvinceOptions ? (
              <View style={styles.categoryDropdown}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {provinceOptions
                    .filter((item) => item.name.toLowerCase().includes(provinceQuery.trim().toLowerCase()))
                    .slice(0, 80)
                    .map((item) => (
                      <TouchableOpacity
                        key={item.code}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setProvinceQuery(item.name);
                          setFormData((prev) => ({
                            ...prev,
                            province: item.name,
                            city: '',
                            barangay: '',
                          }));
                          setCityQuery('');
                          setBarangayQuery('');
                          setShowProvinceOptions(false);
                        }}
                      >
                        <Text style={styles.dropdownText}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <Text style={styles.label}>City / Municipality</Text>
          <View style={styles.categoryInputWrapper}>
            <TextInput
              style={styles.input}
              value={cityQuery}
              editable={Boolean(formData.province)}
              onChangeText={(value) => {
                setCityQuery(value);
                setShowCityOptions(true);
              }}
              onFocus={() => setShowCityOptions(true)}
              placeholder={!formData.province ? 'Select province first' : 'Type or select city'}
              placeholderTextColor="#9ca3af"
            />
            {showCityOptions ? (
              <View style={styles.categoryDropdown}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {filteredCities
                    .filter((item) => item.name.toLowerCase().includes(cityQuery.trim().toLowerCase()))
                    .slice(0, 120)
                    .map((item) => (
                      <TouchableOpacity
                        key={item.code}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setCityQuery(item.name);
                          setFormData((prev) => ({
                            ...prev,
                            city: item.name,
                            barangay: '',
                          }));
                          setBarangayQuery('');
                          setShowCityOptions(false);
                        }}
                      >
                        <Text style={styles.dropdownText}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <Text style={styles.label}>Barangay</Text>
          <View style={styles.categoryInputWrapper}>
            <TextInput
              style={styles.input}
              value={barangayQuery}
              editable={Boolean(formData.city)}
              onChangeText={(value) => {
                setBarangayQuery(value);
                setShowBarangayOptions(true);
              }}
              onFocus={() => setShowBarangayOptions(true)}
              placeholder={!formData.city ? 'Select city first' : isLoadingBarangays ? 'Loading barangays...' : 'Type or select barangay'}
              placeholderTextColor="#9ca3af"
            />
            {showBarangayOptions ? (
              <View style={styles.categoryDropdown}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                  {barangayOptions
                    .filter((item) => item.name.toLowerCase().includes(barangayQuery.trim().toLowerCase()))
                    .slice(0, 200)
                    .map((item) => (
                      <TouchableOpacity
                        key={item.code}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setBarangayQuery(item.name);
                          setFormData((prev) => ({
                            ...prev,
                            barangay: item.name,
                          }));
                          setShowBarangayOptions(false);
                        }}
                      >
                        <Text style={styles.dropdownText}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <Text style={styles.label}>Address / Place</Text>
          <TextInput
            style={styles.input}
            value={formData.address}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, address: value }))}
            placeholder={formData.addressType === 'place' ? 'e.g. Near City Hall' : 'House no., street, subdivision'}
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.helperText}>Location preview: {composeLocation(formData) || 'Select province, city, and barangay'}</Text>

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
  container: { flex: 1, backgroundColor: tokens.colors.background },
  flex: { flex: 1 },
  scroll: { padding: 20 },
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  label: { fontSize: 14, fontWeight: '600', color: tokens.colors.text, marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: tokens.colors.text,
  },
  helperText: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  categoryInputWrapper: { flex: 1 },
  categoryDropdown: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 180,
  },
  dropdownScroll: { maxHeight: 180 },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownText: { color: tokens.colors.text, fontSize: 13 },
  dropdownEmpty: { color: '#6b7280', fontSize: 12 },
  addCategoryButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tokens.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryText: { color: tokens.colors.surface, fontSize: 20, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tokens.colors.surface,
  },
  chipActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: tokens.colors.surface },
  submitButton: {
    marginTop: 20,
    backgroundColor: tokens.colors.brand,
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
  deadlineText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
  urgentRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgentLabel: { fontSize: 14, color: tokens.colors.text, fontWeight: '600' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: tokens.colors.surface, fontSize: 15, fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 12, marginBottom: 6 },
});
