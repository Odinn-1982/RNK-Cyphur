/**
 * RNK Cyphur - Data Manager
 * Handles all data storage, retrieval, and manipulation for the module
 */

import { MODULE_ID, DEFAULTS } from './Constants.js';
import { Utils } from './Utils.js';

export class DataManager {
    // Static data stores
    static privateChats = new Map();
    static groupChats = new Map();
    static interceptedMessages = [];
    static unreadCounts = new Map();
    static lastRead = new Map();
    static typingUsers = new Map();
    static favorites = new Set();
    static lastActivity = new Map();
    static mutedConversations = new Set();
    static pinnedMessages = new Map();
    static sharedBackgrounds = new Map();
    static userPresence = new Map();

    // ════════════════════════════════════════════════════════════════════════════
    // INITIALIZATION & LOADING
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Sanitize message history to remove duplicates and ensure IDs
     * @param {Array} history - Message history array
     * @returns {Array} Sanitized history
     */
    static _sanitizeHistory(history) {
        if (!Array.isArray(history)) return [];
        
        const seenIds = new Set();
        const seenSignatures = new Set();
        const sanitized = [];
        
        for (const msg of history) {
            if (!msg || typeof msg !== 'object') continue;
            
            // Ensure message has an ID
            if (!msg.id) msg.id = foundry.utils.randomID();
            
            // Skip duplicates by ID
            if (seenIds.has(msg.id)) continue;
            
            // Skip duplicates by signature (sender + timestamp + content)
            const hasSignature = Boolean(msg.senderId && msg.timestamp && typeof msg.messageContent === 'string');
            const signature = hasSignature ? `${msg.senderId}|${msg.timestamp}|${msg.messageContent}` : null;
            
            if (signature && seenSignatures.has(signature)) continue;
            
            seenIds.add(msg.id);
            if (signature) seenSignatures.add(signature);
            sanitized.push(msg);
        }
        
        return sanitized;
    }

    /**
     * Generate a consistent chat key for private conversations
     * @param {string} userId1 - First user ID
     * @param {string} userId2 - Second user ID
     * @returns {string} Sorted chat key
     */
    static getPrivateChatKey(userId1, userId2) {
        return [userId1, userId2].sort().join('-');
    }

    /**
     * Load group chats from settings
     */
    static async loadGroupChats() {
        try {
            const groupsData = game.settings.get(MODULE_ID, 'groupChats') || {};
            this.groupChats = new Map(Object.entries(groupsData));
            
            for (const [groupId, group] of this.groupChats.entries()) {
                const history = group?.history ?? group?.messages ?? [];
                group.history = this._sanitizeHistory(history);
                if (group?.messages) delete group.messages;
                this.groupChats.set(groupId, group);
            }
            
            console.debug(`Cyphur | Loaded ${this.groupChats.size} group chats`);
        } catch (e) {
            console.error('Cyphur | Failed to load group chats:', e);
        }
    }

    /**
     * Load private chats from settings
     */
    static async loadPrivateChats() {
        try {
            const chatsData = game.settings.get(MODULE_ID, 'privateChats') || {};
            this.privateChats = new Map(Object.entries(chatsData));
            
            for (const [chatKey, chat] of this.privateChats.entries()) {
                const history = chat?.history ?? [];
                chat.history = this._sanitizeHistory(history);
                this.privateChats.set(chatKey, chat);
            }
            
            console.debug(`Cyphur | Loaded ${this.privateChats.size} private chats`);
        } catch (e) {
            console.error('Cyphur | Failed to load private chats:', e);
        }
    }

    /**
     * Load unread data from client settings
     */
    static async loadUnreadData() {
        try {
            const data = game.settings.get(MODULE_ID, 'unreadData') || { counts: {}, lastRead: {} };
            this.unreadCounts = new Map(Object.entries(data.counts || {}));
            this.lastRead = new Map(Object.entries(data.lastRead || {}));
        } catch (e) {
            console.warn('Cyphur | Failed to load unread data:', e);
        }
    }

    /**
     * Load favorites from client settings
     */
    static async loadFavorites() {
        try {
            const favorites = game.settings.get(MODULE_ID, 'favorites') || [];
            this.favorites = new Set(favorites);
        } catch (e) {
            console.warn('Cyphur | Failed to load favorites:', e);
        }
    }

    /**
     * Load muted conversations from client settings
     */
    static async loadMutedConversations() {
        try {
            const muted = game.settings.get(MODULE_ID, 'mutedConversations') || [];
            this.mutedConversations = new Set(muted);
        } catch (e) {
            console.warn('Cyphur | Failed to load muted conversations:', e);
        }
    }

    /**
     * Load pinned messages from client settings
     */
    static async loadPinnedMessages() {
        try {
            const pinned = game.settings.get(MODULE_ID, 'pinnedMessages') || {};
            this.pinnedMessages = new Map(Object.entries(pinned));
        } catch (e) {
            console.warn('Cyphur | Failed to load pinned messages:', e);
        }
    }

    /**
     * Load shared backgrounds from world settings
     */
    static async loadSharedBackgrounds() {
        try {
            const backgrounds = game.settings.get(MODULE_ID, 'sharedBackgrounds') || {};
            this.sharedBackgrounds = new Map(Object.entries(backgrounds));
        } catch (e) {
            console.warn('Cyphur | Failed to load shared backgrounds:', e);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // SAVING
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Save group chats to settings (GM only)
     */
    static async saveGroupChats() {
        if (!game.user.isGM) return;
        try {
            await game.settings.set(MODULE_ID, 'groupChats', Object.fromEntries(this.groupChats));
        } catch (e) {
            console.error('Cyphur | Failed to save group chats:', e);
        }
    }

    /**
     * Save private chats to settings (GM only)
     */
    static async savePrivateChats() {
        if (!game.user.isGM) return;
        try {
            await game.settings.set(MODULE_ID, 'privateChats', Object.fromEntries(this.privateChats));
        } catch (e) {
            console.error('Cyphur | Failed to save private chats:', e);
        }
    }

    /**
     * Save unread data to client settings
     */
    static async saveUnreadData() {
        try {
            await game.settings.set(MODULE_ID, 'unreadData', {
                counts: Object.fromEntries(this.unreadCounts),
                lastRead: Object.fromEntries(this.lastRead)
            });
        } catch (e) {
            console.warn('Cyphur | Failed to save unread data:', e);
        }
    }

    /**
     * Save favorites to client settings
     */
    static async saveFavorites() {
        try {
            await game.settings.set(MODULE_ID, 'favorites', Array.from(this.favorites));
        } catch (e) {
            console.warn('Cyphur | Failed to save favorites:', e);
        }
    }

    /**
     * Save muted conversations to client settings
     */
    static async saveMutedConversations() {
        try {
            await game.settings.set(MODULE_ID, 'mutedConversations', Array.from(this.mutedConversations));
        } catch (e) {
            console.warn('Cyphur | Failed to save muted conversations:', e);
        }
    }

    /**
     * Save pinned messages to client settings
     */
    static async savePinnedMessages() {
        try {
            await game.settings.set(MODULE_ID, 'pinnedMessages', Object.fromEntries(this.pinnedMessages));
        } catch (e) {
            console.warn('Cyphur | Failed to save pinned messages:', e);
        }
    }

    /**
     * Save shared backgrounds to world settings (GM only)
     */
    static async saveSharedBackgrounds() {
        if (!game.user.isGM) return;
        try {
            await game.settings.set(MODULE_ID, 'sharedBackgrounds', Object.fromEntries(this.sharedBackgrounds));
        } catch (e) {
            console.warn('Cyphur | Failed to save shared backgrounds:', e);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MESSAGE MANAGEMENT
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Add a private message
     * @param {string} userId1 - First user ID
     * @param {string} userId2 - Second user ID
     * @param {object} messageData - Message data object
     */
    static addPrivateMessage(userId1, userId2, messageData) {
        const chatKey = this.getPrivateChatKey(userId1, userId2);
        
        if (!this.privateChats.has(chatKey)) {
            this.privateChats.set(chatKey, { users: [userId1, userId2], history: [] });
        }
        
        if (messageData && Object.keys(messageData).length > 0) {
            if (!messageData.id) messageData.id = foundry.utils.randomID();
            
            // Parse rich content
            if (typeof messageData.messageContent === 'string') {
                messageData.messageContent = Utils.parseRichContent(messageData.messageContent);
            }
            
            const chat = this.privateChats.get(chatKey);
            const exists = chat.history.some(msg => msg.id === messageData.id);
            
            if (!exists) {
                chat.history.push(messageData);
                
                // Trim history if too long
                if (chat.history.length > DEFAULTS.MAX_MESSAGE_HISTORY) {
                    chat.history = chat.history.slice(-DEFAULTS.MAX_MESSAGE_HISTORY);
                }
            }
            
            chat.history = this._sanitizeHistory(chat.history);
            this.updateActivity(chatKey);
        }
    }

    /**
     * Add a group message
     * @param {string} groupId - Group ID
     * @param {object} messageData - Message data object
     */
    static addGroupMessage(groupId, messageData) {
        const group = this.groupChats.get(groupId);
        if (!group) {
            console.warn(`Cyphur | Attempted to add message to non-existent group: ${groupId}`);
            return;
        }
        
        if (!group.history) group.history = [];
        
        if (messageData && Object.keys(messageData).length > 0) {
            if (!messageData.id) messageData.id = foundry.utils.randomID();
            
            // Parse rich content
            if (typeof messageData.messageContent === 'string') {
                messageData.messageContent = Utils.parseRichContent(messageData.messageContent);
            }
            
            const exists = group.history.some(msg => msg.id === messageData.id);
            
            if (!exists) {
                group.history.push(messageData);
                
                // Trim history if too long
                if (group.history.length > DEFAULTS.MAX_MESSAGE_HISTORY) {
                    group.history = group.history.slice(-DEFAULTS.MAX_MESSAGE_HISTORY);
                }
            }
            
            group.history = this._sanitizeHistory(group.history);
            this.updateActivity(groupId);
        }
    }

    /**
     * Edit a message
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {string} newContent - New message content
     * @param {boolean} isGroup - Is this a group chat?
     * @returns {boolean} Success
     */
    static editMessage(conversationId, messageId, newContent, isGroup = false) {
        const chat = isGroup ? this.groupChats.get(conversationId) : this.privateChats.get(conversationId);
        if (!chat) return false;
        
        const messages = chat.history || [];
        const message = messages.find(m => m.id === messageId);
        if (!message) return false;
        
        message.messageContent = Utils.parseRichContent(newContent);
        message.edited = true;
        message.editedAt = Date.now();
        return true;
    }

    /**
     * Delete a message
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {boolean} isGroup - Is this a group chat?
     * @returns {boolean} Success
     */
    static deleteMessage(conversationId, messageId, isGroup = false) {
        const chat = isGroup ? this.groupChats.get(conversationId) : this.privateChats.get(conversationId);
        if (!chat) return false;
        
        const messages = chat.history || [];
        const index = messages.findIndex(m => m.id === messageId);
        if (index === -1) return false;
        
        messages.splice(index, 1);
        return true;
    }

    /**
     * Add intercepted message for GM monitoring
     * @param {object} payload - Message payload
     */
    static addInterceptedMessage(payload) {
        payload.id = foundry.utils.randomID();
        payload.interceptedAt = Date.now();
        this.interceptedMessages.push(payload);
        
        // Keep only recent messages
        if (this.interceptedMessages.length > DEFAULTS.MAX_INTERCEPTED) {
            this.interceptedMessages.shift();
        }
    }

    /**
     * Search messages in a conversation
     * @param {string} conversationId - Conversation ID
     * @param {string} query - Search query
     * @param {boolean} isGroup - Is this a group chat?
     * @returns {Array} Matching messages
     */
    static searchMessages(conversationId, query, isGroup = false) {
        const chat = isGroup ? this.groupChats.get(conversationId) : this.privateChats.get(conversationId);
        if (!chat || !query) return chat?.history || [];
        
        const lowerQuery = query.toLowerCase();
        return (chat.history || []).filter(msg => {
            const content = (msg.messageContent || '').toLowerCase();
            const sender = (msg.senderName || '').toLowerCase();
            return content.includes(lowerQuery) || sender.includes(lowerQuery);
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // UNREAD & ACTIVITY TRACKING
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Mark conversation as read
     * @param {string} conversationId - Conversation ID
     */
    static markAsRead(conversationId) {
        this.lastRead.set(conversationId, Date.now());
        this.unreadCounts.set(conversationId, 0);
        this.saveUnreadData();
    }

    /**
     * Increment unread count for a conversation
     * @param {string} conversationId - Conversation ID
     */
    static incrementUnread(conversationId) {
        // Don't increment if muted
        if (this.mutedConversations.has(conversationId)) return;
        
        const current = this.unreadCounts.get(conversationId) || 0;
        this.unreadCounts.set(conversationId, current + 1);
        this.saveUnreadData();
    }

    /**
     * Get unread count for a conversation
     * @param {string} conversationId - Conversation ID
     * @returns {number}
     */
    static getUnreadCount(conversationId) {
        return this.unreadCounts.get(conversationId) || 0;
    }

    /**
     * Get total unread count across all conversations
     * @returns {number}
     */
    static getTotalUnread() {
        let total = 0;
        for (const count of this.unreadCounts.values()) {
            total += count;
        }
        return total;
    }

    /**
     * Update last activity for a conversation
     * @param {string} conversationId - Conversation ID
     */
    static updateActivity(conversationId) {
        this.lastActivity.set(conversationId, Date.now());
    }

    // ════════════════════════════════════════════════════════════════════════════
    // TYPING INDICATORS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Set typing status for a user in a conversation
     * @param {string} conversationId - Conversation ID
     * @param {string} userId - User ID
     * @param {boolean} isTyping - Is typing?
     * @returns {boolean} Whether the typing state changed
     */
    static setTyping(conversationId, userId, isTyping) {
        if (!this.typingUsers.has(conversationId)) {
            this.typingUsers.set(conversationId, new Map());
        }
        
        const conversationTyping = this.typingUsers.get(conversationId);
        const alreadyTyping = conversationTyping.has(userId);
        let changed = false;
        
        if (isTyping) {
            if (!alreadyTyping) changed = true;
            conversationTyping.set(userId, Date.now());
        } else {
            if (alreadyTyping) changed = true;
            conversationTyping.delete(userId);
        }
        
        return changed;
    }

    /**
     * Get list of users currently typing in a conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Array<string>} Array of user names
     */
    static getTypingUsers(conversationId) {
        const conversationTyping = this.typingUsers.get(conversationId);
        if (!conversationTyping) return [];
        
        const now = Date.now();
        const typingUsers = [];
        
        // Clean up stale typing indicators
        for (const [userId, timestamp] of conversationTyping.entries()) {
            if (now - timestamp > DEFAULTS.TYPING_TIMEOUT) {
                conversationTyping.delete(userId);
            } else {
                const user = game.users.get(userId);
                if (user && user.id !== game.user.id) {
                    typingUsers.push(user.name);
                }
            }
        }
        
        return typingUsers;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // REACTIONS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Toggle a reaction on a message
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {string} emoji - Reaction emoji
     * @param {string} userId - User ID
     * @param {boolean} isGroup - Is this a group chat?
     * @returns {boolean} Success
     */
    static addReaction(conversationId, messageId, emoji, userId, isGroup = false) {
        const chat = isGroup ? this.groupChats.get(conversationId) : this.privateChats.get(conversationId);
        if (!chat) return false;
        
        const messages = chat.history || [];
        const message = messages.find(m => m.id === messageId);
        if (!message) return false;
        
        if (!message.reactions) message.reactions = {};
        if (!message.reactions[emoji]) message.reactions[emoji] = [];
        
        // Toggle reaction
        const index = message.reactions[emoji].indexOf(userId);
        if (index > -1) {
            message.reactions[emoji].splice(index, 1);
            if (message.reactions[emoji].length === 0) {
                delete message.reactions[emoji];
            }
        } else {
            message.reactions[emoji].push(userId);
        }
        
        return true;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // REPLY TRACKING
    // ════════════════════════════════════════════════════════════════════════════

    static _replyToMessage = null;

    static setReplyTo(messageId) {
        this._replyToMessage = messageId;
    }

    static getReplyTo() {
        return this._replyToMessage;
    }

    static clearReplyTo() {
        this._replyToMessage = null;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // FAVORITES & MUTING
    // ════════════════════════════════════════════════════════════════════════════

    static toggleFavorite(conversationId) {
        if (this.favorites.has(conversationId)) {
            this.favorites.delete(conversationId);
        } else {
            this.favorites.add(conversationId);
        }
        this.saveFavorites();
    }

    static isFavorite(conversationId) {
        return this.favorites.has(conversationId);
    }

    static toggleMuted(conversationId) {
        if (this.mutedConversations.has(conversationId)) {
            this.mutedConversations.delete(conversationId);
        } else {
            this.mutedConversations.add(conversationId);
        }
        this.saveMutedConversations();
    }

    static isMuted(conversationId) {
        return this.mutedConversations.has(conversationId);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // PINNED MESSAGES
    // ════════════════════════════════════════════════════════════════════════════

    static togglePinned(conversationId, messageId) {
        if (!this.pinnedMessages.has(conversationId)) {
            this.pinnedMessages.set(conversationId, []);
        }
        
        const pins = this.pinnedMessages.get(conversationId);
        const index = pins.indexOf(messageId);
        
        if (index > -1) {
            pins.splice(index, 1);
        } else {
            pins.push(messageId);
        }
        
        this.savePinnedMessages();
    }

    static isPinned(conversationId, messageId) {
        const pins = this.pinnedMessages.get(conversationId) || [];
        return pins.includes(messageId);
    }

    static getPinnedMessages(conversationId) {
        return this.pinnedMessages.get(conversationId) || [];
    }

    // ════════════════════════════════════════════════════════════════════════════
    // SHARED BACKGROUNDS
    // ════════════════════════════════════════════════════════════════════════════

    static setSharedBackground(userId, path) {
        if (path) {
            this.sharedBackgrounds.set(userId, path);
        } else {
            this.sharedBackgrounds.delete(userId);
        }
    }

    static getSharedBackground(userId) {
        return this.sharedBackgrounds.get(userId) || null;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // GROUP MANAGEMENT
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Create a new group
     * @param {string} name - Group name
     * @param {Array<string>} members - Array of member user IDs
     * @returns {object} The created group
     */
    static createGroup(name, members) {
        const groupId = foundry.utils.randomID();
        const group = {
            id: groupId,
            name: name,
            members: [...new Set(members)],
            history: [],
            createdAt: Date.now(),
            createdBy: game.user.id
        };
        
        this.groupChats.set(groupId, group);
        return group;
    }

    /**
     * Delete a group
     * @param {string} groupId - Group ID
     * @returns {boolean} Success
     */
    static deleteGroup(groupId) {
        return this.groupChats.delete(groupId);
    }

    /**
     * Update group properties
     * @param {string} groupId - Group ID
     * @param {object} updates - Properties to update
     * @returns {boolean} Success
     */
    static updateGroup(groupId, updates) {
        const group = this.groupChats.get(groupId);
        if (!group) return false;
        
        Object.assign(group, updates);
        return true;
    }

    /**
     * Clear a conversation's history
     * @param {string} conversationId - Conversation ID
     * @param {boolean} isGroup - Is this a group chat?
     * @returns {boolean} Success
     */
    static clearConversation(conversationId, isGroup = false) {
        const chat = isGroup ? this.groupChats.get(conversationId) : this.privateChats.get(conversationId);
        if (!chat) return false;
        
        chat.history = [];
        return true;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // IMAGE MANAGEMENT
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Store image data (either URL or base64)
     * @param {File|string} imageData - File object or URL string
     * @returns {Promise<string|null>} Image URL or base64 data
     */
    static async processImage(imageData) {
        try {
            if (typeof imageData === 'string') {
                // Already a URL, validate and return
                if (imageData.startsWith('http') || imageData.startsWith('data:')) {
                    return imageData;
                }
                return null;
            }
            
            // File object - convert to base64
            if (imageData instanceof File) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageData);
                });
            }
            
            return null;
        } catch (e) {
            console.error('Cyphur | Failed to process image:', e);
            return null;
        }
    }

    /**
     * Validate image before sharing (check size, type)
     * @param {File} file - File to validate
     * @returns {object} {valid: boolean, error?: string}
     */
    static validateImage(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }
        
        if (file.size > maxSize) {
            return { valid: false, error: 'Image too large (max 5MB)' };
        }
        
        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: 'Invalid image type (allowed: jpg, png, gif, webp)' };
        }
        
        return { valid: true };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BACKGROUND MANAGEMENT
    // ════════════════════════════════════════════════════════════════════════════

    // Storage for personal backgrounds (client-side)
    static _personalBackground = null;
    static _chatBackgrounds = new Map();
    
    // Storage for GM-controlled backgrounds (world settings)
    static gmBackgrounds = {
        global: null,           // Global background for all players
        perUser: new Map(),     // userId -> background URL
        perChat: new Map()      // chatKey -> background URL
    };

    /**
     * Load background settings
     */
    static async loadBackgroundSettings() {
        try {
            // Load personal background (client setting)
            this._personalBackground = game.settings.get(MODULE_ID, 'personalBackground') || null;
            
            // Load chat-specific backgrounds (client setting)
            const chatBgs = game.settings.get(MODULE_ID, 'chatBackgrounds') || {};
            this._chatBackgrounds = new Map(Object.entries(chatBgs));
            
            // Load GM-controlled backgrounds (world setting, GM only reads this for control)
            if (game.user.isGM) {
                const gmBgs = game.settings.get(MODULE_ID, 'gmBackgrounds') || {};
                this.gmBackgrounds.global = gmBgs.global || null;
                this.gmBackgrounds.perUser = new Map(Object.entries(gmBgs.perUser || {}));
                this.gmBackgrounds.perChat = new Map(Object.entries(gmBgs.perChat || {}));
            }
        } catch (e) {
            console.warn('Cyphur | Failed to load background settings:', e);
        }
    }

    /**
     * Save background settings
     */
    static async saveBackgroundSettings() {
        try {
            // Save personal background
            await game.settings.set(MODULE_ID, 'personalBackground', this._personalBackground || '');
            
            // Save chat backgrounds
            await game.settings.set(MODULE_ID, 'chatBackgrounds', Object.fromEntries(this._chatBackgrounds));
            
            // Save GM backgrounds (GM only)
            if (game.user.isGM) {
                await game.settings.set(MODULE_ID, 'gmBackgrounds', {
                    global: this.gmBackgrounds.global,
                    perUser: Object.fromEntries(this.gmBackgrounds.perUser),
                    perChat: Object.fromEntries(this.gmBackgrounds.perChat)
                });
            }
        } catch (e) {
            console.warn('Cyphur | Failed to save background settings:', e);
        }
    }

    /**
     * Set personal background (player can set their own)
     * @param {string|null} url - Background URL or null to clear
     */
    static setPersonalBackground(url) {
        this._personalBackground = url || null;
        this.saveBackgroundSettings();
    }

    /**
     * Get personal background
     * @returns {string|null}
     */
    static getPersonalBackground() {
        return this._personalBackground;
    }

    /**
     * Set background for a specific chat (personal preference)
     * @param {string} chatKey - Chat key
     * @param {string|null} url - Background URL or null to clear
     */
    static setChatBackground(chatKey, url) {
        if (url) {
            this._chatBackgrounds.set(chatKey, url);
        } else {
            this._chatBackgrounds.delete(chatKey);
        }
        this.saveBackgroundSettings();
    }

    /**
     * Get background for a specific chat
     * @param {string} chatKey - Chat key
     * @returns {string|null}
     */
    static getChatBackground(chatKey) {
        return this._chatBackgrounds.get(chatKey) || null;
    }

    /**
     * GM: Set global background for all players
     * @param {string|null} url - Background URL
     */
    static setGlobalBackground(url) {
        if (!game.user.isGM) return;
        this.gmBackgrounds.global = url || null;
        this.saveBackgroundSettings();
    }

    /**
     * GM: Set background for a specific user
     * @param {string} userId - User ID
     * @param {string|null} url - Background URL
     */
    static setUserBackground(userId, url) {
        if (!game.user.isGM) return;
        if (url) {
            this.gmBackgrounds.perUser.set(userId, url);
        } else {
            this.gmBackgrounds.perUser.delete(userId);
        }
        this.saveBackgroundSettings();
    }

    /**
     * GM: Set background for a specific chat
     * @param {string} chatKey - Chat key
     * @param {string|null} url - Background URL
     */
    static setGMChatBackground(chatKey, url) {
        if (!game.user.isGM) return;
        if (url) {
            this.gmBackgrounds.perChat.set(chatKey, url);
        } else {
            this.gmBackgrounds.perChat.delete(chatKey);
        }
        this.saveBackgroundSettings();
    }

    /**
     * Get the effective background for a chat window
     * Priority: GM chat-specific > Personal chat-specific > GM user-specific > Personal > GM global > none
     * @param {string} chatKey - Chat key
     * @param {string} userId - User ID viewing the chat
     * @returns {string|null}
     */
    static getEffectiveBackground(chatKey, userId = null) {
        userId = userId || game.user.id;
        
        // 1. GM-set chat-specific background (highest priority)
        const gmChatBg = this.gmBackgrounds.perChat.get(chatKey);
        if (gmChatBg) return gmChatBg;
        
        // 2. Personal chat-specific background
        const personalChatBg = this._chatBackgrounds.get(chatKey);
        if (personalChatBg) return personalChatBg;
        
        // 3. GM-set user-specific background
        const gmUserBg = this.gmBackgrounds.perUser.get(userId);
        if (gmUserBg) return gmUserBg;
        
        // 4. Personal background
        if (this._personalBackground) return this._personalBackground;
        
        // 5. GM global background
        if (this.gmBackgrounds.global) return this.gmBackgrounds.global;
        
        return null;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // GM SETTINGS & PERSISTENCE
    // ════════════════════════════════════════════════════════════════════════════

    static _gmSettings = new Map();

    /**
     * Load GM settings
     */
    static async loadGMSettings() {
        if (!game.user.isGM) return;
        try {
            const settings = game.settings.get(MODULE_ID, 'gmSettings') || {};
            this._gmSettings = new Map(Object.entries(settings));
        } catch (e) {
            console.warn('Cyphur | Failed to load GM settings:', e);
        }
    }

    /**
     * Save GM settings
     */
    static async saveGMSettings() {
        if (!game.user.isGM) return;
        try {
            await game.settings.set(MODULE_ID, 'gmSettings', Object.fromEntries(this._gmSettings));
        } catch (e) {
            console.warn('Cyphur | Failed to save GM settings:', e);
        }
    }

    /**
     * Get a GM setting
     * @param {string} key - Setting key
     * @returns {*}
     */
    static getGMSetting(key) {
        return this._gmSettings.get(key);
    }

    /**
     * Set a GM setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    static setGMSetting(key, value) {
        this._gmSettings.set(key, value);
        this.saveGMSettings();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // PLAYER SETTINGS (Hub-accessible)
    // ════════════════════════════════════════════════════════════════════════════

    static _playerSettings = new Map();

    /**
     * Load player settings from client storage
     */
    static async loadPlayerSettings() {
        try {
            const settings = game.settings.get(MODULE_ID, 'playerSettings') || {};
            this._playerSettings = new Map(Object.entries(settings));
        } catch (e) {
            console.warn('Cyphur | Failed to load player settings:', e);
        }
    }

    /**
     * Save player settings to client storage
     */
    static async savePlayerSettings() {
        try {
            await game.settings.set(MODULE_ID, 'playerSettings', Object.fromEntries(this._playerSettings));
        } catch (e) {
            console.warn('Cyphur | Failed to save player settings:', e);
        }
    }

    /**
     * Get a player setting
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value if not set
     * @returns {*}
     */
    static getPlayerSetting(key, defaultValue = null) {
        const value = this._playerSettings.get(key);
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set a player setting
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    static setPlayerSetting(key, value) {
        this._playerSettings.set(key, value);
        this.savePlayerSettings();
    }

    /**
     * Get theme preference
     * @returns {string}
     */
    static getTheme() {
        return this.getPlayerSetting('theme', DEFAULTS.THEME);
    }

    /**
     * Set theme preference
     * @param {string} theme
     */
    static setTheme(theme) {
        this.setPlayerSetting('theme', theme);
    }

    /**
     * Get notification volume
     * @returns {number} 0-100
     */
    static getNotificationVolume() {
        return this.getPlayerSetting('notificationVolume', 50);
    }

    /**
     * Set notification volume
     * @param {number} volume - 0-100
     */
    static setNotificationVolume(volume) {
        this.setPlayerSetting('notificationVolume', Math.max(0, Math.min(100, volume)));
    }

    /**
     * Get notification sound
     * @returns {string}
     */
    static getNotificationSound() {
        return this.getPlayerSetting('notificationSound', DEFAULTS.NOTIFICATION_SOUND);
    }

    /**
     * Set notification sound
     * @param {string} sound - Sound filename
     */
    static setNotificationSound(sound) {
        this.setPlayerSetting('notificationSound', sound);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // EXPORT UTILITIES
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Export a conversation to a formatted string
     * @param {string} conversationId - Conversation ID
     * @param {boolean} isGroup - Is this a group chat?
     * @returns {string} Formatted conversation text
     */
    static exportConversation(conversationId, isGroup = false) {
        const chat = isGroup ? this.groupChats.get(conversationId) : this.privateChats.get(conversationId);
        if (!chat || !chat.history) return '';
        
        const lines = [];
        const title = isGroup ? `Group: ${chat.name || 'Unknown'}` : 'Private Chat';
        lines.push('═══════════════════════════════════════');
        lines.push(`Cyphur Chat Export - ${title}`);
        lines.push(`Exported: ${new Date().toLocaleString()}`);
        lines.push('═══════════════════════════════════════');
        lines.push('');
        
        const sorted = [...chat.history].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        for (const msg of sorted) {
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'Unknown time';
            const sender = msg.senderName || 'Unknown';
            const content = (msg.messageContent || '').replace(/<[^>]*>/g, ''); // Strip HTML
            
            lines.push(`[${time}] ${sender}:`);
            lines.push(`  ${content}`);
            
            if (msg.imageUrl) {
                lines.push(`  [Image: ${msg.imageUrl}]`);
            }
            
            lines.push('');
        }
        
        lines.push('═══════════════════════════════════════');
        lines.push(`End of Export - ${sorted.length} messages`);
        lines.push('═══════════════════════════════════════');
        
        return lines.join('\n');
    }

    /**
     * Get conversations the current user is part of
     * @returns {Array} Array of {id, type, name, lastMessage, unread}
     */
    static getUserConversations() {
        const userId = game.user.id;
        const conversations = [];
        
        // Private chats
        for (const [chatKey, chat] of this.privateChats.entries()) {
            if (!chat.users || !chat.users.includes(userId)) continue;
            
            const otherId = chat.users.find(id => id !== userId);
            const otherUser = game.users.get(otherId);
            
            conversations.push({
                id: chatKey,
                type: 'private',
                name: otherUser?.name || 'Unknown User',
                avatar: otherUser?.avatar,
                lastMessage: chat.history?.[chat.history.length - 1] || null,
                unread: this.getUnreadCount(chatKey),
                isFavorite: this.isFavorite(chatKey),
                isMuted: this.isMuted(chatKey),
                lastActivity: this.lastActivity.get(chatKey) || 0
            });
        }
        
        // Group chats
        for (const [groupId, group] of this.groupChats.entries()) {
            if (!group.members || !group.members.includes(userId)) continue;
            
            conversations.push({
                id: groupId,
                type: 'group',
                name: group.name || 'Unnamed Group',
                members: group.members,
                lastMessage: group.history?.[group.history.length - 1] || null,
                unread: this.getUnreadCount(groupId),
                isFavorite: this.isFavorite(groupId),
                isMuted: this.isMuted(groupId),
                lastActivity: this.lastActivity.get(groupId) || 0
            });
        }
        
        // Sort by last activity
        conversations.sort((a, b) => {
            // Favorites first
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            // Then by activity
            return b.lastActivity - a.lastActivity;
        });
        
        return conversations;
    }
}

