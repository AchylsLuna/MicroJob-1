import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScrollView from '../../components/ui/SmoothScrollView';
import CalendarSheet from '../../components/ui/CalendarSheet';
import { API_URL } from '../../config';
import { apiRequest, asList } from '../../lib/api';
import EmployerNavigation from '../../components/employerNavigation';
import { tokens } from '../../theme/tokens';
import TabTopNav from '../../components/TabTopNav';
import { useToast } from '../../contexts/ToastContext';
import { EmployerAccordion, EmployerModeBanner } from '../../components/employer/EmployerUI';

type Category = { _id: string; name: string };

type PostJobProps = {
  onPosted?: () => void;
  onOpenWallet?: () => void;
  jobToEdit?: any;
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onOpenNotifications?: () => void;
  notificationBadgeCount?: number;
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

const JOB_TYPE_OPTIONS = [
  {
    value: 'Short-term',
    label: 'Short-term',
    description: 'One-time or temporary work with a clear finish.',
  },
  {
    value: 'Side hustle',
    label: 'Side hustle',
    description: 'Flexible work someone can take on for extra income.',
  },
  {
    value: 'Recruiting',
    label: 'Recruiting',
    description: 'Hire for an ongoing or longer-term role.',
  },
] as const;

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
  onOpenWallet,
  jobToEdit,
  activeTab,
  onTabPress,
  onOpenNotifications,
  notificationBadgeCount = 0,
}: PostJobProps) {
  const [expandedSection, setExpandedSection] = useState<'basics' | 'location' | 'hiring' | null>('basics');
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
    jobType: 'Short-term',
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
  const hasInsufficientBalanceError = /(?:insufficient|not have enough) balance/i.test(errorMessage);

  useEffect(() => {
    if (!jobToEdit) return;
    const categoryName = typeof jobToEdit.category === 'object' ? jobToEdit.category?.name : '';
    const categoryId = typeof jobToEdit.category === 'object' ? jobToEdit.category?._id : jobToEdit.category;
    const deadline = jobToEdit.deadline ? new Date(jobToEdit.deadline) : null;
    const locationParts = parseLocationToParts(jobToEdit.location);
    const salaryValue = String(jobToEdit.salary ?? '').replace(/[^0-9]/g, '');
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
      jobType: jobToEdit.jobType || 'Short-term',
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
        const result = await apiRequest(`${API_URL}/categories`, undefined, 'Failed to load categories.');
        if (!result.ok) throw new Error(result.message || 'Failed to load categories.');
        setCategories(asList<Category>(result.raw, ['categories']));
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
        setExpandedSection(missingFields.includes('location') ? 'location' : missingFields.some((field) => ['job type', 'application deadline'].includes(field)) ? 'hiring' : 'basics');
        setErrorMessage(`Missing required fields: ${missingFields.join(', ')}.`);
        setSubmitting(false);
        return;
      }

      if (!Number.isFinite(normalizedSalary) || normalizedSalary <= 0) {
        setExpandedSection('basics');
        setErrorMessage('Minimum guaranteed pay must be greater than zero.');
        setSubmitting(false);
        return;
      }

      const normalizedPositions = Number(positionsNeeded);
      if (!Number.isInteger(normalizedPositions) || normalizedPositions < 1) {
        setExpandedSection('hiring');
        setErrorMessage('Workers needed must be a positive whole number.');
        setSubmitting(false);
        return;
      }

      const parsedDeadline = deadlineValue ? new Date(deadlineValue) : null;
      if (!parsedDeadline || Number.isNaN(parsedDeadline.getTime())) {
        setExpandedSection('hiring');
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
        setExpandedSection('basics');
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
        positionsNeeded: normalizedPositions,
      };

      const result = await apiRequest(`${API_URL}/jobs/${isEditing ? jobToEdit._id : ''}`.replace(/\/$/, ''), {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }, isEditing ? 'Failed to update job.' : 'Failed to post job.');
      if (!result.ok) throw new Error(result.message || (isEditing ? 'Failed to update job.' : 'Failed to post job.'));

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
        jobType: 'Short-term',
      });
      setDeadlineDate(null);
      setDeadlineTime(null);
      setIsUrgent(false);
      setPositionsNeeded('1');
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
      <TabTopNav title={isEditing ? 'Edit Job' : 'Post a Job'} employerMode showNotifications onOpenNotifications={onOpenNotifications} notificationBadgeCount={notificationBadgeCount} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 12 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: tokens.layout.tabBarClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
          {errorMessage && !hasInsufficientBalanceError ? (
            <View style={styles.errorCard} accessibilityRole="alert">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formIntro}>
            <Text style={styles.formIntroTitle}>{isEditing ? 'Update this opportunity' : 'Create a clear opportunity'}</Text>
            <Text style={styles.formIntroText}>
              Post short-term work, a flexible side hustle, or recruit for an ongoing role.
            </Text>
          </View>
          <EmployerModeBanner title={isEditing ? 'Update opportunity' : 'Create an opportunity'} detail="Clear details help local workers understand the job and your secured pay." />

          <EmployerAccordion title="Opportunity basics" subtitle="Title, category, work details, skills, and guaranteed pay." icon="document-text-outline" expanded={expandedSection === 'basics'} onToggle={() => setExpandedSection((section) => section === 'basics' ? null : 'basics')}>

          <Text style={styles.label}>Job Title</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, title: value }))}
            placeholder="e.g. Weekend event assistant"
            placeholderTextColor={tokens.colors.textSubtle}
            maxLength={100}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            <View style={styles.categoryInputWrapper}>
              <TextInput
                style={styles.input}
                value={categoryQuery}
                onChangeText={(value) => {
                  setCategoryQuery(value);
                  setFormData((prev) => ({ ...prev, category: '' }));
                  setShowCategoryOptions(true);
                }}
                onFocus={() => setShowCategoryOptions(true)}
                placeholder="Search job categories"
                placeholderTextColor={tokens.colors.textSubtle}
              />
              {showCategoryOptions && (
                <View style={styles.categoryDropdown}>
                  {loadingCategories ? (
                    <View style={styles.dropdownItem}>
                      <ActivityIndicator size="small" color={tokens.colors.brand} />
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
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, description: value }))}
            placeholder="Describe the job role and responsibilities"
            placeholderTextColor={tokens.colors.textSubtle}
            multiline
            maxLength={1000}
          />

          <Text style={styles.label}>Responsibilities (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.responsibilities}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, responsibilities: value }))}
            placeholder="List responsibilities"
            placeholderTextColor={tokens.colors.textSubtle}
            multiline
          />

          <Text style={styles.label}>Requirements (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.requirements}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, requirements: value }))}
            placeholder="List requirements"
            placeholderTextColor={tokens.colors.textSubtle}
            multiline
          />

          <Text style={styles.label}>Skills (Optional)</Text>
          <TextInput
            style={styles.input}
            value={formData.skills}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, skills: value }))}
            placeholder="React, TypeScript, GraphQL"
            placeholderTextColor={tokens.colors.textSubtle}
          />

          <Text style={styles.label}>Minimum Guaranteed Pay per Worker (PHP)</Text>
          <TextInput
            style={styles.input}
            value={formData.salary}
            onChangeText={(value) => setFormData((prev) => ({ ...prev, salary: value.replace(/[^0-9]/g, '') }))}
            placeholder="e.g. 1500"
            placeholderTextColor={tokens.colors.textSubtle}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>
            This is the minimum amount guaranteed to each hired worker and secured in escrow.
          </Text>
          </EmployerAccordion>

          <EmployerAccordion title="Philippine work location" subtitle={composeLocation(formData) || 'Province, city or municipality, and barangay'} icon="location-outline" expanded={expandedSection === 'location'} onToggle={() => setExpandedSection((section) => section === 'location' ? null : 'location')}>

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
                setFormData((prev) => ({ ...prev, province: '', city: '', barangay: '' }));
                setCityQuery('');
                setBarangayQuery('');
                setShowProvinceOptions(true);
              }}
              onFocus={() => setShowProvinceOptions(true)}
              placeholder={isLoadingLocations ? 'Loading provinces...' : 'Type or select province'}
              placeholderTextColor={tokens.colors.textSubtle}
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
                setFormData((prev) => ({ ...prev, city: '', barangay: '' }));
                setBarangayQuery('');
                setShowCityOptions(true);
              }}
              onFocus={() => setShowCityOptions(true)}
              placeholder={!formData.province ? 'Select province first' : 'Type or select city'}
              placeholderTextColor={tokens.colors.textSubtle}
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
                setFormData((prev) => ({ ...prev, barangay: '' }));
                setShowBarangayOptions(true);
              }}
              onFocus={() => setShowBarangayOptions(true)}
              placeholder={!formData.city ? 'Select city first' : isLoadingBarangays ? 'Loading barangays...' : 'Type or select barangay'}
              placeholderTextColor={tokens.colors.textSubtle}
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
            placeholderTextColor={tokens.colors.textSubtle}
          />

          <Text style={styles.helperText}>Location preview: {composeLocation(formData) || 'Select province, city, and barangay'}</Text>
          </EmployerAccordion>

          <EmployerAccordion title="Pay and hiring" subtitle="Workers needed, opportunity type, deadline, and urgency." icon="people-outline" expanded={expandedSection === 'hiring'} onToggle={() => setExpandedSection((section) => section === 'hiring' ? null : 'hiring')}>

          <Text style={styles.label}>Workers Needed</Text>
          <TextInput
            style={styles.input}
            value={positionsNeeded}
            onChangeText={setPositionsNeeded}
            placeholder="1"
            placeholderTextColor={tokens.colors.textSubtle}
            keyboardType="number-pad"
          />
          <Text style={styles.helperText}>How many workers do you need? Job will auto-close when all positions are filled.</Text>

          <Text style={styles.label}>Opportunity Type</Text>
          <View style={styles.opportunityList} accessibilityRole="radiogroup">
            {JOB_TYPE_OPTIONS.map((option) => {
              const selected = formData.jobType === option.value;
              return (
              <TouchableOpacity
                key={option.value}
                style={[styles.opportunityCard, selected && styles.opportunityCardActive]}
                onPress={() => setFormData((prev) => ({ ...prev, jobType: option.value }))}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[styles.opportunityTitle, selected && styles.opportunityTitleActive]}>
                  {option.label}
                </Text>
                <Text style={styles.opportunityDescription}>{option.description}</Text>
              </TouchableOpacity>
              );
            })}
          </View>
          {formData.jobType && !JOB_TYPE_OPTIONS.some((option) => option.value === formData.jobType) ? (
            <Text style={styles.legacyTypeText}>
              This existing post uses the legacy type “{formData.jobType}”. Choose a current type to modernize it.
            </Text>
          ) : null}

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

          <CalendarSheet
            open={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            mode="single"
            value={deadlineDate}
            onChange={(next) => setDeadlineDate(next)}
            minDate={new Date()}
            title="Application deadline"
            footer={{
              primaryLabel: 'Set deadline',
              onPrimary: () => setShowDatePicker(false),
              clearLabel: 'Clear',
              onClear: () => setDeadlineDate(null),
            }}
          />

          <View style={styles.urgentRow}>
            <Text style={styles.urgentLabel}>Mark as urgent</Text>
            <Switch value={isUrgent} onValueChange={setIsUrgent} />
          </View>
          </EmployerAccordion>

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

      <Modal
        visible={hasInsufficientBalanceError}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setErrorMessage('')}
      >
        <View style={styles.balanceModalBackdrop}>
          <View
            style={styles.balanceModalCard}
            accessibilityRole="alert"
            accessibilityLabel="Insufficient balance"
          >
            <View style={styles.balanceModalIcon}>
              <Text style={styles.balanceModalIconText}>!</Text>
            </View>
            <Text style={styles.balanceModalTitle}>Insufficient balance</Text>
            <Text style={styles.balanceModalMessage}>{errorMessage}</Text>
            <View style={styles.balanceModalActions}>
              <TouchableOpacity
                style={styles.balanceModalSecondaryButton}
                onPress={() => setErrorMessage('')}
                accessibilityRole="button"
              >
                <Text style={styles.balanceModalSecondaryText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.balanceModalPrimaryButton}
                onPress={() => {
                  setErrorMessage('');
                  onOpenWallet?.();
                }}
                accessibilityRole="button"
                accessibilityLabel="Top up employer wallet"
              >
                <Text style={styles.balanceModalPrimaryText}>Top up wallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    shadowColor: tokens.colors.brandDark,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    gap: 14,
  },
  formIntro: {
    backgroundColor: tokens.colors.brandSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
  },
  formIntroTitle: { fontSize: 16, fontWeight: '700', color: tokens.colors.text },
  formIntroText: { marginTop: 4, fontSize: 13, lineHeight: 19, color: tokens.colors.textMuted },
  label: { fontSize: 14, fontWeight: '600', color: tokens.colors.text, marginBottom: 8, marginTop: 12 },
  input: {
    minHeight: 52,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: tokens.colors.text,
  },
  helperText: { fontSize: 12, color: tokens.colors.textMuted, marginTop: 6 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  categoryInputWrapper: { flex: 1 },
  categoryDropdown: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    maxHeight: 180,
  },
  dropdownScroll: { maxHeight: 180 },
  dropdownItem: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  dropdownText: { color: tokens.colors.text, fontSize: 13 },
  dropdownEmpty: { color: tokens.colors.textMuted, fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    backgroundColor: tokens.colors.surface,
  },
  chipActive: {
    backgroundColor: tokens.colors.brand,
    borderColor: tokens.colors.brand,
  },
  chipText: { color: tokens.colors.onCanvasMuted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: tokens.colors.surface },
  opportunityList: { gap: 10 },
  opportunityCard: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  opportunityCardActive: {
    borderColor: tokens.colors.brand,
    backgroundColor: tokens.colors.brandSoft,
  },
  opportunityTitle: { fontSize: 14, fontWeight: '700', color: tokens.colors.text },
  opportunityTitleActive: { color: tokens.colors.brand },
  opportunityDescription: { marginTop: 3, fontSize: 12, lineHeight: 17, color: tokens.colors.textMuted },
  legacyTypeText: { marginTop: 8, fontSize: 12, lineHeight: 17, color: tokens.colors.warning },
  submitButton: {
    minHeight: 52,
    marginTop: 20,
    backgroundColor: tokens.colors.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deadlineRow: { flexDirection: 'row', gap: 10 },
  deadlineButton: {
    minHeight: 52,
    flex: 1,
    backgroundColor: tokens.colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deadlineText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600' },
  urgentRow: {
    minHeight: 52,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgentLabel: { fontSize: 14, color: tokens.colors.text, fontWeight: '600' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: tokens.colors.surface, fontSize: 15, fontWeight: '700' },
  errorCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    padding: 12,
  },
  errorText: { color: '#dc2626', fontSize: 12, marginBottom: 6 },
  balanceModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.72)',
    padding: 24,
  },
  balanceModalCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: tokens.colors.surface,
    padding: 24,
    shadowColor: tokens.colors.brandDark,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  balanceModalIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#fee2e2',
  },
  balanceModalIconText: { color: '#dc2626', fontSize: 28, fontWeight: '800' },
  balanceModalTitle: { marginTop: 16, color: tokens.colors.text, fontSize: 20, fontWeight: '800' },
  balanceModalMessage: {
    marginTop: 8,
    color: tokens.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  balanceModalActions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 24 },
  balanceModalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    backgroundColor: tokens.colors.surface,
  },
  balanceModalSecondaryText: { color: tokens.colors.text, fontSize: 14, fontWeight: '700' },
  balanceModalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: tokens.colors.brand,
  },
  balanceModalPrimaryText: { color: tokens.colors.surface, fontSize: 14, fontWeight: '700' },
});
