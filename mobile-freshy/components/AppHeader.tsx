import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function AppHeader() {
  return (
    <View style={styles.header}>
      <Image
        source={require('../assets/images/logo_blanco_sin_fondo_grande_arbol_recadre.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#A8CFEE',
    paddingTop: 20,
    paddingBottom: 6,
  },
  logo: {
    height: 70,
    width: 150,
  },
});