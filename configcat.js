/**
 * ============================================================================
 * ConfigCat Service Module (configcat.js)
 * ============================================================================
 * Módulo independiente para la gestión y evaluación de Feature Flags con ConfigCat.
 * - Carga asíncrona del SDK en segundo plano (sin scripts embebidos en el HTML).
 * - Carga automática de la SDK Key desde .env vía /api/config.
 * - Detección automática de los keys de Feature Flag existentes en el proyecto
 *   (ej. 'dark_mode_enabled' o 'isMyFirstFeatureEnabled').
 * - Modos de operación:
 *   1. Cloud Mode: Conexión remota con AutoPoll (30s) y eventos en tiempo real (configChanged).
 *   2. Local Overrides Mode: Simulación de Tickets con el motor oficial de ConfigCat SDK.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ConfigCatService = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const STORAGE_KEY = 'nexusdash_configcat_sdk_key';
    const SDK_CDN_URL = 'https://cdn.jsdelivr.net/npm/@configcat/sdk/dist/configcat.browser.umd.min.js';

    let client = null;
    let sdkKey = '';
    let isCloud = false;
    let detectedFlagKey = 'dark_mode_enabled';
    let availableKeys = [];
    let sdkLoadingPromise = null;
    const changeListeners = [];

    /**
     * Carga dinámicamente el bundle de ConfigCat SDK si aún no está presente en window.
     */
    function loadSdk() {
        if (typeof window === 'undefined') return Promise.resolve(null);
        if (window.configcat) return Promise.resolve(window.configcat);

        if (sdkLoadingPromise) return sdkLoadingPromise;

        sdkLoadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = SDK_CDN_URL;
            script.async = true;
            script.onload = () => {
                console.log('🐱 ConfigCat SDK cargado dinámicamente con éxito.');
                resolve(window.configcat);
            };
            script.onerror = (err) => {
                console.error('Error cargando ConfigCat SDK desde CDN:', err);
                reject(err);
            };
            document.head.appendChild(script);
        });

        return sdkLoadingPromise;
    }

    /**
     * Obtiene la SDK Key desde el backend (/api/config) que lee el archivo .env,
     * o desde localStorage si el usuario la personalizó en la interfaz.
     */
    async function fetchSdkKeyFromEnv() {
        // 1. Revisar si hay clave personalizada en localStorage
        const storedKey = localStorage.getItem(STORAGE_KEY);
        if (storedKey && storedKey.trim() !== '') {
            return storedKey.trim();
        }

        // 2. Consultar al endpoint /api/config que lee el .env
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const data = await res.json();
                if (data.configCatSdkKey && data.configCatSdkKey.trim() !== '') {
                    const key = data.configCatSdkKey.trim();
                    if (key !== 'TU_CONFIGCAT_SDK_KEY_AQUI') {
                        return key;
                    }
                }
            }
        } catch (e) {
            // Entorno estático o sin conexión
        }

        return '';
    }

    /**
     * Detecta qué claves de flag existen en la cuenta de ConfigCat del usuario.
     */
    async function detectFlagKeys() {
        if (!client || typeof client.getAllKeysAsync !== 'function') return;

        try {
            const keys = await client.getAllKeysAsync();
            if (Array.isArray(keys) && keys.length > 0) {
                availableKeys = keys;
                if (keys.includes('dark_mode_enabled')) {
                    detectedFlagKey = 'dark_mode_enabled';
                } else if (keys.includes('isMyFirstFeatureEnabled')) {
                    detectedFlagKey = 'isMyFirstFeatureEnabled';
                } else {
                    detectedFlagKey = keys[0];
                }
                console.log(`🐱 Claves detectadas en ConfigCat: ${keys.join(', ')} (Usando: ${detectedFlagKey})`);
            }
        } catch (err) {
            console.warn('No se pudieron obtener todas las claves de ConfigCat:', err);
        }
    }

    /**
     * Inicializa el cliente ConfigCat según la clave disponible.
     */
    async function initClient(customKey, forceLocalSimulation = false) {
        await loadSdk();

        if (typeof window === 'undefined' || !window.configcat) {
            console.warn('ConfigCat SDK no disponible.');
            return null;
        }

        if (customKey !== undefined) {
            sdkKey = customKey.trim();
        } else {
            sdkKey = await fetchSdkKeyFromEnv();
        }

        // Desechar cliente anterior si existe
        if (client && typeof client.dispose === 'function') {
            try { client.dispose(); } catch (e) { /* ignore */ }
        }

        // Modo Cloud si hay SDK Key válida
        if (!forceLocalSimulation && sdkKey && sdkKey !== 'TU_CONFIGCAT_SDK_KEY_AQUI' && sdkKey !== '') {
            try {
                client = window.configcat.getClient(sdkKey, window.configcat.PollingMode.AutoPoll, {
                    pollIntervalSeconds: 30,
                    logger: window.configcat.createConsoleLogger(window.configcat.LogLevel.Info)
                });

                client.on('configChanged', async (newConfig) => {
                    console.log('⚡ ConfigCat: Cambio de configuración remota recibido en vivo.');
                    await detectFlagKeys();
                    changeListeners.forEach(fn => {
                        try { fn(newConfig); } catch (e) { console.error(e); }
                    });
                });

                isCloud = true;
                await detectFlagKeys();
                console.log('🐱 ConfigCat conectado en Modo Cloud (AutoPoll)');
                return client;
            } catch (err) {
                console.error('Error inicializando cliente Cloud ConfigCat:', err);
            }
        }

        // Modo Local Overrides (Simulador de Tickets)
        isCloud = false;
        return updateLocalOverrides(false);
    }

    /**
     * Actualiza el valor del flag en modo Local Overrides con el SDK oficial.
     */
    function updateLocalOverrides(flagValue) {
        if (!window.configcat) return null;

        if (client && typeof client.dispose === 'function') {
            try { client.dispose(); } catch (e) { /* ignore */ }
        }

        const map = {
            'dark_mode_enabled': Boolean(flagValue),
            'isMyFirstFeatureEnabled': Boolean(flagValue)
        };

        client = window.configcat.getClient('local-simulation', window.configcat.PollingMode.ManualPoll, {
            flagOverrides: window.configcat.createFlagOverridesFromMap(
                map,
                window.configcat.OverrideBehaviour.LocalOnly
            )
        });

        isCloud = false;
        return client;
    }

    /**
     * Evalúa el valor del Feature Flag para un usuario específico.
     */
    async function getValueAsync(flagName, defaultValue = false, user = {}) {
        if (!client) {
            await initClient();
        }

        if (!client || typeof client.getValueAsync !== 'function') {
            return defaultValue;
        }

        const keyToQuery = flagName || detectedFlagKey;

        let ccUser = null;
        if (window.configcat && user && user.id) {
            ccUser = new window.configcat.User(
                user.id,
                user.email || undefined,
                'ES',
                { role: user.role || 'user', bucket: user.bucket }
            );
        }

        try {
            return await client.getValueAsync(keyToQuery, defaultValue, ccUser);
        } catch (err) {
            console.error('Error al evaluar flag en ConfigCat:', err);
            return defaultValue;
        }
    }

    function onConfigChanged(callback) {
        if (typeof callback === 'function') {
            changeListeners.push(callback);
        }
    }

    async function setSdkKey(key) {
        sdkKey = (key || '').trim();
        if (sdkKey) {
            localStorage.setItem(STORAGE_KEY, sdkKey);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        return await initClient(sdkKey);
    }

    async function resetToLocal(flagValue = false) {
        sdkKey = '';
        localStorage.removeItem(STORAGE_KEY);
        isCloud = false;
        return updateLocalOverrides(flagValue);
    }

    function getStatus() {
        return {
            isCloud,
            sdkKey,
            hasKey: Boolean(sdkKey && sdkKey !== 'TU_CONFIGCAT_SDK_KEY_AQUI'),
            flagKey: detectedFlagKey,
            availableKeys
        };
    }

    return {
        loadSdk,
        initClient,
        updateLocalOverrides,
        getValueAsync,
        onConfigChanged,
        setSdkKey,
        resetToLocal,
        getStatus,
        getDetectedFlagKey: () => detectedFlagKey
    };
}));
