/**
 * RNK Cyphur - Socket Handler
 * Manages all WebSocket communication between clients
 */

import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { Utils } from './Utils.js';
import { MODULE_ID, SOCKET_NAME, SOCKET_EVENTS } from './Constants.js';

export class SocketHandler {
    static SOCKET_NAME = SOCKET_NAME;

    /**
     * Initialize socket listeners
     */
    static initialize() {
        game.socket.on(this.SOCKET_NAME, (data) => this._onSocketMessage(data));
        console.debug('Cyphur | Socket handler initialized');
    }

    /**
     * Emit a socket message
     * @param {string} type - Event type
     * @param {object} payload - Data payload
     * @param {object} options - Socket options (e.g., recipients)
     */
    static emit(type, payload, options = {}) {
        game.socket.emit(this.SOCKET_NAME, { type, payload }, options);
    }

    /**
     * Play notification sound based on settings
     */
    static _playNotificationSound() {
        if (!game.settings.get(MODULE_ID, 'enableSound')) return;
        
        const soundPath = game.settings.get(MODULE_ID, 'gmOverrideEnabled')
            ? game.settings.get(MODULE_ID, 'gmOverrideSoundPath')
            : game.settings.get(MODULE_ID, 'notificationSound');
        
        const volume = game.settings.get(MODULE_ID, 'notificationVolume');
        Utils.playSound(soundPath, volume);
    }

    /**
     * Handle incoming socket messages
     * @param {object} data - Socket data
     */
    static async _onSocketMessage(data) {
        const isIncoming = (message) => message.senderId !== game.user.id;

        switch (data.type) {
            case SOCKET_EVENTS.PRIVATE_MESSAGE:
                await this._handlePrivateMessage(data.payload, isIncoming);
                break;

            case SOCKET_EVENTS.GROUP_MESSAGE:
                await this._handleGroupMessage(data.payload, isIncoming);
                break;

            case SOCKET_EVENTS.TYPING:
                this._handleTyping(data.payload);
                break;

            case SOCKET_EVENTS.EDIT_MESSAGE:
                await this._handleEditMessage(data.payload);
                break;

            case SOCKET_EVENTS.DELETE_MESSAGE:
                await this._handleDeleteMessage(data.payload);
                break;

            case SOCKET_EVENTS.ADD_REACTION:
                await this._handleAddReaction(data.payload);
                break;

            case SOCKET_EVENTS.GROUP_CREATE:
                await this._handleGroupCreate(data.payload);
                break;

            case SOCKET_EVENTS.GROUP_UPDATE:
                await this._handleGroupUpdate(data.payload);
                break;

            case SOCKET_EVENTS.GROUP_DELETE:
                await this._handleGroupDelete(data.payload);
                break;

            case SOCKET_EVENTS.GROUP_SYNC:
                await this._handleGroupSync(data.payload);
                break;

            case SOCKET_EVENTS.PRIVATE_SYNC:
                await this._handlePrivateSync(data.payload);
                break;

            case SOCKET_EVENTS.BACKGROUND_SHARE:
                this._handleBackgroundShare(data.payload);
                break;

            case SOCKET_EVENTS.MESSAGE_READ:
                this._handleMessageRead(data.payload);
                break;

            default:
                console.debug(`Cyphur | Unknown socket event: ${data.type}`);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MESSAGE HANDLERS
    // ════════════════════════════════════════════════════════════════════════════

    static async _handlePrivateMessage(payload, isIncoming) {
        const { recipientId, message, isRelay, originalSenderId, originalRecipientId } = payload;
        
        // Only process if this message is for us and we didn't send it
        if (recipientId !== game.user.id) return;
        if (!isIncoming(message)) return;

        if (isRelay && game.user.isGM) {
            // GM receiving a relay - add to monitor AND save to history
            const monitorPayload = {
                senderId: originalSenderId,
                recipientId: originalRecipientId,
                messageData: message
            };
            DataManager.addInterceptedMessage(monitorPayload);
            
            // Add to persistent history
            DataManager.addPrivateMessage(originalSenderId, originalRecipientId, message);
            await DataManager.savePrivateChats();
            
            UIManager.updateGMMonitor();
        } else if (!isRelay) {
            // Normal message reception
            DataManager.addPrivateMessage(message.senderId, recipientId, message);
            if (game.user.isGM) await DataManager.savePrivateChats();
            
            // If GM is recipient, also add to monitor
            if (game.user.isGM) {
                const monitorPayload = {
                    senderId: message.senderId,
                    recipientId: recipientId,
                    messageData: message
                };
                DataManager.addInterceptedMessage(monitorPayload);
                UIManager.updateGMMonitor();
            }
            
            // Increment unread
            const chatKey = DataManager.getPrivateChatKey(message.senderId, recipientId);
            DataManager.incrementUnread(chatKey);
            
            // Play sound (unless muted)
            if (!DataManager.isMuted(chatKey)) {
                this._playNotificationSound();
            }
            
            // Desktop notification
            const senderUser = game.users.get(message.senderId);
            if (senderUser) {
                Utils.showDesktopNotification(
                    game.i18n.format('CYPHUR.NotificationNewMessage', { name: senderUser.name }),
                    message.messageContent?.substring(0, 100).replace(/<[^>]*>/g, ''),
                    senderUser.avatar
                );
            }
            
            // Update UI
            UIManager.openChatWindowForNewMessage(message.senderId, 'private');
            UIManager.updatePlayerHub();
        }
    }

    static async _handleGroupMessage(payload, isIncoming) {
        const { groupId, message } = payload;
        const group = DataManager.groupChats.get(groupId);
        
        if (group?.members.includes(game.user.id) && isIncoming(message)) {
            DataManager.addGroupMessage(groupId, message);
            if (game.user.isGM) await DataManager.saveGroupChats();
            
            // Increment unread
            DataManager.incrementUnread(groupId);
            
            // Play sound (unless muted)
            if (!DataManager.isMuted(groupId)) {
                this._playNotificationSound();
            }
            
            // Desktop notification
            const senderUser = game.users.get(message.senderId);
            if (senderUser && group) {
                Utils.showDesktopNotification(
                    game.i18n.format('CYPHUR.NotificationGroupMessage', { name: senderUser.name, group: group.name }),
                    message.messageContent?.substring(0, 100).replace(/<[^>]*>/g, ''),
                    senderUser.avatar
                );
            }
            
            // Update UI
            UIManager.openChatWindowForNewMessage(groupId, 'group');
            UIManager.updatePlayerHub();
        }
        
        // Add to GM monitor
        if (game.user.isGM && isIncoming(message)) {
            const monitorPayload = {
                senderId: message.senderId,
                recipientId: null,
                groupId: groupId,
                groupName: group?.name || 'Unknown Channel',
                messageData: message
            };
            DataManager.addInterceptedMessage(monitorPayload);
            UIManager.updateGMMonitor();
        }
    }

    static _handleTyping(payload) {
        const { conversationId, userId, isTyping, isGroup } = payload;
        const changed = DataManager.setTyping(conversationId, userId, isTyping);
        
        if (!changed) return;
        
        // Update typing indicator
        if (isGroup) {
            UIManager.updateTypingIndicator(conversationId, 'group');
        } else {
            const parts = conversationId.split('-');
            const otherUserId = parts.find(id => id !== game.user.id);
            if (otherUserId) {
                UIManager.updateTypingIndicator(otherUserId, 'private');
            }
        }
    }

    static async _handleEditMessage(payload) {
        const { conversationId, messageId, newContent, isGroup } = payload;
        DataManager.editMessage(conversationId, messageId, newContent, isGroup);
        
        if (game.user.isGM) {
            await (isGroup ? DataManager.saveGroupChats() : DataManager.savePrivateChats());
        }
        
        // Update UI
        if (isGroup) {
            UIManager.updateChatWindow(conversationId, 'group');
        } else {
            const parts = conversationId.split('-');
            const otherUserId = parts.find(id => id !== game.user.id);
            if (otherUserId) UIManager.updateChatWindow(otherUserId, 'private');
        }
    }

    static async _handleDeleteMessage(payload) {
        const { conversationId, messageId, isGroup } = payload;
        DataManager.deleteMessage(conversationId, messageId, isGroup);
        
        if (game.user.isGM) {
            await (isGroup ? DataManager.saveGroupChats() : DataManager.savePrivateChats());
        }
        
        // Update UI
        if (isGroup) {
            UIManager.updateChatWindow(conversationId, 'group');
        } else {
            const parts = conversationId.split('-');
            const otherUserId = parts.find(id => id !== game.user.id);
            if (otherUserId) UIManager.updateChatWindow(otherUserId, 'private');
        }
    }

    static async _handleAddReaction(payload) {
        const { conversationId, messageId, emoji, userId, isGroup } = payload;
        DataManager.addReaction(conversationId, messageId, emoji, userId, isGroup);
        
        if (game.user.isGM) {
            await (isGroup ? DataManager.saveGroupChats() : DataManager.savePrivateChats());
        }
        
        // Update UI
        if (isGroup) {
            UIManager.updateChatWindow(conversationId, 'group');
        } else {
            const parts = conversationId.split('-');
            const otherUserId = parts.find(id => id !== game.user.id);
            if (otherUserId) UIManager.updateChatWindow(otherUserId, 'private');
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // GROUP HANDLERS
    // ════════════════════════════════════════════════════════════════════════════

    static async _handleGroupCreate(payload) {
        const { group } = payload;
        if (!group) return;
        
        // Only add if we're a member
        if (group.members.includes(game.user.id)) {
            DataManager.groupChats.set(group.id, group);
            UIManager.updatePlayerHub();
            UIManager.updateGroupManager();
            
            ui.notifications.info(game.i18n.format('CYPHUR.GroupCreated', { name: group.name }));
        }
    }

    static async _handleGroupUpdate(payload) {
        const { groupId, updates } = payload;
        const group = DataManager.groupChats.get(groupId);
        
        if (group) {
            Object.assign(group, updates);
            UIManager.updatePlayerHub();
            UIManager.updateGroupManager();
            UIManager.updateChatWindow(groupId, 'group');
        }
    }

    static async _handleGroupDelete(payload) {
        const { groupId } = payload;
        
        DataManager.groupChats.delete(groupId);
        UIManager.closeChatWindow(groupId, 'group');
        UIManager.updatePlayerHub();
        UIManager.updateGroupManager();
    }

    static async _handleGroupSync(payload) {
        const { groups } = payload;
        if (!Array.isArray(groups)) return;
        
        for (const group of groups) {
            if (group.members.includes(game.user.id)) {
                DataManager.groupChats.set(group.id, group);
            }
        }
        
        UIManager.updatePlayerHub();
        UIManager.updateGroupManager();
    }

    static async _handlePrivateSync(payload) {
        const { chats } = payload;
        if (!chats || typeof chats !== 'object') return;
        
        for (const [chatKey, chat] of Object.entries(chats)) {
            if (chat.users.includes(game.user.id)) {
                DataManager.privateChats.set(chatKey, chat);
            }
        }
        
        UIManager.updatePlayerHub();
    }

    static _handleBackgroundShare(payload) {
        const { userId, path } = payload;
        UIManager.updateBackgroundForUser(userId, path);
    }

    static _handleMessageRead(payload) {
        const { conversationId, userId } = payload;
        // Could be used to show read receipts in the future
        console.debug(`Cyphur | ${userId} read messages in ${conversationId}`);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // HELPER METHODS FOR SENDING
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Send a private message
     * @param {string} recipientId - Recipient user ID
     * @param {object} messageData - Message data
     */
    static sendPrivateMessage(recipientId, messageData) {
        const recipientUser = game.users.get(recipientId);
        const recipients = [recipientId];
        
        // Send to recipient
        this.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
            recipientId,
            message: messageData
        }, { recipients });

        // If both are non-GMs, relay to GM for monitoring
        if (!game.user.isGM && recipientUser && !recipientUser.isGM) {
            const gm = game.users.find(u => u.isGM && u.active);
            if (gm) {
                this.emit(SOCKET_EVENTS.PRIVATE_MESSAGE, {
                    recipientId: gm.id,
                    message: messageData,
                    isRelay: true,
                    originalSenderId: game.user.id,
                    originalRecipientId: recipientId
                }, { recipients: [gm.id] });
            }
        }
    }

    /**
     * Send a group message
     * @param {string} groupId - Group ID
     * @param {object} messageData - Message data
     */
    static sendGroupMessage(groupId, messageData) {
        const group = DataManager.groupChats.get(groupId);
        if (!group) return;
        
        const recipients = group.members.filter(id => id !== game.user.id);
        
        this.emit(SOCKET_EVENTS.GROUP_MESSAGE, {
            groupId,
            message: messageData
        }, { recipients });
    }

    /**
     * Send typing indicator
     * @param {string} conversationId - Conversation ID
     * @param {boolean} isTyping - Is typing
     * @param {boolean} isGroup - Is group chat
     */
    static sendTypingIndicator(conversationId, isTyping, isGroup) {
        let recipients;
        
        if (isGroup) {
            const group = DataManager.groupChats.get(conversationId);
            recipients = group?.members.filter(id => id !== game.user.id) || [];
        } else {
            const parts = conversationId.split('-');
            recipients = parts.filter(id => id !== game.user.id);
        }
        
        if (recipients.length === 0) return;
        
        this.emit(SOCKET_EVENTS.TYPING, {
            conversationId,
            userId: game.user.id,
            isTyping,
            isGroup
        }, { recipients });
    }

    /**
     * Broadcast group creation
     * @param {object} group - Group object
     */
    static broadcastGroupCreate(group) {
        const recipients = group.members.filter(id => id !== game.user.id);
        this.emit(SOCKET_EVENTS.GROUP_CREATE, { group }, { recipients });
    }

    /**
     * Broadcast group update
     * @param {string} groupId - Group ID
     * @param {object} updates - Updates to apply
     */
    static broadcastGroupUpdate(groupId, updates) {
        const group = DataManager.groupChats.get(groupId);
        if (!group) return;
        
        const recipients = group.members.filter(id => id !== game.user.id);
        this.emit(SOCKET_EVENTS.GROUP_UPDATE, { groupId, updates }, { recipients });
    }

    /**
     * Broadcast group deletion
     * @param {string} groupId - Group ID
     * @param {Array<string>} members - Group members
     */
    static broadcastGroupDelete(groupId, members) {
        const recipients = members.filter(id => id !== game.user.id);
        this.emit(SOCKET_EVENTS.GROUP_DELETE, { groupId }, { recipients });
    }

    /**
     * Broadcast message edit
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {string} newContent - New content
     * @param {boolean} isGroup - Is group chat
     */
    static broadcastEditMessage(conversationId, messageId, newContent, isGroup) {
        let recipients;
        
        if (isGroup) {
            const group = DataManager.groupChats.get(conversationId);
            recipients = group?.members.filter(id => id !== game.user.id) || [];
        } else {
            const parts = conversationId.split('-');
            recipients = parts.filter(id => id !== game.user.id);
        }
        
        this.emit(SOCKET_EVENTS.EDIT_MESSAGE, {
            conversationId,
            messageId,
            newContent,
            isGroup
        }, { recipients });
    }

    /**
     * Broadcast message deletion
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {boolean} isGroup - Is group chat
     */
    static broadcastDeleteMessage(conversationId, messageId, isGroup) {
        let recipients;
        
        if (isGroup) {
            const group = DataManager.groupChats.get(conversationId);
            recipients = group?.members.filter(id => id !== game.user.id) || [];
        } else {
            const parts = conversationId.split('-');
            recipients = parts.filter(id => id !== game.user.id);
        }
        
        this.emit(SOCKET_EVENTS.DELETE_MESSAGE, {
            conversationId,
            messageId,
            isGroup
        }, { recipients });
    }

    /**
     * Broadcast reaction
     * @param {string} conversationId - Conversation ID
     * @param {string} messageId - Message ID
     * @param {string} emoji - Emoji
     * @param {boolean} isGroup - Is group chat
     */
    static broadcastReaction(conversationId, messageId, emoji, isGroup) {
        let recipients;
        
        if (isGroup) {
            const group = DataManager.groupChats.get(conversationId);
            recipients = group?.members.filter(id => id !== game.user.id) || [];
        } else {
            const parts = conversationId.split('-');
            recipients = parts.filter(id => id !== game.user.id);
        }
        
        this.emit(SOCKET_EVENTS.ADD_REACTION, {
            conversationId,
            messageId,
            emoji,
            userId: game.user.id,
            isGroup
        }, { recipients });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // IMAGE SHARING
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Send a private message with an image
     * @param {string} recipientId - Recipient user ID
     * @param {object} messageData - Message data including imageUrl
     */
    static sendPrivateImageMessage(recipientId, messageData) {
        // Same as regular private message, messageData should include imageUrl
        this.sendPrivateMessage(recipientId, messageData);
    }

    /**
     * Send a group message with an image
     * @param {string} groupId - Group ID
     * @param {object} messageData - Message data including imageUrl
     */
    static sendGroupImageMessage(groupId, messageData) {
        // Same as regular group message, messageData should include imageUrl
        this.sendGroupMessage(groupId, messageData);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BACKGROUND SHARING (GM Controlled)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * GM: Broadcast a background change to a specific user
     * @param {string} targetUserId - User to send background to
     * @param {string} backgroundUrl - Background image URL
     */
    static broadcastUserBackground(targetUserId, backgroundUrl) {
        if (!game.user.isGM) return;
        
        this.emit(SOCKET_EVENTS.BACKGROUND_SHARE, {
            type: 'user',
            userId: targetUserId,
            path: backgroundUrl
        }, { recipients: [targetUserId] });
    }

    /**
     * GM: Broadcast a global background change to all users
     * @param {string} backgroundUrl - Background image URL
     */
    static broadcastGlobalBackground(backgroundUrl) {
        if (!game.user.isGM) return;
        
        const allPlayers = game.users.filter(u => !u.isGM && u.active).map(u => u.id);
        
        this.emit(SOCKET_EVENTS.BACKGROUND_SHARE, {
            type: 'global',
            path: backgroundUrl
        }, { recipients: allPlayers });
    }

    /**
     * GM: Broadcast a chat-specific background change
     * @param {string} chatKey - Chat key
     * @param {string} backgroundUrl - Background image URL
     * @param {Array<string>} participants - User IDs involved in the chat
     */
    static broadcastChatBackground(chatKey, backgroundUrl, participants) {
        if (!game.user.isGM) return;
        
        const recipients = participants.filter(id => id !== game.user.id);
        
        this.emit(SOCKET_EVENTS.BACKGROUND_SHARE, {
            type: 'chat',
            chatKey: chatKey,
            path: backgroundUrl
        }, { recipients });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // GM STEALTH MONITORING
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Silently intercept and relay messages to GM monitor
     * This happens automatically via the existing message handlers
     * No explicit call needed - the _handlePrivateMessage and _handleGroupMessage
     * methods already add to interceptedMessages when GM is active
     */

    /**
     * Request sync of all messages from GM (for new GM connections)
     */
    static requestMessageSync() {
        if (game.user.isGM) return; // GM doesn't need to request
        
        const gm = game.users.find(u => u.isGM && u.active);
        if (!gm) return;
        
        this.emit('SYNC_REQUEST', {
            userId: game.user.id,
            type: 'all'
        }, { recipients: [gm.id] });
    }

    /**
     * GM: Broadcast sync data to a requesting user
     * @param {string} userId - User requesting sync
     */
    static sendSyncToUser(userId) {
        if (!game.user.isGM) return;
        
        // Send relevant private chats
        const privateChats = {};
        for (const [chatKey, chat] of DataManager.privateChats.entries()) {
            if (chat.users.includes(userId)) {
                privateChats[chatKey] = chat;
            }
        }
        
        this.emit(SOCKET_EVENTS.PRIVATE_SYNC, {
            chats: privateChats
        }, { recipients: [userId] });
        
        // Send relevant group chats
        const groups = [];
        for (const [groupId, group] of DataManager.groupChats.entries()) {
            if (group.members.includes(userId)) {
                groups.push(group);
            }
        }
        
        this.emit(SOCKET_EVENTS.GROUP_SYNC, {
            groups: groups
        }, { recipients: [userId] });
    }
}

