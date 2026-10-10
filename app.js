/**
 * ============================================================================
 * NexusDash - Analytics Dashboard & Safe Release Engine (Versión 3.0)
 * ============================================================================
 * Taller 6: Continuous Deployment, Feature Toggles & Progressive Delivery
 *
 * Arquitectura:
 * 1. Node.js (Servidor / Render):
 *    - Lee variables de entorno (.env).
 *    - Expone /api/config para la SDK Key de ConfigCat.
 *    - Expone /api/health para el Health Check continuo de Render (resolución al fallo de 11 min).
 *    - Expone /api/payments/checkout para procesar pagos (Standard vs Express).
 *    - Sirve estáticos (index.html, styles.css, configcat.js, app.js).
 * 2. Navegador (DOM):
 *    - Rollout de Tema Oscuro (dark_mode_enabled).
 *    - Rollout Progresivo de Pagos Express (pagos-express-v1):
 *      * Fases: 0% OFF -> Dogfooding (@nexusdash.dev) -> Canary 20% -> 100% GA -> KILL SWITCH.
 *      * Experiencia de Checkout dinámica (Formulario tradicional vs 1-Clic).
 *      * Telemetría en tiempo real (Error rate, latencia p95, conversión, health check).
 *      * Gobernanza y Limpieza de Deuda de Toggles (> 30 días).
 */

if (typeof window === 'undefined') {
    // =========================================================================
    // ENTORNO NODE.JS (Servidor HTTP con carga de .env y Endpoints de API)
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

        // 1. Endpoint /api/config
        if (reqPath === '/api/config') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                configCatSdkKey: CONFIGCAT_ENV_KEY !== 'TU_CONFIGCAT_SDK_KEY_AQUI' ? CONFIGCAT_ENV_KEY : ''
            }));
            return;
        }

        // 2. Endpoint /api/health (Health check robusto para Render y monitoreo)
        if (reqPath === '/api/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                service: 'nexusdash-analytics',
                version: '3.0.0',
                timestamp: new Date().toISOString(),
                uptimeSeconds: Math.round(process.uptime()),
                checks: {
                    pipeline: 'green',
                    renderDeployment: 'online',
                    database: 'connected',
                    paymentGateway: 'operational',
                    configCat: 'synced'
                }
            }));
            return;
        }

        // 3. Endpoint /api/payments/checkout (Simulador de transacciones de pago)
        if (reqPath === '/api/payments/checkout' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    const isExpress = data.type === 'express';
                    const txId = 'TXN-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    const latency = isExpress ? 85 : 420;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        transactionId: txId,
                        method: isExpress ? 'Pago Express (1-Clic)' : 'Checkout Tradicional',
                        amount: data.amount || 89.90,
                        latencyMs: latency,
                        userEmail: data.userEmail || 'usuario@nexusdash.dev',
                        timestamp: new Date().toISOString()
                    }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Payload JSON inválido' }));
                }
            });
            return;
        }

        // 4. Servir archivos estáticos
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
        console.log(`🚀 Servidor NexusDash v3.0 activo en: http://localhost:${PORT}`);
        console.log(`🏥 Health Check disponible en: http://localhost:${PORT}/api/health`);
        console.log(`💳 Endpoint Checkout en: http://localhost:${PORT}/api/payments/checkout`);
        console.log(`📄 Archivo .env cargado correctamente`);
        if (CONFIGCAT_ENV_KEY && CONFIGCAT_ENV_KEY !== 'TU_CONFIGCAT_SDK_KEY_AQUI') {
            console.log(`🐱 ConfigCat SDK Key conectada: ${CONFIGCAT_ENV_KEY.slice(0, 16)}...`);
        }
        console.log(`======================================================\n`);
    });

} else {
    // =========================================================================
    // ENTORNO NAVEGADOR (Lógica de Interfaz, Rollouts y Telemetría)
    // =========================================================================
    document.addEventListener('DOMContentLoaded', async () => {
        const STORAGE_THEME_KEY = 'nexusdash_theme';
        const STORAGE_TICKET_KEY = 'nexusdash_active_ticket';
        const STORAGE_PAGOS_PHASE_KEY = 'nexusdash_pagos_phase';

        const USERS = [
            { id: 'admin_5', name: 'Admin Dev', initials: 'AD', role: 'Staff Engineer', email: 'admin@nexusdash.dev' },
            { id: 'user_qa_88', name: 'QA Tester', initials: 'QA', role: 'Quality Assurance', email: 'qa@nexusdash.dev' },
            { id: 'customer_72', name: 'Cliente Externo', initials: 'CE', role: 'End User', email: 'cliente@gmail.com' }
        ];
        let currentUserIndex = 0;

        let state = {
            activeTicket: 'ticket-3',
            inMemoryTheme: 'light',
            currentUser: USERS[0],
            pagosExpressPhase: localStorage.getItem(STORAGE_PAGOS_PHASE_KEY) || 'off', // 'off' | 'dogfooding' | 'canary-20' | 'ga-100' | 'kill-switch'
            pagosExpressActive: false,
            metrics: {
                totalOrders: 42,
                expressOrders: 18,
                errorCount: 0,
                errorRate: 0.12,
                latencyP95: 450,
                conversionRate: 4.62
            }
        };

        // Referencias al DOM
        const htmlRoot = document.documentElement;
        const ticketSelect = document.getElementById('ticket-select');
        const darkModeToggleBtn = document.getElementById('dark-mode-toggle');
        const toggleLabel = document.getElementById('toggle-label');
        const userCohortBadge = document.getElementById('user-cohort-badge');
        const userProfileCard = document.getElementById('user-profile-toggle');
        const userNameEl = document.querySelector('.user-name');
        const avatarEl = document.querySelector('.avatar');

        // Panel de ConfigCat
        const ccSdkKeyInput = document.getElementById('configcat-sdk-key');
        const ccConnectBtn = document.getElementById('btn-connect-configcat');
        const ccResetBtn = document.getElementById('btn-reset-configcat');
        const ccStatusBadge = document.getElementById('configcat-status-badge');
        const ccConnectionMsg = document.getElementById('configcat-connection-msg');

        // Cajas de Tickets Modo Oscuro
        const ticketBoxes = {
            'ticket-1': document.getElementById('ticket-box-1'),
            'ticket-2': document.getElementById('ticket-box-2'),
            'ticket-3': document.getElementById('ticket-box-3')
        };

        // Elementos de Taller 6: Pagos Express & Rollout
        const pagosFlagStatusBadge = document.getElementById('pagos-flag-status-badge');
        const checkoutTogglePill = document.getElementById('checkout-toggle-pill');
        const checkoutSubtitle = document.getElementById('checkout-experience-subtitle');
        const checkoutTraditionalView = document.getElementById('checkout-traditional-view');
        const checkoutExpressView = document.getElementById('checkout-express-view');
        const transactionResult = document.getElementById('transaction-result');
        const receiptTxId = document.getElementById('receipt-tx-id');
        const receiptMethod = document.getElementById('receipt-method');
        const receiptLatency = document.getElementById('receipt-latency');
        const btnPayTraditional = document.getElementById('btn-pay-traditional');
        const btnPayExpress = document.getElementById('btn-pay-express');

        // Botones de Fases de Rollout
        const phaseButtons = {
            'off': document.getElementById('btn-phase-off'),
            'dogfooding': document.getElementById('btn-phase-dogfooding'),
            'canary-20': document.getElementById('btn-phase-canary'),
            'ga-100': document.getElementById('btn-phase-ga'),
            'kill-switch': document.getElementById('btn-kill-switch')
        };

        // Telemetría & SLIs
        const valErrorRate = document.getElementById('val-error-rate');
        const barErrorRate = document.getElementById('bar-error-rate');
        const valConversionRate = document.getElementById('val-conversion-rate');
        const badgeConversionDiff = document.getElementById('badge-conversion-diff');
        const valLatencyP95 = document.getElementById('val-latency-p95');
        const badgeLatencyDiff = document.getElementById('badge-latency-diff');
        const valHealthStatus = document.getElementById('val-health-status');
        const healthCheckText = document.getElementById('health-check-text');
        const tablePagosStatus = document.getElementById('table-pagos-status');
        const btnTriggerCleanup = document.getElementById('btn-trigger-cleanup');
        const auditLogList = document.getElementById('audit-log-list');

        // Inspector en Runtime
        const inspector = {
            flagValue: document.getElementById('info-flag-value'),
            pagosFlagValue: document.getElementById('info-pagos-flag-value'),
            userIdentifier: document.getElementById('info-user-identifier'),
            userBucket: document.getElementById('info-user-bucket'),
            themeApplied: document.getElementById('info-theme-applied')
        };

        function computeUserBucket(userId) {
            let hash = 0;
            for (let i = 0; i < userId.length; i++) {
                hash = ((hash << 5) - hash) + userId.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash) % 100;
        }

        // ---------------------------------------------------------------------
        // Evaluación del Feature Flag 'pagos-express-v1'
        // ---------------------------------------------------------------------
        async function evaluatePagosExpressFlag() {
            const bucket = computeUserBucket(state.currentUser.id);
            const user = { ...state.currentUser, bucket };
            const ccStatus = window.ConfigCatService ? window.ConfigCatService.getStatus() : { isCloud: false };

            let isFlagActive = false;

            if (ccStatus.isCloud) {
                // En modo Cloud, consulta la clave remota en ConfigCat
                isFlagActive = await window.ConfigCatService.getValueAsync('pagos-express-v1', false, user);
            } else {
                // En modo Local Overrides / Simulador de Taller 6:
                switch (state.pagosExpressPhase) {
                    case 'off':
                    case 'kill-switch':
                        isFlagActive = false;
                        break;
                    case 'dogfooding':
                        // Solo usuarios con dominio interno @nexusdash.dev
                        isFlagActive = user.email.endsWith('@nexusdash.dev');
                        break;
                    case 'canary-20':
                        // Solo cohorte de usuarios con bucket < 20
                        isFlagActive = bucket < 20;
                        break;
                    case 'ga-100':
                        isFlagActive = true;
                        break;
                    default:
                        isFlagActive = false;
                }

                if (window.ConfigCatService) {
                    window.ConfigCatService.setFlagOverride('pagos-express-v1', isFlagActive);
                }
            }

            state.pagosExpressActive = isFlagActive;
            return {
                isFlagActive,
                phase: state.pagosExpressPhase,
                bucket,
                user
            };
        }

        // ---------------------------------------------------------------------
        // Renderizado del Estado de Pagos Express y Telemetría
        // ---------------------------------------------------------------------
        async function renderPagosExpressState() {
            const result = await evaluatePagosExpressFlag();

            // 1. Actualizar Botones de Fase Activa
            Object.keys(phaseButtons).forEach((phaseKey) => {
                const btn = phaseButtons[phaseKey];
                if (btn) {
                    if (phaseKey === state.pagosExpressPhase) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                }
            });

            // 2. Actualizar Vistas de Checkout (Tradicional vs Express)
            if (result.isFlagActive) {
                checkoutTraditionalView.classList.add('hidden');
                checkoutExpressView.classList.remove('hidden');

                checkoutTogglePill.textContent = 'Toggle: ON (Activo)';
                checkoutTogglePill.className = 'badge badge-success';
                checkoutSubtitle.textContent = `Modo: ⚡ Pago Express 1-Clic Activo (Cohorte: ${result.bucket}%)`;

                pagosFlagStatusBadge.textContent = 'Flag: pagos-express-v1 (ON)';
                pagosFlagStatusBadge.className = 'badge badge-success';

                if (tablePagosStatus) tablePagosStatus.textContent = `Rollout Activo (${state.pagosExpressPhase})`;
                if (inspector.pagosFlagValue) {
                    inspector.pagosFlagValue.textContent = 'true';
                    inspector.pagosFlagValue.className = 'val badge on-flag';
                }

                // Métricas optimizadas con Pagos Express
                valLatencyP95.textContent = '85 ms';
                valLatencyP95.className = 'telemetry-value text-emerald';
                badgeLatencyDiff.textContent = '↓ -365ms con Express';
                badgeLatencyDiff.className = 'telemetry-badge positive';

                valConversionRate.textContent = '8.92%';
                badgeConversionDiff.textContent = '↑ +93% Uplift';
                badgeConversionDiff.className = 'telemetry-badge positive';
            } else {
                checkoutTraditionalView.classList.remove('hidden');
                checkoutExpressView.classList.add('hidden');

                checkoutTogglePill.textContent = 'Toggle: OFF (Inactivo)';
                checkoutTogglePill.className = 'badge badge-warning';
                checkoutSubtitle.textContent = state.pagosExpressPhase === 'canary-20'
                    ? `Modo: Formulario Tradicional (Usuario ${result.bucket}% no califica en Canary < 20%)`
                    : state.pagosExpressPhase === 'dogfooding'
                        ? `Modo: Formulario Tradicional (Solo emails @nexusdash.dev en Dogfooding)`
                        : 'Modo: Formulario Tradicional (Toggle Inactivo)';

                pagosFlagStatusBadge.textContent = 'Flag: pagos-express-v1 (OFF)';
                pagosFlagStatusBadge.className = 'badge badge-warning';

                if (tablePagosStatus) tablePagosStatus.textContent = `Rollout 0% (${state.pagosExpressPhase})`;
                if (inspector.pagosFlagValue) {
                    inspector.pagosFlagValue.textContent = 'false';
                    inspector.pagosFlagValue.className = 'val badge off-flag';
                }

                // Métricas tradicionales baseline
                valLatencyP95.textContent = '450 ms';
                valLatencyP95.className = 'telemetry-value text-blue';
                badgeLatencyDiff.textContent = 'Tradicional';
                badgeLatencyDiff.className = 'telemetry-badge';

                valConversionRate.textContent = '4.62%';
                badgeConversionDiff.textContent = 'Baseline';
                badgeConversionDiff.className = 'telemetry-badge';
            }
        }

        // ---------------------------------------------------------------------
        // Ejecución de Checkout / Transacción Simulada
        // ---------------------------------------------------------------------
        async function executeCheckout(isExpress) {
            const btn = isExpress ? btnPayExpress : btnPayTraditional;
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ Procesando pago seguro...</span>';

            const payload = {
                type: isExpress ? 'express' : 'traditional',
                amount: 89.90,
                userEmail: state.currentUser.email,
                userId: state.currentUser.id
            };

            try {
                const response = await fetch('/api/payments/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                // Actualizar métricas
                state.metrics.totalOrders++;
                if (isExpress) state.metrics.expressOrders++;

                // Mostrar recibo interactivo
                if (transactionResult) {
                    transactionResult.classList.remove('hidden');
                    receiptTxId.textContent = data.transactionId;
                    receiptMethod.textContent = data.method;
                    receiptLatency.textContent = `${data.latencyMs} ms`;
                    receiptLatency.className = isExpress ? 'badge badge-success' : 'badge badge-primary';
                }

                showToast(`¡Pago completado! ${data.transactionId} (${data.latencyMs}ms)`);
            } catch (err) {
                state.metrics.errorCount++;
                showToast('Error procesando pago');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }

        // ---------------------------------------------------------------------
        // Handlers de Cambio de Fase de Rollout
        // ---------------------------------------------------------------------
        async function handlePhaseChange(newPhase) {
            state.pagosExpressPhase = newPhase;
            localStorage.setItem(STORAGE_PAGOS_PHASE_KEY, newPhase);

            const descriptions = {
                'off': 'Fase 0: Flag apagado (0% usuarios). Nadie ve la funcionalidad.',
                'dogfooding': 'Fase 1: Dogfooding interno. Solo usuarios @nexusdash.dev.',
                'canary-20': 'Fase 2: Canary 20%. Usuarios con bucket < 20% (Objetivo PO).',
                'ga-100': 'Fase 3: 100% General Availability (Liberación completa).',
                'kill-switch': '🚨 KILL SWITCH ACTIVADO: Rollback inmediato a 0% en ConfigCat.'
            };

            showToast(descriptions[newPhase] || `Fase cambiada a ${newPhase}`);

            // Agregar al log de auditoría
            if (auditLogList) {
                const li = document.createElement('li');
                li.innerHTML = `<span class="time">Ahora:</span> <span>Fase de Rollout actualizada a <strong>${newPhase}</strong> por ${state.currentUser.name}.</span>`;
                auditLogList.prepend(li);
            }

            await renderPagosExpressState();
        }

        // ---------------------------------------------------------------------
        // Limpieza de Deuda Técnica de Toggles
        // ---------------------------------------------------------------------
        function handleCleanupLegacyToggles() {
            const rows = document.querySelectorAll('.row-debt-critical');
            rows.forEach(row => {
                const actionCell = row.querySelector('.action-cell');
                const badge = row.querySelector('.badge-danger');
                if (actionCell) actionCell.innerHTML = '<strong>🧹 PR #142 Creado:</strong> Refactorización en curso';
                if (badge) {
                    badge.textContent = 'En Limpieza';
                    badge.className = 'badge badge-info';
                }
            });

            btnTriggerCleanup.disabled = true;
            btnTriggerCleanup.textContent = '✅ PR #142 Creado en GitHub';
            showToast('Pull Request #142 generado: Eliminando 3 Feature Toggles obsoletos (>45 días)');
        }

        // ---------------------------------------------------------------------
        // Monitoreo Periódico de Salud (/api/health)
        // ---------------------------------------------------------------------
        async function checkHealthStatus() {
            try {
                const res = await fetch('/api/health');
                if (res.ok) {
                    const data = await res.json();
                    if (healthCheckText) healthCheckText.textContent = `Render: ${data.status} (Up ${data.uptimeSeconds}s)`;
                    if (valHealthStatus) valHealthStatus.textContent = '100% Healthy';
                }
            } catch (e) {
                if (healthCheckText) healthCheckText.textContent = 'Render: Desconectado';
                if (valHealthStatus) valHealthStatus.textContent = 'Degradado';
            }
        }

        // ---------------------------------------------------------------------
        // Evaluación y Renderizado de Modo Oscuro (Tickets Originales)
        // ---------------------------------------------------------------------
        async function evaluateFeatureFlag() {
            const bucket = computeUserBucket(state.currentUser.id);
            const userWithBucket = { ...state.currentUser, bucket };
            const ccStatus = window.ConfigCatService ? window.ConfigCatService.getStatus() : { isCloud: false };
            const flagKeyName = 'dark_mode_enabled';

            let flagEnabled = false;

            if (ccStatus.isCloud) {
                flagEnabled = await window.ConfigCatService.getValueAsync(flagKeyName, false, userWithBucket);
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

            // Actualizar Badge de ConfigCat
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
                    ccConnectionMsg.innerHTML = `Conectado a <strong>ConfigCat Cloud (.env activo)</strong>. Flag: <code>dark_mode_enabled</code> & <code>pagos-express-v1</code>.`;
                } else {
                    ccConnectionMsg.innerHTML = `Modo: <strong>ConfigCat SDK Local Overrides</strong> (Simulador de Tickets y Flags).`;
                }
            }

            if (ccSdkKeyInput && ccStatus.sdkKey) {
                ccSdkKeyInput.value = ccStatus.sdkKey;
            }

            if (inspector.flagValue) {
                inspector.flagValue.textContent = String(result.flagEnabled);
                inspector.flagValue.className = `val badge ${result.flagEnabled ? 'on-flag' : 'off-flag'}`;
            }
            if (inspector.userIdentifier) inspector.userIdentifier.textContent = state.currentUser.id;
            if (inspector.userBucket) inspector.userBucket.textContent = result.bucketStatus;

            if (userCohortBadge) {
                userCohortBadge.textContent = `User: ${state.currentUser.name} (${computeUserBucket(state.currentUser.id)}%)`;
            }

            await renderPagosExpressState();
        }

        // Alternador de Tema
        function handleToggleTheme() {
            const currentTheme = htmlRoot.getAttribute('data-theme') || 'light';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
            state.inMemoryTheme = nextTheme;
            applyThemeToDOM(nextTheme);
            showToast(`Tema cambiado a: ${nextTheme === 'dark' ? 'Modo Oscuro 🌙' : 'Modo Claro ☀️'}`);
        }

        // Alternar Usuario para Probar Targeting
        async function handleToggleUser() {
            currentUserIndex = (currentUserIndex + 1) % USERS.length;
            state.currentUser = USERS[currentUserIndex];

            if (userNameEl) userNameEl.textContent = state.currentUser.name;
            if (avatarEl) avatarEl.textContent = state.currentUser.initials;

            await renderState();
            showToast(`Usuario cambiado a: ${state.currentUser.name} (${computeUserBucket(state.currentUser.id)}%) [${state.currentUser.email}]`);
        }

        // Conectar ConfigCat
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

        // Event Listeners
        if (darkModeToggleBtn) darkModeToggleBtn.addEventListener('click', handleToggleTheme);
        if (userProfileCard) userProfileCard.addEventListener('click', handleToggleUser);

        if (ticketSelect) {
            ticketSelect.addEventListener('change', async (e) => {
                state.activeTicket = e.target.value;
                localStorage.setItem(STORAGE_TICKET_KEY, e.target.value);
                await renderState();
            });
        }

        Object.keys(ticketBoxes).forEach((key) => {
            const box = ticketBoxes[key];
            if (box) {
                box.addEventListener('click', async () => {
                    state.activeTicket = key;
                    if (ticketSelect) ticketSelect.value = key;
                    localStorage.setItem(STORAGE_TICKET_KEY, key);
                    await renderState();
                });
            }
        });

        // Listeners de Fases de Pagos Express
        Object.keys(phaseButtons).forEach((phaseKey) => {
            const btn = phaseButtons[phaseKey];
            if (btn) {
                btn.addEventListener('click', () => handlePhaseChange(phaseKey));
            }
        });

        // Listeners de Checkout
        if (btnPayTraditional) {
            btnPayTraditional.addEventListener('click', () => executeCheckout(false));
        }
        if (btnPayExpress) {
            btnPayExpress.addEventListener('click', () => executeCheckout(true));
        }

        // Limpieza de Toggles
        if (btnTriggerCleanup) {
            btnTriggerCleanup.addEventListener('click', handleCleanupLegacyToggles);
        }

        if (ccConnectBtn) ccConnectBtn.addEventListener('click', handleConnectConfigCat);
        if (ccResetBtn) ccResetBtn.addEventListener('click', handleResetConfigCat);

        // Inicializar ConfigCat SDK
        if (window.ConfigCatService) {
            await window.ConfigCatService.initClient();
            window.ConfigCatService.onConfigChanged(async () => {
                showToast('ConfigCat: Configuración remota actualizada en vivo');
                await renderState();
            });
        }

        // Restaurar estado inicial
        const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
        if (savedTheme) applyThemeToDOM(savedTheme);

        const savedTicket = localStorage.getItem(STORAGE_TICKET_KEY);
        if (savedTicket && ticketBoxes[savedTicket]) {
            state.activeTicket = savedTicket;
            if (ticketSelect) ticketSelect.value = savedTicket;
        }

        await renderState();
        await checkHealthStatus();
        setInterval(checkHealthStatus, 15000);
    });
}
