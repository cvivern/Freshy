import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AppHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>freshy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#D4827A',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    fontStyle: 'italic',
  },
});
