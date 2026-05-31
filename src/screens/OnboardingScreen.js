import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';

const ADMIN_PIN = 'ADMIN1234';

export default function OnboardingScreen({ lookupWorker, onComplete, onAdminLogin }) {
  const [employeeId, setEmployeeId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [mode, setMode] = useState('worker');
  const [loading, setLoading] = useState(false);

  const handleWorkerLogin = async () => {
    const id = employeeId.trim();
    const code = passcode.trim();

    if (!id || !code) {
      Alert.alert('Required', 'Enter Employee ID and passcode.');
      return;
    }

    setLoading(true);
    try {
      const worker = await lookupWorker(id);

      if (!worker) {
        Alert.alert('Not Found', `Employee ID "${id}" was not found.`);
        return;
      }

      if ((worker.passcode ?? '') !== code) {
        Alert.alert('Access Denied', 'Incorrect worker passcode.');
        return;
      }

      onComplete(worker);
    } catch (error) {
      console.error('Worker login error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = () => {
    if (adminPin.trim() !== ADMIN_PIN) {
      Alert.alert('Access Denied', 'Incorrect admin PIN.');
      setAdminPin('');
      return;
    }

    onAdminLogin();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logoRow}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>FaceAuth</Text>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'worker' && styles.modeActive]}
            onPress={() => setMode('worker')}
          >
            <Text style={[styles.modeText, mode === 'worker' && styles.modeTextActive]}>
              Worker
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'admin' && styles.modeActive]}
            onPress={() => setMode('admin')}
          >
            <Text style={[styles.modeText, mode === 'admin' && styles.modeTextActive]}>
              Admin
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>
          {mode === 'worker' ? 'Worker Login' : 'Admin Login'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'worker'
            ? 'Use your Employee ID and passcode.'
            : 'Admins can enroll workers without a field account.'}
        </Text>

        {mode === 'worker' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Employee ID e.g. EMP001"
              placeholderTextColor="#A8B5A0"
              value={employeeId}
              onChangeText={setEmployeeId}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Worker passcode"
              placeholderTextColor="#A8B5A0"
              value={passcode}
              onChangeText={setPasscode}
              secureTextEntry
              keyboardType="number-pad"
              editable={!loading}
              onSubmitEditing={handleWorkerLogin}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleWorkerLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#F5F5E8" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="Admin PIN"
              placeholderTextColor="#A8B5A0"
              value={adminPin}
              onChangeText={setAdminPin}
              secureTextEntry
              autoCorrect={false}
              onSubmitEditing={handleAdminLogin}
            />
            <TouchableOpacity style={styles.button} onPress={handleAdminLogin}>
              <Text style={styles.buttonText}>Open Admin</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.hint}>
          Demo worker: EMP001 / 1234
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5E8',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#D4DCC8',
    shadowColor: '#2C3520',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8FA85A',
    marginRight: 8,
  },
  logoText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5C6B3A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#EEF0E8',
    borderRadius: 12,
    padding: 4,
    marginBottom: 22,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  modeActive: {
    backgroundColor: '#FFFFFF',
  },
  modeText: {
    color: '#7A8A6A',
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#5C6B3A',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C3520',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7A8A6A',
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#EEF0E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2C3520',
    borderWidth: 1,
    borderColor: '#D4DCC8',
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  button: {
    backgroundColor: '#5C6B3A',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#F5F5E8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 12,
    color: '#A8B5A0',
    textAlign: 'center',
    lineHeight: 17,
  },
});
