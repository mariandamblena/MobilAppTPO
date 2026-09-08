import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/auth/AuthContext';
import { get } from '@/api/client';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { colors, typography, spacing } from '@/theme';
import type { Country } from '@/api/types';
import type { ApiError } from '@/api/client';

interface RegisterErrors {
  document?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  address?: string;
  countryId?: string;
  idCardFront?: string;
  idCardBack?: string;
  general?: string;
}

/**
 * Registro etapa 1 (F01).
 * Campos obligatorios: DNI, nombre, apellido, email, domicilio, pais, frente y dorso del DNI.
 * Opcional: foto de perfil.
 * Usa expo-image-picker para las fotos del documento.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  // Campos del formulario
  const [document, setDocument] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [countryId, setCountryId] = useState<number | null>(null);
  const [idCardFront, setIdCardFront] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [idCardBack, setIdCardBack] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});

  // Cargar paises al montar
  useEffect(() => {
    get<Country[]>('/countries')
      .then(setCountries)
      .catch(() => setCountries([]))
      .finally(() => setLoadingCountries(false));
  }, []);

  async function pickImage(
    setter: (asset: ImagePicker.ImagePickerAsset) => void
  ) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setter(result.assets[0]);
    }
  }

  function validate(): boolean {
    const next: RegisterErrors = {};

    if (!document.trim()) next.document = 'El DNI es obligatorio';
    if (!firstName.trim()) next.firstName = 'El nombre es obligatorio';
    if (!lastName.trim()) next.lastName = 'El apellido es obligatorio';

    if (!email.trim()) {
      next.email = 'El email es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Ingresá un email válido';
    }

    if (!address.trim()) next.address = 'El domicilio es obligatorio';
    if (!countryId) next.countryId = 'Seleccioná un país';
    if (!idCardFront) next.idCardFront = 'La foto del frente del DNI es obligatoria';
    if (!idCardBack) next.idCardBack = 'La foto del dorso del DNI es obligatoria';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await register({
        document: document.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        address: address.trim(),
        countryId: countryId!,
        idCardFront: idCardFront!,
        idCardBack: idCardBack!,
        photo: photo ?? undefined,
      });

      // Exito → pantalla de pendiente
      router.replace('/(auth)/pending');
    } catch (err) {
      const apiError = err as ApiError;

      // Resaltar campo con error de duplicado
      if (apiError.code === 'DUPLICATE_ENTRY') {
        const msg = apiError.message ?? '';
        if (msg.toLowerCase().includes('document') || msg.toLowerCase().includes('dni')) {
          setErrors({ document: 'Este DNI ya está registrado' });
        } else if (msg.toLowerCase().includes('email')) {
          setErrors({ email: 'Este email ya está registrado' });
        } else {
          setErrors({ general: 'Ya existe un usuario con esos datos' });
        }
        return;
      }

      // VALIDATION_ERROR: resaltar campos indicados por el backend
      if (apiError.code === 'VALIDATION_ERROR' && apiError.details?.fields) {
        setErrors(apiError.details.fields as RegisterErrors);
        return;
      }

      setErrors({ general: apiError.message ?? 'No se pudo completar el registro. Intentá de nuevo.' });
    } finally {
      setLoading(false);
    }
  }

  if (loadingCountries) return <Loading />;

  return (
    <ScreenContainer scrollable>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Completá tus datos personales y las fotos de tu documento.</Text>

      {errors.general ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errors.general}</Text>
        </View>
      ) : null}

      <Field
        label="DNI / Documento"
        required
        value={document}
        onChangeText={setDocument}
        error={errors.document}
        placeholder="30111222"
        keyboardType="numeric"
      />
      <Field
        label="Nombre"
        required
        value={firstName}
        onChangeText={setFirstName}
        error={errors.firstName}
        placeholder="Juan"
        autoCapitalize="words"
      />
      <Field
        label="Apellido"
        required
        value={lastName}
        onChangeText={setLastName}
        error={errors.lastName}
        placeholder="Pérez"
        autoCapitalize="words"
      />
      <Field
        label="Email"
        required
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        placeholder="juan@ejemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Domicilio"
        required
        value={address}
        onChangeText={setAddress}
        error={errors.address}
        placeholder="Av. Santa Fe 1234, CABA"
      />

      {/* Selector de pais simple — en produccion reemplazar con un Picker */}
      <View style={styles.countrySection}>
        <Text style={styles.sectionLabel}>
          País <Text style={styles.required}>*</Text>
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.countryScroll}>
          {countries.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.countryChip, countryId === c.id && styles.countryChipSelected]}
              onPress={() => setCountryId(c.id)}
            >
              <Text style={[styles.countryChipText, countryId === c.id && styles.countryChipTextSelected]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {errors.countryId ? <Text style={styles.fieldError}>{errors.countryId}</Text> : null}
      </View>

      {/* Foto frente del DNI */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionLabel}>
          Foto frente del DNI <Text style={styles.required}>*</Text>
        </Text>
        <Button
          title={idCardFront ? 'Cambiar foto (frente)' : 'Seleccionar foto (frente)'}
          onPress={() => pickImage(setIdCardFront)}
          variant="outline"
        />
        {idCardFront ? (
          <Image source={{ uri: idCardFront.uri }} style={styles.previewImage} />
        ) : null}
        {errors.idCardFront ? <Text style={styles.fieldError}>{errors.idCardFront}</Text> : null}
      </View>

      {/* Foto dorso del DNI */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionLabel}>
          Foto dorso del DNI <Text style={styles.required}>*</Text>
        </Text>
        <Button
          title={idCardBack ? 'Cambiar foto (dorso)' : 'Seleccionar foto (dorso)'}
          onPress={() => pickImage(setIdCardBack)}
          variant="outline"
        />
        {idCardBack ? (
          <Image source={{ uri: idCardBack.uri }} style={styles.previewImage} />
        ) : null}
        {errors.idCardBack ? <Text style={styles.fieldError}>{errors.idCardBack}</Text> : null}
      </View>

      {/* Foto de perfil — opcional */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionLabel}>
          Foto de perfil <Text style={styles.optional}>(opcional)</Text>
        </Text>
        <Button
          title={photo ? 'Cambiar foto de perfil' : 'Seleccionar foto de perfil'}
          onPress={() => pickImage(setPhoto)}
          variant="outline"
        />
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.previewImageRound} />
        ) : null}
      </View>

      <Button
        title="Registrarme"
        onPress={handleRegister}
        loading={loading}
        style={styles.submitButton}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.heading2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.feedback.error,
  },
  optional: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  countrySection: {
    marginBottom: spacing.md,
  },
  countryScroll: {
    marginBottom: spacing.xs,
  },
  countryChip: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    backgroundColor: colors.background.secondary,
  },
  countryChipSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  countryChipText: {
    ...typography.bodySmall,
    color: colors.text.primary,
  },
  countryChipTextSelected: {
    color: '#FFFFFF',
  },
  photoSection: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: spacing.xs,
    resizeMode: 'cover',
  },
  previewImageRound: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: spacing.xs,
  },
  fieldError: {
    ...typography.caption,
    color: colors.feedback.error,
    marginTop: 2,
  },
  submitButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
