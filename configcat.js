/**
 * ============================================================================
 * ConfigCat Service Module (configcat.js) — Versión 3.0 (Taller 6)
 * ============================================================================
 * Módulo para la gestión y evaluación de Feature Flags con ConfigCat.
 * - Soporte Multi-Flag:
 *   1. 'dark_mode_enabled': Tema visual del dashboard.
 *   2. 'pagos-express-v1': Módulo crítico de checkout en 1 clic (Caso Taller 6).
 * - Carga asíncrona del SDK oficial (@configcat/sdk).
 * - Sincronización automática de SDK Key desde .env (/api/config).
 * - Modos de operación:
 *   1. Cloud Mode: Conexión remota con AutoPoll (30s) y eventos en tiempo real.
 *   2. Local Overrides Mode: Simulación de Rollout, Canary cohorts y Kill Switch local.
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
    let sdkLoadingPromise = null;
    const changeListeners = [];

    // Estado local de flags para simulación offline / overrides
    let localFlags = {
        'dark_mode_enabled': false,
        'pagos-express-v1': false
    };

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
            // Entorno sin servidor activo o estático
        }

        return '';
    }

    /**
     * Inicializa el cliente ConfigCat según la clave disponible.
     * @param {string} [customKey] - Clave opcional pasada directamente.
     * @param {boolean} [forceLocalSimulation] - Forzar simulación local.
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

        // Si hay una SDK Key válida y no se fuerza modo local -> Modo Cloud
        if (!forceLocalSimulation && sdkKey && sdkKey !== 'TU_CONFIGCAT_SDK_KEY_AQUI' && sdkKey !== '') {
            try {
                client = window.configcat.getClient(sdkKey, window.configcat.PollingMode.AutoPoll, {
                    pollIntervalSeconds: 30,
                    logger: window.configcat.createConsoleLogger(window.configcat.LogLevel.Info)
                });

                client.on('configChanged', (newConfig) => {
                    console.log('⚡ ConfigCat: Cambio de configuración remota recibido en vivo.');
                    changeListeners.forEach(fn => {
                        try { fn(newConfig); } catch (e) { console.error(e); }
                    });
                });

                isCloud = true;
                console.log('🐱 ConfigCat conectado en Modo Cloud (AutoPoll)');
                return client;
            } catch (err) {
                console.error('Error inicializando cliente Cloud ConfigCat:', err);
            }
        }

        // Modo Local Overrides (Simulador de Tickets y Flags)
        isCloud = false;
        return updateLocalOverrides(localFlags);
    }

    /**
     * Actualiza los valores de flags en modo Local Overrides con el SDK oficial.
     * @param {boolean|object} overrides - Booleano para dark_mode o mapa de flags.
     */
    function updateLocalOverrides(overrides) {
        if (typeof overrides === 'boolean') {
            localFlags['dark_mode_enabled'] = overrides;
        } else if (overrides && typeof overrides === 'object') {
            localFlags = { ...localFlags, ...overrides };
        }

        if (typeof window === 'undefined' || !window.configcat) return null;

        if (client && typeof client.dispose === 'function') {
            try { client.dispose(); } catch (e) { /* ignore */ }
        }

        client = window.configcat.getClient('local-simulation', window.configcat.PollingMode.ManualPoll, {
            flagOverrides: window.configcat.createFlagOverridesFromMap(
                localFlags,
                window.configcat.OverrideBehaviour.LocalOnly
            )
        });

        isCloud = false;
        return client;
    }

    /**
     * Establece el valor de un flag específico en local.
     */
    function setFlagOverride(flagName, value) {
        localFlags[flagName] = Boolean(value);
        return updateLocalOverrides(localFlags);
    }

    /**
     * Evalúa el valor del Feature Flag para un usuario específico.
     * @param {string} flagName
     * @param {boolean} defaultValue
     * @param {object} user - { id, email, role, bucket }
     * @returns {Promise<boolean>}
     */
    async function getValueAsync(flagName, defaultValue = false, user = {}) {
        if (!client) {
            await initClient();
        }

        if (!client || typeof client.getValueAsync !== 'function') {
            return localFlags[flagName] !== undefined ? localFlags[flagName] : defaultValue;
        }

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
            let targetKey = flagName;
            if (isCloud && typeof client.getAllKeysAsync === 'function') {
                const availableKeys = await client.getAllKeysAsync();
                if (!availableKeys.includes(flagName)) {
                    if (flagName === 'pagos-express-v1' && availableKeys.includes('nuevaFuncionalidad')) {
                        targetKey = 'nuevaFuncionalidad';
                    } else if (flagName === 'dark_mode_enabled' && availableKeys.includes('isMyFirstFeatureEnabled')) {
                        targetKey = 'isMyFirstFeatureEnabled';
                    }
                }
            }
            return await client.getValueAsync(targetKey, defaultValue, ccUser);
        } catch (err) {
            console.error(`Error al evaluar flag '${flagName}' en ConfigCat:`, err);
            return defaultValue;
        }
    }

    /**
     * Suscribirse a cambios remotos de configuración.
     * @param {Function} callback
     */
    function onConfigChanged(callback) {
        if (typeof callback === 'function') {
            changeListeners.push(callback);
        }
    }

    /**
     * Establecer una nueva SDK Key manualmente desde la UI y guardarla en localStorage.
     * @param {string} key
     */
    async function setSdkKey(key) {
        sdkKey = (key || '').trim();
        if (sdkKey) {
            localStorage.setItem(STORAGE_KEY, sdkKey);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        return await initClient(sdkKey);
    }

    /**
     * Restablecer al modo local de simulación.
     */
    async function resetToLocal(flagValue = false) {
        sdkKey = '';
        localStorage.removeItem(STORAGE_KEY);
        isCloud = false;
        localFlags['dark_mode_enabled'] = Boolean(flagValue);
        localFlags['pagos-express-v1'] = false;
        return updateLocalOverrides(localFlags);
    }

    /**
     * Retorna el estado actual de la conexión de ConfigCat.
     */
    function getStatus() {
        return {
            isCloud,
            sdkKey,
            hasKey: Boolean(sdkKey && sdkKey !== 'TU_CONFIGCAT_SDK_KEY_AQUI'),
            localFlags
        };
    }

    function getDetectedFlagKey() {
        return 'dark_mode_enabled';
    }

    return {
        loadSdk,
        initClient,
        updateLocalOverrides,
        setFlagOverride,
        getValueAsync,
        onConfigChanged,
        setSdkKey,
        resetToLocal,
        getStatus,
        getDetectedFlagKey
    };
}));
