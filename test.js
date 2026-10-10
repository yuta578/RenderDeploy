/**
 * ============================================================================
 * Automated Test Suite (CI Validation)
 * ============================================================================
 * Ejecuta validaciones automáticas para el pipeline de CI/CD:
 * 1. Existencia e integridad de archivos clave.
 * 2. Comprobación de sintaxis de scripts JS.
 * 3. Prueba de arranque del servidor HTTP y verificación de endpoints.
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

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
        });
        req.on('error', reject);
    });
}

async function runTests() {
    console.log('🧪 Iniciando pruebas de Integración Continua (CI)...\n');

    // 1. Verificación de archivos esenciales
    console.log('📦 1. Verificando estructura del proyecto:');
    const requiredFiles = ['index.html', 'styles.css', 'app.js', 'configcat.js', 'Dockerfile', 'package.json'];
    requiredFiles.forEach((file) => {
        const exists = fs.existsSync(path.join(__dirname, file));
        assert(exists, `Archivo crítico '${file}' presente`);
    });

    // 2. Verificación de sintaxis de configcat.js
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
            if (data.toString().includes('Servidor NexusDash activo') || data.toString().includes('http://localhost')) {
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
        assert(htmlRes.body.includes('NexusDash'), 'El HTML contiene la marca NexusDash');
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

    // Pequeña pausa antes de cerrar proceso para evitar ECONNRESET en Windows
    await new Promise(r => setTimeout(r, 200));
    serverProcess.kill();

    console.log(`\n======================================================`);
    console.log(`📊 Resultado: ${passedTests}/${totalTests} pruebas pasadas con éxito`);
    console.log(`======================================================\n`);

    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runTests();
