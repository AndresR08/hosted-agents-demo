import type { Locale } from "@/state/types";

/**
 * All translatable UI chrome — labels, headings, buttons, captions.
 *
 * Flat key → string per locale, on purpose: this app has a few hundred short
 * strings, not a multi-page product. A nested-namespace i18n library would
 * be overhead this scale doesn't need — see useTranslation.ts.
 */
export const translations: Record<Locale, Record<string, string>> = {
  en: {
    "common.cancel": "Cancel",

    "gatewayNav.label": "Gateway screens",
    "gatewayNav.live": "Live",
    "gatewayNav.reference": "Reference",

    "apim.title": "Reference",
    "apim.question": "What else does API Management offer?",
    "apim.bannerTitle": "Reference material — not this deployment",
    "apim.bannerBody": "This screen describes the Azure API Management product. Most of it is not configured in this lab, and nothing here is read from Azure except the tier in use, marked below. Each capability says whether this lab actually uses it.",
    "apim.pillUsed": "Used here",
    "apim.pillNotUsed": "Not in this lab",
    "apim.footer": "Reference material about the API Management product. The only value read from this deployment is the tier in use, badged where it appears.",

    "apim.tiersTitle": "Choosing a tier has measurable consequences",
    "apim.tiersSubtitle": "Both tiers below were deployed and measured in this subscription. The cold start is a call the gateway rejects with 401 before reaching any backend — it times the gateway waking up, nothing else.",
    "apim.tiersLive": "This deployment: {sku}",
    "apim.tiersUnknown": "Tier not reported by the broker",
    "apim.tierCurrent": "in use",
    "apim.colTier": "Tier",
    "apim.colCost": "Cost",
    "apim.colColdStart": "Cold start",
    "apim.colFit": "Fits",
    "apim.tiersFootnote": "A 12-minute idle period shows only ~1.4 s and reads as acceptable — the instance is still warm. Measuring with too short a gap is how this decision gets made wrongly.",

    "apim.routingTitle": "How is the model chosen for each agent?",
    "apim.routingLead": "API Management does not know, and does not decide. There is no per-agent routing — a common and reasonable assumption, but not what happens here.",
    "apim.routingPunchline": "The choice lives in the agent's configuration at registration time. Changing the model means a new agent version with an updated environment variable — it is not dynamic at request time.",

    "header.productName": "Foundry Hosted Agents",
    "header.tagline": "Custom frameworks, governed by API Management",
    "header.statusLive": "Azure Live",
    "header.statusSimulation": "Simulation",
    "header.settingsLabel": "Settings",
    "header.homeLabel": "Return to Start",
    "header.confirmReturnTitle": "Return to the landing page?",
    "header.confirmReturnBody": "The current conversation will be lost.",

    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.languageEnglish": "English",
    "settings.languageSpanish": "Español",
    "settings.theme": "Theme",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeSystem": "System",
    "settings.demoMode": "Demo Mode",
    "settings.demoModeLive": "Azure Live",
    "settings.demoModeSimulation": "Simulation",
    "settings.reducedMotion": "Reduced Motion",
    "settings.reducedMotionOn": "On",
    "settings.reducedMotionOff": "Off",
    "settings.close": "Close",

    "landing.headline": "Different frameworks. Same platform.",
    "landing.description":
      "Containers your teams build, running as Microsoft Foundry Hosted Agents — governed by Azure API Management, observed through Azure Monitor.",
    "landing.startButton": "Start Executive Demonstration",
    "landing.openSettings": "Open Settings",

    "assistant.title": "Your Agent",
    "assistant.container": "container",
    "assistant.you": "You",
    "assistant.placeholder": "Ask a question…",
    "assistant.send": "Ask",
    "assistant.sending": "Asking…",
    "assistant.viaApim": "via API Management",
    "assistant.liveError": "Live call failed — check that the broker is running",
    "assistant.newConversation": "New conversation",
    "assistant.showEarlier": "Show earlier messages",
    "assistant.welcome":
      "A container your team built is answering, through Azure API Management.\n\nAsk it anything about this lab, or about itself.",

    "journey.caption":
      "The same path and the same policy, whichever framework answers.",
    "journey.nodeClient": "Client",
    "journey.nodeAgent": "Agent",
    "journey.totalLatency": "Total",

    "accessControl.statement": "The client holds one key. It never touches Azure.",
    "accessControl.runAll": "Run all three (S)",
    "accessControl.showPolicy": "Show the live policy",
    "accessControl.emptyState": "Run the three attempts to see the outcomes.",
    "accessControl.simulationNote": "Simulation does not call the gateway.",
    "accessControl.policyTitle": "Access Control — hosted-agent-policy.xml (inbound)",
    "accessControl.rejected": "rejected",
    "accessControl.policyViewer.search": "Search policy…",
    "accessControl.policyViewer.copy": "Copy",
    "accessControl.policyViewer.matchesLabel": "matches",

    // ── ② Framework Experience ─────────────────────────────────────────
    // Framework positioning is quoted from each framework's own README in
    // this repository; capability rows are read from the two main.py files.
    // Nothing here ranks the two, and no timing appears anywhere.

    // Retained after ⑤ Controls was merged into ⑤ Operations: these are the
    // approved, translated catalogue Simulation mode falls back to when the
    // broker's live ARM read is unavailable (OperationsStop).
    "controls.availableCaption":
      "A policy change at a control point you already own — not a re-architecture.",
    "controls.item.subscriptionKey": "Subscription-key authentication, per-consumer revocation",
    "controls.item.managedIdentity": "Managed-identity brokering, both hops",
    "controls.item.headerEnforcement": "Header enforcement and preview feature gating",
    "controls.item.auditLogging": "Full prompt / completion audit logging",
    "controls.item.diagnostics": "Diagnostics to Log Analytics and App Insights",
    "controls.item.contentFiltering": "Content filtering at the model (RAI DefaultV2)",
    "controls.item.registryRbac": "Least-privilege, repository-scoped registry RBAC",
    "controls.item.rateLimiting": "Token rate limiting and per-consumer quotas",
    "controls.item.semanticCaching": "Semantic caching for cost reduction",
    "controls.item.loadBalancing": "Backend load balancing and circuit breaking",
    "controls.item.privateNetworking": "Private networking / Private Link",
    "controls.item.entraOnly": "Entra-only authentication",
    "controls.item.keyVault": "Secret management via Key Vault",

    "header.targetAgentLabel": "Agent targeted by the next question",
    "journey.gatewayOverhead": "Gateway cost",
    "journey.segment.gateway": "gateway",
    "journey.segment.agent": "agent",
    "journey.segment.model": "model",

    "obs.heading": "Observability",
    "obs.question": "What evidence does the platform generate?",
    "obs.kpi.totalTokens": "Total tokens",
    "obs.kpi.promptTokens": "Prompt",
    "obs.kpi.completionTokens": "Completion",
    "obs.kpi.totalLatency": "Latency",
    "obs.kpi.gatewayOverhead": "Gateway",
    "obs.timeline.title": "Where the time went",
    "obs.gov.evidenced": "Evidenced:",
    "obs.kpi.modelLatency": "Model latency",
    "obs.group.technical": "Technical details",
    "obs.timeline.pending": "Per-hop timing appears once Azure Monitor has ingested this request.",
    "obs.hop.apimInbound": "API Management",
    "obs.hop.apimInboundSub": "inbound",
    "obs.hop.agent": "Hosted Agent",
    "obs.hop.agentSub": "processing",
    "obs.hop.apimModel": "API Management",
    "obs.hop.apimModelSub": "model hop",
    "obs.hop.model": "gpt-5-mini",
    "obs.hop.modelSub": "inference",
    "obs.hop.total": "End to end",
    "obs.gov.statusActive": "Enforced",
    "obs.gov.statusAvailable": "Not enabled",
    "obs.gov.statusAbsent": "Not deployed",
    "obs.gov.catalogue": "Control catalogue — this deployment",
    "obs.gov.catalogueNote":
      "What this control point enforces today, and what it can enforce. Ask a question and each active control cites the observation that proves it.",

    // ── ⑤ Operations (telemetry + governance catalogue) ────────────────
    "obs.unavailable": "Unavailable in this deployment",
    "obs.unavailableReason": "This value is not produced by the deployed lab.",
    "obs.sourceLabel": "Source:",
    "obs.copy": "Copy record",
    "obs.expand": "Full request detail",
    "obs.prompt": "Prompt",
    "obs.completion": "Response",
    "obs.showMore": "Show full messages",
    "obs.showLess": "Collapse messages",
    "obs.contextInjected": "The logged prompt also contains demo reference context added by the broker.",
    "obs.empty.simulation": "Simulation produces no Azure telemetry. Switch to Azure Live and ask a question to fill this stop with real data.",
    "obs.empty.noRequest": "Ask a question. Its gateway logs, token accounting and distributed trace appear here.",
    "obs.empty.unknownAsk": "This request is no longer known to the broker. Correlation state is in-memory and clears when the broker restarts — ask a new question to see fresh telemetry.",
    "obs.empty.loading": "Retrieving telemetry…",

    "obs.group.execution": "Execution",
    "obs.group.tokens": "Token accounting",
    "obs.group.identity": "Identity & correlation",

    "obs.field.agent": "Agent",
    "obs.field.framework": "Framework",
    "obs.field.model": "Model",
    "obs.field.deployment": "Deployment",
    "obs.field.region": "Region",
    "obs.field.gatewayApi": "Gateway API",
    "obs.field.status": "HTTP status",
    "obs.field.latency": "Total latency",
    "obs.field.agentServer": "Agent server time",
    "obs.field.corroborated": "Corroborated by",
    "obs.field.promptChars": "Prompt length",
    "obs.field.completionChars": "Response length",
    "obs.field.requestId": "Request ID",
    "obs.field.correlationId": "Correlation ID",
    "obs.field.traceId": "Trace ID",
    "obs.field.conversationId": "Conversation ID",
    "obs.field.subscription": "Subscription",
    "obs.field.timestamp": "Timestamp",

    "obs.gov.active": "Active — evidenced for this request",
    "obs.gov.available": "Available at this control point — not configured",
    "obs.gov.absent": "Not present in this lab",

    "obs.detail.title": "Request detail",
    "obs.detail.timeline": "Execution timeline",
    "obs.detail.correlation": "Correlation",
    "obs.detail.hop1Correlation": "Correlation ID — hop 1 (client → agent)",
    "obs.detail.hop2Correlation": "Correlation ID — hop 2 (agent → model)",
    "obs.detail.apimRequestId": "APIM request ID",
    "obs.detail.route": "Gateway route",
    "obs.detail.operation": "Operation",
    "obs.detail.apiRevision": "API revision",
    "obs.detail.url": "URL",
    "obs.detail.backendStatus": "Backend status",
    "obs.detail.callerIp": "Caller IP",
    "obs.detail.requestBytes": "Request size",
    "obs.detail.responseBytes": "Response size",
    "obs.detail.runtime": "Runtime",
    "obs.detail.cluster": "Serving cluster",
    "obs.detail.platform": "Agent server",
    "obs.detail.genai": "OpenTelemetry GenAI attributes",
    "obs.detail.genaiNote": "Emitted by the agent container itself, independently of the gateway — which is why the token counts here corroborate rather than duplicate those from API Management.",
    "obs.detail.unavailable": "Explicitly unavailable",
    "obs.detail.unavailableNote": "These are named rather than omitted. A production deployment would add them; this environment does not produce them, and nothing on screen estimates them.",
    "obs.detail.cost": "Cost per request",
    "obs.detail.queueTime": "Queue time",

    // ── Audit Record — GET /api/audit-record (obs.auditRecord.*) ────────
    // Distinct from the per-request detail above: this reads
    // ApiManagementGatewayLlmLog directly and needs no `lastAskId`, so it
    // has something to show even before this browser session has asked
    // anything — durable platform evidence, not a demo artifact.
    "obs.auditRecord.title": "Latest captured interaction",
    "obs.auditRecord.sourceNote": "Read directly from the gateway's own log — independent of what has been asked in this session.",
    "obs.auditRecord.empty": "No captured interaction yet for the selected agent.",
    "obs.auditRecord.simulation": "Simulation does not query Azure logs.",
    "obs.auditRecord.notAttributed": "Not attributable to a specific agent from this log alone.",
    "obs.session.title": "This session's most recent request",

    // ── Presenter maintenance ──────────────────────────────────────────
    "maintenance.status.running": "Running…",
    "maintenance.status.completed": "Completed",
    "maintenance.status.failed": "Failed",

    "maintenance.action.ping": "Ping Broker",
    "maintenance.action.warm-agent": "Warm Agent",
    "maintenance.action.test-apim": "Test APIM",
    "maintenance.action.test-hosted-agent": "Test Hosted Agent",
    "maintenance.action.refresh-agent-registry": "Refresh Agent Registry",
    "maintenance.action.refresh-azure-status": "Refresh Azure Status",
    "maintenance.action.reload-audit-logs": "Reload Audit Logs",
    "maintenance.action.reload-policies": "Reload Policies",
    "maintenance.action.refresh-deployment-info": "Refresh Deployment Info",

    // ── The guided walkthrough ─────────────────────────────────────────
    // Five stops in the order the lab itself builds. Each `question` is the
    // single question that stop exists to answer; if a stop ever needs a
    // second one, it is two stops.
    "rail.label": "The walkthrough",

    // ── Console shell — the four top-level sections ─────────────────────
    // ARCHITECTURE.md Navigation labels only — no section owns
    // translation strings of its own beyond this; each renders existing
    // stops unchanged.
    "nav.agents": "Agents",
    "nav.gateway": "Gateway",
    "nav.observability": "Observability",
    "nav.platform": "Platform",

    "copilot.open": "Ask the agent",
    "copilot.close": "Close",
    "copilot.subtitle":
      "The answer comes from a deployed container, through the gateway.",

    // ── ② Hosted Agents ────────────────────────────────────────────────
    // The four steps are the notebook's own (README.md §Get Started); every
    // fact beside them is read from the Foundry registry or from ACR.

    "ha.fact.image": "Container image",
    "ha.fact.digest": "Image digest",
    "ha.fact.pushed": "Pushed to ACR",
    "ha.fact.version": "Hosted Agent",
    "ha.fact.registered": "Version registered",
    "ha.fact.status": "Status",
    "ha.fact.protocol": "Protocol",
    "ha.fact.cpu": "CPU",
    "ha.fact.memory": "Memory",
    "ha.fact.env": "Environment variables",
    "ha.envNote": "Keys only. Values are never read into this application.",
    "agents.overview.frameworkNote": "Not reported by Foundry — derived from the registered agent name.",
    "ha.simulation": "The Foundry registry is not read in Simulation.",
    "ha.unavailable": "Not returned by this read",
    "agents.detail.name": "Name",
    "agents.detail.description": "Description",
    "agents.detail.version": "Current version",
    "agents.detail.containerProtocolVersions": "Container protocol versions",
    "agents.detail.updatedAt": "Updated",
    "agents.versions.title": "Versions",
    "agents.versions.version": "Version",
    "agents.versions.empty": "No versions found for this agent.",

    // ── Agents — console view (ARCHITECTURE.md) ──────
    // List + selection + overview. Fact labels reuse "ha.*" and action
    // labels reuse "maintenance.*" — both already describe exactly what
    // this screen shows or does; no duplicate strings.
    "agents.heading": "Agents",
    "agents.question": "What agents do I have deployed, and what state are they in?",
    "agents.list.title": "Registered agents",
    "agents.list.framework": "Framework",
    "agents.list.empty": "No hosted agents are registered in this Foundry project yet.",
    "agents.overview.title": "Overview",
    "agents.overview.empty": "Select an agent to see its overview.",
    "agents.overview.actionsTitle": "Actions",

    // ── Agent › Run (ARCHITECTURE.md) — single-turn, reuses
    // POST /api/ask exactly as the copilot does. No history, no streaming,
    // no image — those belong to a future /invoke endpoint, not this.
    "agents.run.title": "Run",
    "agents.run.empty": "Invoke this agent directly. This uses its own endpoint, separate from the copilot's.",
    "agents.run.promptLabel": "Prompt",
    "agents.run.answerLabel": "Response",
    "agents.run.simulationNote": "Simulation does not call the agent. Switch to Azure Live to invoke a real agent.",
    "agents.run.runId": "Run ID",
    "agents.run.agentName": "Agent",
    "agents.run.startedAt": "Started",
    "agents.run.finishedAt": "Finished",
    "agents.run.duration": "Duration",
    "agents.run.model": "Model",
    "agents.run.usage": "Usage",
    "agents.run.recentTitle": "Recent runs",
    "agents.run.invoking": "Invoking…",

    // ── Agent › Create (POST /api/agents) ───────────────────────────────
    "agents.create.trigger": "Create agent",
    "agents.create.title": "Create agent",
    "agents.create.namePlaceholder": "e.g. my-new-agent",
    "agents.create.imagePlaceholder": "registry.azurecr.io/my-agent:1",
    "agents.create.submit": "Create",
    "agents.create.creating": "Creating…",
    "agents.create.requiredNote": "Name, container image, CPU and memory are required.",

    "agents.delete.trigger": "Delete agent",
    "agents.delete.title": "Delete agent",
    "agents.delete.warning":
      "This permanently deletes the agent and all of its versions from Foundry. This cannot be undone.",
    "agents.delete.confirmLabel": "Type the agent name to confirm",
    "agents.delete.submit": "Delete",
    "agents.delete.deleting": "Deleting…",

    // ── Gateway ───────────────────────────────────────────────────────
    "gw.heading": "Gateway",
    "gw.question": "How do clients reach the agent?",
    "gw.route.title": "How the agent is addressed",
    "gw.route.note":
      "The agent name is a segment of the URL, so one API serves any number of agents. Deploying the tenth changes no gateway configuration.",
    "gw.route.unavailable": "This deployment did not report its route.",
    "gw.route.segmentLabel": "agent name",
    "gw.path.title": "What the request crosses",
    "gw.boundary.title": "Which credentials are accepted",

    // ── ⑤ Operations ───────────────────────────────────────────────────
    "ops.caption":
      "Enforced here, versus available at the same control point and not switched on. Turning any of it on is configuration, not a rebuild.",

    // ── Platform (ARCHITECTURE.md) ─────────────────────────
    "platform.heading": "Platform",
    "platform.question": "What is deployed, and what does the operations team administer?",
    "platform.environment.title": "Environment",
    "platform.environment.resourceGroup": "Resource group",
    "platform.environment.resourceCount": "Resources",
    "platform.environment.unavailable": "This deployment did not report its environment.",
  },
  es: {
    "common.cancel": "Cancelar",

    "gatewayNav.label": "Pantallas del gateway",
    "gatewayNav.live": "En vivo",
    "gatewayNav.reference": "Referencia",

    "apim.title": "Referencia",
    "apim.question": "¿Qué más ofrece API Management?",
    "apim.bannerTitle": "Material de referencia — no es este despliegue",
    "apim.bannerBody": "Esta pantalla describe el producto Azure API Management. La mayor parte no está configurada en este laboratorio, y nada de aquí se lee de Azure salvo el tier en uso, señalado abajo. Cada capacidad indica si este laboratorio la usa realmente.",
    "apim.pillUsed": "Se usa aquí",
    "apim.pillNotUsed": "No en este lab",
    "apim.footer": "Material de referencia sobre el producto API Management. El único valor leído de este despliegue es el tier en uso, señalado donde aparece.",

    "apim.tiersTitle": "Elegir un tier tiene consecuencias medibles",
    "apim.tiersSubtitle": "Ambos tiers se desplegaron y midieron en esta suscripción. El arranque en frío es una llamada que el gateway rechaza con 401 antes de llegar a ningún backend — mide al gateway despertando, nada más.",
    "apim.tiersLive": "Este despliegue: {sku}",
    "apim.tiersUnknown": "El broker no reportó el tier",
    "apim.tierCurrent": "en uso",
    "apim.colTier": "Tier",
    "apim.colCost": "Costo",
    "apim.colColdStart": "Arranque en frío",
    "apim.colFit": "Sirve para",
    "apim.tiersFootnote": "Con 12 minutos de reposo aparecen solo ~1,4 s y parece aceptable — la instancia sigue caliente. Medir con un hueco demasiado corto es como esta decisión se toma mal.",

    "apim.routingTitle": "¿Cómo se decide qué modelo usa cada agente?",
    "apim.routingLead": "API Management no lo sabe ni lo decide. No hay enrutamiento por agente — es una suposición común y razonable, pero no es lo que ocurre aquí.",
    "apim.routingPunchline": "La decisión vive en la configuración del agente al registrarlo. Cambiar de modelo implica una nueva versión del agente con la variable de entorno actualizada — no es dinámico en tiempo de petición.",

    "header.productName": "Foundry Hosted Agents",
    "header.tagline": "Frameworks personalizados, gobernados por API Management",
    "header.statusLive": "Azure en vivo",
    "header.statusSimulation": "Simulación",
    "header.settingsLabel": "Configuración",
    "header.homeLabel": "Volver al inicio",
    "header.confirmReturnTitle": "¿Volver a la página de inicio?",
    "header.confirmReturnBody": "Se perderá la conversación actual.",

    "settings.title": "Configuración",
    "settings.language": "Idioma",
    "settings.languageEnglish": "English",
    "settings.languageSpanish": "Español",
    "settings.theme": "Tema",
    "settings.themeLight": "Claro",
    "settings.themeDark": "Oscuro",
    "settings.themeSystem": "Sistema",
    "settings.demoMode": "Modo de demostración",
    "settings.demoModeLive": "Azure en vivo",
    "settings.demoModeSimulation": "Simulación",
    "settings.reducedMotion": "Movimiento reducido",
    "settings.reducedMotionOn": "Activado",
    "settings.reducedMotionOff": "Desactivado",
    "settings.close": "Cerrar",

    "landing.headline": "Frameworks distintos. La misma plataforma.",
    "landing.description":
      "Contenedores construidos por sus equipos, ejecutándose como Microsoft Foundry Hosted Agents: gobernados por Azure API Management y observados con Azure Monitor.",
    "landing.startButton": "Iniciar demostración ejecutiva",
    "landing.openSettings": "Abrir configuración",

    "assistant.title": "Tu agente",
    "assistant.container": "contenedor",
    "assistant.you": "Tú",
    "assistant.placeholder": "Haz una pregunta…",
    "assistant.send": "Preguntar",
    "assistant.sending": "Preguntando…",
    "assistant.viaApim": "a través de API Management",
    "assistant.liveError": "Falló la llamada en vivo — verifique que el broker esté en ejecución",
    "assistant.newConversation": "Nueva conversación",
    "assistant.showEarlier": "Mostrar mensajes anteriores",
    "assistant.welcome":
      "Quien responde es un contenedor construido por su equipo, a través de Azure API Management.\n\nPregúntele lo que quiera sobre este laboratorio, o sobre sí mismo.",

    "journey.caption":
      "La misma ruta y la misma política, responda el framework que responda.",
    "journey.nodeClient": "Cliente",
    "journey.nodeAgent": "Agente",
    "journey.totalLatency": "Total",

    "accessControl.statement": "El cliente conserva una sola clave. Nunca toca Azure.",
    "accessControl.runAll": "Ejecutar los tres (S)",
    "accessControl.showPolicy": "Mostrar la política en vivo",
    "accessControl.emptyState": "Ejecuta los tres intentos para ver los resultados.",
    "accessControl.simulationNote": "Simulación no llama a la puerta de enlace.",
    "accessControl.policyTitle": "Control de acceso — hosted-agent-policy.xml (entrada)",
    "accessControl.rejected": "rechazado",
    "accessControl.policyViewer.search": "Buscar en la política…",
    "accessControl.policyViewer.copy": "Copiar",
    "accessControl.policyViewer.matchesLabel": "coincidencias",

    // ── ② Experiencia de frameworks ────────────────────────────────────
    // El posicionamiento se cita del README de cada framework en este
    // repositorio; las filas de capacidades se leen de los dos main.py.
    // Nada de esto clasifica a uno por encima del otro, y no aparece
    // ningún tiempo en ninguna parte.

    // Se conservan tras fusionar ⑤ Controles en ⑤ Operaciones: es el catálogo
    // aprobado y traducido al que recurre el modo Simulación cuando no hay
    // lectura en vivo de ARM (OperationsStop).
    "controls.availableCaption":
      "Un cambio de política en un punto de control que ya posees — no una re-arquitectura.",
    "controls.item.subscriptionKey":
      "Autenticación por clave de suscripción, revocación por consumidor",
    "controls.item.managedIdentity": "Intermediación por identidad administrada en ambos saltos",
    "controls.item.headerEnforcement":
      "Aplicación de encabezados y activación de funciones en vista previa",
    "controls.item.auditLogging": "Registro de auditoría completo de solicitud y respuesta",
    "controls.item.diagnostics": "Diagnósticos hacia Log Analytics y Application Insights",
    "controls.item.contentFiltering": "Filtrado de contenido en el modelo (RAI DefaultV2)",
    "controls.item.registryRbac":
      "RBAC de mínimo privilegio, delimitado por repositorio, en el registro",
    "controls.item.rateLimiting": "Límite de tokens y cuotas por consumidor",
    "controls.item.semanticCaching": "Caché semántica para reducir costos",
    "controls.item.loadBalancing": "Balanceo de carga y disyuntor de circuito en el backend",
    "controls.item.privateNetworking": "Redes privadas / Private Link",
    "controls.item.entraOnly": "Autenticación exclusiva con Entra",
    "controls.item.keyVault": "Gestión de secretos mediante Key Vault",

    "header.targetAgentLabel": "Agente al que se dirigirá la próxima pregunta",
    "journey.gatewayOverhead": "Costo de la puerta de enlace",
    "journey.segment.gateway": "gateway",
    "journey.segment.agent": "agente",
    "journey.segment.model": "modelo",

    "obs.heading": "Observabilidad",
    "obs.question": "¿Qué evidencia genera la plataforma?",
    "obs.kpi.totalTokens": "Tokens totales",
    "obs.kpi.promptTokens": "Entrada",
    "obs.kpi.completionTokens": "Salida",
    "obs.kpi.totalLatency": "Latencia",
    "obs.kpi.gatewayOverhead": "Gateway",
    "obs.timeline.title": "Dónde se fue el tiempo",
    "obs.gov.evidenced": "Evidenciado:",
    "obs.kpi.modelLatency": "Latencia del modelo",
    "obs.group.technical": "Detalles técnicos",
    "obs.timeline.pending": "Los tiempos por salto aparecen cuando Azure Monitor ingiere esta solicitud.",
    "obs.hop.apimInbound": "API Management",
    "obs.hop.apimInboundSub": "entrada",
    "obs.hop.agent": "Agente alojado",
    "obs.hop.agentSub": "procesamiento",
    "obs.hop.apimModel": "API Management",
    "obs.hop.apimModelSub": "salto al modelo",
    "obs.hop.model": "gpt-5-mini",
    "obs.hop.modelSub": "inferencia",
    "obs.hop.total": "Extremo a extremo",
    "obs.gov.statusActive": "Aplicado",
    "obs.gov.statusAvailable": "No habilitado",
    "obs.gov.statusAbsent": "No desplegado",
    "obs.gov.catalogue": "Catálogo de controles — este despliegue",
    "obs.gov.catalogueNote":
      "Lo que este punto de control aplica hoy y lo que puede aplicar. Haga una pregunta y cada control activo citará la observación que lo demuestra.",

    // ── ⑤ Operaciones (telemetría + catálogo de gobernanza) ────────────
    "obs.unavailable": "No disponible en este despliegue",
    "obs.unavailableReason": "Este valor no lo produce el laboratorio desplegado.",
    "obs.sourceLabel": "Origen:",
    "obs.copy": "Copiar registro",
    "obs.expand": "Detalle completo de la solicitud",
    "obs.prompt": "Solicitud",
    "obs.completion": "Respuesta",
    "obs.showMore": "Ver mensajes completos",
    "obs.showLess": "Contraer mensajes",
    "obs.contextInjected": "La solicitud registrada también contiene contexto de referencia añadido por el broker.",
    "obs.empty.simulation": "La Simulación no produce telemetría de Azure. Cambie a Azure en vivo y haga una pregunta para llenar esta etapa con datos reales.",
    "obs.empty.noRequest": "Haga una pregunta. Sus registros, el conteo de tokens y la traza distribuida aparecen aquí.",
    "obs.empty.unknownAsk": "El broker ya no reconoce esta solicitud. El estado de correlación vive en memoria y se borra al reiniciar el broker — haga una nueva pregunta para ver telemetría fresca.",
    "obs.empty.loading": "Recuperando telemetría…",

    "obs.group.execution": "Ejecución",
    "obs.group.tokens": "Conteo de tokens",
    "obs.group.identity": "Identidad y correlación",

    "obs.field.agent": "Agente",
    "obs.field.framework": "Marco",
    "obs.field.model": "Modelo",
    "obs.field.deployment": "Implementación",
    "obs.field.region": "Región",
    "obs.field.gatewayApi": "API de la puerta de enlace",
    "obs.field.status": "Estado HTTP",
    "obs.field.latency": "Latencia total",
    "obs.field.agentServer": "Tiempo del servidor del agente",
    "obs.field.corroborated": "Corroborado por",
    "obs.field.promptChars": "Longitud de la solicitud",
    "obs.field.completionChars": "Longitud de la respuesta",
    "obs.field.requestId": "ID de solicitud",
    "obs.field.correlationId": "ID de correlación",
    "obs.field.traceId": "ID de traza",
    "obs.field.conversationId": "ID de conversación",
    "obs.field.subscription": "Suscripción",
    "obs.field.timestamp": "Marca de tiempo",

    "obs.gov.active": "Activo — evidenciado en esta solicitud",
    "obs.gov.available": "Disponible en este punto de control — no configurado",
    "obs.gov.absent": "No presente en este laboratorio",

    "obs.detail.title": "Detalle de la solicitud",
    "obs.detail.timeline": "Línea de tiempo de ejecución",
    "obs.detail.correlation": "Correlación",
    "obs.detail.hop1Correlation": "ID de correlación — salto 1 (cliente → agente)",
    "obs.detail.hop2Correlation": "ID de correlación — salto 2 (agente → modelo)",
    "obs.detail.apimRequestId": "ID de solicitud de APIM",
    "obs.detail.route": "Ruta de la puerta de enlace",
    "obs.detail.operation": "Operación",
    "obs.detail.apiRevision": "Revisión de la API",
    "obs.detail.url": "URL",
    "obs.detail.backendStatus": "Estado del backend",
    "obs.detail.callerIp": "IP del llamante",
    "obs.detail.requestBytes": "Tamaño de la solicitud",
    "obs.detail.responseBytes": "Tamaño de la respuesta",
    "obs.detail.runtime": "Entorno de ejecución",
    "obs.detail.cluster": "Clúster que atendió",
    "obs.detail.platform": "Servidor del agente",
    "obs.detail.genai": "Atributos GenAI de OpenTelemetry",
    "obs.detail.genaiNote": "Emitidos por el propio contenedor del agente, con independencia de la puerta de enlace — por eso los conteos de tokens aquí corroboran, no duplican, los de API Management.",
    "obs.detail.unavailable": "Explícitamente no disponible",
    "obs.detail.unavailableNote": "Se nombran en lugar de omitirse. Un despliegue de producción los añadiría; este entorno no los produce y nada en pantalla los estima.",
    "obs.detail.cost": "Costo por solicitud",
    "obs.detail.queueTime": "Tiempo en cola",

    // ── Registro de auditoría — GET /api/audit-record ────────────────────
    "obs.auditRecord.title": "Última interacción capturada",
    "obs.auditRecord.sourceNote": "Leído directamente del registro de la puerta de enlace — independiente de lo preguntado en esta sesión.",
    "obs.auditRecord.empty": "Aún no hay una interacción capturada para el agente seleccionado.",
    "obs.auditRecord.simulation": "Simulación no consulta los registros de Azure.",
    "obs.auditRecord.notAttributed": "No se puede atribuir a un agente específico solo con este registro.",
    "obs.session.title": "La solicitud más reciente de esta sesión",

    // ── Mantenimiento del presentador ──────────────────────────────────
    "maintenance.status.running": "Ejecutando…",
    "maintenance.status.completed": "Completado",
    "maintenance.status.failed": "Fallido",

    "maintenance.action.ping": "Comprobar broker",
    "maintenance.action.warm-agent": "Precalentar agente",
    "maintenance.action.test-apim": "Probar APIM",
    "maintenance.action.test-hosted-agent": "Probar agente alojado",
    "maintenance.action.refresh-agent-registry": "Actualizar registro de agentes",
    "maintenance.action.refresh-azure-status": "Actualizar estado de Azure",
    "maintenance.action.reload-audit-logs": "Recargar registros de auditoría",
    "maintenance.action.reload-policies": "Recargar políticas",
    "maintenance.action.refresh-deployment-info": "Actualizar información del despliegue",

    // ── El recorrido guiado ────────────────────────────────────────────
    "rail.label": "El recorrido",

    // ── Shell de la consola — las cuatro secciones principales ──────────
    "nav.agents": "Agentes",
    "nav.gateway": "Gateway",
    "nav.observability": "Observabilidad",
    "nav.platform": "Plataforma",

    "copilot.open": "Preguntar al agente",
    "copilot.close": "Cerrar",
    "copilot.subtitle":
      "La respuesta viene de un contenedor desplegado, a través de la puerta de enlace.",

    // ── ② Agentes alojados ─────────────────────────────────────────────

    "ha.fact.image": "Imagen del contenedor",
    "ha.fact.digest": "Digest de la imagen",
    "ha.fact.pushed": "Publicada en ACR",
    "ha.fact.version": "Agente alojado",
    "ha.fact.registered": "Versión registrada",
    "ha.fact.status": "Estado",
    "ha.fact.protocol": "Protocolo",
    "ha.fact.cpu": "CPU",
    "ha.fact.memory": "Memoria",
    "ha.fact.env": "Variables de entorno",
    "ha.envNote": "Solo las claves. Los valores nunca se leen en esta aplicación.",
    "agents.overview.frameworkNote": "No lo reporta Foundry — se deriva del nombre del agente registrado.",
    "ha.simulation": "El registro de Foundry no se consulta en modo Simulación.",
    "ha.unavailable": "No devuelto por esta lectura",
    "agents.detail.name": "Nombre",
    "agents.detail.description": "Descripción",
    "agents.detail.version": "Versión actual",
    "agents.detail.containerProtocolVersions": "Versiones de protocolo del contenedor",
    "agents.detail.updatedAt": "Actualizado",
    "agents.versions.title": "Versiones",
    "agents.versions.version": "Versión",
    "agents.versions.empty": "No se encontraron versiones para este agente.",

    // ── Agents — vista de consola ────────────────────────────────────────
    "agents.heading": "Agentes",
    "agents.question": "¿Qué agentes tengo desplegados y en qué estado están?",
    "agents.list.title": "Agentes registrados",
    "agents.list.framework": "Framework",
    "agents.list.empty": "Aún no hay agentes alojados registrados en este proyecto de Foundry.",
    "agents.overview.title": "Resumen",
    "agents.overview.empty": "Seleccione un agente para ver su resumen.",
    "agents.overview.actionsTitle": "Acciones",

    // ── Agent › Run ───────────────────────────────────────────────────
    "agents.run.title": "Ejecutar",
    "agents.run.empty": "Invoque este agente directamente. Usa su propio endpoint, distinto del copiloto.",
    "agents.run.promptLabel": "Solicitud",
    "agents.run.answerLabel": "Respuesta",
    "agents.run.simulationNote": "Simulación no llama al agente. Cambie a Azure en vivo para invocar un agente real.",
    "agents.run.runId": "ID de ejecución",
    "agents.run.agentName": "Agente",
    "agents.run.startedAt": "Iniciado",
    "agents.run.finishedAt": "Finalizado",
    "agents.run.duration": "Duración",
    "agents.run.model": "Modelo",
    "agents.run.usage": "Uso",
    "agents.run.recentTitle": "Ejecuciones recientes",
    "agents.run.invoking": "Invocando…",

    // ── Agent › Create (POST /api/agents) ───────────────────────────────
    "agents.create.trigger": "Crear agente",
    "agents.create.title": "Crear agente",
    "agents.create.namePlaceholder": "p. ej. mi-nuevo-agente",
    "agents.create.imagePlaceholder": "registro.azurecr.io/mi-agente:1",
    "agents.create.submit": "Crear",
    "agents.create.creating": "Creando…",
    "agents.create.requiredNote": "Nombre, imagen del contenedor, CPU y memoria son obligatorios.",

    "agents.delete.trigger": "Eliminar agente",
    "agents.delete.title": "Eliminar agente",
    "agents.delete.warning":
      "Esto elimina permanentemente el agente y todas sus versiones de Foundry. Esta acción no se puede deshacer.",
    "agents.delete.confirmLabel": "Escriba el nombre del agente para confirmar",
    "agents.delete.submit": "Eliminar",
    "agents.delete.deleting": "Eliminando…",

    // ── Gateway ───────────────────────────────────────────────────────
    "gw.heading": "Gateway",
    "gw.question": "¿Cómo llegan los clientes al agente?",
    "gw.route.title": "Cómo se direcciona al agente",
    "gw.route.note":
      "El nombre del agente es un segmento de la URL, así que una sola API sirve a cualquier número de agentes. Desplegar el décimo no cambia la configuración.",
    "gw.route.unavailable": "Este despliegue no informó de su ruta.",
    "gw.route.segmentLabel": "nombre del agente",
    "gw.path.title": "Qué atraviesa la solicitud",
    "gw.boundary.title": "Qué credenciales se aceptan",

    // ── ⑤ Operación ────────────────────────────────────────────────────
    "ops.caption":
      "Aplicado aquí, frente a disponible en el mismo punto de control y sin activar. Activarlo es configuración, no una reconstrucción.",

    // ── Plataforma ────────────────────────────────────────────────────
    "platform.heading": "Plataforma",
    "platform.question": "¿Qué está desplegado y qué administra el equipo de operaciones?",
    "platform.environment.title": "Entorno",
    "platform.environment.resourceGroup": "Grupo de recursos",
    "platform.environment.resourceCount": "Recursos",
    "platform.environment.unavailable": "Este despliegue no informó de su entorno.",
  },
};
