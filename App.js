import React, { useEffect, useState, useCallback } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
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
import { startSyncLoop, onSyncStateChange } from './src/services/SyncService';
import { preloadModels } from './src/services/ModelCache';

import LaunchScreen      from './src/screens/LaunchScreen';
import OnboardingScreen  from './src/screens/OnboardingScreen';
import AuthScreen        from './src/screens/AuthScreen';
import HistoryScreen     from './src/screens/HistoryScreen';
import ProfileScreen     from './src/screens/ProfileScreen';
import AdminOverviewScreen from './src/screens/AdminOverviewScreen';
import WorkersScreen     from './src/screens/WorkersScreen';
import EnrollScreen      from './src/screens/EnrollScreen';
import SettingsScreen    from './src/screens/SettingsScreen';
import BottomNav         from './src/components/BottomNav';

const Tab = createBottomTabNavigator();

export default function App() {
  const [dbReady, setDbReady]       = useState(false);
  const [onboarded, setOnboarded]   = useState(false);
  const [adminMode, setAdminMode]   = useState(false);
  const [worker, setWorker]         = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [showEnroll, setShowEnroll] = useState(false); // modal for enroll from Workers

  const refreshPending = useCallback(async () => {
    try {
      const n = await getPendingCount();
      setPendingCount(n);
    } catch (_) {}
  }, []);

  const completeWorkerLogin = useCallback(async (selectedWorker) => {
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
    const startTime = Date.now();

    (async () => {
      try {
        preloadModels();
        await initDB();

        let restoredWorker = null;
        const savedId = await getConfig('employee_id');
        if (savedId) {
          restoredWorker = await getWorkerByEmployeeId(savedId);
        }

        // Minimum 3 seconds on launch screen regardless of how fast DB loads
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        await new Promise((resolve) => setTimeout(resolve, remaining));

        if (!mounted) return;

        if (restoredWorker) {
          setWorker(restoredWorker);
          setOnboarded(true);
        }

        setDbReady(true);
        refreshPending();
        startSyncLoop();

        onSyncStateChange((state) => {
          if (!state.syncing && state.lastSyncedAt !== null && mounted) {
            refreshPending();
          }
        });
      } catch (error) {
        console.error('initDB failed:', error);
        if (mounted) setDbReady(true); // show login even on error
      }
    })();
    return () => { mounted = false; };
  }, [refreshPending]);

  // ── Launch ──────────────────────────────────────────────────────────────
  if (!dbReady) return <LaunchScreen hint="Loading models…" />;

  // ── Login ───────────────────────────────────────────────────────────────
  if (!onboarded) {
    return (
      <OnboardingScreen
        lookupWorker={getWorkerByEmployeeId}
        onComplete={completeWorkerLogin}
        onAdminLogin={completeAdminLogin}
      />
    );
  }

  // ── Worker Dashboard ─────────────────────────────────────────────────────
  if (!adminMode) {
    return (
      <NavigationContainer>
        <Tab.Navigator
          tabBar={(props) => <BottomNav {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Verify">
            {() => (
              <AuthScreen
                worker={worker}
                pendingCount={pendingCount}
                onAttendanceLogged={refreshPending}
                refreshWorker={async () => {
                  if (!worker?.employee_id) return null;
                  const fresh = await getWorkerByEmployeeId(worker.employee_id);
                  if (fresh) setWorker(fresh);
                  return fresh;
                }}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="MyHistory">
            {() => (
              <HistoryScreen
                workerFilter={worker?.employee_id ?? null}
                showSync={false}
                showFailures={false}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Profile">
            {() => (
              <ProfileScreen
                worker={worker}
                onLogout={logout}
                onWorkerUpdated={async () => {
                  if (!worker?.employee_id) return;
                  const fresh = await getWorkerByEmployeeId(worker.employee_id);
                  if (fresh) setWorker(fresh);
                }}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    );
  }

  // ── Admin Dashboard ───────────────────────────────────────────────────────
  return (
    <>
      <NavigationContainer>
        <Tab.Navigator
          tabBar={(props) => <BottomNav {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Overview" component={AdminOverviewScreen} />

          <Tab.Screen name="Workers">
            {() => (
              <WorkersScreen
                onEnrollNew={() => setShowEnroll(true)}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Attendance">
            {() => (
              <HistoryScreen
                workerFilter={null}
                showSync={true}
                showFailures={true}
              />
            )}
          </Tab.Screen>

          <Tab.Screen name="Settings">
            {() => <SettingsScreen onLogout={logout} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>

      {/* Enroll modal — opens from Workers tab */}
      <Modal
        visible={showEnroll}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEnroll(false)}
      >
        <EnrollScreen
          initialUnlocked={true}
          onDone={() => setShowEnroll(false)}
        />
      </Modal>
    </>
  );
}
