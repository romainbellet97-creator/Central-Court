import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Types
interface Observation {
  id: string;
  author: string;
  role?: string;
  text: string;
  createdAt: string;
  parentId?: string | null;
  isPending?: boolean;
}

interface CurrentUser {
  id: string;
  name: string;
  role?: string;
}

interface Props {
  eventId: string;
  observations: Observation[];
  currentUser: CurrentUser;
  onObservationAdded: (observation: Observation | null, removeId?: string) => void;
  onSaveObservation: (data: { eventId: string; text: string; parentId?: string | null }) => Promise<Observation>;
}

// ============================================================
// BUG #1 FIX: ComposerBox est maintenant un composant SÉPARÉ
// avec son propre state local pour éviter les re-renders du parent
// ============================================================
interface ComposerBoxProps {
  replyingTo: { id: string; authorName: string } | null;
  onSubmit: (content: string, parentId: string | null) => Promise<void>;
  onCancel: () => void;
  onClearReply: () => void;
}

const ComposerBox = React.memo<ComposerBoxProps>(({ 
  replyingTo, 
  onSubmit,
  onCancel,
  onClearReply,
}) => {
  // ✅ State LOCAL au ComposerBox — ne propage PAS vers le parent
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus automatique à l'ouverture
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || isSubmitting) return;
    const content = text.trim();
    setText(''); // Reset immédiat
    setIsSubmitting(true);
    try {
      await onSubmit(content, replyingTo?.id || null);
    } finally {
      setIsSubmitting(false);
    }
  }, [text, isSubmitting, onSubmit, replyingTo]);

  return (
    <View style={styles.composerContainer}>
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>
            ↩ Réponse à {replyingTo.authorName}
          </Text>
          <TouchableOpacity 
            onPress={onClearReply} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        ref={inputRef}
        style={styles.textInput}
        placeholder={replyingTo ? `Répondre à ${replyingTo.authorName}...` : 'Ajouter une observation...'}
        placeholderTextColor="#9CA3AF"
        value={text}
        onChangeText={setText}  // ✅ setState LOCAL — pas de remontée vers parent
        multiline={true}
        scrollEnabled={true}
        maxLength={1000}
        
        // ✅ CRITIQUE : empêche le dismiss du clavier
        blurOnSubmit={false}
        returnKeyType="default"
        
        // ✅ Empêche la perte de focus sur interaction externe
        autoCorrect={true}
        autoCapitalize="sentences"
      />

      <Text style={styles.charCount}>{text.length}/1000</Text>

      <View style={styles.composerActions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, (!text.trim() || isSubmitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!text.trim() || isSubmitting}
        >
          <Text style={styles.submitText}>
            {isSubmitting ? 'Envoi...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Composant carte observation
const ObservationCard = React.memo(({ 
  observation, 
  allObservations,
  onReply,
  isReply = false,
}: { 
  observation: Observation; 
  allObservations: Observation[];
  onReply: (target: { id: string; authorName: string }) => void;
  isReply?: boolean;
}) => {
  const replies = allObservations.filter(o => o.parentId === observation.id);

  // Format date relative
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <View style={[styles.observationCard, isReply && styles.observationReply]}>
      <View style={styles.observationHeader}>
        <View style={styles.authorAvatar}>
          <Text style={styles.authorInitial}>
            {observation.author?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.observationMeta}>
          <Text style={styles.authorName}>{observation.author}</Text>
          <Text style={styles.observationDate}>{formatRelativeDate(observation.createdAt)}</Text>
        </View>
        {observation.isPending && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Envoi...</Text>
          </View>
        )}
      </View>

      <Text style={styles.observationText}>{observation.text}</Text>

      {!isReply && (
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() => onReply({ id: observation.id, authorName: observation.author })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-undo-outline" size={14} color="#1a5276" />
          <Text style={styles.replyButtonText}>Répondre</Text>
        </TouchableOpacity>
      )}

      {/* Réponses imbriquées */}
      {replies.map(reply => (
        <ObservationCard 
          key={reply.id} 
          observation={reply} 
          allObservations={allObservations}
          onReply={onReply}
          isReply 
        />
      ))}
    </View>
  );
});

// ============================================================
// Composant principal EventObservationSection
// ============================================================
const EventObservationSection: React.FC<Props> = ({
  eventId,
  observations = [],
  currentUser,
  onObservationAdded,
  onSaveObservation,
}) => {
  const [isComposing, setIsComposing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);

  const hasObservations = observations.length > 0;

  // ✅ useCallback OBLIGATOIRE pour stabiliser les références
  const handleSubmit = useCallback(async (content: string, parentId: string | null) => {
    const optimisticObs: Observation = {
      id: `temp-${Date.now()}`,
      text: content,
      author: currentUser.name,
      role: currentUser.role || 'Staff',
      createdAt: new Date().toISOString(),
      parentId: parentId,
      isPending: true,
    };
    
    onObservationAdded(optimisticObs);
    setIsComposing(false);
    setReplyingTo(null);

    try {
      await onSaveObservation({ eventId, text: content, parentId });
    } catch (error) {
      onObservationAdded(null, optimisticObs.id);
      Alert.alert('Erreur', "Impossible d'enregistrer l'observation.");
    }
  }, [eventId, currentUser, onObservationAdded, onSaveObservation]);

  const handleCancel = useCallback(() => {
    setIsComposing(false);
    setReplyingTo(null);
  }, []);

  const handleOpenComposer = useCallback((replyTarget: { id: string; authorName: string } | null = null) => {
    setReplyingTo(replyTarget);
    setIsComposing(true);
  }, []);

  const handleClearReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Observations racines uniquement (pas les réponses)
  const rootObservations = observations.filter(o => !o.parentId);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Ionicons name="chatbubbles-outline" size={18} color="#1F2937" />
        <Text style={styles.sectionTitle}>
          Observations {hasObservations ? `(${observations.length})` : ''}
        </Text>
      </View>

      {/* CAS A : Pas de commentaire → afficher zone de saisie */}
      {!hasObservations && !isComposing && (
        <TouchableOpacity
          style={styles.emptyState}
          onPress={() => handleOpenComposer()}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={20} color="#6B7280" />
          <Text style={styles.emptyStateText}>Ajouter une observation</Text>
        </TouchableOpacity>
      )}

      {/* CAS B : Commentaires existants */}
      {hasObservations && (
        <>
          {rootObservations.map(obs => (
            <ObservationCard 
              key={obs.id} 
              observation={obs} 
              allObservations={observations}
              onReply={handleOpenComposer}
            />
          ))}
          {!isComposing && (
            <TouchableOpacity
              style={styles.addObservationButton}
              onPress={() => handleOpenComposer()}
            >
              <Ionicons name="add-circle-outline" size={18} color="#1a5276" />
              <Text style={styles.addObservationText}>Ajouter une observation</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Boîte de saisie - key FIXE et STABLE */}
      {isComposing && (
        <ComposerBox
          key="observation-composer"
          replyingTo={replyingTo}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onClearReply={handleClearReply}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    marginTop: 16, 
    paddingTop: 16, 
    borderTopWidth: 1, 
    borderTopColor: '#E5E7EB' 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 12 
  },
  sectionTitle: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#1F2937' 
  },

  // Empty state
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyStateText: { 
    fontSize: 14, 
    color: '#6B7280', 
    fontStyle: 'italic' 
  },

  // Observation card
  observationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  observationReply: {
    marginLeft: 20,
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  observationHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10, 
    gap: 10 
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a5276',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInitial: { 
    color: '#FFFFFF', 
    fontWeight: '700', 
    fontSize: 15 
  },
  observationMeta: { flex: 1 },
  authorName: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#1F2937' 
  },
  observationDate: { 
    fontSize: 12, 
    color: '#9CA3AF', 
    marginTop: 2 
  },
  observationText: { 
    fontSize: 14, 
    color: '#374151', 
    lineHeight: 22 
  },
  replyButton: { 
    marginTop: 10, 
    alignSelf: 'flex-start', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  replyButtonText: { 
    fontSize: 13, 
    color: '#1a5276', 
    fontWeight: '500' 
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingText: { 
    fontSize: 11, 
    color: '#D97706', 
    fontWeight: '500' 
  },

  // Composer
  composerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1a5276',
    padding: 14,
    marginTop: 10,
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  replyBannerText: { 
    fontSize: 13, 
    color: '#1a5276', 
    fontWeight: '500' 
  },
  textInput: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 22,
    minHeight: 80,
    maxHeight: 200,
    textAlignVertical: 'top',
    paddingBottom: 4,
  },
  charCount: { 
    fontSize: 11, 
    color: '#9CA3AF', 
    textAlign: 'right', 
    marginBottom: 10 
  },
  composerActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 12 
  },
  cancelButton: { 
    paddingHorizontal: 16, 
    paddingVertical: 10 
  },
  cancelText: { 
    fontSize: 14, 
    color: '#6B7280', 
    fontWeight: '500' 
  },
  submitButton: {
    backgroundColor: '#1a5276',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  submitButtonDisabled: { 
    backgroundColor: '#D1D5DB' 
  },
  submitText: { 
    fontSize: 14, 
    color: '#FFFFFF', 
    fontWeight: '600' 
  },

  // Add button
  addObservationButton: {
    marginTop: 6,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addObservationText: { 
    fontSize: 14, 
    color: '#1a5276', 
    fontWeight: '500' 
  },
});

export default EventObservationSection;
