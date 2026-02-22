import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================
// TYPES
// ============================================================

// BUG #2 FIX: Statuts d'envoi pour le badge
const SEND_STATUS = {
  SENDING: 'sending',    // badge orange "Envoi..."
  SENT: 'sent',          // badge vert "Envoyé ✓"  → disparaît après 2s
  ERROR: 'error',        // badge rouge "Échec"
} as const;

type SendStatusType = typeof SEND_STATUS[keyof typeof SEND_STATUS] | null;

interface Observation {
  id: string;
  author: string;
  role?: string;
  text: string;
  createdAt: string;
  parentId?: string | null;
  isPending?: boolean;
  sendStatus?: SendStatusType;
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
  onObservationUpdated?: (observationId: string, updatedFields: Partial<Observation>) => void;
  onSaveObservation: (data: { eventId: string; text: string; parentId?: string | null }) => Promise<Observation>;
  onComposerOpen?: () => void; // BUG #3 FIX: Callback pour scroll
}

// ============================================================
// BUG #2 FIX: Badge de statut d'envoi
// ============================================================
const SendStatusBadge = React.memo(({ status }: { status?: SendStatusType }) => {
  if (!status) return null;

  const config = {
    [SEND_STATUS.SENDING]: {
      label: 'Envoi...',
      backgroundColor: '#FEF3C7',
      color: '#D97706',
    },
    [SEND_STATUS.SENT]: {
      label: 'Envoyé ✓',
      backgroundColor: '#D1FAE5',
      color: '#059669',
    },
    [SEND_STATUS.ERROR]: {
      label: 'Échec ✕',
      backgroundColor: '#FEE2E2',
      color: '#DC2626',
    },
  }[status];

  if (!config) return null;

  return (
    <View style={[styles.sendBadge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.sendBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
});

// ============================================================
// ComposerBox - Composant isolé avec state local
// ============================================================
interface ComposerBoxProps {
  replyingTo: { id: string; authorName: string } | null;
  onSubmit: (content: string, parentId: string | null) => Promise<void>;
  onCancel: () => void;
  onClearReply: () => void;
  onFocus?: () => void; // BUG #3 FIX: Callback au focus
}

const ComposerBox = React.memo<ComposerBoxProps>(({ 
  replyingTo, 
  onSubmit,
  onCancel,
  onClearReply,
  onFocus,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || isSubmitting) return;
    const content = text.trim();
    setText('');
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
        onChangeText={setText}
        multiline={true}
        scrollEnabled={true}
        maxLength={1000}
        blurOnSubmit={false}
        returnKeyType="default"
        autoCorrect={true}
        autoCapitalize="sentences"
        // BUG #3 FIX: Callback au focus pour scroller
        onFocus={onFocus}
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

// ============================================================
// ObservationCard - Carte d'observation avec badge statut
// ============================================================
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
        {/* BUG #2 FIX: Utiliser SendStatusBadge au lieu de isPending */}
        <SendStatusBadge status={observation.sendStatus} />
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
  onObservationUpdated,
  onSaveObservation,
  onComposerOpen,
}) => {
  const [isComposing, setIsComposing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);

  const hasObservations = observations.length > 0;

  // ============================================================
  // BUG #1 FIX: Utiliser currentUser.name (pas replyingTo.authorName)
  // BUG #2 FIX: Gestion complète des statuts d'envoi
  // ============================================================
  const handleSubmit = useCallback(async (content: string, parentId: string | null) => {
    const tempId = `temp-${Date.now()}`;

    // BUG #1 FIX: TOUJOURS utiliser currentUser.name, PAS replyingTo.authorName
    const optimisticObs: Observation = {
      id: tempId,
      text: content,
      author: currentUser.name,      // ✅ Nom de l'utilisateur connecté
      role: currentUser.role || 'Staff',
      createdAt: new Date().toISOString(),
      parentId: parentId,
      sendStatus: SEND_STATUS.SENDING,  // BUG #2 FIX: Statut initial
    };
    
    // 1. Affichage immédiat avec "Envoi..."
    onObservationAdded(optimisticObs);
    setIsComposing(false);
    setReplyingTo(null);

    try {
      // 2. Appel API
      const savedObs = await onSaveObservation({ eventId, text: content, parentId });
      
      // 3. BUG #2 FIX: Passer à "Envoyé ✓" (remplacer tempId par ID réel)
      if (onObservationUpdated) {
        onObservationUpdated(tempId, {
          id: savedObs.id,
          sendStatus: SEND_STATUS.SENT,
        });

        // 4. BUG #2 FIX: Faire disparaître le badge après 2 secondes
        setTimeout(() => {
          onObservationUpdated(savedObs.id, { sendStatus: null });
        }, 2000);
      }
    } catch (error) {
      // 5. BUG #2 FIX: Passer à "Échec" en cas d'erreur
      if (onObservationUpdated) {
        onObservationUpdated(tempId, { sendStatus: SEND_STATUS.ERROR });
      }
      Alert.alert('Erreur', "L'observation n'a pas pu être enregistrée.");
    }
  }, [eventId, currentUser, onObservationAdded, onObservationUpdated, onSaveObservation]);

  const handleCancel = useCallback(() => {
    setIsComposing(false);
    setReplyingTo(null);
  }, []);

  // BUG #3 FIX: Déclencher le scroll dès l'ouverture du composer
  const handleOpenComposer = useCallback((replyTarget: { id: string; authorName: string } | null = null) => {
    setReplyingTo(replyTarget);
    setIsComposing(true);
    onComposerOpen?.();
  }, [onComposerOpen]);

  const handleClearReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // BUG #3 FIX: Callback supplémentaire au focus du TextInput
  const handleComposerFocus = useCallback(() => {
    onComposerOpen?.();
  }, [onComposerOpen]);

  const rootObservations = observations.filter(o => !o.parentId);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Ionicons name="chatbubbles-outline" size={18} color="#1F2937" />
        <Text style={styles.sectionTitle}>
          Observations {hasObservations ? `(${observations.length})` : ''}
        </Text>
      </View>

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

      {isComposing && (
        <ComposerBox
          key="observation-composer"
          replyingTo={replyingTo}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onClearReply={handleClearReply}
          onFocus={handleComposerFocus}
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

  // BUG #2 FIX: Styles pour les badges de statut
  sendBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sendBadgeText: { 
    fontSize: 11, 
    fontWeight: '500' 
  },

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
