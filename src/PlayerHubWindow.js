/**
 * RNK Cyphur - Player Hub Window
 * Main hub for accessing conversations and starting new chats
 * Players: Create chats, view own chats, change theme, export, notifications
 * GMs: Additional monitoring, group management, moderation tools
 */

import { MODULE_ID, THEMES, SOUNDS } from './Constants.js';
import { QuantumPortal } from './QuantumPortal.js';
import { UIManager } from './UIManager.js';
import { DataManager } from './DataManager.js';

// Version-compatible Application class
let AppClass;
if (typeof foundry !== 'undefined' && foundry.applications?.api?.ApplicationV2) {
    const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
    AppClass = HandlebarsApplicationMixin(ApplicationV2);
} else {
    AppClass = Application;
}

export class PlayerHubWindow extends AppClass {

    static DEFAULT_OPTIONS = {
        id: 'cyphur-player-hub',
        classes: ['rnk-cyphur', 'cyphur-hub', 'cyphur-window'],
        window: { title: 'CYPHUR.Hub.Title', resizable: true },
        tag: 'div',
        position: { width: 700, height: 600 }
    };

    // For v11/v12 compatibility
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'cyphur-player-hub',
            classes: ['rnk-cyphur', 'cyphur-hub', 'cyphur-window'],
            title: game.i18n.localize('CYPHUR.Hub.Title'),
            template: `modules/${MODULE_ID}/templates/player-hub.hbs`,
            width: 700,
            height: 600,
            resizable: true
        });
    }

    get title() {
        return game.i18n.localize('CYPHUR.Hub.Title');
    }

    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/player-hub.hbs` }
    };

    constructor(options = {}) {
        super(options);
        this.activeTab = 'conversations';
    }

    async _prepareContext(options) {
        return this.getData();
    }

    async getData() {
        const currentUser = game.user;
        const conversations = [];

        // Get group chats where user is a member
        if (DataManager.groupChats) {
            const visibleGroups = Array.from(DataManager.groupChats.values())
                .filter(g => g.members?.includes(currentUser.id));
            
            for (const group of visibleGroups) {
                const unreadCount = DataManager.getUnreadCount?.(group.id) || 0;
                const lastMsg = group.history?.slice(-1)[0];
                
                conversations.push({
                    id: group.id,
                    name: group.name,
                    type: 'group',
                    icon: 'fa-users',
                    memberCount: group.members?.length || 0,
                    unreadCount: unreadCount,
                    hasUnread: unreadCount > 0,
                    isFavorite: DataManager.isFavorite?.(group.id) || false,
                    isMuted: DataManager.isMuted?.(group.id) || false,
                    lastActivity: lastMsg?.timestamp || group.created || 0,
                    lastMessage: lastMsg ? {
                        preview: this._getMessagePreview(lastMsg),
                        time: this._formatRelativeTime(lastMsg.timestamp)
                    } : null
                });
            }
        }

        // Get private chats
        if (DataManager.privateChats) {
            const visiblePrivateChats = Array.from(DataManager.privateChats.values())
                .filter(chat => chat.users?.includes(currentUser.id));
            
            for (const chat of visiblePrivateChats) {
                const otherUserId = chat.users?.find(id => id !== currentUser.id);
                const otherUser = game.users.get(otherUserId);
                if (!otherUser) continue;
                
                const chatKey = DataManager.getPrivateChatKey?.(chat.users[0], chat.users[1]) || `${chat.users[0]}-${chat.users[1]}`;
                const unreadCount = DataManager.getUnreadCount?.(chatKey) || 0;
                const lastMsg = chat.history?.slice(-1)[0];
                
                conversations.push({
                    id: chatKey,
                    name: otherUser.name,
                    type: 'private',
                    icon: 'fa-user-secret',
                    unreadCount: unreadCount,
                    hasUnread: unreadCount > 0,
                    isOnline: otherUser.active,
                    isGM: otherUser.isGM,
                    isFavorite: DataManager.isFavorite?.(chatKey) || false,
                    isMuted: DataManager.isMuted?.(chatKey) || false,
                    otherUserId: otherUserId,
                    avatar: otherUser.avatar,
                    color: otherUser.color,
                    lastActivity: lastMsg?.timestamp || 0,
                    lastMessage: lastMsg ? {
                        preview: this._getMessagePreview(lastMsg),
                        time: this._formatRelativeTime(lastMsg.timestamp)
                    } : null
                });
            }
        }

        // Sort: favorites first, then by last activity
        conversations.sort((a, b) => {
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            return (b.lastActivity || 0) - (a.lastActivity || 0);
        });

        // Get all users for new chat creation - split into GMs and Players
        const allOtherUsers = game.users
            .filter(u => u.id !== currentUser.id)
            .map(u => ({
                id: u.id,
                name: u.name,
                initials: this._getInitials(u.name),
                isOnline: u.active,
                isGM: u.isGM,
                avatar: u.avatar,
                color: u.color || this._getRandomColor(u.id)
            }))
            .sort((a, b) => {
                if (a.isOnline && !b.isOnline) return -1;
                if (!a.isOnline && b.isOnline) return 1;
                return a.name.localeCompare(b.name);
            });

        // Split users into GMs and Players for 2-column layout
        const gmUsers = allOtherUsers.filter(u => u.isGM);
        const playerUsers = allOtherUsers.filter(u => !u.isGM);
        const users = allOtherUsers; // Keep for backwards compatibility

        // Current settings for player controls
        let currentTheme = 'neon';
        let enableSounds = true;
        let soundVolume = 0.5;
        let notificationSound = 'notify.wav';
        let enableNotifications = true;
        
        try {
            currentTheme = game.settings.get(MODULE_ID, 'theme');
            enableSounds = game.settings.get(MODULE_ID, 'enableSound');
            soundVolume = game.settings.get(MODULE_ID, 'notificationVolume');
            notificationSound = game.settings.get(MODULE_ID, 'notificationSound');
            enableNotifications = game.settings.get(MODULE_ID, 'enableDesktopNotifications');
        } catch (e) { /* defaults */ }

        return {
            conversations,
            users,
            gmUsers,
            playerUsers,
            isGM: game.user.isGM,
            totalUnread: DataManager.getTotalUnread() || 0,
            activeTab: this.activeTab,
            // Theme options for players
            themes: Object.entries(THEMES).map(([key, value]) => ({
                key,
                name: value.name,
                description: value.description,
                selected: key === currentTheme
            })),
            currentTheme,
            // Sound options for players
            sounds: SOUNDS.map(s => ({
                ...s,
                selected: s.file === notificationSound
            })),
            enableSounds,
            soundVolume: soundVolume * 100, // Convert 0-1 to 0-100 for slider
            enableNotifications,
            // Module info
            moduleId: MODULE_ID
        };
    }

    _getMessagePreview(msg) {
        if (!msg) return '';
        let content = msg.messageContent || msg.content || '';
        // Strip HTML and truncate
        content = content.replace(/<[^>]*>/g, '').trim();
        if (msg.type === 'image') return 'ðŸ“· Image';
        return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }

    _getInitials(name) {
        if (!name) return '?';
        const parts = name.split(/\s+/).filter(p => p.length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    _getRandomColor(userId) {
        // Generate consistent color from userId
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 50%)`;
    }

    _formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return game.i18n.localize('CYPHUR.Time.JustNow');
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        return `${days}d`;
    }

    // v11/v12 compatibility
    activateListeners(html) {
        super.activateListeners(html);
        this._setupEventListeners(html[0] || html);
    }

    // v13 compatibility
    _onRender(context, options) {
        super._onRender?.(context, options);
        this._setupEventListeners(this.element);
        
        // Quantum Portal integration
        this.bringToFront();
        this._addQuantumPortal();
        this._addHeaderLogo();
    }

    _setupEventListeners(element) {
        if (!element) return;

        // Tab switching
        element.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.activeTab = e.currentTarget.dataset.tab;
                element.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                element.querySelectorAll('.cyphur-tab-content').forEach(c => c.classList.remove('active'));
                element.querySelector(`.cyphur-tab-content[data-tab-content="${this.activeTab}"]`)?.classList.add('active');
            });
        });

        // Conversation clicks
        element.querySelectorAll('.cyphur-conv-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.cyphur-conv-action')) return;
                this._onOpenConversation(item);
            });
        });

        // Favorite/Mute toggles
        element.querySelectorAll('.cyphur-conv-action[data-action="favorite"]').forEach(btn => {
            btn.addEventListener('click', (e) => this._onToggleFavorite(e));
        });
        element.querySelectorAll('.cyphur-conv-action[data-action="mute"]').forEach(btn => {
            btn.addEventListener('click', (e) => this._onToggleMute(e));
        });

        // User selection for new chat
        element.querySelectorAll('.cyphur-user-card').forEach(item => {
            // Single click toggles selection
            item.addEventListener('click', () => item.classList.toggle('selected'));
            
            // Double-click opens chat immediately
            item.addEventListener('dblclick', () => {
                const userId = item.dataset.userId;
                if (userId) {
                    const api = game.modules.get(MODULE_ID)?.api;
                    api?.UIManager?.openChatFor?.(userId);
                }
            });
        });

        // Create chat button
        element.querySelector('[data-action="createChat"]')?.addEventListener('click', () => this._onCreateChat());

        // Theme selection
        element.querySelectorAll('.cyphur-theme-option').forEach(opt => {
            opt.addEventListener('click', (e) => this._onSelectTheme(e.currentTarget.dataset.theme));
        });

        // Sound toggle
        element.querySelector('[data-action="toggleSounds"]')?.addEventListener('change', (e) => {
            game.settings.set(MODULE_ID, 'enableSound', e.target.checked);
        });

        // Volume slider
        element.querySelector('[data-action="setVolume"]')?.addEventListener('input', (e) => {
            // Convert 0-100 slider to 0-1 float
            game.settings.set(MODULE_ID, 'notificationVolume', parseInt(e.target.value) / 100);
        });

        // Notification sound select
        element.querySelector('[data-action="setNotificationSound"]')?.addEventListener('change', (e) => {
            game.settings.set(MODULE_ID, 'notificationSound', e.target.value);
        });

        // Test sound button
        element.querySelector('[data-action="testSound"]')?.addEventListener('click', () => this._onTestSound());

        // Notification toggle
        element.querySelector('[data-action="toggleNotifications"]')?.addEventListener('change', (e) => {
            game.settings.set(MODULE_ID, 'enableDesktopNotifications', e.target.checked);
            if (e.target.checked) this._requestNotificationPermission();
        });

        // Export buttons (available to all players)
        element.querySelector('[data-action="exportToJournal"]')?.addEventListener('click', () => this._onExportToJournal());
        element.querySelector('[data-action="exportLocal"]')?.addEventListener('click', () => this._onExportLocal());

        // GM-only buttons
        if (game.user.isGM) {
            element.querySelector('[data-action="openGMTools"]')?.addEventListener('click', () => this._onOpenGMTools());
            element.querySelector('[data-action="openGroupManager"]')?.addEventListener('click', () => this._onOpenGroupManager());
            element.querySelector('[data-action="openMonitor"]')?.addEventListener('click', () => this._onOpenMonitor());
            element.querySelector('[data-action="setGlobalBackground"]')?.addEventListener('click', () => this._onSetGlobalBackground());
            
            element.querySelectorAll('[data-action="setUserBackground"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const userId = e.currentTarget.dataset.userId;
                    if (userId) this._onSetUserBackground(userId);
                });
            });
        }

        // Search/filter
        const searchInput = element.querySelector('.cyphur-hub-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                element.querySelectorAll('.cyphur-conv-item').forEach(item => {
                    const name = item.querySelector('.cyphur-conv-name')?.textContent?.toLowerCase() || '';
                    item.style.display = name.includes(query) ? '' : 'none';
                });
            });
        }

        // Apply current theme
        this._applyTheme();
    }

    _onOpenConversation(item) {
        const convId = item.dataset.conversationId;
        const type = item.dataset.type;

        if (type === 'group') {
            UIManager.openGroupChat(convId);
        } else if (type === 'private') {
            const otherUserId = item.dataset.userId;
            if (otherUserId) UIManager.openChatFor(otherUserId);
        }
    }

    async _onCreateChat() {
        const selectedUsers = Array.from(this.element.querySelectorAll('.cyphur-user-card.selected'))
            .map(el => el.dataset.userId);

        if (selectedUsers.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.Errors.SelectUsersToChat') || 'Select at least one user');
        }

        // Single user = private chat
        if (selectedUsers.length === 1) {
            UIManager.openChatFor(selectedUsers[0]);
            return;
        }

        // Multiple users = only GM can create groups
        if (!game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.Errors.OnlyGMCanCreateGroups') || 'Only GM can create group chats');
        }

        const groupNameInput = this.element.querySelector('input[name="newGroupName"]');
        let groupName = groupNameInput?.value?.trim();
        
        if (!groupName) {
            const userNames = selectedUsers.map(id => game.users.get(id)?.name || 'Unknown').join(', ');
            groupName = `Group: ${userNames.substring(0, 30)}${userNames.length > 30 ? '...' : ''}`;
        }

        // Import RNKCyphur dynamically if needed or assume it's available globally/imported
        // Since we don't import RNKCyphur at the top, let's use the global or import it
        const { RNKCyphur } = await import('./RNKCyphur.js');
        const group = await RNKCyphur.createGroup(groupName, selectedUsers);
        if (group) {
            UIManager.openGroupChat(group.id);
        }
    }

    _onSelectTheme(themeKey) {
        game.settings.set(MODULE_ID, 'theme', themeKey);
        this._applyTheme(themeKey);
        this.render();
    }

    _applyTheme(themeKey) {
        const theme = themeKey || game.settings.get(MODULE_ID, 'theme') || 'neon';
        const themeClass = THEMES[theme]?.class || 'cyphur-theme-neon';
        
        // Remove all theme classes and add the selected one
        Object.values(THEMES).forEach(t => {
            document.body.classList.remove(t.class);
        });
        document.body.classList.add(themeClass);
    }

    _onTestSound() {
        try {
            const soundFile = game.settings.get(MODULE_ID, 'notificationSound');
            const volume = game.settings.get(MODULE_ID, 'notificationVolume');
            const audio = new Audio(`modules/${MODULE_ID}/sounds/${soundFile}`);
            audio.volume = volume;
            audio.play();
        } catch (e) {
            console.error('Failed to play test sound:', e);
        }
    }

    _requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    async _onToggleFavorite(e) {
        const convId = e.currentTarget.closest('.cyphur-conv-item')?.dataset.conversationId;
        if (convId) {
            await DataManager.toggleFavorite(convId);
            this.render();
        }
    }

    async _onToggleMute(e) {
        const convId = e.currentTarget.closest('.cyphur-conv-item')?.dataset.conversationId;
        if (convId) {
            await DataManager.toggleMute(convId);
            this.render();
        }
    }

    async _onExportToJournal() {
        const selectedConvs = Array.from(this.element.querySelectorAll('.cyphur-conv-item.selected'))
            .map(el => el.dataset.conversationId);
        
        if (selectedConvs.length === 0) {
            // Export all user's conversations
            await this._exportAllToJournal();
        } else {
            await this._exportConversationsToJournal(selectedConvs);
        }
    }

    async _exportAllToJournal() {
        const currentUser = game.user;
        let content = `<h1>Cyphur Chat Export</h1>\n<p>Exported: ${new Date().toLocaleString()}</p>\n<hr>\n`;

        // Export private chats
        if (DataManager.privateChats) {
            for (const [key, chat] of DataManager.privateChats) {
                if (!chat.users?.includes(currentUser.id)) continue;
                const otherUserId = chat.users.find(id => id !== currentUser.id);
                const otherUser = game.users.get(otherUserId);
                content += `<h2>Private Chat with ${otherUser?.name || 'Unknown'}</h2>\n`;
                content += this._formatMessagesForExport(chat.history || []);
            }
        }

        // Export group chats
        if (DataManager.groupChats) {
            for (const [key, group] of DataManager.groupChats) {
                if (!group.members?.includes(currentUser.id)) continue;
                content += `<h2>Group: ${group.name}</h2>\n`;
                content += this._formatMessagesForExport(group.history || []);
            }
        }

        // Create journal entry
        await JournalEntry.create({
            name: `Cyphur Export - ${new Date().toLocaleDateString()}`,
            pages: [{
                name: 'Chat History',
                type: 'text',
                text: { content, format: 1 }
            }]
        });

        ui.notifications.info(game.i18n.localize('CYPHUR.Export.JournalSuccess') || 'Chat exported to journal');
    }

    async _exportConversationsToJournal(convIds) {
        // Similar to above but only for selected conversations
        ui.notifications.info('Exporting selected conversations...');
        await this._exportAllToJournal(); // Simplified for now
    }

    _formatMessagesForExport(messages) {
        if (!messages || messages.length === 0) return '<p><em>No messages</em></p>\n';
        
        let html = '<ul style="list-style: none; padding: 0;">\n';
        for (const msg of messages) {
            const sender = game.users.get(msg.senderId)?.name || msg.senderName || 'Unknown';
            const time = new Date(msg.timestamp).toLocaleString();
            const content = msg.messageContent || msg.content || '';
            html += `<li><strong>[${time}] ${sender}:</strong> ${content}</li>\n`;
        }
        html += '</ul>\n';
        return html;
    }

    async _onExportLocal() {
        const currentUser = game.user;
        let exportData = {
            exportDate: new Date().toISOString(),
            user: currentUser.name,
            conversations: []
        };

        // Export private chats
        if (DataManager.privateChats) {
            for (const [key, chat] of DataManager.privateChats) {
                if (!chat.users?.includes(currentUser.id)) continue;
                const otherUserId = chat.users.find(id => id !== currentUser.id);
                const otherUser = game.users.get(otherUserId);
                exportData.conversations.push({
                    type: 'private',
                    name: `Chat with ${otherUser?.name || 'Unknown'}`,
                    messages: (chat.history || []).map(m => ({
                        sender: game.users.get(m.senderId)?.name || m.senderName || 'Unknown',
                        time: new Date(m.timestamp).toLocaleString(),
                        content: (m.messageContent || m.content || '').replace(/<[^>]*>/g, '')
                    }))
                });
            }
        }

        // Export group chats
        if (DataManager.groupChats) {
            for (const [key, group] of DataManager.groupChats) {
                if (!group.members?.includes(currentUser.id)) continue;
                exportData.conversations.push({
                    type: 'group',
                    name: group.name,
                    messages: (group.history || []).map(m => ({
                        sender: game.users.get(m.senderId)?.name || m.senderName || 'Unknown',
                        time: new Date(m.timestamp).toLocaleString(),
                        content: (m.messageContent || m.content || '').replace(/<[^>]*>/g, '')
                    }))
                });
            }
        }

        // Create readable text format
        let textContent = `CYPHUR CHAT EXPORT\n`;
        textContent += `Exported: ${new Date().toLocaleString()}\n`;
        textContent += `User: ${currentUser.name}\n`;
        textContent += `${'='.repeat(50)}\n\n`;

        for (const conv of exportData.conversations) {
            textContent += `\n${conv.type.toUpperCase()}: ${conv.name}\n`;
            textContent += `${'-'.repeat(40)}\n`;
            for (const msg of conv.messages) {
                textContent += `[${msg.time}] ${msg.sender}: ${msg.content}\n`;
            }
            textContent += '\n';
        }

        // Download as text file
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyphur-export-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        ui.notifications.info(game.i18n.localize('CYPHUR.Export.LocalSuccess') || 'Chat exported to file');
    }

    // GM-only methods
    _onOpenGMTools() {
        if (!game.user.isGM) return;
        UIManager.openGMModWindow();
    }

    _onOpenGroupManager() {
        if (!game.user.isGM) return;
        UIManager.openGroupManager();
    }

    _onOpenMonitor() {
        if (!game.user.isGM) return;
        UIManager.openGMMonitor();
    }

    /**
     * Set a global background for all chats
     */
    async _onSetGlobalBackground() {
        if (!game.user.isGM) return;

        const picker = new FilePicker({
            type: 'image',
            current: game.settings.get(MODULE_ID, 'gmBackgrounds')?.global || '',
            callback: async (path) => {
                if (path) {
                    const gmBgs = game.settings.get(MODULE_ID, 'gmBackgrounds') || {};
                    gmBgs.global = path;
                    await game.settings.set(MODULE_ID, 'gmBackgrounds', gmBgs);
                    ui.notifications.info('Global background set for all chats');
                }
            }
        });
        picker.render(true);
    }

    /**
     * Set a background for a specific user's chats
     * @param {string} userId - User ID to set background for
     */
    async _onSetUserBackground(userId) {
        if (!game.user.isGM) return;

        const user = game.users.get(userId);
        if (!user) return;

        const gmBgs = game.settings.get(MODULE_ID, 'gmBackgrounds') || {};
        const currentBg = gmBgs.perUser?.[userId] || '';

        const picker = new FilePicker({
            type: 'image',
            current: currentBg,
            callback: async (path) => {
                if (!gmBgs.perUser) gmBgs.perUser = {};
                
                if (path) {
                    gmBgs.perUser[userId] = path;
                    ui.notifications.info(`Background set for ${user.name}'s chats`);
                } else {
                    delete gmBgs.perUser[userId];
                    ui.notifications.info(`Background removed for ${user.name}'s chats`);
                }
                
                await game.settings.set(MODULE_ID, 'gmBackgrounds', gmBgs);
                
                // Reload DataManager backgrounds
                if (DataManager.loadBackgroundSettings) {
                    await DataManager.loadBackgroundSettings();
                }
            }
        });
        picker.render(true);
    }

    /**
     * Bring window to front when opened
     */
    bringToFront() {
        if (this.element) {
            this.element.style.zIndex = Math.max(100, ...Array.from(document.querySelectorAll('.window-app')).map(w => parseInt(w.style.zIndex) || 0)) + 1;
            this.element.classList.add('window-focus');
        }
    }

    /**
     * Add Quantum Portal trigger button to window header
     */
    _addQuantumPortal() {
        if (!this.element) return;
        
        const header = this.element.querySelector('.window-header');
        if (!header || header.querySelector('.quantum-portal-trigger')) return;
        
        const portalBtn = document.createElement('button');
        portalBtn.className = 'quantum-portal-trigger';
        portalBtn.type = 'button';
        portalBtn.title = game.i18n.localize('CYPHUR.QuantumPortal.Tooltip') || 'Open in Quantum Portal';
        portalBtn.innerHTML = `<img src="modules/${MODULE_ID}/rnk-codex.jpg" alt="Quantum Portal" class="quantum-logo spinning">`;
        
        portalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            QuantumPortal.openPortal(this);
        });
        
        const closeBtn = header.querySelector('.close') || header.querySelector('button');
        if (closeBtn) {
            header.insertBefore(portalBtn, closeBtn);
        } else {
            header.appendChild(portalBtn);
        }
    }

    /**
     * Add logo to window header area
     */
    _addHeaderLogo() {
        if (!this.element) return;
        
        const windowContent = this.element.querySelector('.window-content');
        if (!windowContent || windowContent.querySelector('.cyphur-header-logo')) return;
        
        const logoContainer = document.createElement('div');
        logoContainer.className = 'cyphur-header-logo';
        logoContainer.innerHTML = `<img src="modules/${MODULE_ID}/rnk-codex.jpg" alt="RNK Cyphur" title="RNK Cyphur - Secure Communications">`;
        
        windowContent.insertBefore(logoContainer, windowContent.firstChild);
    }
}

