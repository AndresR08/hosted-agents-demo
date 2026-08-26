/**
 * Local demonstration knowledge base.
 *
 * The assistant is part of this deployment, so it should be able to explain the
 * deployment — the architecture, the agents, the policies, and the application
 * the audience is looking at — the way a knowledgeable colleague would. The
 * broker matches a question against the entries below and injects the matching
 * facts as reference context before forwarding to the hosted agent through APIM.
 *
 * Sourced from ARCHITECTURE.md, DESIGN_DECISIONS.md, ARCHITECTURE.md,
 * AZURE_INTEGRATION_REPORT.md and the 2026-08-02 telemetry inventory. Every claim here
 * must be true of the deployed environment.
 *
 * ─── On answering rather than deflecting ─────────────────────────────────
 *
 * An earlier version made the assistant say "this environment does not
 * demonstrate that", which reads as evasion and breaks the sense of talking to
 * a real system. The fix is not to loosen the honesty rule — it is to give the
 * assistant enough real material that it never needs to dodge, and to frame
 * unconfigured controls the way the architecture actually frames them: present
 * at the control point, not switched on here, a policy change rather than a
 * rebuild. That is both accurate and a better answer.
 *
 * What must never happen is the opposite error: claiming a control is active
 * when it is not. The directive below draws that line explicitly.
 */

export interface KnowledgeEntry {
  id: string;
  /** Lowercase substrings; if any appears in the question, the entry matches. */
  keywords: string[];
  fact: string;
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  // ── The demonstration itself ───────────────────────────────────────────
  {
    id: "what-is-this",
    keywords: [
      "what is this demo", "what is this demonstration", "what am i looking at", "what am i seeing",
      "what is this app", "what is this application", "explain this demo", "about this demo",
      "qué es esta demo", "qué es esta demostración", "qué estoy viendo", "qué es esta aplicación",
      "explica esta demo", "de qué trata",
    ],
    fact:
      "This is a live demonstration of custom agent frameworks running as managed platform assets. Two " +
      "agents built on two different frameworks — Pydantic AI and Strands — run as Microsoft Foundry " +
      "Hosted Agents, meaning containers the enterprise supplies and Foundry operates behind one " +
      "standard contract. Azure API Management then sits on both sides of them: in front of each agent, " +
      "and in front of the model each agent calls. The point is that neither container was modified to " +
      "gain governance, identity or telemetry. Everything on screen is real: the answers come from live " +
      "agents, the policies are read from the running gateway, and the telemetry is queried from Log " +
      "Analytics and Application Insights. Different frameworks, same platform.",
  },
  {
    id: "what-is-this-panel",
    keywords: [
      "what is this panel", "what does this panel", "what are these panels", "what is on screen",
      "qué es este panel", "qué muestra este panel", "qué son estos paneles",
      "explain the panels", "explain the dashboard", "explica el panel", "explica los paneles",
      "what are the stops", "cuáles son las etapas", "qué etapas",
    ],
    fact:
      "The walkthrough has five stops, in the order the lab itself builds. Frameworks answers which " +
      "frameworks the platform supports and why a team would choose one — Pydantic AI or Strands, with " +
      "the capabilities that genuinely differ between them. Hosted Agents answers what happens when one " +
      "is deployed: the image built in Azure Container Registry, its digest, the immutable version " +
      "Foundry assigned, the resources the container runs in, and what became identical for both once " +
      "registered. API Management answers how clients reach an agent: the routed URL with the agent " +
      "name in the path, the measured cost of each hop, which credentials are accepted, and the policy " +
      "running in the gateway right now. Observability answers what evidence the platform produces for " +
      "a request. Operations answers what the platform team administers — what is enforced today and " +
      "what is available at the control point but not switched on here.",
  },
  {
    id: "how-to-use",
    keywords: [
      "how do i use", "how does this work as a demo", "how do i navigate", "how to use this",
      "cómo uso esta", "cómo se usa", "cómo navego", "cómo funciona la demostración",
      "how do i move between", "cómo me muevo entre",
    ],
    fact:
      "Move between the five stops with the rail across the top of the screen, or with the left and " +
      "right arrow keys. Each stop answers a single question and shows the Azure evidence behind its " +
      "answer, so nothing on screen is a diagram of what could happen — it is a read of what this " +
      "deployment actually did. I am available at every stop and can be closed whenever the screen is " +
      "needed in full. Asking me something is itself an example of what the walkthrough describes: the " +
      "question travels through API Management to a hosted agent container and the answer comes back " +
      "stamped with the framework, container and version that produced it.",
  },
  {
    id: "the-lab",
    keywords: [
      "the lab", "this lab", "notebook", "el laboratorio", "este laboratorio", "cuaderno",
      "how was this deployed", "cómo se desplegó", "how do i reproduce", "cómo reproduzco",
      "bicep", "how do i build this myself", "cómo lo construyo",
    ],
    fact:
      "This comes from the Microsoft lab 'AI Foundry Hosted Agents with Custom Frameworks', which runs " +
      "end to end from a single Jupyter notebook. The notebook deploys the infrastructure with Bicep — " +
      "API Management, two Foundry resources, the gpt-5-mini deployment, Container Registry, Log " +
      "Analytics and Application Insights, together with the ACR and Foundry role assignments — then " +
      "builds the selected framework's image in Azure Container Registry with az acr build, registers " +
      "it as a Foundry Hosted Agent, and tests it twice: directly against Foundry and through API " +
      "Management. A framework variable in the initialization cell chooses which runtime is built, and " +
      "a companion notebook removes the resource group afterwards. No local Docker installation is " +
      "needed, because the image is built in ACR.",
  },
  {
    id: "register-agent",
    keywords: [
      "register a new agent", "register an agent", "how do i deploy an agent", "create_version",
      "registrar un agente", "registrar un nuevo agente", "cómo despliego un agente",
      "new agent", "nuevo agente", "deploy my own", "desplegar el mío",
    ],
    fact:
      "Agents are registered through the Foundry data-plane SDK rather than through ARM. The notebook " +
      "opens an AIProjectClient against the agents project endpoint with preview enabled and calls " +
      "agents.create_version with a HostedAgentDefinition: the protocol version — Responses 1.0.0 — a " +
      "CPU and memory allocation of one core and two gibibytes, the container image URI in Azure " +
      "Container Registry, and the environment variables the runtime needs, which here are the " +
      "inference endpoint, the API version, the model deployment name and the gateway subscription key. " +
      "Foundry pulls the image, starts the container and assigns the next version number. Versions are " +
      "immutable: publishing again creates a new version rather than overwriting the previous one, " +
      "which is what makes it possible to say exactly which build answered a given request.",
  },
  {
    id: "add-framework",
    keywords: [
      "add another framework", "add a framework", "third framework", "crewai", "autogen",
      "agregar otro framework", "añadir un framework", "tercer framework", "otro framework",
      "langchain", "semantic kernel",
    ],
    fact:
      "Adding a framework is a container build plus a registration, not a platform change. Create a " +
      "folder alongside strands and pydantic under src/frameworks, copy the Dockerfile, write a main.py " +
      "that serves the Responses protocol through the same agent-server library, list the dependencies " +
      "in a requirements file, then add an entry to the frameworks map in the notebook's initialization " +
      "cell giving the agent name and image name, point the framework variable at it, and re-run the " +
      "build, deploy and test cells. Nothing in API Management changes, because routing is by agent " +
      "name in the URL path — the new agent is reachable through the same API the moment it is " +
      "registered, and it inherits the same identity model, telemetry and audit trail.",
  },
  {
    id: "observability-how",
    keywords: [
      "how is observability", "where does telemetry come from", "how do you get the telemetry",
      "cómo se obtiene la observabilidad", "de dónde viene la telemetría", "cómo se instrumenta",
      "did you instrument", "instrumentation", "instrumentación", "opentelemetry", "traceparent",
    ],
    fact:
      "None of it was added by application code. The Bicep deployment creates a Log Analytics workspace " +
      "and Application Insights and wires API Management to both, so the gateway writes its own request " +
      "logs — including per-hop total and backend duration — and, through the large-language-model " +
      "diagnostic, the full prompt, completion and token counts for every model call. The agent " +
      "container emits OpenTelemetry spans of its own and propagates the trace context, which is why " +
      "the response's X-Request-ID matches the operation id in Application Insights and one request can " +
      "be followed across the gateway, the Foundry runtime and the container. Both frameworks land in " +
      "the same workspace with the same shape, which is the point — one operational surface whatever " +
      "the team put inside the container. Log Analytics ingests on a one-to-three-minute delay, so " +
      "telemetry for a request that has just finished appears shortly after it.",
  },
  {
    id: "observability-panel",
    keywords: [
      "observability panel", "observability tab", "what is observability", "telemetry panel",
      "panel de observabilidad", "qué es observabilidad", "audit panel", "panel de auditoría",
    ],
    fact:
      "The Observability panel shows everything Azure recorded about the most recent request, in three " +
      "tabs. Audit is the conversation record — prompt, response, agent, model, status, latency. " +
      "Inference is the operational metadata: prompt, completion and total tokens, per-hop timing, " +
      "gateway overhead, correlation and trace identifiers, region, deployment, subscription. " +
      "Governance lists which controls are evidenced to have fired for that specific request. " +
      "Token counts come from API Management's own LLM logs and are independently corroborated by the " +
      "agent's OpenTelemetry instrumentation — two separate sources that agree. Expanding the panel " +
      "shows the real distributed trace, span by span.",
  },
  {
    id: "journey-panel",
    keywords: [
      "journey", "request journey", "the flow", "request path", "recorrido", "el flujo",
      "ruta de la solicitud", "how does a request flow", "cómo fluye",
    ],
    fact:
      "The Request Path shows the five stages a request passes through: client, API Management, " +
      "the hosted agent, API Management again, and the model. Routing is by URL path, with the agent " +
      "name in the path, so the same path and the same policy serve whichever framework answers. " +
      "Each gateway hop displays its measured " +
      "duration from API Management's own logs. The number worth watching is the gateway overhead: " +
      "API Management's own processing costs single-digit milliseconds against requests that take " +
      "several seconds. The control point is not in the latency budget — the model is.",
  },
  {
    id: "governance-panel",
    keywords: [
      "governance panel", "controls panel", "panel de gobernanza", "panel de controles",
      "what controls", "qué controles", "controls catalogue", "catálogo de controles",
    ],
    fact:
      "The Operations stop answers what the platform team administers, and presents governance in three " +
      "states rather than as a single list. Active protections are " +
      "evidenced for the request on screen — each one cites the observation that proves it, such as " +
      "the managed-identity token acquisition appearing as its own span in the trace. Available " +
      "protections exist at this control point but are not switched on in this environment: token " +
      "rate limiting and quotas, semantic caching, backend load balancing, private networking, " +
      "Entra-only authentication, Key Vault secret management. Turning any of them on is a policy " +
      "change at a gateway the enterprise already owns. The third group is what this particular lab " +
      "does not include at all, such as Prompt Shield, which would need a Content Safety resource.",
  },
  {
    id: "access-control-panel",
    keywords: [
      "access control", "credential test", "three tests", "401", "control de acceso",
      "prueba de credenciales", "tres pruebas", "rejected", "rechazado",
    ],
    fact:
      "Access Control runs three real HTTPS attempts on demand. With the subscription key, the request " +
      "succeeds with a 200. Without it, API Management rejects it with a 401 before anything reaches " +
      "Foundry. Going directly to the Foundry endpoint and bypassing the gateway entirely also returns " +
      "401, because there is no Entra token. Those two rejections are the desired outcome, not errors. " +
      "The panel also fetches the actual policy XML from Azure Resource Manager at that moment, so what " +
      "is displayed is the configuration running in the gateway right now.",
  },
  {
    id: "agents-panel",
    keywords: [
      "agents panel", "active agents", "panel de agentes", "agentes activos", "switch agent",
      "cambiar de agente", "which agents", "qué agentes", "framework experience",
      "experiencia de frameworks", "frameworks panel", "panel de frameworks",
    ],
    fact:
      "Two stops cover this. The Frameworks stop puts both frameworks side by side with the engineering " +
      "reason to choose each and the capabilities that genuinely differ, read from the two main.py " +
      "files in the lab's own source; it can also ask both containers the same question at once so " +
      "each answers for itself. The Hosted Agents stop then reads the live Foundry registry for the " +
      "agent selected — immutable version, container image and digest, when it was pushed and " +
      "registered, the CPU and memory allocation and the environment-variable keys the definition " +
      "declares. Two agents are registered here: pydantic-agent on Pydantic AI and strands-agent on " +
      "Strands. Selecting one retargets everything downstream. Only what the registry actually returns " +
      "is shown, and no performance comparison is made between the two frameworks.",
  },
  {
    id: "live-simulation",
    keywords: [
      "live mode", "simulation mode", "azure live", "modo en vivo", "modo simulación",
      "what is simulation", "qué es simulación", "difference between live",
    ],
    fact:
      "The application runs in one of two modes. Azure Live, the default, calls the real deployment for " +
      "everything: real agent invocations, real policy documents, real telemetry. Simulation runs " +
      "entirely on local content and contacts nothing — it exists as a rehearsal fallback so a network " +
      "problem never ends a session. Every panel re-badges when the mode changes, so what is live is " +
      "always labelled as live.",
  },
  {
    id: "presenter-tools",
    keywords: [
      "presenter tools", "presenter mode", "maintenance", "herramientas del presentador",
      "modo presentador", "mantenimiento", "warm agent", "precalentar",
    ],
    fact:
      "Presenter Tools sit behind the menu in the header and are not audience-facing. They include a " +
      "full presenter guide, a keyboard reference, and a maintenance section with nine live diagnostics " +
      "against the deployment: warming an agent, testing the gateway, refreshing the agent registry, " +
      "reloading policies and audit logs, and checking the broker. Each reports success or failure with " +
      "elapsed time. They exist so the environment can be verified before a session rather than " +
      "discovered during one.",
  },

  // ── Architecture ───────────────────────────────────────────────────────
  {
    id: "dual-gateway",
    keywords: [
      "two gateway", "dual gateway", "twice", "two hops", "both sides", "why are there two",
      "dos gateway", "doble gateway", "two checkpoints", "dos puntos de control",
      "how does this architecture work", "how does the architecture", "cómo funciona esta arquitectura",
      "cómo funciona la arquitectura", "explain the architecture", "explica la arquitectura",
    ],
    fact:
      "API Management appears twice in a single request path. North-south: the client calls APIM, which " +
      "forwards to the Foundry hosted agent. East-west: the agent's own outbound model call goes back " +
      "through APIM to gpt-5-mini. This is the central idea. Most designs govern the front door and " +
      "leave the agent's own model traffic ungoverned; here both directions cross a policy enforcement " +
      "point the platform team owns. That is what makes metering, logging and future throttling possible " +
      "for what the agent consumes, not only for what end users request.",
  },
  {
    id: "what-apim-does",
    keywords: [
      "what is apim", "what does apim", "api management do", "what is api management", "role of apim",
      "qué hace apim", "qué es api management", "función de apim", "gateway do", "papel de apim",
    ],
    fact:
      "API Management is the control point. On each hop it validates the caller's subscription key, " +
      "strips it, and injects a managed-identity bearer token minted per request and never stored. " +
      "It enforces required headers, including the preview feature flag the Hosted Agents surface needs. " +
      "It captures full prompt and completion logging into Log Analytics along with token counts. And it " +
      "does all of that for single-digit milliseconds of added latency — measurable in the Journey panel.",
  },
  {
    id: "policies",
    keywords: [
      "what policies", "which policies", "policy applied", "policies are applied", "qué políticas",
      "cuáles políticas", "política aplicada", "políticas aplicadas", "show the policy", "policy xml",
    ],
    fact:
      "Two policy documents are in force, one per API. The hosted-agent policy acquires a managed-identity " +
      "token for the https://ai.azure.com audience, overwrites the Authorization header with it, forces " +
      "Content-Type to application/json, and sets the Foundry-Features header that opts into the Hosted " +
      "Agents preview surface. The inference policy does the same credential exchange for the " +
      "https://cognitiveservices.azure.com audience and selects the models backend. Both can be read " +
      "live from the Access Control panel — the XML shown is fetched from Azure Resource Manager at that " +
      "moment, not from a file.",
  },
  {
    id: "what-is-logged",
    keywords: [
      "what is logged", "what information is recorded", "what gets recorded", "what is captured",
      "qué queda registrado", "qué información se registra", "qué se captura", "qué se guarda",
      "audit trail", "pista de auditoría", "evidence", "evidencia",
    ],
    fact:
      "Every call through the gateway is recorded. API Management writes the full prompt and completion " +
      "into Log Analytics along with prompt, completion and total token counts, the model and deployment " +
      "name, the subscription that made the call, correlation identifiers, HTTP status, request and " +
      "response sizes, caller IP, region, and the measured duration of the gateway and of the backend. " +
      "The agent container adds its own OpenTelemetry trace, including the managed-identity token " +
      "acquisition and the model call, with GenAI attributes carrying token usage and the exact model " +
      "version. All of it is centralised regardless of which team built the agent or which framework " +
      "they chose — which is the property a compliance function needs.",
  },
  {
    id: "authentication",
    keywords: [
      "authentication", "how is auth", "credential", "how do you authenticate", "identity", "token",
      "autenticación", "credencial", "cómo se autentica", "identidad", "managed identity",
      "who holds the key", "api key", "security model", "modelo de seguridad", "identidad administrada",
    ],
    fact:
      "The client presents only an API Management subscription key — not an Azure AD credential, not a " +
      "Foundry key, not a model key. API Management exchanges it for a managed-identity token. Two " +
      "different audiences are used deliberately: https://ai.azure.com for the agent hop and " +
      "https://cognitiveservices.azure.com for the model hop. The agent container holds a subscription " +
      "key for its outbound calls, never a model credential. Onboarding a new AI consumer means issuing " +
      "a gateway subscription — revocable and meterable — rather than provisioning cloud identity.",
  },
  {
    id: "ai-foundry",
    keywords: [
      "what is foundry", "ai foundry", "microsoft foundry", "hosted agent", "qué es foundry",
      "agente alojado", "foundry do", "qué hace foundry",
    ],
    fact:
      "Microsoft Foundry hosts the agent. A Hosted Agent is a container the enterprise supplies that " +
      "Foundry runs on its behalf behind a standard HTTP contract, the OpenAI Responses protocol. The " +
      "enterprise keeps full control of the agent framework and its internal logic; Foundry provides the " +
      "hosting lifecycle, identity, routing and observability. Agents are registered through the " +
      "data-plane SDK and versions are immutable — publishing creates a new version rather than mutating " +
      "the existing one, so it is always possible to say which build answered which request.",
  },
  {
    id: "governance",
    keywords: [
      "what is governed", "governance", "what do you control", "what is controlled", "gobernanza",
      "qué se gobierna", "qué se controla", "compliance", "cumplimiento", "regulator", "regulador",
    ],
    fact:
      "Enforced today, and evidenced per request: subscription-key authentication with per-consumer " +
      "revocation, managed-identity credential brokering on both hops, header enforcement, full prompt " +
      "and completion audit logging with token metering, distributed tracing, data residency in the " +
      "deployment region, and content filtering at the model deployment through the Microsoft.DefaultV2 " +
      "RAI policy. Present at this control point and available to switch on: token rate limiting and " +
      "per-consumer quotas, semantic caching, backend load balancing, private networking, Entra-only " +
      "authentication, and Key Vault secret management. Each of those is a policy change at a gateway " +
      "the enterprise already owns rather than a re-architecture.",
  },

  // ── Agents ─────────────────────────────────────────────────────────────
  {
    id: "multiple-agents",
    keywords: [
      "multiple agent", "why use multiple", "two agents", "many agents", "framework lock", "lock-in",
      "varios agentes", "dos agentes", "por qué dos", "framework agnostic", "different framework",
      "dependencia de proveedor",
    ],
    fact:
      "Two agents run side by side under identical governance: pydantic-agent on Pydantic AI and " +
      "strands-agent on Strands. They are genuinely different agent frameworks behind the same gateway, " +
      "the same identity model and the same audit trail. Routing is by URL path, so one API Management " +
      "API serves any number of agents with no reconfiguration — deploying a tenth agent requires no " +
      "infrastructure change. Teams choose their own tools; the platform keeps one governance model.",
  },
  {
    id: "pydantic-vs-strands",
    keywords: [
      "pydantic", "strands", "difference between pydantic", "diferencia entre pydantic",
      "compare the agents", "compara los agentes", "which agent is better", "cuál agente es mejor",
      "comparison", "comparación",
    ],
    fact:
      "They exist for different engineering reasons. Pydantic AI treats the agent as the primary " +
      "abstraction — a container for instructions, tools, structured output typing, dependency typing " +
      "and model settings — so it suits teams for whom output shape and validation matter to downstream " +
      "systems, who want typed dependencies and static-checker feedback, and who compose reusable " +
      "behaviour. Strands is a toolkit for production agents with model and provider flexibility, " +
      "built-in context management, execution limits, observability and hook-based runtime control, so " +
      "it suits tool-heavy workflow automation and teams who want to steer the agent loop at runtime. " +
      "In this lab that shows up concretely: Strands exposes two tools to Pydantic AI's one, keeps " +
      "native message history with a sliding twenty-message window where Pydantic AI flattens history " +
      "into a text prompt, and accepts image input where Pydantic AI does not. Neither is faster or " +
      "better, and no benchmark is implied — the choice belongs to the team building the agent, and the " +
      "hosting contract, routing, identity, telemetry and audit trail are identical either way.",
  },
  {
    id: "responses-protocol",
    keywords: [
      "responses protocol", "protocolo responses", "what protocol", "qué protocolo",
      "how does foundry run", "hosting contract", "contrato de alojamiento",
      "how is a framework pluggable", "cómo se conecta un framework",
    ],
    fact:
      "The Responses protocol v1.0.0 is the contract that makes any framework pluggable. A hosted agent " +
      "is an HTTP server that accepts POST on /agents/{name}/endpoint/protocols/openai/responses with " +
      "api-version=v1, taking a body of input and stream, and returning the answer as output text or as " +
      "streaming deltas. Both containers in this lab implement it through the same library, " +
      "azure-ai-agentserver-responses, and the only coupling either framework has to Foundry is one " +
      "decorated handler function. Everything else inside the container is the team's own choice, which " +
      "is why routing, identity, telemetry and governance can treat two completely different runtimes " +
      "identically.",
  },
  {
    id: "why-containers",
    keywords: [
      "why container", "why containers", "containerized", "docker", "por qué contenedor",
      "por qué contenedores", "container image", "imagen de contenedor",
    ],
    fact:
      "Containers are what make the platform framework-agnostic. The only coupling between the agent and " +
      "Foundry is one decorated handler function serving the Responses protocol — everything inside is " +
      "the team's own choice. Containers also give an auditable supply chain: the image is built in Azure " +
      "Container Registry and each agent version pins a specific image digest, so it is always possible " +
      "to say which build answered which request.",
  },
  {
    id: "model-change",
    keywords: [
      "model change", "if one model", "swap the model", "change the model", "new model", "model version",
      "cambia el modelo", "cambiar de modelo", "otro modelo", "different model",
    ],
    fact:
      "Model choice is a gateway concern, not an application concern. The agent container calls API " +
      "Management, not the model — it holds an inference-gateway subscription key and a base URL, not a " +
      "model endpoint or key. Repointing the gateway backend changes the model for every agent at once, " +
      "with no rebuild and no change to agent code. The same property is what makes load balancing across " +
      "model capacity a configuration change.",
  },

  // ── Operations ─────────────────────────────────────────────────────────
  {
    id: "tokens",
    keywords: [
      "tokens", "token count", "token usage", "how many tokens", "cuántos tokens", "uso de tokens",
      "consumo", "consumption", "metering", "medición",
    ],
    fact:
      "Token usage is metered at the gateway. API Management records prompt, completion and total tokens " +
      "for every model call into Log Analytics, and the agent's own OpenTelemetry instrumentation reports " +
      "the same counts independently — the two sources agree, which is why the Observability panel shows " +
      "one as corroboration of the other. Because metering happens at the control point rather than in " +
      "application code, it works the same for every agent and every framework, and it is the foundation " +
      "per-consumer quotas and chargeback would build on.",
  },
  {
    id: "latency",
    keywords: [
      "latency", "how fast", "performance", "slow", "overhead", "latencia", "rendimiento", "lento",
      "qué tan rápido", "does the gateway slow", "sobrecarga",
    ],
    fact:
      "API Management measures its own processing time separately from the backend's. In this deployment " +
      "the gateway adds single-digit milliseconds per hop against requests that take several seconds " +
      "end to end — the overwhelming majority of the time is the model generating tokens, and a cold " +
      "agent container adds several seconds more on first call. The Journey panel shows the measured " +
      "figure per hop. The practical conclusion is that putting a governed control point in the path " +
      "costs essentially nothing in latency terms.",
  },
  {
    id: "azure-services",
    keywords: [
      "which azure", "what azure services", "what services", "azure resources", "qué servicios",
      "servicios de azure", "what is deployed", "qué está desplegado", "components", "componentes",
    ],
    fact:
      "Deployed here: Azure API Management as the gateway on both paths; two Microsoft Foundry accounts, " +
      "one hosting the gpt-5-mini model deployment and one hosting the agent runtime, each with a project; " +
      "Azure Container Registry for agent images; and Log Analytics with Application Insights for " +
      "diagnostics, full LLM logging and distributed tracing. Everything runs in a single region, " +
      "Sweden Central, which is also what the audit records show as the processing location.",
  },
  {
    id: "scale",
    keywords: [
      "how would this scale", "scale", "scaling", "production ready", "fifty agents", "escalar",
      "escala", "how many agents", "enterprise scale", "go to production", "a producción",
    ],
    fact:
      "The routing model scales without reconfiguration: agents are addressed by URL path, so one gateway " +
      "API serves any number of them, and governance is applied at the gateway rather than per agent, so " +
      "a new team inherits it by default. Moving this pattern to production would add rate limiting and " +
      "per-consumer quotas, private networking, Key Vault for the agent's subscription key, Entra-only " +
      "authentication, and a higher gateway tier for zone redundancy and multi-region. Those are policy " +
      "and configuration changes at a control point that already exists.",
  },
  {
    id: "production-readiness",
    keywords: [
      "limitation", "what is not", "gaps", "weakness", "limitación", "limitaciones", "brechas",
      "not enabled", "no configurado", "what's missing", "qué falta", "hardening", "endurecer",
    ],
    fact:
      "This is a laboratory environment and the gaps are known and named rather than hidden. The agent's " +
      "subscription key is injected as a plaintext environment variable and would move to Key Vault. " +
      "Key-based authentication remains enabled on the AI services alongside Entra and would be disabled. " +
      "The container registry has its admin account on. There is no rate-limiting policy and no private " +
      "networking. Each is a specific configuration change rather than an architectural gap, which is why " +
      "the path from here to production is measured in weeks rather than a rebuild.",
  },

  // ── Positioning ────────────────────────────────────────────────────────
  {
    id: "not-a-replacement",
    keywords: [
      "does this replace", "is this a replacement", "replace azure ai foundry", "replace the portal",
      "why not just use the portal", "is this a product", "can i buy this", "is this supported",
      "esto reemplaza", "es un reemplazo", "reemplaza a foundry", "reemplaza el portal",
      "por qué no usar el portal", "es esto un producto", "puedo comprar esto", "tiene soporte",
    ],
    fact:
      "This application is not Azure AI Foundry and does not replace it, the Azure Portal, or any " +
      "Microsoft management surface — it is a guided walkthrough built to explain, in one sitting, what " +
      "the official 'AI Foundry Hosted Agents with Custom Frameworks' lab deploys and why it is governed " +
      "the way it is. Every fact it shows is read live from the same Azure resources an engineer would " +
      "open in the Foundry portal or Azure Portal directly — registering agents, changing policies, and " +
      "operating the deployment day to day still happens there, not here. Think of this as the narrated " +
      "tour; Foundry and the Azure Portal are where the work actually gets done.",
  },
];

/**
 * The style contract, and the honesty boundary.
 *
 * Written to make the assistant answer like a knowledgeable participant rather
 * than a system reporting its own gaps. The one hard line is the last
 * paragraph: reframing an unconfigured control as available is accurate;
 * claiming it is active is not, and an architect reading the configuration
 * afterwards would catch it.
 */
const STYLE_DIRECTIVE =
  "You are the AI assistant built into this Azure solution, speaking with the architects and executives " +
  "who are using it. Answer as an experienced Azure Solutions Architect would: assured, specific, and " +
  "helpful, naming the Azure services actually involved — API Management, AI Foundry, managed identity, " +
  "Log Analytics, Application Insights, OpenTelemetry — where they are genuinely part of the answer. " +
  "Answer in at most three or four short sentences unless more detail is requested. Be concrete and " +
  "business-oriented. Do not use bullet lists, headings, or markdown. Do not restate the question. " +
  "Answer in the same language the question was asked in. " +
  // Voice. The assistant is a component of the solution, not a narrator standing
  // outside it describing a demo — so it speaks about "this implementation",
  // never about "this environment not showing" something.
  "Speak from inside the solution. Say 'in this implementation' or 'here', not 'this environment does " +
  "not show' or 'this demo does not include'. You are the assistant inside a guided walkthrough of this " +
  "lab, so when you are asked what a stop shows, how to move between them, or how the walkthrough is " +
  "organised, answer directly and practically — but do not volunteer that framing when the question is " +
  "about the architecture itself. Do not ask the user to select or choose anything; offer to explain " +
  "instead. When something is not " +
  "enabled, explain it technically and constructively — what it would take, and where it plugs in — " +
  "rather than presenting it as a gap in what you can discuss. " +
  // The honesty boundary, unchanged. Reframing an unconfigured control as
  // available is accurate; describing it as active is not, and an architect
  // reading the policy afterwards would catch it.
  "Accuracy still binds absolutely: never state that rate limiting, quotas, semantic caching, load " +
  "balancing, private networking, Prompt Shield or Key Vault integration are currently active here. " +
  "They are configured at the control point but not enabled, and you should say exactly that. Never " +
  "cite cost, spend, uptime or historical trend figures, which are not collected here. And never present " +
  "this application itself as Azure AI Foundry, the Azure Portal, or a replacement for either — if asked " +
  "directly, say plainly that it is a guided explanation of a real deployment, and that agent lifecycle " +
  "and day-to-day operations happen in those tools, not here.";

/** Cap on injected entries — three is enough for any question and keeps latency down. */
const MAX_ENTRIES = 3;

/**
 * Distinctive single terms per entry. These carry most of the matching work:
 * a question mentioning "apim" is about API Management however it is phrased,
 * whereas exact phrases only fire when someone happens to word it the way the
 * list anticipated.
 */
const TOPIC_TERMS: Record<string, string[]> = {
  "what-is-this": ["demo", "demostracion", "viendo", "looking"],
  "what-is-this-panel": ["panel", "paneles", "panels", "dashboard", "tablero", "pantalla", "screen", "stops", "etapas", "recorrido"],
  "how-to-use": ["navigate", "navegar", "usar", "use", "arrows", "flechas", "walkthrough"],
  "the-lab": ["lab", "laboratorio", "notebook", "cuaderno", "bicep", "reproduce", "reproducir", "deploy", "desplegar"],
  "register-agent": ["register", "registrar", "createversion", "definition", "definicion", "hostedagentdefinition"],
  "add-framework": ["crewai", "autogen", "langchain", "add", "agregar", "anadir", "third", "tercer"],
  "observability-how": ["instrument", "instrumentar", "instrumentacion", "opentelemetry", "otel", "traceparent", "spans"],
  "observability-panel": ["observability", "observabilidad", "telemetry", "telemetria", "auditoria", "audit"],
  "journey-panel": ["journey", "recorrido", "flow", "flujo", "path", "ruta", "hops", "saltos"],
  "governance-panel": ["controls", "controles", "catalogue", "catalogo", "protections", "protecciones"],
  "access-control-panel": ["401", "rejected", "rechazado", "credential", "credencial", "bypass"],
  "agents-panel": ["registry", "registro", "switch", "cambiar"],
  "live-simulation": ["simulation", "simulacion", "live", "vivo", "mode", "modo"],
  "presenter-tools": ["presenter", "presentador", "maintenance", "mantenimiento", "warm", "precalentar"],
  "dual-gateway": ["gateway", "gateways", "arquitectura", "architecture", "hops", "checkpoints"],
  "what-apim-does": ["apim", "management", "gateway", "puerta"],
  policies: ["policy", "policies", "politica", "politicas", "xml"],
  "what-is-logged": ["logged", "registra", "registrado", "recorded", "captured", "capturado", "evidence", "evidencia", "trail"],
  authentication: ["auth", "authentication", "autenticacion", "credential", "credencial", "identity", "identidad", "token", "key", "clave", "seguridad", "security"],
  "ai-foundry": ["foundry", "hosted", "alojado"],
  governance: ["governance", "gobernanza", "governed", "gobierna", "compliance", "cumplimiento"],
  "multiple-agents": ["agents", "agentes", "framework", "frameworks", "lock"],
  "pydantic-vs-strands": ["pydantic", "pydanticai", "strands", "diferencia", "difference", "compare", "compara", "comparacion", "comparison"],
  "responses-protocol": ["protocol", "protocolo", "responses", "contract", "contrato", "pluggable"],
  "why-containers": ["container", "containers", "contenedor", "contenedores", "docker", "imagen", "image"],
  "model-change": ["model", "modelo", "swap", "cambiar"],
  tokens: ["token", "tokens", "metering", "medicion", "consumo", "consumption"],
  latency: ["latency", "latencia", "performance", "rendimiento", "overhead", "sobrecarga", "fast", "rapido", "slow", "lento"],
  "azure-services": ["services", "servicios", "resources", "recursos", "deployed", "desplegado", "components", "componentes"],
  scale: ["scale", "escala", "escalar", "scaling", "production", "produccion"],
  "production-readiness": ["limitation", "limitacion", "limitaciones", "gaps", "brechas", "missing", "falta", "hardening"],
  "not-a-replacement": ["replace", "reemplaza", "reemplazo", "replacement", "product", "producto", "supported", "soporte"],
};

/** Lowercase, strip accents and punctuation — so "¿Qué hace APIM?" and "que hace apim" match alike. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Scores an entry against a question using three signals, strongest first:
 *
 *  1. a full keyword phrase appears verbatim — unambiguous, weighted heaviest
 *  2. most of a multi-word keyword's words appear, in any order — catches
 *     rephrasings like "what does API Management do" vs "qué hace API Management"
 *  3. a distinctive topic term appears — the broad net that stops a question
 *     from falling through to a generic answer just because it was worded
 *     unexpectedly
 *
 * Falling through matters more than a slightly wrong match: with no context the
 * agent answers from general knowledge about Azure, which is exactly the
 * off-key, textbook response this knowledge base exists to prevent.
 */
function scoreEntry(entry: KnowledgeEntry, question: string): number {
  const words = new Set(question.split(" "));
  let score = 0;

  for (const rawKeyword of entry.keywords) {
    const keyword = normalise(rawKeyword);
    if (!keyword) continue;

    if (question.includes(keyword)) {
      score = Math.max(score, keyword.length * 10);
      continue;
    }

    const parts = keyword.split(" ").filter((p) => p.length > 2);
    if (parts.length >= 2) {
      const hits = parts.filter((p) => words.has(p)).length;
      if (hits / parts.length >= 0.6) {
        score = Math.max(score, keyword.length * 3);
      }
    }
  }

  for (const term of TOPIC_TERMS[entry.id] ?? []) {
    if (words.has(normalise(term))) {
      score = Math.max(score, term.length);
    }
  }

  return score;
}

export function findRelevantEntries(question: string): KnowledgeEntry[] {
  const normalised = normalise(question);
  return KNOWLEDGE_BASE.map((entry) => ({ entry, score: scoreEntry(entry, normalised) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES)
    .map((s) => s.entry);
}

/**
 * Builds the text actually sent to the hosted agent. When the question maps
 * onto the knowledge base, the matching facts are injected as reference
 * context; otherwise only the style directive applies and the agent answers
 * from its own capability, which is what makes free-form conversation work.
 *
 * The user's question is always passed through verbatim and clearly delimited,
 * so this never silently rewrites what was asked.
 */
/**
 * The prompt for a capability probe: the style directive and nothing else.
 *
 * Used when the same question goes to both agents so their answers can be
 * compared. Reference context is deliberately withheld — the probe asks what
 * each *container* can do, and feeding both the same facts would have them
 * recite the same borrowed answer. Keeping the style directive is what makes
 * the two replies comparable at all: same voice, same length, same language.
 */
export function buildProbePrompt(question: string): string {
  return `${STYLE_DIRECTIVE}\n\nQuestion: ${question}`;
}

export function buildAugmentedPrompt(question: string): {
  prompt: string;
  matchedEntryIds: string[];
} {
  const entries = findRelevantEntries(question);

  if (entries.length === 0) {
    return {
      prompt: `${STYLE_DIRECTIVE}\n\nQuestion: ${question}`,
      matchedEntryIds: [],
    };
  }

  const context = entries.map((e) => `- ${e.fact}`).join("\n");
  return {
    prompt:
      `${STYLE_DIRECTIVE}\n\n` +
      `Reference context about the environment you are running in (authoritative — prefer it over general knowledge):\n` +
      `${context}\n\n` +
      `Question: ${question}`,
    matchedEntryIds: entries.map((e) => e.id),
  };
}
