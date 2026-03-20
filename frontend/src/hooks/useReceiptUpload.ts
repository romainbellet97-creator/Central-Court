import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export const useReceiptUpload = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  // GUARD : Empêche double-clic
  const withGuard = async (action: () => Promise<any>) => {
    if (isProcessing) {
      console.log('⚠️ Action déjà en cours, ignoré');
      return null;
    }

    setIsProcessing(true);
    try {
      const result = await action();
      return result;
    } finally {
      // Attendre 500ms avant d'autoriser nouveau clic
      setTimeout(() => setIsProcessing(false), 500);
    }
  };

  // CAMÉRA : ImagePicker
  const takePhoto = async () => {
    return withGuard(async () => {
      console.log('📸 Ouverture caméra...');

      // Demander permission
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Autorisez l\'accès à la caméra pour scanner les reçus.',
          [
            { text: 'Annuler', style: 'cancel' },
            { 
              text: 'Paramètres', 
              onPress: () => Linking.openSettings() 
            },
          ]
        );
        return null;
      }

      // Lancer caméra
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('✅ Photo prise:', result.assets[0].uri);
        return result.assets[0];
      }

      console.log('❌ Photo annulée');
      return null;
    });
  };

  // GALERIE : ImagePicker
  const pickFromGallery = async () => {
    return withGuard(async () => {
      console.log('🖼️ Ouverture galerie...');

      // Demander permission
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission requise',
          'Autorisez l\'accès à la galerie.',
          [
            { text: 'Annuler', style: 'cancel' },
            { 
              text: 'Paramètres', 
              onPress: () => Linking.openSettings() 
            },
          ]
        );
        return null;
      }

      // Ouvrir galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('✅ Image sélectionnée:', result.assets[0].uri);
        return result.assets[0];
      }

      console.log('❌ Sélection annulée');
      return null;
    });
  };

  return {
    takePhoto,
    pickFromGallery,
    isProcessing,
  };
};
