import { useState, useEffect } from 'react';
import AuthScreen from './src/screens/AuthScreen';
import SuccessScreen from './src/screens/SuccessScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import { initDB } from './src/services/DatabaseService';
import { syncWhenOnline } from './src/services/SyncService';

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [lastWorker, setLastWorker] = useState('Field Worker');

 useEffect(() => {
    initDB()
      .then(() => syncWhenOnline())
      .catch((e) => console.log('DB error:', e));
  }, []);

  if (screen === 'success') {
    return <SuccessScreen workerName={lastWorker} onDone={() => setScreen('auth')} />;
  }
  if (screen === 'enroll') {
    return <EnrollScreen onBack={() => setScreen('auth')} />;
  }
  return (
    <AuthScreen
      onSuccess={(name) => { setLastWorker(name); setScreen('success'); }}
      onEnroll={() => setScreen('enroll')}
    />
  );
}