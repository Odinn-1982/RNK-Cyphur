/**
 * RNK Cyphur - Group Manager Window
 * GM tool for managing group chats/channels
 * Supports Foundry VTT v11, v12, and v13
 */

import { DataManager } from './DataManager.js';
import { UIManager } from './UIManager.js';
import { SocketHandler } from './SocketHandler.js';
import { RNKCyphur } from './RNKCyphur.js';
import { MODULE_ID } from './Constants.js';
import { QuantumPortal } from './QuantumPortal.js';

// Version-compatible Application class
let AppClass;
if (typeof foundry !== 'undefined' && foundry.applications?.api?.ApplicationV2) {
    const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
    AppClass = HandlebarsApplicationMixin(ApplicationV2);
} else {
    AppClass = Application;
}

export class GroupManagerWindow extends AppClass {

    static DEFAULT_OPTIONS = {
        id: 'cyphur-group-manager',
        classes: ['rnk-cyphur', 'cyphur-group-manager', 'cyphur-window'],
        window: { title: 'CYPHUR.GroupManagerTitle', resizable: true },
        tag: 'form',
        position: { width: 600, height: 550 }
    };

    // v11/v12 compatibility - static defaultOptions getter
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions || {}, {
            id: 'cyphur-group-manager',
            classes: ['rnk-cyphur', 'cyphur-group-manager', 'cyphur-window'],
            template: 'modules/rnk-cyphur/templates/group-manager.hbs',
            title: 'CYPHUR.GroupManagerTitle',
            width: 600,
            height: 550,
            resizable: true
        });
    }

    get title() {
        return game.i18n.localize(this.options?.window?.title || 'CYPHUR.GroupManagerTitle');
    }

    static PARTS = {
        form: { template: 'modules/rnk-cyphur/templates/group-manager.hbs' }
    };

    // v11/v12 compatibility - getData method (alias for _prepareContext)
    async getData() {
        return this._prepareContext();
    }

    async _prepareContext(options) {
        const groups = Array.from(DataManager.groupChats.values()).map(group => ({
            id: group.id,
            name: group.name,
            memberCount: group.members.length,
            messageCount: group.history?.length || 0,
            members: group.members.map(id => {
                const user = game.users.get(id);
                return user ? { id: user.id, name: user.name, isOnline: user.active } : null;
            }).filter(Boolean),
            createdAt: group.createdAt ? new Date(group.createdAt).toLocaleDateString() : 'Unknown'
        }));

        const users = game.users.map(u => ({
            id: u.id,
            name: u.name,
            isOnline: u.active,
            isGM: u.isGM
        }));

        return {
            groups,
            users,
            isGM: game.user.isGM
        };
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

        // Quantum Portal integration
        this.bringToFront();
        this._addQuantumPortal();
        this._addHeaderLogo();

        // Group selection
        element.querySelectorAll('.cyphur-group-item input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => this._updateSelectionState());
        });

        // Action buttons
        element.querySelector('[data-action="openSelected"]')?.addEventListener('click', () => this._onOpenSelected());
        element.querySelector('[data-action="exportSelected"]')?.addEventListener('click', () => this._onExportSelected());
        element.querySelector('[data-action="deleteSelected"]')?.addEventListener('click', () => this._onDeleteSelected());
        element.querySelector('[data-action="createGroup"]')?.addEventListener('click', () => this._onCreateGroup());

        // Edit buttons
        element.querySelectorAll('.cyphur-edit-group').forEach(btn => {
            btn.addEventListener('click', (e) => this._onEditGroup(e));
        });
    }

    _updateSelectionState() {
        const selected = this.element.querySelectorAll('.cyphur-group-item input[type="checkbox"]:checked');
        const actionBtns = this.element.querySelectorAll('.cyphur-selection-actions button');
        actionBtns.forEach(btn => btn.disabled = selected.length === 0);
    }

    async _onOpenSelected() {
        const selected = this.element.querySelectorAll('.cyphur-group-item input[type="checkbox"]:checked');
        if (selected.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.SelectGroupOpen'));
        }

        selected.forEach(cb => {
            const groupId = cb.closest('.cyphur-group-item').dataset.groupId;
            UIManager.openGroupChat(groupId);
        });
    }

    async _onExportSelected() {
        const selected = this.element.querySelectorAll('.cyphur-group-item input[type="checkbox"]:checked');
        if (selected.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.SelectGroupExport'));
        }

        selected.forEach(cb => {
            const groupId = cb.closest('.cyphur-group-item').dataset.groupId;
            const group = DataManager.groupChats.get(groupId);
            if (group) {
                const filename = `cyphur-${group.name.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.txt`;
                import('./Utils.js').then(({ Utils }) => {
                    Utils.exportMessages(group.history || [], filename);
                });
            }
        });
    }

    async _onDeleteSelected() {
        const selected = this.element.querySelectorAll('.cyphur-group-item input[type="checkbox"]:checked');
        if (selected.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.SelectGroupDelete'));
        }

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize('CYPHUR.DeleteConfirmTitle'),
            content: game.i18n.format('CYPHUR.DeleteConfirmContent', { count: selected.length })
        });

        if (confirmed) {
            for (const cb of selected) {
                const groupId = cb.closest('.cyphur-group-item').dataset.groupId;
                await RNKCyphur.deleteGroup(groupId);
            }
            this.render(true);
        }
    }

    async _onCreateGroup() {
        const nameInput = this.element.querySelector('input[name="newGroupName"]');
        const name = nameInput?.value?.trim();

        if (!name) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.GroupNameEmpty'));
        }

        const selectedMembers = Array.from(
            this.element.querySelectorAll('.cyphur-member-select input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        if (selectedMembers.length === 0) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.SelectAtLeastOneMember'));
        }

        await RNKCyphur.createGroup(name, selectedMembers);
        
        // Clear form
        if (nameInput) nameInput.value = '';
        this.element.querySelectorAll('.cyphur-member-select input[type="checkbox"]').forEach(cb => cb.checked = false);
        
        this.render(true);
    }

    async _onEditGroup(event) {
        const groupId = event.currentTarget.closest('.cyphur-group-item')?.dataset.groupId;
        const group = DataManager.groupChats.get(groupId);
        if (!group) return;

        // Build member checkboxes
        const memberCheckboxes = game.users.map(u => {
            const checked = group.members.includes(u.id) ? 'checked' : '';
            return `<label><input type="checkbox" name="members" value="${u.id}" ${checked}> ${u.name}</label>`;
        }).join('<br>');

        const result = await Dialog.prompt({
            title: game.i18n.format('CYPHUR.EditGroup', { name: group.name }),
            content: `
                <div class="form-group">
                    <label>${game.i18n.localize('CYPHUR.GroupName')}</label>
                    <input type="text" name="name" value="${group.name}" style="width:100%">
                </div>
                <div class="form-group">
                    <label>${game.i18n.localize('CYPHUR.SelectMembers')}</label>
                    <div style="max-height:150px;overflow-y:auto;padding:5px;border:1px solid #666;">
                        ${memberCheckboxes}
                    </div>
                </div>
            `,
            callback: (html) => ({
                name: html.find('[name="name"]').val(),
                members: Array.from(html.find('[name="members"]:checked')).map(el => el.value)
            }),
            rejectClose: false
        });

        if (result && result.name) {
            // Update group
            DataManager.updateGroup(groupId, {
                name: result.name.trim(),
                members: result.members
            });

            if (game.user.isGM) {
                await DataManager.saveGroupChats();
            }

            // Broadcast update
            SocketHandler.broadcastGroupUpdate(groupId, {
                name: result.name.trim(),
                members: result.members
            });

            ui.notifications.info(game.i18n.localize('CYPHUR.GroupUpdated'));
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
        logoContainer.innerHTML = `<img src="modules/${MODULE_ID}/rnk-codex.jpg" alt="RNK Cyphur" title="RNK Cyphur - Group Manager">`;
        
        windowContent.insertBefore(logoContainer, windowContent.firstChild);
    }
}
