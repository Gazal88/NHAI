import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

const tabIcons = {
  Verify: 'V',
  Enroll: '+',
  History: 'H',
  Account: 'A',
};

export default function BottomNav({ state, descriptors, navigation }) {
  return (
    <View style={styles.nav}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const options = descriptors[route.key]?.options ?? {};
        const label = options.tabBarLabel ?? options.title ?? route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, isFocused && styles.iconActive]}>
              <Text style={[styles.icon, isFocused && styles.iconTextActive]}>
                {tabIcons[route.name] ?? route.name.charAt(0)}
              </Text>
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {label}
            </Text>
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF0E8',
    elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: '#EEF0E8' },
  icon: { fontSize: 18, color: '#A8B5A0', fontWeight: '800' },
  iconTextActive: { color: '#5C6B3A' },
  label: { fontSize: 11, color: '#A8B5A0', fontWeight: '500' },
  labelActive: { color: '#5C6B3A', fontWeight: '800' },
});
