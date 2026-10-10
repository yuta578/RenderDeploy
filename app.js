/**
 * ============================================================================
 * NexusDash - Analytics Dashboard: Feature Flag & Dark Mode Rollout Engine
 * ============================================================================
 * Este archivo está diseñado de forma universal (híbrida):
 * 1. En Node.js (Terminal / Render): Actúa como servidor web HTTP para servir index.html, styles.css, etc.
 * 2. En el Navegador (Browser DOM): Ejecuta la lógica interactiva de Feature Flags y Modo Oscuro.
 */

if (typeof window === 'undefined') {
    // =========================================================================
    // ENTORNO NODE.JS (Servidor HTTP para Despliegue en Render y Desarrollo Local)
    // =========================================================================
    const http = require('http');
    const fs = require('fs');
    const path = require('path');

    const PORT = process.env.PORT || 3000;

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
        if (reqPath === '/' || reqPath === '') {
            reqPath = '/index.html';
        }

        // Sanitizar ruta para prevenir Directory Traversal
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
        console.log(`📦 Puerto configurado para Render / Local: ${PORT}`);
        console.log(`======================================================\n`);
    });

} else {
    // =========================================================================
    // ENTORNO NAVEGADOR (Lógica de Interfaz, Feature Flags y Modo Oscuro)
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        // ---------------------------------------------------------------------
        // 1. Constantes y Configuración
        // ---------------------------------------------------------------------
        const STORAGE_THEME_KEY = 'nexusdash_theme';
        const STORAGE_TICKET_KEY = 'nexusdash_active_ticket';

        // Lista de usuarios muestra para simular cohortes (Bucket < 10% y Bucket >= 10%)
        const USERS = [
            { id: 'admin_5', name: 'Admin Dev', initials: 'AD', role: 'Staff Engineer' },      // Hash: 7% -> Califica
            { id: 'user_qa_88', name: 'QA Tester', initials: 'QA', role: 'Quality Assurance' } // Hash: 77% -> Fuera del 10%
        ];
        let currentUserIndex = 0;

        // Estado en memoria
        let state = {
            activeTicket: 'ticket-3', // Valor inicial sincronizado con HTML (ticket-3)
            inMemoryTheme: 'light',  // Para Ticket 2 (sin persistencia)
            currentUser: USERS[0]
        };

        // ---------------------------------------------------------------------
        // 2. Referencias al DOM
        // ---------------------------------------------------------------------
        const htmlRoot = document.documentElement;
        const ticketSelect = document.getElementById('ticket-select');
        const darkModeToggleContainer = document.getElementById('dark-mode-toggle-container');
        const darkModeToggleBtn = document.getElementById('dark-mode-toggle');
        const toggleLabel = document.getElementById('toggle-label');
        const userCohortBadge = document.getElementById('user-cohort-badge');
        const userProfileCard = document.querySelector('.user-profile');
        const userNameEl = document.querySelector('.user-name');
        const avatarEl = document.querySelector('.avatar');

        // Cajas de Tickets
        const ticketBoxes = {
            'ticket-1': document.getElementById('ticket-box-1'),
            'ticket-2': document.getElementById('ticket-box-2'),
            'ticket-3': document.getElementById('ticket-box-3')
        };

        // Inspector de Estado en Runtime
        const inspector = {
            phase: document.getElementById('info-current-phase'),
            rolloutPct: document.getElementById('info-rollout-pct'),
            userBucket: document.getElementById('info-user-bucket'),
            persistence: document.getElementById('info-persistence-status'),
            themeApplied: document.getElementById('info-theme-applied')
        };

        // ---------------------------------------------------------------------
        // 3. Algoritmo de Hashing para Cohortes de Feature Flag
        // ---------------------------------------------------------------------
        /**
         * Calcula de forma determinista un bucket numérico entre 0 y 99 a partir del ID del usuario.
         * @param {string} userId
         * @returns {number} 0..99
         */
        function computeUserBucket(userId) {
            let hash = 0;
            for (let i = 0; i < userId.length; i++) {
                hash = ((hash << 5) - hash) + userId.charCodeAt(i);
                hash |= 0; // Conversión a entero de 32 bits
            }
            return Math.abs(hash) % 100;
        }

        // ---------------------------------------------------------------------
        // 4. Lógica del Feature Flag por Ticket
        // ---------------------------------------------------------------------
        function evaluateFeatureFlag() {
            const bucket = computeUserBucket(state.currentUser.id);
            const ticket = state.activeTicket;

            switch (ticket) {
                case 'ticket-1':
                    // Ticket 1: 0% Rollout. Flag desactivado globalmente.
                    return {
                        ticketName: 'Ticket 1',
                        rolloutPct: '0%',
                        canToggle: false,
                        bucket,
                        bucketStatus: `${bucket}% (No califica - Rollout apagado)`,
                        persistenceText: 'Deshabilitada (Rollout 0%)',
                        themeToApply: 'light'
                    };

                case 'ticket-2': {
                    // Ticket 2: 10% Canary. Determinístico. Sin persistencia en localStorage.
                    const qualifies = bucket < 10;
                    return {
                        ticketName: 'Ticket 2 (Canary)',
                        rolloutPct: '10%',
                        canToggle: qualifies,
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
                    // Ticket 3: 100% GA. Todos califican. Con persistencia en localStorage.
                    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
                    const themeToApply = savedTheme || 'light';
                    return {
                        ticketName: 'Ticket 3 (100% GA)',
                        rolloutPct: '100%',
                        canToggle: true,
                        bucket,
                        bucketStatus: `${bucket}% (Califica - Acceso General 100%)`,
                        persistenceText: 'localStorage (Habilitada y persistente)',
                        themeToApply
                    };
                }
            }
        }

        // ---------------------------------------------------------------------
        // 5. Aplicación del Tema al DOM
        // ---------------------------------------------------------------------
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

        // ---------------------------------------------------------------------
        // 6. Actualización de Interfaz y UI
        // ---------------------------------------------------------------------
        function renderState() {
            const flagState = evaluateFeatureFlag();

            // 1. Visibilidad del Toggle Container
            if (flagState.canToggle) {
                darkModeToggleContainer.classList.remove('hidden');
            } else {
                darkModeToggleContainer.classList.add('hidden');
            }

            // 2. Aplicar tema
            applyThemeToDOM(flagState.themeToApply);

            // 3. Resaltar Ticket Activo en la cuadrícula de tickets
            Object.keys(ticketBoxes).forEach((key) => {
                const box = ticketBoxes[key];
                if (box) {
                    if (key === state.activeTicket) {
                        box.classList.add('is-active-phase');
                    } else {
                        box.classList.remove('is-active-phase');
                    }
                }
            });

            // 4. Actualizar Badge de Cohorte en el Sidebar
            if (userCohortBadge) {
                if (state.activeTicket === 'ticket-1') {
                    userCohortBadge.textContent = 'Cohort: 0% Rollout (Inactivo)';
                } else if (state.activeTicket === 'ticket-2') {
                    userCohortBadge.textContent = flagState.canToggle
                        ? `Cohort: Canary ${flagState.bucket}% (Activo)`
                        : `Cohort: Excluido ${flagState.bucket}% (Fuera de 10%)`;
                } else {
                    userCohortBadge.textContent = 'Cohort: GA 100% (Acceso Total)';
                }
            }

            // 5. Actualizar Inspector de Runtime
            if (inspector.phase) inspector.phase.textContent = flagState.ticketName;
            if (inspector.rolloutPct) inspector.rolloutPct.textContent = flagState.rolloutPct;
            if (inspector.userBucket) inspector.userBucket.textContent = flagState.bucketStatus;
            if (inspector.persistence) inspector.persistence.textContent = flagState.persistenceText;
        }

        // ---------------------------------------------------------------------
        // 7. Acciones de Usuario
        // ---------------------------------------------------------------------
        function handleToggleTheme() {
            const currentTheme = htmlRoot.getAttribute('data-theme') || 'light';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

            if (state.activeTicket === 'ticket-3') {
                localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
                applyThemeToDOM(nextTheme);
                showToast(`Tema cambiado a ${nextTheme} (Guardado en localStorage)`);
            } else if (state.activeTicket === 'ticket-2') {
                state.inMemoryTheme = nextTheme;
                applyThemeToDOM(nextTheme);
                showToast(`Tema cambiado a ${nextTheme} (Solo en memoria - Ticket 2)`);
            }
        }

        function handleSelectTicket(ticketId) {
            state.activeTicket = ticketId;
            ticketSelect.value = ticketId;
            localStorage.setItem(STORAGE_TICKET_KEY, ticketId);

            renderState();

            const ticketNames = {
                'ticket-1': 'Ticket 1 (0% Rollout - Flag apagado)',
                'ticket-2': 'Ticket 2 (10% Canary - Sin persistencia)',
                'ticket-3': 'Ticket 3 (100% GA - Persistencia en localStorage)'
            };
            showToast(`Fase activada: ${ticketNames[ticketId] || ticketId}`);
        }

        function handleToggleUser() {
            currentUserIndex = (currentUserIndex + 1) % USERS.length;
            state.currentUser = USERS[currentUserIndex];

            if (userNameEl) userNameEl.textContent = state.currentUser.name;
            if (avatarEl) avatarEl.textContent = state.currentUser.initials;

            renderState();
            showToast(`Usuario: ${state.currentUser.name} (Bucket: ${computeUserBucket(state.currentUser.id)}%)`);
        }

        // ---------------------------------------------------------------------
        // 8. Mensajes Toast de Notificación
        // ---------------------------------------------------------------------
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

        // ---------------------------------------------------------------------
        // 9. Event Listeners
        // ---------------------------------------------------------------------
        if (darkModeToggleBtn) {
            darkModeToggleBtn.addEventListener('click', handleToggleTheme);
        }

        if (ticketSelect) {
            ticketSelect.addEventListener('change', (e) => {
                handleSelectTicket(e.target.value);
            });
        }

        Object.keys(ticketBoxes).forEach((key) => {
            const box = ticketBoxes[key];
            if (box) {
                box.addEventListener('click', () => {
                    handleSelectTicket(key);
                });
            }
        });

        if (userProfileCard) {
            userProfileCard.title = 'Haz clic para alternar usuario de prueba (Bucket Canary)';
            userProfileCard.addEventListener('click', handleToggleUser);
        }

        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach((i) => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // ---------------------------------------------------------------------
        // 10. Inicialización en Navegador
        // ---------------------------------------------------------------------
        const savedTicket = localStorage.getItem(STORAGE_TICKET_KEY);
        if (savedTicket && ticketBoxes[savedTicket]) {
            state.activeTicket = savedTicket;
            if (ticketSelect) ticketSelect.value = savedTicket;
        }

        renderState();
    });
}
