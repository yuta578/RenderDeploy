/**
 * ============================================================================
 * NexusDash - Analytics Dashboard: Feature Flag & Dark Mode Rollout Engine
 * ============================================================================
 * Arquitectura:
 * 1. Node.js (Servidor / Render):
 *    - Lee automáticamente las variables de entorno desde el archivo .env.
 *    - Sirve index.html, styles.css, configcat.js, app.js.
 *    - Expone el endpoint /api/config para entregar la clave de ConfigCat al frontend.
 * 2. Navegador (DOM):
 *    - Botón de Modo Oscuro siempre visible y funcional.
 *    - Sincronización en vivo con ConfigCat SDK (configcat.js) y simulador de tickets.
 */

if (typeof window === 'undefined') {
    // =========================================================================
    // ENTORNO NODE.JS (Servidor HTTP con carga de .env)
    // =========================================================================
    const http = require('http');
    const fs = require('fs');
    const path = require('path');

    function loadEnvFile() {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
            lines.forEach((line) => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const eqIdx = trimmed.indexOf('=');
                    if (eqIdx !== -1) {
                        const key = trimmed.slice(0, eqIdx).trim();
                        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                        if (!process.env[key]) {
                            process.env[key] = val;
                        }
                    }
                }
            });
        }
    }

    loadEnvFile();

    const PORT = process.env.PORT || 3000;
    const CONFIGCAT_ENV_KEY = process.env.CONFIGCAT_SDK_KEY || '';

    const MIME_TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];

        if (reqPath === '/api/config') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                configCatSdkKey: CONFIGCAT_ENV_KEY !== 'TU_CONFIGCAT_SDK_KEY_AQUI' ? CONFIGCAT_ENV_KEY : ''
            }));
            return;
        }

        if (reqPath === '/' || reqPath === '') {
            reqPath = '/index.html';
        }

        const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(__dirname, safePath);

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 - Archivo no encontrado');
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });

    server.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 Servidor NexusDash activo en: http://localhost:${PORT}`);
        console.log(`📄 Archivo .env cargado correctamente`);
        if (CONFIGCAT_ENV_KEY && CONFIGCAT_ENV_KEY !== 'TU_CONFIGCAT_SDK_KEY_AQUI') {
            console.log(`🐱 ConfigCat SDK Key conectada: ${CONFIGCAT_ENV_KEY.slice(0, 16)}...`);
        }
        console.log(`📦 Puerto configurado para Render / Local: ${PORT}`);
        console.log(`======================================================\n`);
    });

} else {
    // =========================================================================
    // ENTORNO NAVEGADOR (Lógica de Interfaz y Modo Oscuro)
    // =========================================================================
    document.addEventListener('DOMContentLoaded', async () => {
        const STORAGE_THEME_KEY = 'nexusdash_theme';
        const STORAGE_TICKET_KEY = 'nexusdash_active_ticket';

        const USERS = [
            { id: 'admin_5', name: 'Admin Dev', initials: 'AD', role: 'Staff Engineer', email: 'admin@nexusdash.dev' },
            { id: 'user_qa_88', name: 'QA Tester', initials: 'QA', role: 'Quality Assurance', email: 'qa@nexusdash.dev' }
        ];
        let currentUserIndex = 0;

        let state = {
            activeTicket: 'ticket-3',
            inMemoryTheme: 'light',
            currentUser: USERS[0],
            lastEvaluatedFlagValue: false
        };

        // Referencias al DOM
        const htmlRoot = document.documentElement;
        const ticketSelect = document.getElementById('ticket-select');
        const darkModeToggleContainer = document.getElementById('dark-mode-toggle-container');
        const darkModeToggleBtn = document.getElementById('dark-mode-toggle');
        const toggleLabel = document.getElementById('toggle-label');
        const userCohortBadge = document.getElementById('user-cohort-badge');
        const userProfileCard = document.querySelector('.user-profile');
        const userNameEl = document.querySelector('.user-name');
        const avatarEl = document.querySelector('.avatar');

        // Panel de ConfigCat
        const ccSdkKeyInput = document.getElementById('configcat-sdk-key');
        const ccConnectBtn = document.getElementById('btn-connect-configcat');
        const ccResetBtn = document.getElementById('btn-reset-configcat');
        const ccStatusBadge = document.getElementById('configcat-status-badge');
        const ccConnectionMsg = document.getElementById('configcat-connection-msg');

        // Cajas de Tickets
        const ticketBoxes = {
            'ticket-1': document.getElementById('ticket-box-1'),
            'ticket-2': document.getElementById('ticket-box-2'),
            'ticket-3': document.getElementById('ticket-box-3')
        };

        // Inspector en Runtime
        const inspector = {
            sdkProvider: document.getElementById('info-sdk-provider'),
            flagKey: document.querySelector('.flag-inspector-list li:nth-child(2) .val'),
            flagValue: document.getElementById('info-flag-value'),
            phase: document.getElementById('info-current-phase'),
            rolloutPct: document.getElementById('info-rollout-pct'),
            userIdentifier: document.getElementById('info-user-identifier'),
            userBucket: document.getElementById('info-user-bucket'),
            persistence: document.getElementById('info-persistence-status'),
            themeApplied: document.getElementById('info-theme-applied')
        };

        // Asegurar que el botón de Modo Oscuro SIEMPRE esté visible
        if (darkModeToggleContainer) {
            darkModeToggleContainer.classList.remove('hidden');
        }

        function computeUserBucket(userId) {
            let hash = 0;
            for (let i = 0; i < userId.length; i++) {
                hash = ((hash << 5) - hash) + userId.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash) % 100;
        }

        // ---------------------------------------------------------------------
        // Evaluación de Feature Flag
        // ---------------------------------------------------------------------
        async function evaluateFeatureFlag() {
            const bucket = computeUserBucket(state.currentUser.id);
            const userWithBucket = { ...state.currentUser, bucket };
            const ccStatus = window.ConfigCatService ? window.ConfigCatService.getStatus() : { isCloud: false };
            const flagKeyName = window.ConfigCatService ? window.ConfigCatService.getDetectedFlagKey() : 'dark_mode_enabled';

            let flagEnabled = false;

            if (ccStatus.isCloud) {
                // Modo Cloud (evaluación con el SDK contra ConfigCat)
                flagEnabled = await window.ConfigCatService.getValueAsync(flagKeyName, false, userWithBucket);
                state.lastEvaluatedFlagValue = flagEnabled;

                // Si en ConfigCat está activo y no hay preferencia manual guardada, activar dark mode
                const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
                const themeToApply = savedTheme || (flagEnabled ? 'dark' : 'light');

                return {
                    ticketName: 'ConfigCat Cloud (Live)',
                    rolloutPct: 'Remoto (ConfigCat)',
                    flagKey: flagKeyName,
                    flagEnabled,
                    bucket,
                    bucketStatus: `${bucket}% (Evaluado por Reglas Remotas)`,
                    persistenceText: 'localStorage (Habilitada)',
                    themeToApply
                };
            }

            // Modo Local de Tickets
            let simulatedFlagValue = false;
            if (state.activeTicket === 'ticket-3') {
                simulatedFlagValue = true;
            } else if (state.activeTicket === 'ticket-2') {
                simulatedFlagValue = bucket < 10;
            } else {
                simulatedFlagValue = false;
            }

            if (window.ConfigCatService) {
                window.ConfigCatService.updateLocalOverrides(simulatedFlagValue);
                flagEnabled = await window.ConfigCatService.getValueAsync(flagKeyName, false, userWithBucket);
            } else {
                flagEnabled = simulatedFlagValue;
            }

            state.lastEvaluatedFlagValue = flagEnabled;

            switch (state.activeTicket) {
                case 'ticket-1':
                    return {
                        ticketName: 'Ticket 1 (0% Rollout)',
                        rolloutPct: '0%',
                        flagKey: flagKeyName,
                        flagEnabled,
                        bucket,
                        bucketStatus: `${bucket}% (No califica - Rollout 0%)`,
                        persistenceText: 'Deshabilitada (Rollout 0%)',
                        themeToApply: 'light'
                    };

                case 'ticket-2': {
                    const qualifies = bucket < 10;
                    return {
                        ticketName: 'Ticket 2 (10% Canary)',
                        rolloutPct: '10%',
                        flagKey: flagKeyName,
                        flagEnabled,
                        bucket,
                        bucketStatus: qualifies
                            ? `${bucket}% (Califica para Canary < 10%)`
                            : `${bucket}% (No califica - Excluido de Canary)`,
                        persistenceText: 'Deshabilitada (Solo memoria de sesión)',
                        themeToApply: qualifies ? state.inMemoryTheme : 'light'
                    };
                }

                case 'ticket-3':
                default: {
                    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY) || 'light';
                    return {
                        ticketName: 'Ticket 3 (100% GA)',
                        rolloutPct: '100%',
                        flagKey: flagKeyName,
                        flagEnabled,
                        bucket,
                        bucketStatus: `${bucket}% (Califica - Acceso General 100%)`,
                        persistenceText: 'localStorage (Habilitada y persistente)',
                        themeToApply: savedTheme
                    };
                }
            }
        }

        function applyThemeToDOM(theme) {
            htmlRoot.setAttribute('data-theme', theme);

            if (toggleLabel) {
                toggleLabel.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
            }

            if (inspector.themeApplied) {
                inspector.themeApplied.textContent = theme;
                inspector.themeApplied.style.color = theme === 'dark' ? '#818cf8' : '#4f46e5';
            }
        }

        async function renderState() {
            const result = await evaluateFeatureFlag();
            const ccStatus = window.ConfigCatService ? window.ConfigCatService.getStatus() : { isCloud: false };

            // El botón de alternar tema siempre está disponible
            if (darkModeToggleContainer) {
                darkModeToggleContainer.classList.remove('hidden');
            }

            // Aplicar tema resultante al DOM
            applyThemeToDOM(result.themeToApply);

            // Resaltar Cajas de Tickets
            Object.keys(ticketBoxes).forEach((key) => {
                const box = ticketBoxes[key];
                if (box) {
                    if (!ccStatus.isCloud && key === state.activeTicket) {
                        box.classList.add('is-active-phase');
                    } else {
                        box.classList.remove('is-active-phase');
                    }
                }
            });

            // Actualizar Estado de ConfigCat en el Panel
            if (ccStatusBadge) {
                if (ccStatus.isCloud) {
                    ccStatusBadge.textContent = '🟢 Cloud Conectado';
                    ccStatusBadge.className = 'badge badge-success';
                } else {
                    ccStatusBadge.textContent = '🟡 Local Overrides';
                    ccStatusBadge.className = 'badge badge-warning';
                }
            }

            if (ccConnectionMsg) {
                if (ccStatus.isCloud) {
                    ccConnectionMsg.innerHTML = `Conectado a <strong>ConfigCat Cloud (.env activo)</strong>. Flag: <code>${result.flagKey}</code> = <strong>${result.flagEnabled}</strong>.`;
                } else {
                    ccConnectionMsg.innerHTML = `Modo: <strong>ConfigCat SDK Local Overrides</strong> (Simulador de Tickets). Clave configurada en tu <code>.env</code>.`;
                }
            }

            if (ccSdkKeyInput && ccStatus.sdkKey) {
                ccSdkKeyInput.value = ccStatus.sdkKey;
            }

            // Actualizar Inspector
            if (inspector.flagKey) {
                inspector.flagKey.textContent = result.flagKey;
            }
            if (inspector.flagValue) {
                inspector.flagValue.textContent = String(result.flagEnabled);
                inspector.flagValue.className = `val badge ${result.flagEnabled ? 'on-flag' : 'off-flag'}`;
            }
            if (inspector.phase) inspector.phase.textContent = result.ticketName;
            if (inspector.rolloutPct) inspector.rolloutPct.textContent = result.rolloutPct;
            if (inspector.userIdentifier) inspector.userIdentifier.textContent = state.currentUser.id;
            if (inspector.userBucket) inspector.userBucket.textContent = result.bucketStatus;
            if (inspector.persistence) inspector.persistence.textContent = result.persistenceText;

            // Badge en Sidebar
            if (userCohortBadge) {
                if (ccStatus.isCloud) {
                    userCohortBadge.textContent = `ConfigCat: ${result.flagEnabled ? 'Flag ON (Activo)' : 'Flag OFF (Inactivo)'}`;
                } else if (state.activeTicket === 'ticket-1') {
                    userCohortBadge.textContent = 'Cohort: 0% Rollout (Inactivo)';
                } else if (state.activeTicket === 'ticket-2') {
                    userCohortBadge.textContent = result.flagEnabled
                        ? `Cohort: Canary ${result.bucket}% (Activo)`
                        : `Cohort: Excluido ${result.bucket}% (Fuera de 10%)`;
                } else {
                    userCohortBadge.textContent = 'Cohort: GA 100% (Acceso Total)';
                }
            }
        }

        // Alternador de Modo Claro / Oscuro
        function handleToggleTheme() {
            const currentTheme = htmlRoot.getAttribute('data-theme') || 'light';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

            localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
            state.inMemoryTheme = nextTheme;
            applyThemeToDOM(nextTheme);
            showToast(`Tema cambiado a: ${nextTheme === 'dark' ? 'Modo Oscuro 🌙' : 'Modo Claro ☀️'}`);
        }

        async function handleSelectTicket(ticketId) {
            state.activeTicket = ticketId;
            ticketSelect.value = ticketId;
            localStorage.setItem(STORAGE_TICKET_KEY, ticketId);

            const ccStatus = window.ConfigCatService ? window.ConfigCatService.getStatus() : { isCloud: false };
            if (ccStatus.isCloud) {
                showToast('Aviso: Estás conectado a ConfigCat Cloud en vivo.');
            } else {
                const names = {
                    'ticket-1': 'Ticket 1 (0% Rollout)',
                    'ticket-2': 'Ticket 2 (10% Canary)',
                    'ticket-3': 'Ticket 3 (100% GA)'
                };
                showToast(`Fase activada: ${names[ticketId] || ticketId}`);
            }

            await renderState();
        }

        async function handleToggleUser() {
            currentUserIndex = (currentUserIndex + 1) % USERS.length;
            state.currentUser = USERS[currentUserIndex];

            if (userNameEl) userNameEl.textContent = state.currentUser.name;
            if (avatarEl) avatarEl.textContent = state.currentUser.initials;

            await renderState();
            showToast(`Usuario: ${state.currentUser.name} (${computeUserBucket(state.currentUser.id)}%)`);
        }

        async function handleConnectConfigCat() {
            const inputVal = (ccSdkKeyInput ? ccSdkKeyInput.value : '').trim();
            if (!inputVal) {
                showToast('Por favor introduce una SDK Key válida');
                return;
            }

            if (window.ConfigCatService) {
                await window.ConfigCatService.setSdkKey(inputVal);
                await renderState();
                showToast('Conectado a ConfigCat Cloud SDK');
            }
        }

        async function handleResetConfigCat() {
            if (window.ConfigCatService) {
                await window.ConfigCatService.resetToLocal(false);
                if (ccSdkKeyInput) ccSdkKeyInput.value = '';
                await renderState();
                showToast('Restablecido a modo simulación local');
            }
        }

        function showToast(message) {
            let container = document.querySelector('.toast-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'toast-container';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
            container.appendChild(toast);

            setTimeout(() => {
                toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(10px)';
                setTimeout(() => toast.remove(), 300);
            }, 2800);
        }

        // Listeners
        if (darkModeToggleBtn) {
            darkModeToggleBtn.addEventListener('click', handleToggleTheme);
        }
        if (ticketSelect) {
            ticketSelect.addEventListener('change', (e) => handleSelectTicket(e.target.value));
        }

        Object.keys(ticketBoxes).forEach((key) => {
            const box = ticketBoxes[key];
            if (box) box.addEventListener('click', () => handleSelectTicket(key));
        });

        if (userProfileCard) {
            userProfileCard.title = 'Haz clic para alternar usuario y probar targeting';
            userProfileCard.addEventListener('click', handleToggleUser);
        }

        if (ccConnectBtn) ccConnectBtn.addEventListener('click', handleConnectConfigCat);
        if (ccResetBtn) ccResetBtn.addEventListener('click', handleResetConfigCat);

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach((i) => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Inicialización del servicio ConfigCat
        if (window.ConfigCatService) {
            await window.ConfigCatService.initClient();
            window.ConfigCatService.onConfigChanged(async () => {
                console.log('⚡ ConfigCat: Cambio en vivo recibido');
                showToast('ConfigCat: Configuración remota actualizada en vivo');
                await renderState();
            });
        }

        // Restaurar tema guardado previamente si existe
        const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
        if (savedTheme) {
            applyThemeToDOM(savedTheme);
        }

        const savedTicket = localStorage.getItem(STORAGE_TICKET_KEY);
        if (savedTicket && ticketBoxes[savedTicket]) {
            state.activeTicket = savedTicket;
            if (ticketSelect) ticketSelect.value = savedTicket;
        }

        await renderState();
    });
}
