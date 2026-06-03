import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { C, FONT } from '../theme';

const TAB_CONFIG = {
  Verify:     { icon: '◎', label: 'Verify' },
  MyHistory:  { icon: '◷', label: 'History' },
  Profile:    { icon: '◯', label: 'Profile' },
  Overview:   { icon: '▦', label: 'Overview' },
  Workers:    { icon: '◫', label: 'Workers' },
  Attendance: { icon: '◷', label: 'Attendance' },
  Settings:   { icon: '◈', label: 'Settings' },
};

export default function BottomNav({ state, descriptors, navigation }) {
  return (
    <View style={styles.nav}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const cfg = TAB_CONFIG[route.name] ?? { icon: route.name.charAt(0), label: route.name };

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <TouchableOpacity key={route.key} style={styles.tab} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.iconWrap, isFocused && styles.iconActive]}>
              <Text style={[styles.icon, isFocused && styles.iconOn]}>{cfg.icon}</Text>
            </View>
            <Text style={[styles.label, isFocused && styles.labelOn]}>{cfg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    elevation: 16,
    shadowColor: C.textPrimary,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  tab:      { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 46, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: C.primaryLight },
  icon:   { fontSize: 20, color: C.textMuted },
  iconOn: { color: C.primary },
  label:   { fontSize: 10, color: C.textMuted, fontWeight: FONT.medium },
  labelOn: { color: C.primary, fontWeight: FONT.extraBold },
});
