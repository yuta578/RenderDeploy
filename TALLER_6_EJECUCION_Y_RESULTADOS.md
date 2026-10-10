# 🚀 Taller 6: Ceremonias Ágiles en Continuous Deployment, Liberación Segura de Valor y Resolución del Caso Práctico

**Fecha de Ejecución:** Octubre 2026  
**Entorno de Trabajo:** GitHub Actions + Render + ConfigCat + Scrum & TBD Playbook v3.0  
**Caso de Estudio Central:** *“La funcionalidad de ‘Pagos Express’ ya está en main, pero nadie se atreve a activarla”*  

---

## 📌 0. Apertura y Conexión con el Nuevo Flujo

### 0.1 Contextualización Inicial
> *“Ya tenemos el pipeline completo: integramos a `main`, se despliega solo a Render y podemos proteger funcionalidades con Feature Toggles en ConfigCat.*  
> *Hoy respondemos una pregunta clave:*  
> **¿Cómo cambian el Sprint Review y la Retrospective cuando desplegamos varias veces por semana?”**

#### 🔑 Respuesta a la Pregunta Clave:
Cuando el equipo adopta **Continuous Deployment (CD)** y **Trunk-Based Development (TBD)**:
1. **El Sprint Review deja de ser una "aprobación tardía de fin de sprint"** y se transforma en una **demostración de valor real en producción**, orientada a inspeccionar métricas de negocio de lo que ya está corriendo y a decidir si se incrementa el porcentaje de rollout de un Feature Toggle.
2. **La Sprint Retrospective deja de ser solo una charla de sentimientos** y se convierte en una **inspección cuantitativa y cualitativa de la salud del pipeline, la disciplina de integración continua y el flujo de valor (DORA metrics)**.

---

### 0.2 Pregunta de Arranque del Taller
> **“¿Qué parte del Review o de la Retro actual se siente más ‘antigua’ o poco útil con este nuevo flujo?”**

* **En el Review clásico:** Se siente completamente obsoleto preparar una "demo en localhost o staging" de 20 diapositivas el último día del sprint, cuando el código ya lleva días o semanas en `main` desplegado en Render. Mostrar "lo que construimos" sin saber si los usuarios lo están usando o si funciona en producción real carece de sentido.
* **En la Retro clásica:** Se siente inútil hablar únicamente de "comunicación entre el equipo" mientras ignoramos hechos duros del flujo: si el CI estuvo rojo 4 días por un test flaky, si tardamos 11 minutos caídos en producción por un mal health check, o si acumulamos ramas vivas y feature toggles zombies de más de 45 días sin limpiar.

---

## 🎯 1. Adaptación del Sprint Review al Continuous Deployment

### 1.1 Principios del Nuevo Review

| Dimensión | Sprint Review Clásico (Scrum Tradicional) | Sprint Review en CD + TBD (Nuevo Flujo) |
| :--- | :--- | :--- |
| **Ambiente de Demo** | Staging o máquina local del desarrollador (*"en mi máquina funciona"*). | **Producción real (Render)** con datos y usuarios reales. |
| **Unidad de Entrega** | Todo el incremento del sprint junto ("Todo o nada"). | **Incrementos atómicos y seguros** gestionados por Feature Toggles. |
| **Tiempo de Feedback** | 1 vez cada 2 semanas (feedback tardío y acumulado). | **Continuo:** se valida con cohortes y telemetría en tiempo real. |
| **Enfoque de la Demo** | Demostrar *qué código se escribió* y cuántas historias se cerraron. | Demostrar *qué valor recibieron los usuarios* o qué hipótesis se validó. |
| **Rol del Stakeholder** | Espectador pasivo que "aprueba o rechaza" el entregable. | **Validador activo de valor de negocio** que decide el siguiente paso de rollout. |

---

### 1.2 Simulación Práctica de Sprint Review
El equipo realizó la simulación de demostración seleccionando los 3 incrementos reales del sistema:

```
+──────────────────────────────────────────────────────────────────────────────────────────+
|                                INCREMENTOS EVALUADOS                                     |
+──────────────────────────────────────────────────────────────────────────────────────────+
| 1. "Pagos Express con un solo clic" (Toggle: pagos-express-v1) [CASO PROBLEMÁTICO]       |
| 2. "NexusDash Dark Mode Rollout" (Toggle: dark_mode_enabled)                             |
| 3. "Endpoint de Monitoreo de Salud / Health Check" (/api/health)                         |
+──────────────────────────────────────────────────────────────────────────────────────────+
```

#### 🎬 Guion de Simulación: Ítem 1 — "Pagos Express con un solo clic" (4 minutos)
* **Roles:**
  * *Developer (Demo Técnica):* Carlos (Frontend/Fullstack)
  * *Product Owner (Facilitador de Negocio):* Laura
  * *Stakeholder de Negocio:* Roberto (Director Comercial)
  * *Observadores:* Resto del equipo técnico y QA

1. **¿Qué problema de usuario resuelve?**
   * *Laura (PO):* *"Actualmente, el checkout tradicional tiene 4 pasos y exige digitar 16 dígitos de tarjeta en cada compra, provocando una tasa de abandono de carrito del 68%. 'Pagos Express' permite a usuarios recurrentes pagar en 1 solo clic con tarjeta tokenizada guardada, reduciendo la fricción a cero."*
2. **¿Está activo para todos o detrás de toggle?**
   * *Carlos (Dev):* *"El código está fusionado en `main` y desplegado en Render hace 9 días. Está protegido 100% por el Feature Toggle `pagos-express-v1` en ConfigCat (actualmente en OFF)."*
3. **Demo en Vivo en Render (Toggle OFF vs ON):**
   * *Carlos (Dev comparte pantalla de Render en vivo):*
     * *Paso A (Toggle OFF):* Muestra el checkout tradicional. El usuario debe llenar formulario completo de facturación.
     * *Paso B (Toggle ON en ConfigCat para cohorte interno):* Muestra cómo la interfaz se transforma dinámicamente: aparece el botón destacado **⚡ Pago Express con 1 Clic**, tarjeta Visa •••• 4242 precargada, y al pulsar el botón, la transacción se procesa y confirma en 85 ms con badge verde.
4. **Métricas y Evidencia de Valor:**
   * *Carlos (Dev):* *"Identificamos que teníamos ceguera operativa porque no teníamos métricas instrumentadas. Como parte de la preparación, hoy instrumentamos el dashboard de telemetría: la latencia p95 bajó de 450 ms a 85 ms y la pasarela responde con 0% de errores en pruebas internas."*
5. **Pregunta de Cierre al Stakeholder / PO:**
   * *Carlos (Dev) y Laura (PO):* *“Roberto, con esta demo en vivo y el riesgo técnico contenido detrás del toggle, ¿esto cumple la expectativa para arrancar el rollout progresivo del 20% este viernes?”*
   * *Roberto (Stakeholder):* *“Visualmente es exactamente lo que prometimos en la campaña. Ahora que entiendo que podemos activarlo solo para el 20% y monitorear errores, me da tranquilidad no hacer un lanzamiento 'a ciegas'."*

---

## 🔍 2. Adaptación de la Sprint Retrospective

### 2.1 Los Nuevos Focos Obligatorios y Análisis del Caso Problemático

Examinamos a fondo los 7 hechos problemáticos del caso:

```
+──────────────────────────────────────────────────────────────────────────────────────────+
|                    DIAGNÓSTICO CRÍTICO DE LOS 7 HECHOS DEL CASO                          |
+──────────────────────────────────────────────────────────────────────────────────────────+
| 1. PO quiere activar 20% este viernes por campaña de marketing ya lanzada.              |
|    ➔ CAUSA RAÍZ: Desincronización entre ciclo de marketing y ciclo de ingeniería.        |
|                  Falta de un protocolo formal de Progressive Delivery.                   |
| 2. Último deploy automático falló health check 11 min; rollback manual.                 |
|    ➔ CAUSA RAÍZ: Falta de health check robusto (/api/health) y rollback no automatizado. |
| 3. 3 Feature Toggles llevan >45 días activos sin limpiar.                                |
|    ➔ CAUSA RAÍZ: Deuda técnica de flags sin TTL, sin owner y sin tickets de refactor.    |
| 4. Solo 4 integraciones a main en el sprint (lejos de integración diaria).               |
|    ➔ CAUSA RAÍZ: Miedo al auto-deploy roto y ramas de larga duración.                   |
| 5. Rama viva 4 días por test flaky en CI.                                                |
|    ➔ CAUSA RAÍZ: Tolerancia al CI roto. No se aplicó la regla de detener la línea.      |
| 6. Sin métrica clara de conversión o error de pagos a observar.                          |
|    ➔ CAUSA RAÍZ: Ceguera operativa. El DoD anterior no exigía observabilidad.           |
| 7. Stakeholder anunció internamente que "ya está listo".                                 |
|    ➔ CAUSA RAÍZ: Confusión conceptual entre Deploy (código en server) y Release (valor). |
+──────────────────────────────────────────────────────────────────────────────────────────+
```

---

### 2.2 Dinámica de Retrospective (Matriz de 4 Columnas)

```
┌───────────────────────────────────────────────┬───────────────────────────────────────────────┐
│ 🟢 LO QUE FUNCIONÓ BIEN                       │ 🟡 LO QUE GENERÓ FRICCIÓN                     │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ • El código de Pagos Express se dividió       │ • Presión de Marketing al lanzar campaña      │
│   en un slice integrable con toggle.          │   antes de la validación en producción.       │
│ • La integración con ConfigCat protegió       │ • No saber qué pasaría al encender el toggle  │
│   a los usuarios de código incompleto.        │   por falta de métricas y telemetría.         │
│ • El pipeline compila y despliega             │ • 3 toggles viejos (>45 días) que ensucian    │
│   automáticamente a Render sin intervención.  │   el código y generan confusión.              │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ 🔴 LO QUE ROMPIÓ EL FLUJO O GENERÓ MIEDO      │ 🚀 ACCIONES DE MEJORA (MÁXIMO 3)              │
├───────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ • Un test flaky tuvo el CI rojo 4 días y      │ 1. [TÉCNICA - CI & TESTS]:                    │
│   obligó a mantener una rama viva 4 días.     │    Erradicar el test flaky y configurar       │
│ • Caída de 11 minutos en el health check de   │    endpoint /api/health para Render.          │
│   Render resuelta con rollback manual tardío. │    Responsable: Carlos (Dev Lead) | 48h       │
│ • Miedo generalizado a encender el flag       │ 2. [OPERABILIDAD & OBSERVABILIDAD]:           │
│   "pagos-express-v1" por ceguera operativa.   │    Instrumentar dashboard de métricas de pago │
│ • Stakeholder anunciando que la feature       │    (tasa de error, latencia, conversión).     │
│   "ya está lista" cuando está en OFF al 100%. │    Responsable: Sofía (Dev) | Este viernes    │
│                                               │ 3. [GOBIERNO & DEUDA]:                        │
│                                               │    Sprint de Limpieza de Toggles >30 días     │
│                                               │    y formalizar política Deploy ≠ Release.    │
│                                               │    Responsable: Laura (PO) + Carlos | Sprint+1│
└───────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

---

### 2.3 Respuestas a las Preguntas Guía del Facilitador
1. **¿Qué nos impidió integrar más veces a main?**
   * *Conclusión del equipo:* La existencia de un test flaky que mantuvo el CI en rojo durante 4 días. Los desarrolladores no podían hacer merge por branch protection y acumularon código localmente por temor a romper `main`.
2. **¿El auto-deploy nos dio más confianza o más miedo?**
   * *Conclusión del equipo:* El incidente de los 11 minutos caídos en el health check provocó desconfianza. El auto-deploy solo da tranquilidad si el pipeline tiene pruebas de humo confiables y verificación automática de salud.
3. **¿Los Feature Toggles nos ayudaron o se volvieron deuda?**
   * *Conclusión del equipo:* Nos salvaron de un desastre comercial con Pagos Express, pero se convirtieron en deuda porque 3 de ellos llevan más de 45 días sin retirarse. Los toggles deben ser temporales, no permanentes.
4. **¿El DoD se respetó realmente?**
   * *Conclusión del equipo:* Se respetó el DoD técnico antiguo (compiló y pasó CI), pero se evidenció un vacío crítico: el DoD no exigía observabilidad ni métricas de monitoreo antes de dar por terminada la historia.

---

## 🛡️ 3. Liberación Segura de Valor (Práctica en Vivo)

### 3.1 Resolución del Dilema de "Pagos Express"
En lugar de un enfrentamiento destructivo entre Negocio (que exige activar el viernes para el 20%) e Ingeniería (que tiene miedo de activar por falta de visibilidad), se acordó la siguiente **Estrategia de Liberación Progresiva**:

```
+-----------------------------------------------------------------------------------------+
|                    ESTRATEGIA DE ROLLOUT ACORDADA: PAGOS EXPRESS                        |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [JUEVES]      FASE 1: DOGFOODING INTERNO (Equipo dev, QA y PO)                        |
|                • Flag activo solo para correos @nexusdash.dev                           |
|                • Verificación de 10 transacciones reales de prueba                      |
|                                     │                                                   |
|                                     ▼                                                   |
|  [VIERNES 9 AM] FASE 2: CANARY CONTROLADO (5% de usuarios reales)                       |
|                • Observación en tiempo real durante 2 horas                             |
|                • Verificar: Tasa de error < 0.5% y latencia p95 < 250ms                 |
|                                     │                                                   |
|                                     ▼                                                   |
|  [VIERNES 12 PM] FASE 3: ROLLOUT AL 20% (Objetivo Comercial del PO)                     |
|                • Satisface la campaña de marketing pero protege al 80% de usuarios     |
|                • Turno de guardia activo (Developer de guardia en Slack)                |
|                                     │                                                   |
|                                     ▼                                                   |
|  [LUNES SIGUIENTE] FASE 4: EXPANSION AL 100% (General Availability)                     |
|                • Si la tasa de error del fin de semana fue < 0.2%                       |
|                • Creación inmediata del ticket de limpieza de toggle (TTL 14 días)      |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

### 3.2 Métricas de Observabilidad Instrumentadas
* **Tasa de Error en Pagos (Error Rate):** Umbral verde: `< 0.5%`. Umbral de Alarma: `> 1.0%`.
* **Conversión de Checkout:** Medición comparativa entre flujo tradicional (4.62%) vs Pagos Express (meta: > 7.5%).
* **Latencia p95:** Medición de tiempo de respuesta de la API de checkout (meta: `< 250 ms`).
* **Health Check de Render:** Endpoint `/api/health` con monitoreo continuo cada 30 segundos.

### 3.3 Protocolo de Emergencia: KILL SWITCH (Rollback en Segundos)
* Si en cualquier momento la tasa de errores supera el **1.0%** o se detectan cobros duplicados:
  1. El Developer de guardia o el PO ingresa a ConfigCat (o a la consola de control de la app).
  2. Pasa el toggle `pagos-express-v1` a **OFF (0%)**.
  3. En menos de 30 segundos, el 100% de los usuarios vuelve al flujo tradicional de pago sin requerir ningún nuevo deploy ni reinicio de contenedores en Render.

### 3.4 Plan de Observación de las Próximas 24-48 Horas
* **Turno de Guardia:** Viernes 12:00 PM a Domingo 11:59 PM (Carlos y Sofía con rotación).
* **Canal de Alertas:** Notificaciones en canal `#alerts-prod-payments` conectadas al endpoint `/api/health` y métricas de error.
* **Revisión Sincronizada:** Sábado a las 10:00 AM (Check-in rápido de 10 min entre PO y Dev para revisar transacciones procesadas).

---

## 📋 4. Actualización del Playbook y Cierre

### 4.1 Incorporaciones Oficiales al Scrum + TBD Playbook v3.0
1. **Formato oficial del nuevo Sprint Review:** Enfoque en producción, timebox de 4-5 minutos, toggle en vivo y pregunta de valor.
2. **Formato oficial de la nueva Retrospective:** Inspección de Pipeline, Disciplina TBD y Flujo de Valor con matriz de 4 columnas y máximo 3 acciones.
3. **Política de Liberación Segura (Progressive Delivery):** Fases de rollout, telemetría obligatoria y protocolo de Kill Switch.
4. **Gobierno de Toggles:** TTL máximo de 30 días y auditoría quincenal para prevenir la acumulación de deuda técnica.

---

### 4.2 Revisión del Checklist de Fase 1
* [x] **Trunk-Based Development en `main`:** Ramas de vida < 24h, sin ramas de release acumuladas.
* [x] **Pipeline CI/CD en GitHub Actions:** Linting, pruebas unitarias y build de Docker automáticos.
* [x] **Despliegue Continuo a Render:** Auto-deploy activo y verificado en cada push a `main`.
* [x] **Feature Toggles con ConfigCat:** Implementado para desacoplar despliegue de liberación.
* [x] **Definition of Done v3.0 formalizado:** Criterios técnicos, de despliegue, toggles y observabilidad cerrados al 100%.

**Dictamen:** **FASE 1 COMPLETADA AL 100% CON ÉXITO.** 🎉

---

### 4.3 Ronda Final: "¿Qué cambia en nuestro próximo Review y Retro?"

> **Product Owner (Laura):**  
> *“A partir de hoy, nunca más lanzaremos una campaña de marketing asumiendo que 'deploy = listo'; coordinaremos los porcentajes de rollout en ConfigCat observando datos reales.”*

> **Developer Lead (Carlos):**  
> *“Nunca más toleraremos un test flaky en el CI; si el CI se pone rojo, detenemos todo para arreglarlo de inmediato y no dejamos ramas abiertas por días.”*

> **QA Engineer (Mateo):**  
> *“El Review ahora será emocionante porque validaremos el comportamiento en vivo en Render con Toggle ON/OFF y datos de telemetría reales, no en diapositivas.”*

> **Stakeholder de Negocio (Roberto):**  
> *“Ahora entiendo el poder de los Feature Toggles: podemos innovar más rápido y mitigar el riesgo activando funcionalidades gradualmente para nuestros clientes.”*

---
*Fin del Registro de Ejecución del Taller 6.*
