import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'onboarding_data';
const STEP_KEY = 'onboarding_current_step';

export interface OnboardingData {
  prenom?: string;
  dateNaissance?: string;
  circuits?: string[];
  niveaux?: string[];
  classement?: number | null;
  email?: string;
  password?: string;
}

export const saveOnboardingStep = async (step: number, data: Partial<OnboardingData>): Promise<void> => {
  try {
    // Get existing data
    const existingDataStr = await AsyncStorage.getItem(STORAGE_KEY);
    const existingData: OnboardingData = existingDataStr ? JSON.parse(existingDataStr) : {};
    
    // Merge with new data
    const updatedData = { ...existingData, ...data };
    
    // Save both
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    await AsyncStorage.setItem(STEP_KEY, step.toString());
  } catch (error) {
    console.error('Error saving onboarding step:', error);
  }
};

export const getOnboardingData = async (): Promise<OnboardingData | null> => {
  try {
    const dataStr = await AsyncStorage.getItem(STORAGE_KEY);
    return dataStr ? JSON.parse(dataStr) : null;
  } catch (error) {
    console.error('Error getting onboarding data:', error);
    return null;
  }
};

export const getCurrentStep = async (): Promise<number> => {
  try {
    const step = await AsyncStorage.getItem(STEP_KEY);
    return step ? parseInt(step) : 0;
  } catch (error) {
    return 0;
  }
};

export const clearOnboardingData = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(STEP_KEY);
  } catch (error) {
    console.error('Error clearing onboarding data:', error);
  }
};
