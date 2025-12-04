/**
 * RNK Cyphur - GM Moderation Window
 * Advanced moderation tools for GMs
 * Supports Foundry VTT v11, v12, and v13
 */

import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { RNKCyphur } from './RNKCyphur.js';
import { Utils } from './Utils.js';
import { QuantumPortal } from './QuantumPortal.js';
import { MODULE_ID } from './Constants.js';

// Version-compatible Application class
let AppClass;
if (typeof foundry !== 'undefined' && foundry.applications?.api?.ApplicationV2) {
    const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
    AppClass = HandlebarsApplicationMixin(ApplicationV2);
} else {
    AppClass = Application;
}

export class GMModWindow extends AppClass {

    static DEFAULT_OPTIONS = {
        id: 'cyphur-gm-mod-window',
        classes: ['rnk-cyphur', 'cyphur-gm-mod', 'cyphur-window'],
        window: { title: 'CYPHUR.GMModTitle', resizable: true },
        tag: 'div',
        position: { width: 550, height: 500 }
    };

    // v11/v12 compatibility
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'cyphur-gm-mod-window',
            classes: ['rnk-cyphur', 'cyphur-gm-mod', 'cyphur-window'],
            title: game.i18n.localize('CYPHUR.GMModTitle'),
            template: `modules/${MODULE_ID}/templates/gm-mod.hbs`,
            width: 550,
            height: 500,
            resizable: true
        });
    }

    get title() {
        return game.i18n.localize('CYPHUR.GMModTitle');
    }

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/gm-mod.hbs` }
    };

    // v11/v12 compatibility
    async getData() {
        return this._prepareContext({});
    }

    async _prepareContext(options) {
        // Get all conversations
        const privateChats = Array.from(DataManager.privateChats.entries()).map(([key, chat]) => {
            const users = chat.users.map(id => game.users.get(id)?.name || 'Unknown').join(' ↔ ');
            return {
                id: key,
                name: users,
                type: 'private',
                messageCount: chat.history?.length || 0
            };
        });

        const groupChats = Array.from(DataManager.groupChats.values()).map(group => ({
            id: group.id,
            name: group.name,
            type: 'group',
            messageCount: group.history?.length || 0,
            memberCount: group.members?.length || 0
        }));

        return {
            privateChats,
            groupChats,
            totalPrivate: privateChats.length,
            totalGroups: groupChats.length
        };
    }

    _onRender(context, options) {
        super._onRender?.(context, options);
        this._setupEventListeners(this.element);
        
        // Quantum Portal integration
        this.bringToFront?.();
        this._addQuantumPortal?.();
        this._addHeaderLogo?.();
    }

    // v11/v12 compatibility
    activateListeners(html) {
        super.activateListeners?.(html);
        this._setupEventListeners(html[0] || html);
    }

    _setupEventListeners(element) {
        if (!element) return;

        // Clear conversation buttons
        element.querySelectorAll('[data-action="clearConversation"]').forEach(btn => {
            btn.addEventListener('click', (e) => this._onClearConversation(e));
        });

        // Delete conversation buttons
        element.querySelectorAll('[data-action="deleteConversation"]').forEach(btn => {
            btn.addEventListener('click', (e) => this._onDeleteConversation(e));
        });

        // View conversation buttons
        element.querySelectorAll('[data-action="viewConversation"]').forEach(btn => {
            btn.addEventListener('click', (e) => this._onViewConversation(e));
        });

        // Clear all buttons
        element.querySelector('[data-action="clearAllPrivate"]')?.addEventListener('click', () => this._onClearAllPrivate());
        element.querySelector('[data-action="clearAllGroups"]')?.addEventListener('click', () => this._onClearAllGroups());

        // Open monitor button
        element.querySelector('[data-action="openMonitor"]')?.addEventListener('click', () => {
            UIManager.openGMMonitor();
        });

        // Refresh button
        element.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
            this.render(true);
        });
    }

    async _onClearConversation(event) {
        const item = event.currentTarget.closest('[data-conversation-id]');
        const convId = item?.dataset.conversationId;
        const type = item?.dataset.type;
        
        if (!convId) return;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize('CYPHUR.ClearConversationTitle'),
            content: game.i18n.localize('CYPHUR.ClearConversationConfirm')
        });

        if (confirmed) {
            DataManager.clearConversation(convId, type === 'group');
            
            if (type === 'group') {
                await DataManager.saveGroupChats();
            } else {
                await DataManager.savePrivateChats();
            }
            
            ui.notifications.info(game.i18n.localize('CYPHUR.ConversationCleared'));
            this.render(true);
        }
    }

    async _onDeleteConversation(event) {
        const item = event.currentTarget.closest('[data-conversation-id]');
        const convId = item?.dataset.conversationId;
        const type = item?.dataset.type;
        
        if (!convId) return;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize('CYPHUR.DeleteConversationTitle'),
            content: game.i18n.localize('CYPHUR.DeleteConversationConfirm')
        });

        if (confirmed) {
            if (type === 'group') {
                await RNKCyphur.deleteGroup(convId);
            } else {
                DataManager.privateChats.delete(convId);
                await DataManager.savePrivateChats();
            }
            
            ui.notifications.info(game.i18n.localize('CYPHUR.ConversationDeleted'));
            this.render(true);
        }
    }

    _onViewConversation(event) {
        const item = event.currentTarget.closest('[data-conversation-id]');
        const convId = item?.dataset.conversationId;
        const type = item?.dataset.type;
        
        if (!convId) return;

        if (type === 'group') {
            UIManager.openGroupChat(convId);
        } else {
            // Extract other user ID from private chat key
            const parts = convId.split('-');
            const otherUserId = parts.find(id => id !== game.user.id);
            if (otherUserId) UIManager.openChatFor(otherUserId);
        }
    }

    async _onClearAllPrivate() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize('CYPHUR.ClearAllPrivateTitle'),
            content: game.i18n.localize('CYPHUR.ClearAllPrivateConfirm')
        });

        if (confirmed) {
            for (const [key, chat] of DataManager.privateChats.entries()) {
                chat.history = [];
            }
            await DataManager.savePrivateChats();
            
            ui.notifications.info(game.i18n.localize('CYPHUR.AllPrivateCleared'));
            this.render(true);
        }
    }

    async _onClearAllGroups() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize('CYPHUR.ClearAllGroupsTitle'),
            content: game.i18n.localize('CYPHUR.ClearAllGroupsConfirm')
        });

        if (confirmed) {
            for (const [id, group] of DataManager.groupChats.entries()) {
                group.history = [];
            }
            await DataManager.saveGroupChats();
            
            ui.notifications.info(game.i18n.localize('CYPHUR.AllGroupsCleared'));
            this.render(true);
        }
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
        logoContainer.innerHTML = `<img src="modules/rnk-cyphur/rnk-codex.jpg" alt="RNK Cyphur" title="RNK Cyphur - GM Moderation">`;
        
        windowContent.insertBefore(logoContainer, windowContent.firstChild);
    }
}
