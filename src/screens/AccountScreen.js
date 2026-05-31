import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AccountScreen({ worker, isAdmin = false, onLogout }) {
  const confirmLogout = () => {
    Alert.alert(
      isAdmin ? 'Exit Admin?' : 'Switch Worker?',
      isAdmin
        ? 'This will return to the login screen.'
        : 'This will clear the saved employee ID on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isAdmin ? 'Exit' : 'Switch', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{isAdmin ? 'CURRENT SESSION' : 'CURRENT WORKER'}</Text>
        <Text style={styles.name}>{isAdmin ? 'Administrator' : worker?.name ?? 'Not selected'}</Text>
        <Text style={styles.meta}>{isAdmin ? 'Admin access' : worker?.employee_id ?? '-'}</Text>
        {worker?.department ? <Text style={styles.meta}>{worker.department}</Text> : null}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
        <Text style={styles.logoutText}>{isAdmin ? 'Exit Admin' : 'Switch Worker'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5E8',
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  title: {
    color: '#2C3520',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D4DCC8',
    marginBottom: 14,
  },
  label: {
    color: '#A8B5A0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  name: {
    color: '#2C3520',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  meta: {
    color: '#7A8A6A',
    fontSize: 13,
    marginBottom: 2,
  },
  logoutButton: {
    backgroundColor: '#5C6B3A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  logoutText: {
    color: '#F5F5E8',
    fontSize: 16,
    fontWeight: '800',
  },
});
