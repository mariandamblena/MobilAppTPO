import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fonts, spacing, radius } from '@/theme';

/**
 * Splash de marca (Figma "Splash Screen"): degradé azul + tile translúcido con
 * gema + wordmark AUCTIFY + subtítulo. Renderizado por código (sin assets, para
 * no dejar Expo Go en blanco). Se muestra durante la carga de fuentes y la
 * hidratación de sesión.
 */
export function SplashScreen() {
  return (
    <LinearGradient
      colors={['#1E3A8A', '#102A66']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={styles.tile}>
        <Ionicons name="diamond" size={44} color="#FFFFFF" />
      </View>
      <Text style={styles.wordmark}>AUCTIFY</Text>
      <Text style={styles.subtitle}>Galería de alta velocidad</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 40, color: '#FFFFFF', letterSpacing: 2 },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 3,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
});
