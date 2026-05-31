import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import {
  initDB,
  getWorkerByEmployeeId,
  getPendingCount,
  getConfig,
  setConfig,
  deleteConfig,
} from './src/services/DatabaseService';
import { startSyncLoop } from './src/services/SyncService';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LaunchScreen from './src/screens/LaunchScreen';
import AuthScreen from './src/screens/AuthScreen';
import EnrollScreen from './src/screens/EnrollScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import AccountScreen from './src/screens/AccountScreen';
import BottomNav from './src/components/BottomNav';

const Tab = createBottomTabNavigator();

async function loadAppModels() {
  try {
    const { loadModels, getModelStatus } = require('./src/bridges/ModelBridge');
    await loadModels();
    console.log('Model status:', getModelStatus());
  } catch (error) {
    console.log('Model loading skipped:', error.message);
  }
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [worker, setWorker] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      const n = await getPendingCount();
      setPendingCount(n);
    } catch (error) {
      console.log('Pending count refresh failed:', error);
    }
  }, []);

  const completeOnboarding = useCallback(async (selectedWorker) => {
    await setConfig('employee_id', selectedWorker.employee_id);
    setAdminMode(false);
    setWorker(selectedWorker);
    setOnboarded(true);
  }, []);

  const completeAdminLogin = useCallback(() => {
    setAdminMode(true);
    setWorker(null);
    setOnboarded(true);
  }, []);

  const logout = useCallback(async () => {
    await deleteConfig('employee_id');
    setAdminMode(false);
    setWorker(null);
    setOnboarded(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let modelTimer = null;

    (async () => {
      try {
        await initDB();

        const savedEmployeeId = await getConfig('employee_id');
        if (savedEmployeeId) {
          const savedWorker = await getWorkerByEmployeeId(savedEmployeeId);
          if (mounted && savedWorker) {
            setWorker(savedWorker);
            setOnboarded(true);
          }
        }

        if (mounted) {
          setDbReady(true);
          refreshPending();
        }

        startSyncLoop();
        modelTimer = setTimeout(loadAppModels, 750);
      } catch (error) {
        console.error('initDB failed:', error);
      }
    })();

    return () => {
      mounted = false;
      if (modelTimer) {
        clearTimeout(modelTimer);
      }
    };
  }, [refreshPending]);

  if (!dbReady) {
    return <LaunchScreen />;
  }

  if (!onboarded) {
    return (
      <OnboardingScreen
        lookupWorker={getWorkerByEmployeeId}
        onComplete={completeOnboarding}
        onAdminLogin={completeAdminLogin}
      />
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        tabBar={(props) => <BottomNav {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {!adminMode && (
          <Tab.Screen name="Verify">
            {() => (
              <AuthScreen
                worker={worker}
                pendingCount={pendingCount}
                onAttendanceLogged={refreshPending}
              />
            )}
          </Tab.Screen>
        )}

        <Tab.Screen name="Enroll">
          {() => <EnrollScreen initialUnlocked={adminMode} />}
        </Tab.Screen>

        <Tab.Screen name="History" component={HistoryScreen} />

        <Tab.Screen name="Account">
          {() => (
            <AccountScreen
              worker={worker}
              isAdmin={adminMode}
              onLogout={logout}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
