# 📘 Scrum + Trunk-Based Development (TBD) Playbook — Versión 3.0

> **Propósito:** Guía de referencia operativa para equipos de ingeniería y producto que operan en **Continuous Deployment (CD)** con **Trunk-Based Development (TBD)** y **Feature Toggles (ConfigCat)** en entornos cloud (Render + GitHub Actions).

---

## 📑 Índice
1. [Manifiesto de Flujo Continuo: Deploy ≠ Release](#1-manifiesto-de-flujo-continuo-deploy--release)
2. [Adaptación del Sprint Review al Continuous Deployment](#2-adaptación-del-sprint-review-al-continuous-deployment)
3. [Adaptación de la Sprint Retrospective a CD + TBD](#3-adaptación-de-la-sprint-retrospective-a-cd--tbd)
4. [Política de Liberación Segura de Valor (Progressive Delivery)](#4-política-de-liberación-segura-de-valor-progressive-delivery)
5. [Gobierno y Ciclo de Vida de Feature Toggles](#5-gobierno-y-ciclo-de-vida-de-feature-toggles)
6. [Definition of Done (DoD) — Versión 3.0 Definitiva](#6-definition-of-done-dod--versión-30-definitiva)
7. [Checklist de Cierre Fase 1 (100% Completado) y Transición a Fase 2](#7-checklist-de-cierre-fase-1-100-completado-y-transición-a-fase-2)

---

## 1. Manifiesto de Flujo Continuo: Deploy ≠ Release

En el desarrollo tradicional, un *despliegue* significaba encender una funcionalidad para todos los usuarios simultáneamente al final de un ciclo largo ("Big Bang Release"). En nuestro flujo de CD + TBD, establecemos la separación fundamental:

```
+-----------------------------------------------------------------------------------------+
|                                    EL NUEVO FLUJO                                       |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   [Código en Rama Corta] (<24h)                                                        |
|             │                                                                           |
|             ▼                                                                           |
|   [Merge a main con CI Verde] ───────► [DEPLOY AUTOMÁTICO A RENDER]                     |
|                                         (Acción técnica frecuente: N veces por semana)  |
|                                         (Código en producción, protegido por Toggle)    |
|                                                       │                                 |
|                                                       ▼                                 |
|                                         [RELEASE PROGRESIVO DE VALOR]                   |
|                                         (Acción de negocio controlada: ConfigCat)       |
|                                         (Dogfooding ➔ Canary 20% ➔ 100% GA)             |
|                                         (Monitoreado con telemetría en tiempo real)     |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

* **Deploy (Despliegue):** Acto técnico y automatizado. Mover artefactos probados desde `main` al entorno de producción (Render). El código está presente físicamente en los servidores, pero su visibilidad está controlada.
* **Release (Liberación):** Decisión estratégica de negocio y producto. Activar una funcionalidad para los usuarios finales a través de un Feature Toggle (ConfigCat), de forma gradual y monitoreada.

---

## 2. Adaptación del Sprint Review al Continuous Deployment

### 2.1 Principios del Nuevo Review

| Dimensión | Sprint Review Clásico (Scrum Tradicional) | Sprint Review en CD + TBD (Playbook 3.0) |
| :--- | :--- | :--- |
| **Objeto de Demo** | Incremento local o en staging empaquetado para el fin del sprint. | Lo que ya está desplegado en producción (o activable vía toggle). |
| **Naturaleza** | "Todo o nada" (si falló algo, no se muestra nada). | Incremental, granular y desacoplado mediante Feature Toggles. |
| **Momento del Feedback** | Feedback tardío acumulado al final de 2 semanas. | Feedback continuo en producción con datos y telemetría real. |
| **Enfoque de la Sesión** | *"Miren lo que construimos"* (esfuerzo y código). | *"Miren el valor que recibieron (o recibirán) los usuarios"* (impacto y métricas). |
| **Decisión Típica** | "¿Aceptamos o rechazamos la historia para pasar a release?" | "¿Aumentamos el rollout del toggle o activamos el Kill Switch con los datos observados?" |

### 2.2 Estructura Obligatoria de Demostración (Timebox: 4-5 min por ítem)
Cada ítem presentado en el Review debe seguir estrictamente este guion de 5 pasos:

1. **Problema de Usuario:** ¿Qué necesidad, fricción o dolor del cliente resuelve este incremento?
2. **Estado de Exposición:** ¿Está activo para el 100% de los usuarios o protegido detrás de un Feature Toggle en ConfigCat?
3. **Demo en Vivo en Producción (Render):** Demostración interactiva en la URL real de producción.
   * *Si está detrás de toggle:* Mostrar el comportamiento con Toggle OFF (experiencia baseline) y luego con Toggle ON (experiencia mejorada).
4. **Métricas y Evidencia de Valor:** Presentar telemetría real (tasa de conversión, latencia p95, tasa de error, feedback cualitativo de usuarios del Canary cohort).
5. **Pregunta de Cierre al Stakeholder / PO:** *“Con base en estos datos y la demo en vivo, ¿esta funcionalidad está generando el valor de negocio esperado o ajustamos la estrategia de rollout?”*.

### 2.3 Roles Durante el Review
* **Developer (Líder Técnico de la Demo):** Ejecuta la demostración en vivo en Render, explica el estado técnico y manipula el toggle si aplica.
* **Product Owner (Facilitador de Negocio):** Contextualiza el problema del usuario, expone las métricas de negocio y modera el feedback de los stakeholders.
* **Stakeholders / Usuarios:** Prueban la funcionalidad (si tienen acceso Canary) y validan si resuelve el problema de negocio.
* **Equipo Scrum:** Observa las interacciones, captura retroalimentación no contemplada y anota oportunidades de mejora.

---

## 3. Adaptación de la Sprint Retrospective a CD + TBD

### 3.1 Nuevos Focos Obligatorios de Inspección
La Retrospective deja de ser solo una charla de dinámicas interpersonales para convertirse en una **auditoría sistémica del flujo de ingeniería, la salud del pipeline y la disciplina de TBD**:

```
+───────────────────────────────────────────────────────────────────────────────────────+
|                           3 PILARES OBLIGATORIOS DE LA RETRO                          |
+───────────────────────────────────────────────────────────────────────────────────────+
|  1. Salud del Pipeline (CI/CD)  │ 2. Disciplina TBD             │ 3. Flujo de Valor   |
|  ─────────────────────────────  │ ──────────────────────────    │ ──────────────────  |
|  • ¿Cuántas veces falló el CI?  │ • Frecuencia diaria a main    │ • Lead Time real    |
|  • ¿Tuvimos tests flaky?        │ • Vida de ramas (<24 horas)   │ • Tiempo Deploy vs  |
|  • Tiempo de build y deploy     │ • Deuda técnica de toggles    │   Tiempo Release    |
|  • Health checks y rollbacks    │ • Tamaño de PRs / Commits     │ • Impacto en metric |
+───────────────────────────────────────────────────────────────────────────────────────+
```

### 3.2 Dinámica de Retrospective (Formato 4 Columnas)
Se organiza la conversación en 4 columnas estructuradas:
* 🟢 **Lo que funcionó bien en el flujo:** Prácticas, automatizaciones o hábitos que aceleraron la entrega sin fricción.
* 🟡 **Lo que generó fricción:** Retrasos en revisiones, dudas en toggles, lentitud de CI o falta de telemetría.
* 🔴 **Lo que rompió el flujo o generó miedo:** Tests flaky, caídas de health check, ramas de varios días, presión por liberar a ciegas.
* 🚀 **Acciones de mejora (Regla Estricta: Máximo 3):**
  * Toda acción debe tener: **(1) Responsable único**, **(2) Fecha límite / Sprint**, **(3) Criterio de aceptación verificable**.

### 3.3 Preguntas Guía del Facilitador
1. *¿Qué nos impidió integrar diariamente a main?* (¿Slices muy grandes? ¿Miedo a romper? ¿CI lento?).
2. *¿El auto-deploy nos dio más confianza o más miedo?* (¿Confiamos en la suite de tests para que Render despliegue sin supervisión humana?).
3. *¿Los Feature Toggles nos ayudaron a mitigar riesgos o se están convirtiendo en deuda técnica acumulada?*
4. *¿Cumplimos realmente el Definition of Done en cada commit integrado?*

---

## 4. Política de Liberación Segura de Valor (Progressive Delivery)

Para erradicar el miedo a activar funcionalidades en producción, se establece el **Protocolo de Rollout Progresivo en 4 Fases**:

```
[FASE 0: DARK DEPLOY] ──► [FASE 1: DOGFOODING] ──► [FASE 2: CANARY ROLLOUT] ──► [FASE 3: GA (100%)]
  Toggle 0% (OFF)           Interno (@equipo)          Canary (5% - 20%)             Todos los usuarios
  Código en producción      Validación de humo         Monitoreo de SLIs             Feature permanente
  Sin impacto en usuarios   Pruebas exploratorias      Criterio Go/No-Go estricto    Plan de retiro de flag
```

### 4.1 Fases Detalladas de Liberación

| Fase | Audiencia Objetivo | Configuración ConfigCat | Objetivo | Duración Típica |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 0: Dark Deploy** | Ningún usuario (0%) | Flag `OFF` global | Validar que el código compila, despliega y no degrada la app existente. | Inmediato post-deploy |
| **Fase 1: Dogfooding Interno** | Equipo dev, QA y PO (`email ENDS WITH @empresa.com`) | Regla de Targeting por usuario | Validar flujos de punta a punta en producción con datos reales sin afectar clientes. | 24 - 48 horas |
| **Fase 2: Canary Progresivo** | 5% ➔ 20% de usuarios (Hashing determinístico por `userId`) | Regla de Porcentaje de Rollout | Evaluar estabilidad bajo carga real y vigilar anomalías en métricas. | 48 - 72 horas |
| **Fase 3: General Availability (GA)** | 100% de usuarios | Flag `ON` para todos | Liberación completa de la funcionalidad. Comienza el timer de obsolescencia del toggle. | Permanente hasta cleanup |

### 4.2 Criterios Estrictos de Go / No-Go y Política de Kill Switch
Antes de promover un toggle de una fase a la siguiente, deben cumplirse los siguientes umbrales:

* **Tasa de Errores (HTTP 5xx / Excepciones no controladas):** Debe mantenerse estrictamente **< 0.5%**.
  * Si la tasa supera el **1.0%**, se activa inmediatamente el **KILL SWITCH (Rollback en ConfigCat a 0% en segundos)**.
* **Latencia de Checkout / Transacciones:** p95 debe ser **< 250 ms**.
* **Health Check de Producción:** 100% de disponibilidad continua (código HTTP 200).
* **Métricas de Negocio:** No debe existir caída estadísticamente significativa en la conversión o transacciones exitosas.

---

## 5. Gobierno y Ciclo de Vida de Feature Toggles

Un Feature Toggle es un **préstamo técnico con alto interés**. Si no se paga retirando el código condicional, degrada la arquitectura y crea caminos de código muertos.

### 5.1 Reglas de Gestión de Toggles
1. **TTL (Time to Live) Máximo:**
   * **Toggles de Release:** Máximo **30 días naturales** desde su creación.
   * Si una funcionalidad alcanza el 100% de rollout y es estable durante 7 días, se programa obligatoriamente su retiro en el siguiente sprint.
2. **Propiedad y Responsabilidad:**
   * Todo toggle en ConfigCat debe tener asignado:
     - **Owner técnico:** Ingeniero responsable de su implementación y retiro.
     - **Owner de producto:** PO responsable de autorizar los cambios de porcentaje.
     - **Ticket de limpieza (Cleanup Issue):** Creado en GitHub Projects en el mismo momento en que se crea el toggle.
3. **Auditoría Quincenal de Deuda:**
   * En cada Retrospective se revisa el inventario de flags activos. Cualquier flag con **más de 30 días** es clasificado como **Deuda Crítica** y bloquea la creación de nuevos flags hasta que se refactorice.

---

## 6. Definition of Done (DoD) — Versión 3.0 Definitiva

Para que cualquier historia de usuario, slice técnico o bugfix se considere **TERMINADO (Done)**, debe satisfacer la totalidad de los siguientes criterios:

### 🧩 1. Criterios Técnicos y TBD
* [x] Rama corta con tiempo de vida inferior a 24 horas (`feat/small-slice`).
* [x] Pruebas unitarias y de integración pasando al 100% en local y en GitHub Actions.
* [x] Cero tolerancia a pruebas inestables (*flaky tests*): si una prueba es inestable, se repara o se aísla inmediatamente antes del merge.
* [x] Revisión de código (Code Review) enfocada en legibilidad, arquitectura limpia y manejo de errores.

### 🚀 2. Criterios de Despliegue y Pipeline (Render)
* [x] Merge a `main` mediante Pull Request aprobado con CI en verde.
* [x] Despliegue automático (*Auto-Deploy*) ejecutado exitosamente en Render sin intervención manual.
* [x] Endpoint de Health Check (`/api/health`) respondiendo HTTP 200 OK inmediatamente post-deploy.

### 🚩 3. Criterios de Feature Toggle (ConfigCat)
* [x] Si la funcionalidad está incompleta, en validación o sujeta a rollout progresivo, está obligatoriamente encapsulada en un Feature Toggle de ConfigCat.
* [x] Flag configurado en modo `OFF` por defecto para producción hasta autorización formal de rollout.
* [x] Ticket de retiro y limpieza del toggle creado en el backlog con fecha límite de vencimiento (TTL ≤ 30 días).

### 📊 4. Criterios de Observabilidad y Negocio
* [x] Telemetría y métricas clave configuradas y visibles (tasa de error, latencia, eventos de negocio).
* [x] Criterios de Go / No-Go y procedimiento de Kill Switch documentados y acordados entre el Developer y el PO.
* [x] El PO ha validado la funcionalidad en ambiente de producción bajo el flag y aprueba el inicio del plan de rollout progresivo.

---

## 7. Checklist de Cierre Fase 1 (100% Completado) y Transición a Fase 2

### ✅ Estado Oficial de Fase 1
* [x] **Trunk-Based Development operativo:** Ramas de corta vida integrando continuamente a `main`.
* [x] **Pipeline de CI/CD robusto:** GitHub Actions validando sintaxis, pruebas automatizadas y build de contenedor Docker.
* [x] **Auto-deploy continuo:** Integración directa con Render que despliega cada cambio aprobado a `main`.
* [x] **Feature Toggles integrados:** SDK de ConfigCat conectado y operando tanto en backend como en frontend.
* [x] **Definition of Done v3.0 formalizado y aplicado:** Criterios técnicos, despliegue, toggles y observabilidad estandarizados.

### 🎯 Roadmap hacia Fase 2 (Excelencia en Entrega Continua)
1. **Canary Releases Automatizados:** Promoción automática de porcentajes de rollout en ConfigCat guiada por alertas de métricas de Render/Datadog.
2. **Auto-Rollback Guiado por SLIs:** Webhook de Render o ConfigCat que apaga el flag si la tasa de error supera el umbral sin intervención humana.
3. **Pipeline de Limpieza Automatizada de Toggles:** Bot que detecta flags con más de 30 días y genera automáticamente el Pull Request de refactorización.

---
*Playbook Scrum + TBD v3.0 — Aprobado por el Equipo de Ingeniería y Producto.*
