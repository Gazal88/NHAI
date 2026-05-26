import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, TextInput, Platform, Alert
} from 'react-native';
import { useState } from 'react';
import { enrollWorker } from '../services/DatabaseService';

export default function EnrollScreen({ onBack }) {
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const checkPin = () => {
    if (pin === 'ADMIN1234') setUnlocked(true);
    else {
      setPin('');
      Alert.alert('Wrong PIN', 'Please try again.');
    }
  };

  const handleCapture = () => {
    if (step < 5) setStep(s => s + 1);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter worker name.');
      return;
    }
    setSaving(true);
    try {
      await enrollWorker(name.trim());
      Alert.alert('Success', name + ' enrolled successfully.', [
  { text: 'OK', onPress: () => onBack() }]);
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Try again.');
    }
    setSaving(false);
  };

  if (!unlocked) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5EFE6" />
        <Text style={styles.heading}>Admin Access</Text>
        <Text style={styles.sub}>Enter PIN to enroll a new worker</Text>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          placeholder="Admin PIN"
          placeholderTextColor="#C8A97E"
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={checkPin}>
          <Text style={styles.buttonText}>UNLOCK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFE6" />
      <Text style={styles.heading}>Enroll Worker</Text>
      <Text style={styles.sub}>Capture face and register identity</Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Worker full name"
        placeholderTextColor="#C8A97E"
      />

      <View style={styles.frameBox}>
        <Text style={styles.frameText}>
          {step === 0 ? 'Position face in frame' : step < 5 ? `Frame ${step} of 5 captured` : 'All frames captured'}
        </Text>
        <View style={styles.progressRow}>
          {[1,2,3,4,5].map(i => (
            <View
              key={i}
              style={[styles.progressDot, i <= step && styles.progressDotActive]}
            />
          ))}
        </View>
        {step > 0 && (
          <Text style={styles.stepDone}>✓ {step}/5 complete</Text>
        )}
      </View>

      {step < 5 ? (
        <TouchableOpacity style={styles.button} onPress={handleCapture}>
          <Text style={styles.buttonText}>CAPTURE FRAME {step + 1}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'SAVING...' : 'SAVE WORKER'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 22,
    paddingTop: 80,
    paddingBottom: 28,
    alignItems: 'center',
  },
  heading: {
    color: '#2C1A0E',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    marginBottom: 6,
  },
  sub: {
    color: '#A0522D',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 28,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  input: {
    width: '100%',
    backgroundColor: '#EDE0CC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4C4A8',
    paddingVertical: 14,
    paddingHorizontal: 18,
    color: '#2C1A0E',
    fontSize: 15,
    marginBottom: 16,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
  frameBox: {
    width: '100%',
    height: 200,
    backgroundColor: '#EDE0CC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4C4A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 16,
  },
  frameText: {
    color: '#A0522D',
    fontSize: 13,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  stepDone: {
    color: '#7A9E7E',
    fontSize: 12,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 10,
  },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D4C4A8',
  },
  progressDotActive: {
    backgroundColor: '#A0522D',
  },
  button: {
    width: '100%',
    backgroundColor: '#A0522D',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#C8A97E',
  },
  buttonText: {
    color: '#F5EFE6',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
  },
  back: {
    color: '#A0522D',
    fontSize: 14,
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
  },
});