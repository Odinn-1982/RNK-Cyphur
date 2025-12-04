/**
 * RNK Cyphur - Settings Window
 * User settings and preferences
 * Supports Foundry VTT v11, v12, and v13
 */

import { MODULE_ID, THEMES, DEFAULTS } from './Constants.js';
import { UIManager } from './UIManager.js';
import { Utils } from './Utils.js';

// Version-compatible Application class
let AppClass;
if (typeof foundry !== 'undefined' && foundry.applications?.api?.ApplicationV2) {
    const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
    AppClass = HandlebarsApplicationMixin(ApplicationV2);
} else {
    AppClass = Application;
}

export class SettingsWindow extends AppClass {

    static DEFAULT_OPTIONS = {
        id: 'cyphur-settings-window',
        classes: ['rnk-cyphur', 'cyphur-settings'],
        window: { title: 'CYPHUR.SettingsTitle', resizable: true },
        tag: 'form',
        position: { width: 500, height: 450 }
    };

    // v11/v12 compatibility - static defaultOptions getter
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions || {}, {
            id: 'cyphur-settings-window',
            classes: ['rnk-cyphur', 'cyphur-settings'],
            template: 'modules/rnk-cyphur/templates/settings-window.hbs',
            title: 'CYPHUR.SettingsTitle',
            width: 500,
            height: 450,
            resizable: true
        });
    }

    get title() {
        return game.i18n.localize(this.options?.window?.title || 'CYPHUR.SettingsTitle');
    }

    static PARTS = {
        form: { template: 'modules/rnk-cyphur/templates/settings-window.hbs' }
    };

    // v11/v12 compatibility - getData method (alias for _prepareContext)
    async getData() {
        return this._prepareContext();
    }

    async _prepareContext(options) {
        const currentTheme = game.user.isGM 
            ? game.settings.get(MODULE_ID, 'globalTheme') 
            : 'none';

        const themes = Object.entries(THEMES).map(([key, theme]) => ({
            key,
            name: theme.name,
            selected: key === currentTheme
        }));

        return {
            isGM: game.user.isGM,
            themes,
            enableSound: game.settings.get(MODULE_ID, 'enableSound'),
            notificationVolume: game.settings.get(MODULE_ID, 'notificationVolume'),
            notificationSound: game.settings.get(MODULE_ID, 'notificationSound'),
            enableDesktopNotifications: game.settings.get(MODULE_ID, 'enableDesktopNotifications'),
            personalBackground: game.settings.get(MODULE_ID, 'personalBackground'),
            shareBackground: game.settings.get(MODULE_ID, 'shareBackground'),
            gmOverrideEnabled: game.user.isGM ? game.settings.get(MODULE_ID, 'gmOverrideEnabled') : false,
            gmOverrideSoundPath: game.user.isGM ? game.settings.get(MODULE_ID, 'gmOverrideSoundPath') : ''
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

        // Theme preview
        element.querySelector('select[name="globalTheme"]')?.addEventListener('change', (e) => {
            UIManager.applyTheme(e.target.value);
        });

        // Sound preview
        element.querySelector('[data-action="previewSound"]')?.addEventListener('click', () => {
            const soundPath = element.querySelector('input[name="notificationSound"]')?.value;
            const volume = parseFloat(element.querySelector('input[name="notificationVolume"]')?.value || 0.8);
            
            if (soundPath) {
                Utils.playSound(soundPath, volume);
            } else {
                ui.notifications.warn(game.i18n.localize('CYPHUR.ErrorPlaySound'));
            }
        });

        // Background file picker
        element.querySelector('[data-action="pickBackground"]')?.addEventListener('click', async () => {
            const fp = new FilePicker({
                type: 'image',
                current: element.querySelector('input[name="personalBackground"]')?.value || '',
                callback: (path) => {
                    const input = element.querySelector('input[name="personalBackground"]');
                    if (input) input.value = path;
                }
            });
            fp.render(true);
        });

        // Sound file picker
        element.querySelector('[data-action="pickSound"]')?.addEventListener('click', async () => {
            const fp = new FilePicker({
                type: 'audio',
                current: element.querySelector('input[name="notificationSound"]')?.value || '',
                callback: (path) => {
                    const input = element.querySelector('input[name="notificationSound"]');
                    if (input) input.value = path;
                }
            });
            fp.render(true);
        });

        // GM override sound picker
        element.querySelector('[data-action="pickGMSound"]')?.addEventListener('click', async () => {
            const fp = new FilePicker({
                type: 'audio',
                current: element.querySelector('input[name="gmOverrideSoundPath"]')?.value || '',
                callback: (path) => {
                    const input = element.querySelector('input[name="gmOverrideSoundPath"]');
                    if (input) input.value = path;
                }
            });
            fp.render(true);
        });

        // Save button
        element.querySelector('[data-action="saveSettings"]')?.addEventListener('click', () => {
            this._saveSettings();
        });

        // Request notification permission
        element.querySelector('[data-action="requestNotifications"]')?.addEventListener('click', async () => {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    ui.notifications.info(game.i18n.localize('CYPHUR.NotificationsEnabled'));
                }
            }
        });
    }

    async _saveSettings() {
        try {
            // Client settings
            const enableSound = this.element.querySelector('input[name="enableSound"]')?.checked ?? true;
            const notificationVolume = parseFloat(this.element.querySelector('input[name="notificationVolume"]')?.value || 0.8);
            const notificationSound = this.element.querySelector('input[name="notificationSound"]')?.value || DEFAULTS.NOTIFICATION_SOUND;
            const enableDesktopNotifications = this.element.querySelector('input[name="enableDesktopNotifications"]')?.checked ?? false;
            const personalBackground = this.element.querySelector('input[name="personalBackground"]')?.value || '';
            const shareBackground = this.element.querySelector('input[name="shareBackground"]')?.checked ?? false;

            await game.settings.set(MODULE_ID, 'enableSound', enableSound);
            await game.settings.set(MODULE_ID, 'notificationVolume', notificationVolume);
            await game.settings.set(MODULE_ID, 'notificationSound', notificationSound);
            await game.settings.set(MODULE_ID, 'enableDesktopNotifications', enableDesktopNotifications);
            await game.settings.set(MODULE_ID, 'personalBackground', personalBackground);
            await game.settings.set(MODULE_ID, 'shareBackground', shareBackground);

            // GM-only settings
            if (game.user.isGM) {
                const globalTheme = this.element.querySelector('select[name="globalTheme"]')?.value || 'none';
                const gmOverrideEnabled = this.element.querySelector('input[name="gmOverrideEnabled"]')?.checked ?? false;
                const gmOverrideSoundPath = this.element.querySelector('input[name="gmOverrideSoundPath"]')?.value || '';

                await game.settings.set(MODULE_ID, 'globalTheme', globalTheme);
                await game.settings.set(MODULE_ID, 'gmOverrideEnabled', gmOverrideEnabled);
                await game.settings.set(MODULE_ID, 'gmOverrideSoundPath', gmOverrideSoundPath);

                UIManager.applyTheme(globalTheme);
            }

            ui.notifications.info(game.i18n.localize('CYPHUR.SettingsSaved'));
            this.close();
            
        } catch (e) {
            console.error('Cyphur | Failed to save settings:', e);
            ui.notifications.error(game.i18n.localize('CYPHUR.SettingsError'));
        }
    }
}
