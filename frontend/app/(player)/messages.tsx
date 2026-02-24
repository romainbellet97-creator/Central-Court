import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../src/constants/colors';
import { useApp } from '../../src/context/AppContext';
import { Channel } from '../../src/types';
import { generateQuickReplies, QuickReply } from '../../src/utils/aiService';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { channels, messages, sendMessage, markChannelAsRead } = useApp();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  const channelMessages = selectedChannel
    ? messages.filter(m => m.channelId === selectedChannel.id)
    : [];

  useEffect(() => {
    if (selectedChannel) {
      markChannelAsRead(selectedChannel.id);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      // Load AI quick replies
      loadQuickReplies();
    }
  }, [selectedChannel]);

  // Reload quick replies when messages change
  useEffect(() => {
    if (selectedChannel && channelMessages.length > 0) {
      loadQuickReplies();
    }
  }, [messages.length]);

  const loadQuickReplies = async () => {
    if (!selectedChannel) return;
    
    const lastMessages = channelMessages
      .filter(m => m.senderId !== 'player')
      .slice(-3)
      .map(m => m.content);
    
    if (lastMessages.length === 0) {
      setQuickReplies([]);
      return;
    }

    setIsLoadingReplies(true);
    try {
      const replies = await generateQuickReplies({
        channelType: selectedChannel.type,
        lastMessages,
        senderRole: channelMessages[channelMessages.length - 1]?.senderRole || selectedChannel.type,
      });
      setQuickReplies(replies);
    } catch (error) {
      console.error('Error loading quick replies:', error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const handleSend = () => {
    if (!newMessage.trim() || !selectedChannel) return;
    sendMessage(selectedChannel.id, newMessage.trim());
    setNewMessage('');
    setShowQuickReplies(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleQuickReply = (reply: QuickReply) => {
    if (!selectedChannel) return;
    sendMessage(selectedChannel.id, reply.text);
    setShowQuickReplies(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Channel List View
  if (!selectedChannel) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1e3c72', '#2a5298']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Communiquez avec votre équipe</Text>
        </LinearGradient>

        <ScrollView style={styles.channelList}>
          {channels.map(channel => (
            <TouchableOpacity
              key={channel.id}
              style={styles.channelItem}
              onPress={() => setSelectedChannel(channel)}
            >
              <View style={[styles.channelIcon, { backgroundColor: channel.color + '20' }]}>
                <Ionicons name={channel.icon as any} size={24} color={channel.color} />
              </View>
              <View style={styles.channelInfo}>
                <View style={styles.channelHeader}>
                  <Text style={styles.channelName}>{channel.name}</Text>
                  <Text style={styles.channelTime}>{channel.lastMessageTime}</Text>
                </View>
                <View style={styles.channelPreview}>
                  <Text style={styles.channelMessage} numberOfLines={1}>
                    {channel.lastMessage}
                  </Text>
                  {channel.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{channel.unreadCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.channelMembers}>
                  {channel.members.join(', ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Chat View
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Chat Header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedChannel(null)}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={[styles.chatIcon, { backgroundColor: selectedChannel.color + '20' }]}>
          <Ionicons name={selectedChannel.icon as any} size={20} color={selectedChannel.color} />
        </View>
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{selectedChannel.name}</Text>
          <Text style={styles.chatMembers}>{selectedChannel.members.length} membres</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {channelMessages.map(msg => (
          <View
            key={msg.id}
            style={[
              styles.messageRow,
              msg.senderId === 'player' && styles.messageRowSent
            ]}
          >
            {msg.senderId !== 'player' && (
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarText}>
                  {msg.senderName.charAt(0)}
                </Text>
              </View>
            )}
            <View style={[
              styles.messageBubble,
              msg.senderId === 'player' ? styles.sentBubble : styles.receivedBubble
            ]}>
              {msg.senderId !== 'player' && (
                <Text style={styles.senderName}>{msg.senderName}</Text>
              )}
              <Text style={[
                styles.messageText,
                msg.senderId === 'player' && styles.sentText
              ]}>
                {msg.content}
              </Text>
              <Text style={[
                styles.messageTime,
                msg.senderId === 'player' && styles.sentTimeText
              ]}>
                {formatTime(msg.timestamp)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 16 }]}>
        {/* Quick Replies */}
        {showQuickReplies && quickReplies.length > 0 && (
          <View style={styles.quickRepliesContainer}>
            <View style={styles.quickRepliesHeader}>
              <View style={styles.quickRepliesTitle}>
                <Ionicons name="flash" size={14} color={Colors.primary} />
                <Text style={styles.quickRepliesTitleText}>Réponses rapides</Text>
              </View>
              {isLoadingReplies && (
                <ActivityIndicator size="small" color={Colors.primary} />
              )}
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRepliesList}
            >
              {quickReplies.map(reply => (
                <TouchableOpacity
                  key={reply.id}
                  style={styles.quickReplyChip}
                  onPress={() => handleQuickReply(reply)}
                >
                  <Text style={styles.quickReplyText}>{reply.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Votre message..."
            placeholderTextColor={Colors.text.muted}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  channelList: {
    flex: 1,
    paddingTop: 8,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
  },
  channelIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  channelTime: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  channelPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  channelMessage: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  channelMembers: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  chatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chatInfo: {
    marginLeft: 12,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  chatMembers: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageRowSent: {
    justifyContent: 'flex-end',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  receivedBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  sentBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  sentText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  sentTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  quickRepliesContainer: {
    paddingBottom: 8,
  },
  quickRepliesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickRepliesTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickRepliesTitleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  quickRepliesList: {
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  quickReplyText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: Colors.text.primary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
