import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { apiRequest } from '../lib/api';

type Role = 'hire' | 'work' | 'both';

type Props = {
  onBack: () => void;
  onNavigateToSignIn: () => void;
  onNavigateToVerify: () => void;
};

const ROLE_OPTIONS: Array<{
  label: string;
  value: Role;
  icon: 'briefcase-outline' | 'account-outline' | 'account-group-outline';
}> = [
  { label: 'Hire', value: 'hire', icon: 'briefcase-outline' },
  { label: 'Work', value: 'work', icon: 'account-outline' },
  { label: 'Both', value: 'both', icon: 'account-group-outline' },
];

const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';

const isStrongPassword = (value: string) =>
  value.length >= 8 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

const parseFullName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(' ');
  if (parts.length < 2) {
    return null;
  }

  const [firstName, ...lastNameParts] = parts;
  const lastName = lastNameParts.join(' ').trim();

  if (!firstName || !lastName) {
    return null;
  }

  return { normalized, firstName, lastName };
};

export default function SignUp({ onBack, onNavigateToSignIn, onNavigateToVerify }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('work');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    const parsedName = parseFullName(fullName);
    if (!parsedName) {
      Alert.alert('Error', 'Please enter your full name (first and last name)');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (!isStrongPassword(password)) {
      Alert.alert('Error', PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const result = await apiRequest(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: parsedName.normalized,
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          email: normalizedEmail,
          password,
          role: selectedRole,
        }),
      }, 'Registration failed.');

      if (result.ok) {
        await AsyncStorage.setItem('pending_verification_email', normalizedEmail);
        Alert.alert('Success', 'Account created! Please verify your email.');
        onNavigateToVerify();
      } else {
        Alert.alert('Error', `${result.message || 'Registration failed'} (HTTP ${result.status})`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and server status.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Feather name="arrow-left" size={22} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.title}>Start your Journey</Text>
          <Text style={styles.subtitle}>Create an account to get started</Text>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#9ca3af"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(prev => !prev)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm Password"
              placeholderTextColor="#9ca3af"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(prev => !prev)}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <Text style={styles.roleSectionLabel}>I want to:</Text>
          <View style={styles.roleContainer}>
            {ROLE_OPTIONS.map(role => {
              const isActive = selectedRole === role.value;
              return (
                <TouchableOpacity
                  key={role.value}
                  style={[styles.roleButton, isActive && styles.roleButtonActive]}
                  onPress={() => setSelectedRole(role.value)}
                >
                  <MaterialCommunityIcons
                    name={role.icon}
                    size={24}
                    color={isActive ? '#0a2847' : '#9ca3af'}
                  />
                  <Text style={[styles.roleOptionLabel, isActive && styles.roleOptionLabelActive]}>{role.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signUpButtonText}>SIGN UP</Text>}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={onNavigateToSignIn}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.securityRow}>
            <Feather name="shield" size={14} color="#16a34a" />
            <Text style={styles.securityText}>Your information is secure and encrypted</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a2847',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    padding: 2,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 18,
  },
  input: {
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 14,
    color: '#111827',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 12,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  eyeButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  roleSectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
    marginBottom: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  roleButton: {
    width: '31.5%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
  },
  roleButtonActive: {
    borderColor: '#0a2847',
    backgroundColor: '#eaf0f9',
  },
  roleOptionLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleOptionLabelActive: {
    color: '#0a2847',
  },
  signUpButton: {
    backgroundColor: '#0a2847',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  signUpButtonDisabled: {
    opacity: 0.65,
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  loginText: {
    fontSize: 14,
    color: '#4b5563',
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a2847',
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
});
