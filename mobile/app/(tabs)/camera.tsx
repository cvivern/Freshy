import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="camera" size={48} color="#4CAF50" />
      <Text style={styles.title}>Cámara</Text>
      <Text style={styles.placeholder}>— placeholder —</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FBF9',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2E7D32',
  },
  placeholder: {
    fontSize: 14,
    color: '#aaa',
  },
});
