/**
 * RNK Cyphur - Encrypted Communications for Foundry VTT
 * Main entry point - handles version compatibility for v11, v12, v13
 */

// Import all modules
import { MODULE_ID, SOCKET_NAME, THEMES, DEFAULTS, SOUNDS } from './src/Constants.js';
import { Utils } from './src/Utils.js';
import { DataManager } from './src/DataManager.js';
import { SocketHandler } from './src/SocketHandler.js';
import { UIManager } from './src/UIManager.js';
import { RNKCyphur } from './src/RNKCyphur.js';
import { CyphurWindow } from './src/CyphurWindow.js';
import { PlayerHubWindow } from './src/PlayerHubWindow.js';
import { GroupManagerWindow } from './src/GroupManagerWindow.js';
import { GMMonitorWindow } from './src/GMMonitorWindow.js';
import { SettingsWindow } from './src/SettingsWindow.js';
import { GMModWindow } from './src/GMModWindow.js';

// Import hooks for settings registration and initialization
// This file handles all Foundry hooks (init, ready, etc.)
import './src/hooks.js';

/**
 * Detect Foundry VTT version
 */
function getFoundryVersion() {
    const version = game.version || game.data?.version || '0.0.0';
    const major = parseInt(version.split('.')[0]);
    return { version, major };
}

/**
 * Check if we're on v11, v12, or v13+
 */
function isV11() { return getFoundryVersion().major === 11; }
function isV12() { return getFoundryVersion().major === 12; }
function isV13Plus() { return getFoundryVersion().major >= 13; }

/**
 * Get the appropriate Application class based on version
 */
function getApplicationClass() {
    if (isV13Plus() && foundry.applications?.api?.ApplicationV2) {
        return foundry.applications.api.ApplicationV2;
    }
    return Application;
}

/**
 * Get the appropriate HandlebarsApplicationMixin based on version
 */
function getHandlebarsMixin() {
    if (isV13Plus() && foundry.applications?.api?.HandlebarsApplicationMixin) {
        return foundry.applications.api.HandlebarsApplicationMixin;
    }
    return null;
}

// Export for external use
export {
    MODULE_ID,
    SOCKET_NAME,
    THEMES,
    DEFAULTS,
    SOUNDS,
    Utils,
    DataManager,
    SocketHandler,
    UIManager,
    RNKCyphur,
    CyphurWindow,
    PlayerHubWindow,
    GroupManagerWindow,
    GMMonitorWindow,
    SettingsWindow,
    GMModWindow,
    getFoundryVersion,
    isV11,
    isV12,
    isV13Plus,
    getApplicationClass,
    getHandlebarsMixin
};
