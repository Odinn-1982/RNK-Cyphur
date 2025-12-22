/**
 * RNK Cyphur - Chat Window
 * Main chat interface for private and group conversations
 * Supports Foundry VTT v11, v12, and v13
 */

import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { SocketHandler } from './SocketHandler.js';
import { Utils } from './Utils.js';
import { RNKCyphur } from './RNKCyphur.js';
import { QuantumPortal } from './QuantumPortal.js';
import { REACTION_EMOJIS } from './Constants.js';

// Version-compatible Application class
let AppClass;
if (typeof foundry !== 'undefined' && foundry.applications?.api?.ApplicationV2) {
    const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
    AppClass = HandlebarsApplicationMixin(ApplicationV2);
} else {
    AppClass = Application;
}

export class CyphurWindow extends AppClass {

    constructor(options = {}) {
        super(options);
        this._preservedInputValue = '';
        this._typingTimeout = null;
        this._lastTypingEmit = 0;
        this._searchQuery = '';
        this._shouldScrollToBottom = true;
        this._boundSubmitHandler = this._handleFormSubmit.bind(this);
        this._isRendering = false;
        this._renderScheduled = false;
        this._pendingImage = null; // For image upload preview
    }

    get id() {
        const base = 'cyphur-window';
        if (this.options.groupId) return `${base}-group-${this.options.groupId}`;
        if (this.options.otherUserId) return `${base}-private-${this.options.otherUserId}`;
        return `${base}-${foundry.utils.randomID()}`;
    }

    get title() {
        if (this.options.groupId) {
            const group = DataManager.groupChats.get(this.options.groupId);
            return group 
                ? game.i18n.format('CYPHUR.GroupChat', { name: group.name }) 
                : game.i18n.localize('CYPHUR.GroupChatDefault');
        }
        if (this.options.otherUserId) {
            const otherUser = game.users.get(this.options.otherUserId);
            return otherUser 
                ? game.i18n.format('CYPHUR.ChatWith', { name: otherUser.name }) 
                : game.i18n.localize('CYPHUR.PrivateChat');
        }
        return game.i18n.localize('CYPHUR.AppName');
    }

    static DEFAULT_OPTIONS = {
        classes: ['rnk-cyphur', 'cyphur-chat-window'],
        position: { width: 420, height: 500 },
        window: { resizable: true },
        popOut: true,
        tag: 'form',
        form: { closeOnSubmit: false }
    };

    // v11/v12 compatibility - static defaultOptions getter
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions || {}, {
            classes: ['rnk-cyphur', 'cyphur-chat-window'],
            template: 'modules/rnk-cyphur/templates/chat-window.hbs',
            width: 420,
            height: 500,
            resizable: true,
            popOut: true
        });
    }

    static PARTS = {
        form: { template: 'modules/rnk-cyphur/templates/chat-window.hbs' }
    };

    // v11/v12 compatibility - getData method (alias for _prepareContext)
    async getData() {
        return this._prepareContext();
    }

    async _prepareContext() {
        const context = {
            currentUser: game.user,
            isGM: game.user.isGM,
            reactionEmojis: REACTION_EMOJIS
        };
        
        // GM speaker selection
        if (context.isGM) {
            context.speakers = [
                { id: game.user.id, name: game.user.name, isActor: false },
                ...game.actors.filter(a => a.isOwner).map(a => ({
                    id: a.id,
                    name: a.name,
                    isActor: true
                }))
            ];
        }
        
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        
        context.isFavorite = DataManager.isFavorite(conversationId);
        context.isMuted = DataManager.isMuted(conversationId);
        context.isGroup = !!this.options.groupId;
        context.conversationId = conversationId;
        
        // Get messages
        let messages = [];
        
        if (this.options.otherUserId) {
            const chatKey = DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            const chat = DataManager.privateChats.get(chatKey);
            messages = chat ? [...(chat.history || [])] : [];
            
            // Mark as read
            DataManager.markAsRead(chatKey);
            
            context.otherUser = game.users.get(this.options.otherUserId);
            context.isOnline = Utils.isUserOnline(this.options.otherUserId);
            
        } else if (this.options.groupId) {
            const group = DataManager.groupChats.get(this.options.groupId);
            messages = group ? [...(group.history || [])] : [];
            
            // Mark as read
            DataManager.markAsRead(this.options.groupId);
            
            context.group = group;
            context.memberCount = group?.members?.length || 0;
        }
        
        // Apply search filter
        if (this._searchQuery) {
            const lowerQuery = this._searchQuery.toLowerCase();
            messages = messages.filter(msg => {
                const content = (msg.messageContent || '').toLowerCase();
                const sender = (msg.senderName || '').toLowerCase();
                return content.includes(lowerQuery) || sender.includes(lowerQuery);
            });
            context.searchActive = true;
            context.searchResultCount = messages.length;
        }
        
        // Enrich messages with display data
        messages.forEach(msg => {
            msg.relativeTime = Utils.formatRelativeTime(msg.timestamp);
            msg.fullTime = Utils.formatFullTimestamp(msg.timestamp);
            msg.isOwn = Utils.isOwnMessage(msg.senderId);
            msg.displayContent = Utils.highlightMentions(msg.messageContent || '');
            msg.isPinned = DataManager.isPinned(conversationId, msg.id);
            
            // Reply context
            if (msg.replyToId) {
                const replyToMsg = messages.find(m => m.id === msg.replyToId);
                if (replyToMsg) {
                    msg.replyTo = Utils.formatReplyQuote(replyToMsg);
                }
            }
            
            // Edit timestamp
            if (msg.edited) {
                msg.editedTime = Utils.formatFullTimestamp(msg.editedAt);
            }
            
            // Format reactions
            if (msg.reactions && Object.keys(msg.reactions).length > 0) {
                msg.formattedReactions = Object.entries(msg.reactions).map(([emoji, users]) => ({
                    emoji,
                    count: users.length,
                    users: users.map(id => game.users.get(id)?.name).filter(Boolean).join(', '),
                    isOwnReaction: users.includes(game.user.id)
                }));
            }
            
            // Avatar
            const avatar = Utils.getUserAvatar(msg.senderId);
            if (avatar.type === 'initials') {
                msg.avatarInitials = avatar.value;
                msg.useInitials = true;
            } else {
                msg.senderImg = avatar.value;
                msg.useInitials = false;
            }
            
            // User color for visual identification
            msg.userColor = Utils.getUserColor(msg.senderId);
        });
        
        context.messages = messages;
        
        // Typing users
        const typingNames = DataManager.getTypingUsers(conversationId);
        if (typingNames.length > 0) {
            context.typingText = typingNames.length === 1
                ? game.i18n.format('CYPHUR.TypingSingle', { name: typingNames[0] })
                : game.i18n.format('CYPHUR.TypingMultiple', { names: typingNames.join(', ') });
        }
        
        // Reply preview
        const replyToId = DataManager.getReplyTo();
        if (replyToId) {
            const replyMsg = messages.find(m => m.id === replyToId);
            if (replyMsg) {
                context.replyingTo = Utils.formatReplyQuote(replyMsg);
            }
        }
        
        return context;
    }

    /**
     * Update typing indicator without full re-render
     */
    updateTypingIndicator() {
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        const typingNames = DataManager.getTypingUsers(conversationId);
        
        const typingEl = this.element?.querySelector('.cyphur-typing-indicator');
        
        if (typingNames.length === 0) {
            if (typingEl) typingEl.style.display = 'none';
            return;
        }
        
        const text = typingNames.length === 1
            ? game.i18n.format('CYPHUR.TypingSingle', { name: typingNames[0] })
            : game.i18n.format('CYPHUR.TypingMultiple', { names: typingNames.join(', ') });
        
        if (typingEl) {
            typingEl.style.display = '';
            typingEl.innerHTML = `<i class="fas fa-ellipsis-h"></i> ${Utils.sanitizeHTML(text)}`;
        } else {
            const messageList = this.element?.querySelector('.cyphur-message-list');
            if (messageList) {
                const div = document.createElement('div');
                div.className = 'cyphur-typing-indicator';
                div.innerHTML = `<i class="fas fa-ellipsis-h"></i> ${Utils.sanitizeHTML(text)}`;
                messageList.appendChild(div);
            }
        }
    }

    _onRender(context, options) {
        if (super._onRender) super._onRender(context, options);
        this._setupEventListeners(this.element);
    }

    // v11/v12 compatibility - activateListeners method
    activateListeners(html) {
        if (super.activateListeners) super.activateListeners(html);
        const element = html[0] || html;
        this._setupEventListeners(element);
    }

    /**
     * Set up event listeners - shared by _onRender (v13) and activateListeners (v11/v12)
     * @param {HTMLElement} element - The root element to bind listeners to
     */
    _setupEventListeners(element) {
        if (!element) return;

        // Bring window to front
        this.bringToFront();
        
        // Add Quantum Portal button to header
        const header = element.querySelector('.window-header');
        if (header) {
            QuantumPortal.addPortalButton(header, this);
            this._addHeaderLogo(header);
        }
        
        // Add logo to content area
        const content = element.querySelector('.cyphur-chat-container');
        if (content) {
            QuantumPortal.addLogoDisplay(content, 'corner');
        }
        
        // Scroll to bottom
        this._scrollToBottom(this._shouldScrollToBottom);
        
        // Form submit handler
        element.removeEventListener('submit', this._boundSubmitHandler);
        element.addEventListener('submit', this._boundSubmitHandler);
        
        // Search functionality
        const searchInput = element.querySelector('.cyphur-search-input');
        if (searchInput) {
            searchInput.value = this._searchQuery;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this._searchQuery = e.target.value.trim();
                this._shouldScrollToBottom = false;
                this.render(true);
            }, 300));
        }
        
        // Toolbar buttons
        element.querySelector('.cyphur-favorite-btn')?.addEventListener('click', () => this._onToggleFavorite());
        element.querySelector('.cyphur-mute-btn')?.addEventListener('click', () => this._onToggleMute());
        element.querySelector('.cyphur-export-btn')?.addEventListener('click', () => this._onExport());
        element.querySelector('.cyphur-image-btn')?.addEventListener('click', () => this._onImageUpload());
        element.querySelector('.cyphur-background-btn')?.addEventListener('click', () => this._onSetBackground());


        // Image upload via hidden input
        const imageInput = element.querySelector('.cyphur-image-input');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => this._onImageSelected(e));
        }

        // Cancel pending image
        element.querySelector('.cyphur-cancel-image')?.addEventListener('click', () => {
            this._pendingImage = null;
            this._updateImagePreview();
        });
        
        // Message input
        const textarea = element.querySelector('textarea[name="message"]');
        if (textarea) {
            textarea.value = this._preservedInputValue;
            
            textarea.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    this._handleFormSubmit(event);
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.close();
                }
            });
            
            textarea.addEventListener('input', () => {
                this._preservedInputValue = textarea.value;
                this._onTyping();
            });
            
            textarea.focus();
        }
        
        // Message action buttons
        element.querySelectorAll('.cyphur-msg-reply').forEach(btn => {
            btn.addEventListener('click', (e) => this._onReplyMessage(e));
        });
        
        element.querySelectorAll('.cyphur-msg-react').forEach(btn => {
            btn.addEventListener('click', (e) => this._onReactMessage(e));
        });
        
        element.querySelectorAll('.cyphur-msg-pin').forEach(btn => {
            btn.addEventListener('click', (e) => this._onPinMessage(e));
        });
        
        element.querySelectorAll('.cyphur-msg-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this._onEditMessage(e));
        });
        
        element.querySelectorAll('.cyphur-msg-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this._onDeleteMessage(e));
        });
        
        // Reaction clicks
        element.querySelectorAll('.cyphur-reaction').forEach(item => {
            item.addEventListener('click', (e) => this._onClickReaction(e));
        });
        
        // Cancel reply
        element.querySelector('.cyphur-cancel-reply')?.addEventListener('click', () => {
            DataManager.clearReplyTo();
            this.render(true);
        });
        
        // Emoji picker for reactions
        element.querySelectorAll('.cyphur-emoji-option').forEach(btn => {
            btn.addEventListener('click', (e) => this._onSelectEmoji(e));
        });
        
        // Apply background
        try {
            const conversationId = this.options.groupId || 
                DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            const bgPath = DataManager.getEffectiveBackground(conversationId, game.user.id);
            this._applyBackground(bgPath);
        } catch (e) { /* ignore */ }

        // Update image preview if there's a pending image
        this._updateImagePreview();
    }

    /**
     * Apply a background image to this chat window
     * @param {string|null} path - Background image path
     */
    _applyBackground(path) {
        const container = this.element?.querySelector('.cyphur-chat-container');
        if (!container) return;

        if (path) {
            container.style.setProperty('--chat-background', `url("${path}")`);
            container.classList.add('has-background');
        } else {
            container.style.removeProperty('--chat-background');
            container.classList.remove('has-background');
        }
    }

    /**
     * Update the image preview area
     */
    _updateImagePreview() {
        const previewArea = this.element?.querySelector('.cyphur-image-preview');
        if (!previewArea) return;

        if (this._pendingImage) {
            previewArea.innerHTML = `
                <div class="cyphur-pending-image">
                    <img src="${this._pendingImage}" alt="Preview">
                    <button type="button" class="cyphur-cancel-image" title="${game.i18n.localize('CYPHUR.CancelImage')}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            previewArea.style.display = 'block';

            // Re-attach cancel handler
            previewArea.querySelector('.cyphur-cancel-image')?.addEventListener('click', () => {
                this._pendingImage = null;
                this._updateImagePreview();
            });
        } else {
            previewArea.innerHTML = '';
            previewArea.style.display = 'none';
        }
    }

    /**
     * Handle image upload button click
     */
    _onImageUpload() {
        const input = this.element?.querySelector('.cyphur-image-input');
        if (input) {
            input.click();
        }
    }

    /**
     * Handle image file selection
     * @param {Event} event
     */
    async _onImageSelected(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate the image
        const validation = DataManager.validateImage(file);
        if (!validation.valid) {
            ui.notifications.error(validation.error);
            return;
        }

        // Process and store for preview
        try {
            const imageData = await DataManager.processImage(file);
            if (imageData) {
                this._pendingImage = imageData;
                this._updateImagePreview();
            }
        } catch (e) {
            console.error('Cyphur | Failed to process image:', e);
            ui.notifications.error(game.i18n.localize('CYPHUR.ImageProcessError'));
        }

        // Clear the input for next selection
        event.target.value = '';
    }

    /**
     * Open dialog to set chat background
     */
    async _onSetBackground() {
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        
        // Use file picker
        const picker = new FilePicker({
            type: 'image',
            current: DataManager.getChatBackground(conversationId) || '',
            callback: (path) => {
                if (path) {
                    DataManager.setChatBackground(conversationId, path);
                    this._applyBackground(path);
                    ui.notifications.info(game.i18n.localize('CYPHUR.BackgroundSet'));
                }
            }
        });
        picker.render(true);
    }

    _scrollToBottom(smooth = true) {
        const messageList = this.element?.querySelector('.cyphur-message-list');
        if (messageList) {
            // Use requestAnimationFrame to ensure DOM is ready before scrolling
            requestAnimationFrame(() => {
                messageList.scrollTo({
                    top: messageList.scrollHeight,
                    behavior: smooth ? 'smooth' : 'auto'
                });
            });
        }
        this._shouldScrollToBottom = true;
    }

    _handleFormSubmit(event) {
        event?.preventDefault();
        
        const textarea = this.element.querySelector('textarea[name="message"]');
        const message = textarea?.value?.trim();
        
        // Need either message or image
        if (!message && !this._pendingImage) return;
        
        // Get speaker data if GM selected an actor
        let speakerData = null;
        const speakerSelect = this.element.querySelector('select[name="speaker"]');
        if (speakerSelect && game.user.isGM) {
            const speakerId = speakerSelect.value;
            if (speakerId !== game.user.id) {
                const actor = game.actors.get(speakerId);
                if (actor) {
                    speakerData = {
                        name: actor.name,
                        img: actor.img || game.user.avatar
                    };
                }
            }
        }

        // Build message options
        const messageOptions = {
            speakerData,
            imageUrl: this._pendingImage || null
        };
        
        // Send the message
        if (this.options.groupId) {
            RNKCyphur.sendGroupMessage(this.options.groupId, message || '', speakerData, messageOptions.imageUrl);
        } else {
            RNKCyphur.sendMessage(this.options.otherUserId, message || '', speakerData, messageOptions.imageUrl);
        }
        
        // Clear input and image
        if (textarea) textarea.value = '';
        this._preservedInputValue = '';
        this._pendingImage = null;
        
        // Clear typing indicator
        this._clearTyping();
        
        // Scroll to bottom
        this._shouldScrollToBottom = true;
        this.render(false);
    }

    _onTyping() {
        const now = Date.now();
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        
        // Throttle typing emissions
        if (now - this._lastTypingEmit > 2000) {
            this._lastTypingEmit = now;
            SocketHandler.sendTypingIndicator(conversationId, true, !!this.options.groupId);
        }
        
        // Clear typing after delay
        clearTimeout(this._typingTimeout);
        this._typingTimeout = setTimeout(() => this._clearTyping(), 3000);
    }

    _clearTyping() {
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        SocketHandler.sendTypingIndicator(conversationId, false, !!this.options.groupId);
    }

    _onToggleFavorite() {
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        DataManager.toggleFavorite(conversationId);
        this.render(true);
    }

    _onToggleMute() {
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        DataManager.toggleMuted(conversationId);
        
        const isMuted = DataManager.isMuted(conversationId);
        ui.notifications.info(game.i18n.localize(isMuted ? 'CYPHUR.ChatMuted' : 'CYPHUR.ChatUnmuted'));
        
        this.render(true);
    }

    _onExport() {
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        const isGroup = !!this.options.groupId;
        
        const chat = isGroup 
            ? DataManager.groupChats.get(conversationId) 
            : DataManager.privateChats.get(conversationId);
        
        const messages = chat?.history || [];
        const filename = isGroup 
            ? `cyphur-${chat?.name || 'group'}-${Date.now()}.txt`
            : `cyphur-chat-${Date.now()}.txt`;
        
        Utils.exportMessages(messages, filename);
    }

    _onReplyMessage(event) {
        const messageId = event.currentTarget.closest('[data-message-id]')?.dataset.messageId;
        if (messageId) {
            DataManager.setReplyTo(messageId);
            this.render(true);
            this.element.querySelector('textarea[name="message"]')?.focus();
        }
    }

    _onReactMessage(event) {
        const messageEl = event.currentTarget.closest('[data-message-id]');
        const picker = messageEl?.querySelector('.cyphur-emoji-picker');
        if (picker) {
            picker.classList.toggle('visible');
        }
    }

    _onSelectEmoji(event) {
        const emoji = event.currentTarget.dataset.emoji;
        const messageId = event.currentTarget.closest('[data-message-id]')?.dataset.messageId;
        
        if (emoji && messageId) {
            const conversationId = this.options.groupId || 
                DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            RNKCyphur.toggleReaction(conversationId, messageId, emoji, !!this.options.groupId);
        }
        
        // Hide picker
        event.currentTarget.closest('.cyphur-emoji-picker')?.classList.remove('visible');
    }

    _onClickReaction(event) {
        const emoji = event.currentTarget.dataset.emoji;
        const messageId = event.currentTarget.closest('[data-message-id]')?.dataset.messageId;
        
        if (emoji && messageId) {
            const conversationId = this.options.groupId || 
                DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            RNKCyphur.toggleReaction(conversationId, messageId, emoji, !!this.options.groupId);
        }
    }

    _onPinMessage(event) {
        const messageId = event.currentTarget.closest('[data-message-id]')?.dataset.messageId;
        if (messageId) {
            const conversationId = this.options.groupId || 
                DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            DataManager.togglePinned(conversationId, messageId);
            this.render(true);
        }
    }

    async _onEditMessage(event) {
        const messageEl = event.currentTarget.closest('[data-message-id]');
        const messageId = messageEl?.dataset.messageId;
        if (!messageId) return;
        
        const conversationId = this.options.groupId || 
            DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
        const isGroup = !!this.options.groupId;
        
        const chat = isGroup 
            ? DataManager.groupChats.get(conversationId) 
            : DataManager.privateChats.get(conversationId);
        
        const message = chat?.history?.find(m => m.id === messageId);
        if (!message) return;
        
        // Strip HTML for editing
        const plainContent = (message.messageContent || '').replace(/<[^>]*>/g, '');
        
        // Show edit dialog
        const newContent = await Dialog.prompt({
            title: game.i18n.localize('CYPHUR.EditMessage'),
            content: `<textarea name="content" style="width:100%;height:100px;">${plainContent}</textarea>`,
            callback: (html) => html.find('[name="content"]').val(),
            rejectClose: false
        });
        
        if (newContent && newContent.trim() !== plainContent) {
            RNKCyphur.editMessage(conversationId, messageId, newContent.trim(), isGroup);
        }
    }

    async _onDeleteMessage(event) {
        const messageId = event.currentTarget.closest('[data-message-id]')?.dataset.messageId;
        if (!messageId) return;
        
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize('CYPHUR.DeleteMessage'),
            content: `<p>${game.i18n.localize('CYPHUR.DeleteMessageConfirm')}</p>`
        });
        
        
        if (confirmed) {
            const conversationId = this.options.groupId || 
                DataManager.getPrivateChatKey(game.user.id, this.options.otherUserId);
            RNKCyphur.deleteMessage(conversationId, messageId, !!this.options.groupId);
        }
    }

    /**
     * Add logo to window header
     * @param {HTMLElement} header - The window header element
     * @private
     */
    _addHeaderLogo(header) {
        // Don't add if already exists
        if (header.querySelector('.cyphur-header-logo')) return;
        
        const titleEl = header.querySelector('.window-title');
        if (titleEl) {
            const logo = document.createElement('img');
            logo.src = 'modules/rnk-cyphur/rnk-codex.jpg';
            logo.alt = 'RNK Cyphur';
            logo.className = 'cyphur-header-logo';
            titleEl.insertBefore(logo, titleEl.firstChild);
        }
    }

    /**
     * Bring this window to the front (highest z-index)
     */
    bringToFront() {
        if (!this.element) return;
        
        // Get max z-index from all Cyphur windows
        const allWindows = document.querySelectorAll('.rnk-cyphur');
        let maxZ = 200;
        allWindows.forEach(win => {
            const z = parseInt(win.style.zIndex || 0, 10);
            if (z > maxZ) maxZ = z;
        });
        
        // Set this window higher
        this.element.style.zIndex = maxZ + 1;
        this.element.classList.add('focused');
        
        // Remove focused class from others
        allWindows.forEach(win => {
            if (win !== this.element) {
                win.classList.remove('focused');
            }
        });
    }

    close(options) {
        this._clearTyping();
        
        // Remove from tracking
        if (this.options.otherUserId) {
            UIManager.openPrivateChatWindows.delete(this.options.otherUserId);
        } else if (this.options.groupId) {
            UIManager.openGroupChatWindows.delete(this.options.groupId);
        }
        
        return super.close(options);
    }
}
