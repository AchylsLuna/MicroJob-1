import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function SignSuccess({ onBackToLogin }: { onBackToLogin: () => void }) {
  return (
    <View style={styles.container}>
      {/* Success Icon */}
      <View style={styles.iconContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>Sign-Up Successful</Text>

      {/* Message */}
      <Text style={styles.message}>
        Welcome to the Micro Jobs! Your account has been successfully created. Enjoy exploring our
        collection.
      </Text>

      {/* Back to Login Button */}
      <TouchableOpacity style={styles.button} onPress={onBackToLogin}>
        <Text style={styles.buttonText}>Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a2847',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 32,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 60,
    color: '#fff',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#b0b0b0',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});