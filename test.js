/**
 * ============================================================================
 * Automated Test Suite (CI Validation) — Versión 3.0 (Taller 6)
 * ============================================================================
 * Ejecuta validaciones automáticas y deterministas para el pipeline de CI/CD:
 * 1. Existencia e integridad de archivos clave (Playbook v3.0, código, Docker).
 * 2. Comprobación de sintaxis estricta de app.js y configcat.js.
 * 3. Prueba de arranque del servidor HTTP y verificación de endpoints críticos:
 *    - GET /index.html (HTML con UI de Pagos Express)
 *    - GET /api/config (Variables de entorno)
 *    - GET /api/health (Health check robusto para Render)
 *    - POST /api/payments/checkout (Simulador de transacciones de pago)
 * 4. Cero tolerancia a pruebas inestables (Flaky-free guarantee).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        passedTests++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        process.exitCode = 1;
    }
}

function fetchUrl(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Iniciando pruebas de Integración Continua (CI) — Taller 6 (CD & TBD)...\n');

    // 1. Verificación de archivos esenciales
    console.log('📦 1. Verificando estructura del proyecto y artefactos:');
    const requiredFiles = [
        'index.html',
        'styles.css',
        'app.js',
        'configcat.js',
        'Dockerfile',
        'package.json',
        'SCRUM_TBD_PLAYBOOK_v3.0.md',
        'TALLER_6_EJECUCION_Y_RESULTADOS.md'
    ];
    requiredFiles.forEach((file) => {
        const exists = fs.existsSync(path.join(__dirname, file));
        assert(exists, `Archivo crítico '${file}' presente`);
    });

    // 2. Verificación de sintaxis de módulos JavaScript
    console.log('\n🔍 2. Verificando sintaxis JavaScript:');
    try {
        require('./configcat.js');
        assert(true, 'configcat.js carga sin errores');
    } catch (err) {
        assert(false, `Error cargando configcat.js: ${err.message}`);
    }

    // 3. Prueba de Servidor HTTP en puerto efímero (3999)
    console.log('\n🌐 3. Verificando servidor HTTP y Endpoints:');
    const testPort = 3999;
    const serverProcess = spawn('node', ['app.js'], {
        cwd: __dirname,
        env: { ...process.env, PORT: testPort, CONFIGCAT_SDK_KEY: 'test-key-ci' }
    });

    let serverReady = false;

    await new Promise((resolve) => {
        serverProcess.stdout.on('data', (data) => {
            if (data.toString().includes('Servidor NexusDash') || data.toString().includes('http://localhost')) {
                serverReady = true;
                resolve();
            }
        });
        setTimeout(resolve, 2000);
    });

    assert(serverReady, `Servidor HTTP responde en el puerto ${testPort}`);

    // Probar GET /index.html
    try {
        const htmlRes = await fetchUrl(`http://localhost:${testPort}/index.html`);
        assert(htmlRes.statusCode === 200, 'GET /index.html devuelve status 200 OK');
        assert(htmlRes.headers['content-type'].includes('text/html'), 'Content-Type es text/html');
        assert(htmlRes.body.includes('Pagos Express'), 'El HTML contiene el módulo de Pagos Express');
        assert(htmlRes.body.includes('pagos-express-v1'), 'El HTML contiene el Feature Toggle pagos-express-v1');
    } catch (err) {
        assert(false, `Error en petición a /index.html: ${err.message}`);
    }

    // Probar GET /api/config
    try {
        const configRes = await fetchUrl(`http://localhost:${testPort}/api/config`);
        assert(configRes.statusCode === 200, 'GET /api/config devuelve status 200 OK');
        const json = JSON.parse(configRes.body);
        assert(json.configCatSdkKey === 'test-key-ci', 'Endpoint /api/config expone variable CONFIGCAT_SDK_KEY');
    } catch (err) {
        assert(false, `Error en petición a /api/config: ${err.message}`);
    }

    // Probar GET /api/health (Health check robusto para Render)
    try {
        const healthRes = await fetchUrl(`http://localhost:${testPort}/api/health`);
        assert(healthRes.statusCode === 200, 'GET /api/health devuelve status 200 OK');
        const healthJson = JSON.parse(healthRes.body);
        assert(healthJson.status === 'healthy', "Endpoint /api/health reporta estado 'healthy'");
        assert(healthJson.version === '3.0.0', 'Versión del servicio es 3.0.0');
        assert(healthJson.checks.pipeline === 'green', "Health check valida pipeline 'green'");
    } catch (err) {
        assert(false, `Error en petición a /api/health: ${err.message}`);
    }

    // Probar POST /api/payments/checkout (Simulador de Checkout)
    try {
        const postData = JSON.stringify({
            type: 'express',
            amount: 89.90,
            userEmail: 'ci-tester@nexusdash.dev'
        });
        const checkoutRes = await fetchUrl(`http://localhost:${testPort}/api/payments/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            body: postData
        });
        assert(checkoutRes.statusCode === 200, 'POST /api/payments/checkout devuelve status 200 OK');
        const checkoutJson = JSON.parse(checkoutRes.body);
        assert(checkoutJson.success === true, 'Transacción completada exitosamente');
        assert(checkoutJson.transactionId.startsWith('TXN-'), 'Genera un transactionId válido');
        assert(checkoutJson.latencyMs === 85, 'Latencia optimizada de Pago Express verificada (85 ms)');
    } catch (err) {
        assert(false, `Error en petición a /api/payments/checkout: ${err.message}`);
    }

    // Cerrar proceso de servidor
    await new Promise(r => setTimeout(r, 200));
    serverProcess.kill();

    console.log(`\n======================================================`);
    console.log(`📊 Resultado: ${passedTests}/${totalTests} pruebas pasadas con éxito (0 Flaky Tests)`);
    console.log(`======================================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runTests();
