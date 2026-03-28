import { StyleSheet, View, Text } from 'react-native';

export default function HeladeraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi Heladera</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
  },
});
