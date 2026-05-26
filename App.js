import { useState } from 'react';
import AuthScreen from './src/screens/AuthScreen';
import SuccessScreen from './src/screens/SuccessScreen';
import EnrollScreen from './src/screens/EnrollScreen';

export default function App() {
  const [screen, setScreen] = useState('auth');

  if (screen === 'success') {
    return <SuccessScreen onDone={() => setScreen('auth')} />;
  }
  if (screen === 'enroll') {
    return <EnrollScreen onBack={() => setScreen('auth')} />;
  }
  return (
    <AuthScreen
      onSuccess={() => setScreen('success')}
      onEnroll={() => setScreen('enroll')}
    />
  );
}