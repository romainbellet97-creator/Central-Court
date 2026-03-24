/**
 * InvoiceVerification - Écran de vérification des données OCR extraites
 * Affiche l'aperçu du document et les champs éditables
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import EditableField from './EditableField';

// Types
export interface InvoiceLineItem {
  description: string;
  quantite?: number;
  prixUnitaire?: number | null;
  montant?: number | null;
}

export interface InvoiceData {
  montantTotal?: number | null;
  montantHT?: number | null;
  montantTVA?: number | null;
  currency?: string;
  numeroFacture?: string | null;
  dateFacture?: string | null;
  fournisseur?: string | null;
  adresse?: string | null;
  categorie?: string;
  lignes?: InvoiceLineItem[];
  confidence?: number;
  needsReview?: boolean;
  description?: string | null;
  fileType?: string;
  pageCount?: number;
  warnings?: string[];
}

interface InvoiceVerificationProps {
  data: InvoiceData;
  imageUri?: string;
  fileType?: 'image' | 'pdf';
  onSave: (data: InvoiceData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Catégories disponibles
const CATEGORIES = [
  { id: 'travel',         label: 'Transport',    icon: 'airplane' as const,    color: '#00796b' },
  { id: 'accommodation',  label: 'Hébergement',  icon: 'bed' as const,         color: '#1976d2' },
  { id: 'restaurant',     label: 'Restauration', icon: 'restaurant' as const,  color: '#e64a19' },
  { id: 'medical',        label: 'Médical',      icon: 'medkit' as const,      color: '#c2185b' },
  { id: 'equipment',      label: 'Matériel',     icon: 'tennisball' as const,  color: '#7b1fa2' },
  { id: 'services',       label: 'Services',     icon: 'briefcase' as const,   color: '#0097a7' },
  { id: 'other',          label: 'Autre',        icon: 'document' as const,    color: '#757575' },
];

// Map legacy French OCR category names → English IDs
const CATEGORY_NORMALIZE: Record<string, string> = {
  Transport: 'travel', Hébergement: 'accommodation', Restauration: 'restaurant',
  Médical: 'medical', Matériel: 'equipment', Équipement: 'equipment',
  Services: 'services', Autre: 'other',
};

export default function InvoiceVerification({
  data,
  imageUri,
  fileType = 'image',
  onSave,
  onCancel,
  isLoading = false,
}: InvoiceVerificationProps) {
  const normalizeData = (d: InvoiceData): InvoiceData => ({
    ...d,
    categorie: d.categorie ? (CATEGORY_NORMALIZE[d.categorie] ?? d.categorie) : 'other',
  });

  const [editedData, setEditedData] = useState<InvoiceData>(() => normalizeData(data));
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    setEditedData(normalizeData(data));
  }, [data]);

  const updateField = (field: keyof InvoiceData, value: string | number | null) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    // Convertir les montants en nombres
    const finalData: InvoiceData = {
      ...editedData,
      montantTotal: editedData.montantTotal !== null && editedData.montantTotal !== undefined
        ? parseFloat(editedData.montantTotal.toString()) || null
        : null,
      montantHT: editedData.montantHT !== null && editedData.montantHT !== undefined
        ? parseFloat(editedData.montantHT.toString()) || null
        : null,
      montantTVA: editedData.montantTVA !== null && editedData.montantTVA !== undefined
        ? parseFloat(editedData.montantTVA.toString()) || null
        : null,
    };
    onSave(finalData);
  };

  const confidence = data.confidence || 0;
  const needsReview = data.needsReview || confidence < 0.7;
  const selectedCategory = CATEGORIES.find(c => c.id === editedData.categorie) || CATEGORIES[6];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerBtn} testID="verification-cancel-btn">
          <Ionicons name="close" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Vérifier les données</Text>
          {needsReview && (
            <View style={styles.reviewBadge}>
              <Ionicons name="alert-circle" size={14} color="#F44336" />
              <Text style={styles.reviewText}>Vérification requise</Text>
            </View>
          )}
        </View>
        <TouchableOpacity 
          onPress={handleSave} 
          style={[styles.headerBtn, styles.saveBtn]}
          disabled={isLoading}
          testID="verification-save-btn"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Document Preview Toggle */}
        <TouchableOpacity 
          style={styles.previewToggle}
          onPress={() => setShowPreview(!showPreview)}
          testID="preview-toggle"
        >
          <Ionicons 
            name={showPreview ? 'eye-off' : 'eye'} 
            size={18} 
            color={Colors.primary} 
          />
          <Text style={styles.previewToggleText}>
            {showPreview ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu'}
          </Text>
          <Ionicons 
            name={showPreview ? 'chevron-up' : 'chevron-down'} 
            size={18} 
            color={Colors.primary} 
          />
        </TouchableOpacity>

        {/* Document Preview */}
        {showPreview && imageUri && (
          <View style={styles.previewContainer} testID="document-preview">
            {fileType === 'pdf' ? (
              <View style={styles.pdfPreview}>
                <Ionicons name="document-text" size={48} color={Colors.primary} />
                <Text style={styles.pdfText}>Document PDF</Text>
                {data.pageCount && (
                  <Text style={styles.pdfPages}>{data.pageCount} page(s)</Text>
                )}
              </View>
            ) : (
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
          </View>
        )}

        {/* Confidence Score */}
        <View style={styles.confidenceCard}>
          <View style={styles.confidenceHeader}>
            <Ionicons 
              name={confidence >= 0.7 ? 'sparkles' : 'warning'} 
              size={20} 
              color={confidence >= 0.7 ? '#4CAF50' : '#FF9800'} 
            />
            <Text style={styles.confidenceTitle}>
              {confidence >= 0.9 ? 'Extraction excellente' :
               confidence >= 0.7 ? 'Extraction réussie' :
               'Vérification nécessaire'}
            </Text>
          </View>
          <View style={styles.confidenceBar}>
            <View 
              style={[
                styles.confidenceFill, 
                { 
                  width: `${Math.round(confidence * 100)}%`,
                  backgroundColor: confidence >= 0.7 ? '#4CAF50' : '#FF9800'
                }
              ]} 
            />
          </View>
          <Text style={styles.confidencePercent}>
            Confiance: {Math.round(confidence * 100)}%
          </Text>
        </View>

        {/* Warnings */}
        {data.warnings && data.warnings.length > 0 && (
          <View style={styles.warningsCard}>
            <Text style={styles.warningsTitle}>
              <Ionicons name="alert-circle" size={16} color="#F44336" /> Avertissements
            </Text>
            {data.warnings.map((warning, index) => (
              <Text key={index} style={styles.warningItem}>• {warning}</Text>
            ))}
          </View>
        )}

        {/* Main Amount - Prominent */}
        <View style={styles.mainAmountCard} testID="main-amount-section">
          <EditableField
            label="Montant Total TTC"
            value={editedData.montantTotal}
            onValueChange={(val) => updateField('montantTotal', val)}
            type="amount"
            placeholder="0.00"
            icon="cash"
            confidence={confidence}
            required
            suffix="€"
            testID="field-montant-total"
          />
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catégorie</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  editedData.categorie === cat.id && { 
                    backgroundColor: cat.color + '20', 
                    borderColor: cat.color 
                  }
                ]}
                onPress={() => updateField('categorie', cat.id)}
                testID={`category-${cat.id}`}
              >
                <Ionicons 
                  name={cat.icon} 
                  size={16} 
                  color={editedData.categorie === cat.id ? cat.color : Colors.text.secondary} 
                />
                <Text style={[
                  styles.categoryLabel,
                  editedData.categorie === cat.id && { color: cat.color }
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations générales</Text>
          
          <EditableField
            label="Date de facture"
            value={editedData.dateFacture}
            onValueChange={(val) => updateField('dateFacture', val)}
            type="date"
            placeholder="JJ/MM/AAAA"
            icon="calendar"
            testID="field-date"
          />

          <EditableField
            label="Fournisseur"
            value={editedData.fournisseur}
            onValueChange={(val) => updateField('fournisseur', val)}
            placeholder="Nom du fournisseur"
            icon="business"
            testID="field-fournisseur"
          />

          <EditableField
            label="Numéro de facture"
            value={editedData.numeroFacture}
            onValueChange={(val) => updateField('numeroFacture', val)}
            placeholder="N° facture (optionnel)"
            icon="document-text"
            testID="field-numero"
          />
        </View>

        {/* Detailed Amounts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détail des montants</Text>
          
          <View style={styles.amountsRow}>
            <View style={styles.amountHalf}>
              <EditableField
                label="Montant HT"
                value={editedData.montantHT}
                onValueChange={(val) => updateField('montantHT', val)}
                type="amount"
                placeholder="0.00"
                suffix="€"
                testID="field-montant-ht"
              />
            </View>
            <View style={styles.amountHalf}>
              <EditableField
                label="TVA"
                value={editedData.montantTVA}
                onValueChange={(val) => updateField('montantTVA', val)}
                type="amount"
                placeholder="0.00"
                suffix="€"
                testID="field-montant-tva"
              />
            </View>
          </View>
        </View>

        {/* Line Items */}
        {editedData.lignes && editedData.lignes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Lignes de facture ({editedData.lignes.length})
            </Text>
            {editedData.lignes.map((ligne, index) => (
              <View key={index} style={styles.lineItem}>
                <Text style={styles.lineDescription} numberOfLines={2}>
                  {ligne.description || 'Article sans description'}
                </Text>
                <View style={styles.lineDetails}>
                  {ligne.quantite && ligne.quantite > 1 && (
                    <Text style={styles.lineQuantity}>x{ligne.quantite}</Text>
                  )}
                  {ligne.montant && (
                    <Text style={styles.lineMontant}>{ligne.montant.toFixed(2)} €</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        {data.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{data.description}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.cancelBtn} 
            onPress={onCancel}
            testID="btn-cancel"
          >
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={handleSave}
            disabled={isLoading}
            testID="btn-save"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  reviewText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  previewToggleText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  previewContainer: {
    height: 200,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  pdfPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  pdfPages: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 4,
  },
  confidenceCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  confidenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidencePercent: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'right',
  },
  warningsCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  warningsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 8,
  },
  warningItem: {
    fontSize: 13,
    color: '#E65100',
    marginTop: 4,
  },
  mainAmountCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  amountsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountHalf: {
    flex: 1,
  },
  lineItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  lineDescription: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  lineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineQuantity: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  lineMontant: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  descriptionCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
