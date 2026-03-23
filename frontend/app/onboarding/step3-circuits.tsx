import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import OnboardingProgressBar from '../../src/components/OnboardingProgressBar';
import { saveOnboardingStep } from '../../src/utils/onboardingStorage';

const COLORS = {
  primary: '#2D5016',
  secondary: '#E8B923',
  background: '#F8F9FA',
  success: '#43A047',
  error: '#E53935',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
};

const CIRCUITS = [
  {
    id: 'ATP',
    name: 'ATP',
    description: 'Circuit masculin professionnel',
    emoji: '🎾',
    color: '#1976d2',
  },
  {
    id: 'WTA',
    name: 'WTA',
    description: 'Circuit féminin professionnel',
    emoji: '🎾',
    color: '#9c27b0',
  },
  {
    id: 'ITF',
    name: 'ITF',
    description: 'Circuit ITF Pro',
    emoji: '🌍',
    color: '#2e7d32',
  },
  {
    id: 'ITF_WHEELCHAIR',
    name: 'ITF Wheelchair',
    description: 'Circuit Handisport',
    emoji: '♿',
    color: '#ff5722',
  },
];

export default function Step3Circuits() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([]);
  
  const toggleCircuit = (circuitId: string) => {
    setSelectedCircuits(prev => {
      if (prev.includes(circuitId)) return prev.filter(c => c !== circuitId);
      // ATP and WTA are gender-exclusive — selecting one deselects the other
      if (circuitId === 'ATP') return [...prev.filter(c => c !== 'WTA'), 'ATP'];
      if (circuitId === 'WTA') return [...prev.filter(c => c !== 'ATP'), 'WTA'];
      return [...prev, circuitId];
    });
  };
  
  const saveAndContinue = async () => {
    await saveOnboardingStep(3, { circuits: selectedCircuits });
    setTimeout(() => {
      router.push('/onboarding/step4-niveaux');
    }, 300);
  };
  
  const canContinue = selectedCircuits.length > 0;
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
      </TouchableOpacity>
      
      <OnboardingProgressBar currentStep={3} totalSteps={7} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.question}>Sur quel(s) circuit(s) jouez-vous ?</Text>
          <Text style={styles.hint}>ATP et WTA sont exclusifs · ITF combinable</Text>
          
          <View style={styles.cardsContainer}>
            {CIRCUITS.map(circuit => {
              const isSelected = selectedCircuits.includes(circuit.id);
              return (
                <TouchableOpacity
                  key={circuit.id}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected,
                    isSelected && { borderColor: circuit.color },
                  ]}
                  onPress={() => toggleCircuit(circuit.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardContent}>
                    <Text style={styles.cardEmoji}>{circuit.emoji}</Text>
                    <View style={styles.cardTextContainer}>
                      <Text style={styles.cardName}>{circuit.name}</Text>
                      <Text style={styles.cardDescription}>{circuit.description}</Text>
                    </View>
                  </View>
                  
                  {isSelected && (
                    <View style={[styles.checkmark, { backgroundColor: circuit.color }]}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
      
      {/* Continue button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          onPress={saveAndContinue}
          disabled={!canContinue}
        >
          <Text style={[styles.continueBtnText, !canContinue && styles.continueBtnTextDisabled]}>
            Continuer
          </Text>
          <Ionicons 
            name="arrow-forward" 
            size={20} 
            color={canContinue ? '#fff' : '#bdbdbd'} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  question: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSelected: {
    backgroundColor: '#f0fdf4',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  continueBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  continueBtnTextDisabled: {
    color: '#bdbdbd',
  },
});
