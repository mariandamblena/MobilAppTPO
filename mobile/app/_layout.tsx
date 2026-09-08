import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { AuthProvider } from '@/auth/AuthContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SplashScreen } from '@/components/SplashScreen';

/**
 * Root layout: carga las fuentes del diseño (Manrope + Inter, del Figma `Auctify - DA1`),
 * y envuelve la app en AuthProvider + SafeAreaProvider.
 * OfflineBanner se superpone globalmente sobre cualquier pantalla.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Esperamos a las fuentes; si fallan, igual renderizamos (fallback a fuente del sistema).
  if (!fontsLoaded && !fontError) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <OfflineBanner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
