import React, { useState, useEffect } from 'react';
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
import { saveOnboardingStep, getOnboardingData } from '../../src/utils/onboardingStorage';

const COLORS = {
  primary: '#2D5016',
  secondary: '#E8B923',
  background: '#F8F9FA',
  success: '#43A047',
  error: '#E53935',
  text: '#1a1a1a',
  textSecondary: '#6b7280',
};

const TOURNAMENT_LEVELS: Record<string, { id: string; name: string; points: string }[]> = {
  ATP: [
    { id: 'grand_slam', name: 'Grand Chelem', points: '2000 pts' },
    { id: 'atp_1000', name: 'ATP Masters 1000', points: '1000 pts' },
    { id: 'atp_500', name: 'ATP 500', points: '500 pts' },
    { id: 'atp_250', name: 'ATP 250', points: '250 pts' },
    { id: 'atp_challenger', name: 'ATP Challenger', points: '125 pts' },
    { id: 'itf_m15', name: 'ITF M15-M25', points: 'Points ITF' },
  ],
  WTA: [
    { id: 'grand_slam', name: 'Grand Chelem', points: '2000 pts' },
    { id: 'wta_1000', name: 'WTA 1000', points: '1000 pts' },
    { id: 'wta_500', name: 'WTA 500', points: '500 pts' },
    { id: 'wta_250', name: 'WTA 250', points: '250 pts' },
    { id: 'wta_125', name: 'WTA 125', points: '125 pts' },
    { id: 'itf_w15', name: 'ITF W15-W100', points: 'Points ITF' },
  ],
  ITF: [
    { id: 'itf_m15', name: 'ITF M15-M25', points: 'Points ITF' },
    { id: 'itf_w15', name: 'ITF W15-W100', points: 'Points ITF' },
  ],
  ITF_WHEELCHAIR: [
    { id: 'itf_wheelchair', name: 'ITF Wheelchair Tour', points: 'Points ITF' },
  ],
};

export default function Step4Niveaux() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [selectedCircuits, setSelectedCircuits] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load selected circuits from previous step
  useEffect(() => {
    loadCircuits();
  }, []);
  
  const loadCircuits = async () => {
    const data = await getOnboardingData();
    if (data?.circuits) {
      setSelectedCircuits(data.circuits);
    }
    setLoading(false);
  };
  
  // Get unique levels based on selected circuits
  const getAvailableLevels = () => {
    const allLevels = selectedCircuits.flatMap(circuit => TOURNAMENT_LEVELS[circuit] || []);
    // Remove duplicates by id
    const uniqueLevels = allLevels.filter((level, index, self) =>
      index === self.findIndex(l => l.id === level.id)
    );
    return uniqueLevels;
  };
  
  const toggleLevel = (levelId: string) => {
    setSelectedLevels(prev =>
      prev.includes(levelId)
        ? prev.filter(l => l !== levelId)
        : [...prev, levelId]
    );
  };
  
  const saveAndContinue = async () => {
    await saveOnboardingStep(4, { niveauxTournois: selectedLevels });
    setTimeout(() => {
      router.push('/onboarding/step5-classement');
    }, 300);
  };
  
  const canContinue = selectedLevels.length > 0;
  const availableLevels = getAvailableLevels();
  
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text>Chargement...</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={COLORS.text} />
      </TouchableOpacity>
      
      <OnboardingProgressBar currentStep={4} totalSteps={7} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.question}>À quels niveaux de tournois participez-vous ?</Text>
          <Text style={styles.hint}>Sélection multiple possible</Text>
          
          {/* Group by circuit if multiple */}
          {selectedCircuits.length > 1 ? (
            selectedCircuits.map(circuit => {
              const circuitLevels = TOURNAMENT_LEVELS[circuit] || [];
              return (
                <View key={circuit} style={styles.circuitSection}>
                  <Text style={styles.circuitHeader}>{circuit}</Text>
                  {circuitLevels.map(level => {
                    const isSelected = selectedLevels.includes(level.id);
                    return (
                      <TouchableOpacity
                        key={level.id}
                        style={[
                          styles.levelCard,
                          isSelected && styles.levelCardSelected,
                        ]}
                        onPress={() => toggleLevel(level.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.levelInfo}>
                          <Text style={styles.levelName}>{level.name}</Text>
                          <Text style={styles.levelPoints}>{level.points}</Text>
                        </View>
                        
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          ) : (
            <View style={styles.levelsContainer}>
              {availableLevels.map(level => {
                const isSelected = selectedLevels.includes(level.id);
                return (
                  <TouchableOpacity
                    key={level.id}
                    style={[
                      styles.levelCard,
                      isSelected && styles.levelCardSelected,
                    ]}
                    onPress={() => toggleLevel(level.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.levelInfo}>
                      <Text style={styles.levelName}>{level.name}</Text>
                      <Text style={styles.levelPoints}>{level.points}</Text>
                    </View>
                    
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      
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
  circuitSection: {
    marginBottom: 24,
  },
  circuitHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelsContainer: {
    gap: 10,
  },
  levelCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  levelCardSelected: {
    borderColor: COLORS.success,
    backgroundColor: '#f0fdf4',
  },
  levelInfo: {
    flex: 1,
  },
  levelName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  levelPoints: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
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
