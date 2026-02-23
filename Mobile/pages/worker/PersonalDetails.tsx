import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';

type PersonalDetailsProps = {
  onBack?: () => void;
};

export default function PersonalDetails({ onBack }: PersonalDetailsProps) {
  const [firstName, setFirstName] = useState('Jonas');
  const [lastName, setLastName] = useState('Enriquez');
  const [email, setEmail] = useState('enriquez@gmail.com');
  const [phone, setPhone] = useState('09123456789');
  const [country, setCountry] = useState('Philippines');
  const [location, setLocation] = useState('Pangasinan');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* First name */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#9ca3af"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>

        {/* Last name */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Last name</Text>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#9ca3af"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

        {/* Email */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
        </View>

        {/* Contact Number */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Contact Number"
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        {/* Country */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Country</Text>
          <TextInput
            style={styles.input}
            placeholder="Country"
            placeholderTextColor="#9ca3af"
            value={country}
            onChangeText={setCountry}
          />
        </View>

        {/* Home location */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Home location</Text>
          <TextInput
            style={styles.input}
            placeholder="Home Location"
            placeholderTextColor="#9ca3af"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Update Button */}
        <TouchableOpacity style={styles.updateButton}>
          <Text style={styles.updateButtonText}>Update</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#1e3a5f',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 32, color: '#fff', fontWeight: '300' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  updateButton: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  updateButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
