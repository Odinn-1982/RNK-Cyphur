/**
 * RNK Cyphur - GM Monitor Window (Stealth Edition)
 * Secretly monitors all private and group chat activity
 * Players are not aware this monitoring is taking place
 * Supports Foundry VTT v11, v12, and v13
 */

import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { Utils } from './Utils.js';
import { MODULE_ID, SOCKET_EVENTS } from './Constants.js';
import { QuantumPortal } from './QuantumPortal.js';

// Version-compatible Application class
let AppClass;
if (typeof foundry !== 'undefined' && foundry.applications?.api?.ApplicationV2) {
    const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
    AppClass = HandlebarsApplicationMixin(ApplicationV2);
} else {
    AppClass = Application;
}

export class GMMonitorWindow extends AppClass {

    constructor(options = {}) {
        super(options);
        this._filterType = 'all'; // 'all', 'private', 'group', 'flagged'
        this._searchQuery = '';
        this._sortOrder = 'newest'; // 'newest', 'oldest', 'sender', 'type'
        this._showImages = true;
        this._autoScroll = true;
        this._selectedUsers = new Set();
        this._flaggedMessages = new Set();
        this._stealthMode = true; // True by default - players never know
        
        // Real-time update listener
        this._boundUpdateHandler = this._onNewMessage.bind(this);
    }

    static DEFAULT_OPTIONS = {
        id: 'cyphur-gm-monitor',
        classes: ['rnk-cyphur', 'cyphur-gm-monitor', 'stealth-monitor', 'cyphur-window'],
        window: { 
            title: 'CYPHUR.GMMonitorTitle', 
            resizable: true,
            minimizable: true
        },
        tag: 'div',
        position: { width: 850, height: 700 }
    };

    // v11/v12 compatibility
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'cyphur-gm-monitor',
            classes: ['rnk-cyphur', 'cyphur-gm-monitor', 'stealth-monitor', 'cyphur-window'],
            title: game.i18n.localize('CYPHUR.GMMonitorTitle'),
            template: `modules/${MODULE_ID}/templates/gm-monitor.hbs`,
            width: 850,
            height: 700,
            resizable: true,
            minimizable: true
        });
    }

    get title() {
        const baseTitle = game.i18n.localize('CYPHUR.GMMonitorTitle');
        const unread = this._getUnreadCount();
        return unread > 0 ? `${baseTitle} (${unread} new)` : baseTitle;
    }

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/gm-monitor.hbs` }
    };

    // v11/v12 compatibility
    async getData() {
        return this._prepareContext({});
    }

    /**
     * Get count of unread/new messages since last view
     */
    _getUnreadCount() {
        const lastViewed = DataManager.getGMSetting('lastMonitorView') || 0;
        return DataManager.interceptedMessages.filter(m => 
            (m.interceptedAt || m.messageData?.timestamp) > lastViewed
        ).length;
    }

    /**
     * Get all unique users involved in intercepted messages
     */
    _getInvolvedUsers() {
        const userIds = new Set();
        DataManager.interceptedMessages.forEach(m => {
            if (m.senderId) userIds.add(m.senderId);
            if (m.recipientId) userIds.add(m.recipientId);
            if (m.participants) m.participants.forEach(p => userIds.add(p));
        });
        
        return Array.from(userIds)
            .map(id => game.users.get(id))
            .filter(u => u && !u.isGM)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get statistics about monitored messages
     */
    _getStats() {
        const messages = DataManager.interceptedMessages;
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        const today = new Date().setHours(0, 0, 0, 0);
        
        return {
            total: messages.length,
            private: messages.filter(m => !m.groupId).length,
            group: messages.filter(m => !!m.groupId).length,
            images: messages.filter(m => m.messageData?.imageUrl).length,
            lastHour: messages.filter(m => (m.interceptedAt || m.messageData?.timestamp) > hourAgo).length,
            today: messages.filter(m => (m.interceptedAt || m.messageData?.timestamp) > today).length,
            flagged: this._flaggedMessages.size
        };
    }

    async _prepareContext(options) {
        let messages = [...DataManager.interceptedMessages];

        // Apply user filter
        if (this._selectedUsers.size > 0) {
            messages = messages.filter(m => 
                this._selectedUsers.has(m.senderId) || 
                this._selectedUsers.has(m.recipientId) ||
                (m.participants && m.participants.some(p => this._selectedUsers.has(p)))
            );
        }

        // Apply type filter
        if (this._filterType === 'private') {
            messages = messages.filter(m => !m.groupId);
        } else if (this._filterType === 'group') {
            messages = messages.filter(m => m.groupId);
        } else if (this._filterType === 'flagged') {
            messages = messages.filter(m => this._flaggedMessages.has(m.id));
        } else if (this._filterType === 'images') {
            messages = messages.filter(m => m.messageData?.imageUrl);
        }

        // Apply search
        if (this._searchQuery) {
            const query = this._searchQuery.toLowerCase();
            messages = messages.filter(m => {
                const content = (m.messageData?.messageContent || '').toLowerCase();
                const sender = (m.messageData?.senderName || '').toLowerCase();
                const group = (m.groupName || '').toLowerCase();
                return content.includes(query) || sender.includes(query) || group.includes(query);
            });
        }

        // Apply sort
        switch (this._sortOrder) {
            case 'oldest':
                messages.sort((a, b) => (a.interceptedAt || 0) - (b.interceptedAt || 0));
                break;
            case 'sender':
                messages.sort((a, b) => (a.messageData?.senderName || '').localeCompare(b.messageData?.senderName || ''));
                break;
            case 'type':
                messages.sort((a, b) => (a.groupId ? 1 : 0) - (b.groupId ? 1 : 0));
                break;
            case 'newest':
            default:
                messages.sort((a, b) => (b.interceptedAt || 0) - (a.interceptedAt || 0));
                break;
        }

        // Enrich messages
        messages = messages.map(m => {
            const sender = game.users.get(m.senderId);
            const recipient = m.recipientId ? game.users.get(m.recipientId) : null;
            
            // Build participant list for group chats
            let participantNames = [];
            if (m.groupId && m.participants) {
                participantNames = m.participants
                    .map(id => game.users.get(id)?.name)
                    .filter(n => n);
            }
            
            return {
                id: m.id,
                timestamp: Utils.formatFullTimestamp(m.messageData?.timestamp || m.interceptedAt),
                relativeTime: Utils.formatRelativeTime(m.messageData?.timestamp || m.interceptedAt),
                rawTimestamp: m.messageData?.timestamp || m.interceptedAt,
                senderName: m.messageData?.senderName || sender?.name || 'Unknown',
                senderAvatar: m.messageData?.senderImg || sender?.avatar,
                senderId: m.senderId,
                recipientName: recipient?.name || null,
                recipientId: m.recipientId,
                groupName: m.groupName || null,
                groupId: m.groupId,
                isGroup: !!m.groupId,
                participantNames,
                content: m.messageData?.messageContent || '',
                contentPreview: (m.messageData?.messageContent || '').replace(/<[^>]*>/g, '').substring(0, 150),
                hasImage: !!m.messageData?.imageUrl,
                imageUrl: m.messageData?.imageUrl,
                isFlagged: this._flaggedMessages.has(m.id),
                isNew: (m.interceptedAt || m.messageData?.timestamp) > (DataManager.getGMSetting('lastMonitorView') || 0)
            };
        });

        const stats = this._getStats();
        const involvedUsers = this._getInvolvedUsers();

        return {
            messages,
            filterType: this._filterType,
            sortOrder: this._sortOrder,
            searchQuery: this._searchQuery,
            showImages: this._showImages,
            autoScroll: this._autoScroll,
            stealthMode: this._stealthMode,
            messageCount: messages.length,
            totalCount: DataManager.interceptedMessages.length,
            stats,
            involvedUsers,
            selectedUsers: Array.from(this._selectedUsers),
            isGM: game.user.isGM
        };
    }

    _onRender(context, options) {
        super._onRender?.(context, options);
        this._setupEventListeners(this.element);
        
        // Quantum Portal integration
        this.bringToFront?.();
        this._addQuantumPortal?.();
        this._addHeaderLogo?.();
        
        // Mark as viewed - update last view time
        DataManager.setGMSetting('lastMonitorView', Date.now());
    }

    // v11/v12 compatibility
    activateListeners(html) {
        super.activateListeners?.(html);
        this._setupEventListeners(html[0] || html);
    }

    _setupEventListeners(element) {
        if (!element) return;

        // Filter buttons
        element.querySelectorAll('.cyphur-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._filterType = btn.dataset.filter;
                this.render(true);
            });
        });

        // Sort selector
        const sortSelect = element.querySelector('.cyphur-sort-select');
        if (sortSelect) {
            sortSelect.value = this._sortOrder;
            sortSelect.addEventListener('change', (e) => {
                this._sortOrder = e.target.value;
                this.render(true);
            });
        }

        // User filter checkboxes
        element.querySelectorAll('.cyphur-user-filter').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const userId = e.target.dataset.userId;
                if (e.target.checked) {
                    this._selectedUsers.add(userId);
                } else {
                    this._selectedUsers.delete(userId);
                }
                this.render(true);
            });
        });

        // Clear user filter
        element.querySelector('[data-action="clearUserFilter"]')?.addEventListener('click', () => {
            this._selectedUsers.clear();
            this.render(true);
        });

        // Search
        const searchInput = element.querySelector('.cyphur-monitor-search');
        if (searchInput) {
            searchInput.value = this._searchQuery;
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this._searchQuery = e.target.value.trim();
                this.render(true);
            }, 300));
        }

        // Toggle options
        element.querySelector('[data-action="toggleImages"]')?.addEventListener('click', () => {
            this._showImages = !this._showImages;
            this.render(true);
        });

        element.querySelector('[data-action="toggleAutoScroll"]')?.addEventListener('click', () => {
            this._autoScroll = !this._autoScroll;
            this.render(true);
        });

        // Clear button
        element.querySelector('[data-action="clearLog"]')?.addEventListener('click', async () => {
            const confirmed = await Dialog.confirm({
                title: game.i18n.localize('CYPHUR.ClearMonitorTitle'),
                content: game.i18n.localize('CYPHUR.ClearMonitorConfirm')
            });
            
            if (confirmed) {
                DataManager.interceptedMessages = [];
                this._flaggedMessages.clear();
                this.render(true);
            }
        });

        // Export button
        element.querySelector('[data-action="exportLog"]')?.addEventListener('click', () => {
            this._exportMonitorLog();
        });

        // Export to Journal
        element.querySelector('[data-action="exportToJournal"]')?.addEventListener('click', () => {
            this._exportToJournal();
        });

        // Flag/unflag messages
        element.querySelectorAll('.cyphur-flag-message').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const msgId = btn.dataset.messageId;
                if (this._flaggedMessages.has(msgId)) {
                    this._flaggedMessages.delete(msgId);
                } else {
                    this._flaggedMessages.add(msgId);
                }
                this.render(true);
            });
        });

        // Message expansion
        element.querySelectorAll('.cyphur-monitor-message').forEach(msg => {
            msg.addEventListener('click', () => {
                msg.classList.toggle('expanded');
            });
        });

        // Open chat buttons (stealth - opens as GM, not revealing monitoring)
        element.querySelectorAll('.cyphur-open-chat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const msgId = btn.dataset.messageId;
                const intercepted = DataManager.interceptedMessages.find(m => m.id === msgId);
                
                if (intercepted) {
                    if (intercepted.groupId) {
                        // GM joins group silently - already in groups as observer
                        UIManager.openGroupChat(intercepted.groupId);
                    } else if (intercepted.senderId && intercepted.recipientId) {
                        // Open direct chat with sender
                        const otherUser = intercepted.senderId === game.user.id 
                            ? intercepted.recipientId 
                            : intercepted.senderId;
                        UIManager.openChatFor(otherUser);
                    }
                }
            });
        });

        // Send message as user (GM impersonation for moderation)
        element.querySelectorAll('.cyphur-impersonate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                const user = game.users.get(userId);
                
                if (!user) return;
                
                const content = await Dialog.prompt({
                    title: game.i18n.localize('CYPHUR.ImpersonateTitle'),
                    content: `<p>${game.i18n.format('CYPHUR.ImpersonatePrompt', { name: user.name })}</p>
                              <textarea class="cyphur-impersonate-input" style="width:100%;height:100px;"></textarea>`,
                    label: game.i18n.localize('CYPHUR.Send'),
                    callback: (html) => html.find('.cyphur-impersonate-input').val()
                });
                
                if (content) {
                    // This would need special GM privilege handling
                    ui.notifications.info(game.i18n.localize('CYPHUR.ImpersonationNotImplemented'));
                }
            });
        });

        // View user's chat history
        element.querySelectorAll('.cyphur-view-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const userId = btn.dataset.userId;
                this._selectedUsers.clear();
                this._selectedUsers.add(userId);
                this._filterType = 'all';
                this.render(true);
            });
        });

        // Auto-scroll to bottom if enabled
        if (this._autoScroll) {
            const messageList = element.querySelector('.cyphur-monitor-messages');
            if (messageList) {
                messageList.scrollTop = messageList.scrollHeight;
            }
        }

        // Register for real-time updates
        this._registerUpdateListener();
    }

    /**
     * Register listener for real-time message updates
     */
    _registerUpdateListener() {
        // Listen for new intercepted messages
        if (!this._listenerRegistered) {
            Hooks.on('cyphurMessageIntercepted', this._boundUpdateHandler);
            this._listenerRegistered = true;
        }
    }

    /**
     * Handle new message interception
     */
    _onNewMessage(messageData) {
        // Update title with unread count
        if (this.element) {
            const titleEl = this.element.querySelector('.window-title');
            if (titleEl) {
                titleEl.textContent = this.title;
            }
        }
        
        // Re-render if auto-scroll enabled
        if (this._autoScroll && this.rendered) {
            this.render(true);
        }
    }

    /**
     * Export monitor log to file
     */
    _exportMonitorLog() {
        let messages = DataManager.interceptedMessages;
        
        // Apply current filters
        if (this._selectedUsers.size > 0) {
            messages = messages.filter(m => 
                this._selectedUsers.has(m.senderId) || 
                this._selectedUsers.has(m.recipientId)
            );
        }
        
        if (this._filterType === 'private') {
            messages = messages.filter(m => !m.groupId);
        } else if (this._filterType === 'group') {
            messages = messages.filter(m => m.groupId);
        } else if (this._filterType === 'flagged') {
            messages = messages.filter(m => this._flaggedMessages.has(m.id));
        }

        const exportData = messages.map(m => ({
            timestamp: Utils.formatFullTimestamp(m.messageData?.timestamp || m.interceptedAt),
            type: m.groupId ? 'GROUP' : 'PRIVATE',
            sender: m.messageData?.senderName || 'Unknown',
            recipient: m.groupName || (m.recipientId ? game.users.get(m.recipientId)?.name : 'Unknown'),
            content: (m.messageData?.messageContent || '').replace(/<[^>]*>/g, ''),
            hasImage: !!m.messageData?.imageUrl,
            flagged: this._flaggedMessages.has(m.id)
        }));

        const filename = `cyphur-monitor-export-${new Date().toISOString().split('T')[0]}.json`;
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        ui.notifications.info(game.i18n.format('CYPHUR.ExportComplete', { count: exportData.length }));
    }

    /**
     * Export monitor log to Journal Entry
     */
    async _exportToJournal() {
        let messages = DataManager.interceptedMessages;
        
        // Apply current filters
        if (this._filterType === 'flagged') {
            messages = messages.filter(m => this._flaggedMessages.has(m.id));
        }

        if (messages.length === 0) {
            ui.notifications.warn(game.i18n.localize('CYPHUR.NoMessagesToExport'));
            return;
        }

        // Build HTML content
        let content = `<h2>Cyphur Monitor Log - ${new Date().toLocaleDateString()}</h2>`;
        content += `<p><em>Total Messages: ${messages.length}</em></p><hr>`;

        const sorted = [...messages].sort((a, b) => 
            (a.messageData?.timestamp || a.interceptedAt || 0) - 
            (b.messageData?.timestamp || b.interceptedAt || 0)
        );

        for (const m of sorted) {
            const timestamp = Utils.formatFullTimestamp(m.messageData?.timestamp || m.interceptedAt);
            const sender = m.messageData?.senderName || 'Unknown';
            const type = m.groupId ? `[GROUP: ${m.groupName || 'Unknown'}]` : '[PRIVATE]';
            const recipient = m.recipientId ? game.users.get(m.recipientId)?.name : '';
            const flagged = this._flaggedMessages.has(m.id) ? '⚑ ' : '';
            
            content += `<p><strong>${flagged}${timestamp}</strong> ${type}</p>`;
            content += `<p><strong>${sender}</strong>${recipient ? ` → ${recipient}` : ''}:</p>`;
            content += `<blockquote>${m.messageData?.messageContent || ''}</blockquote>`;
            
            if (m.messageData?.imageUrl) {
                content += `<p><img src="${m.messageData.imageUrl}" style="max-width:200px;"></p>`;
            }
            content += `<hr>`;
        }

        // Create Journal Entry
        const journal = await JournalEntry.create({
            name: `Cyphur Monitor Log - ${new Date().toLocaleString()}`,
            ownership: { default: 0 }, // GM only
            pages: [{
                name: 'Monitor Log',
                type: 'text',
                text: { content, format: 1 }
            }]
        });

        ui.notifications.info(game.i18n.format('CYPHUR.JournalExportComplete', { name: journal.name }));
        journal.sheet.render(true);
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
        portalBtn.innerHTML = `<img src="modules/rnk-cyphur/rnk-codex.jpg" alt="Quantum Portal" class="quantum-logo spinning">`;
        
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
        logoContainer.innerHTML = `<img src="modules/rnk-cyphur/rnk-codex.jpg" alt="RNK Cyphur" title="RNK Cyphur - Stealth Monitor">`;
        
        windowContent.insertBefore(logoContainer, windowContent.firstChild);
    }

    close(options) {
        // Unregister listener
        if (this._listenerRegistered) {
            Hooks.off('cyphurMessageIntercepted', this._boundUpdateHandler);
            this._listenerRegistered = false;
        }
        
        UIManager.gmMonitorWindow = null;
        return super.close(options);
    }
}
