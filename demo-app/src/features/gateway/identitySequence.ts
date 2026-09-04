import type { Locale } from "@/state/types";

/**
 * The double-token identity flow, step by step.
 *
 * WHAT THIS IS
 *
 * Conceptual material for the Reference tab: how the managed-identity
 * mechanism works in this pattern, with one token per audience. It is not a
 * reading of any invocation — the Live tab does that, with four measured
 * segments, and deliberately does NOT break them into token sub-steps because
 * ApiManagementGatewayLogs cannot measure them separately. Splitting a
 * measured number into invented parts is the one thing this project refuses.
 *
 * PROVENANCE OF THE CONTENT
 *
 * Every step below was checked against the deployed configuration —
 * hosted-agent-policy.xml, policy.xml, deploy.ps1's environment variables and
 * Validate.ps1's own call — not against an architecture note. That check
 * mattered: the hand-written mock this was adapted from described a flow that
 * is mostly right in shape and wrong in several specifics, and those are
 * corrected here rather than reproduced:
 *
 *   - The client authenticates with an APIM SUBSCRIPTION KEY, not a bearer
 *     token of its own. There is no validate-azure-ad-token anywhere in the
 *     lab; a grep for it across the vendored lab returns nothing.
 *   - No rate limiting, CORS, rewrite-uri, cache-store, log-to-eventhub or
 *     llm-emit-token-metric is configured. Both policies' outbound sections
 *     are a bare <base />. Token metrics reach Log Analytics through the
 *     APIM diagnostic settings, not through an outbound policy.
 *   - The agent's own call to the gateway also carries the subscription key
 *     (APIM_SUBSCRIPTION_KEY, injected by deploy.ps1).
 *   - "Ingress" and "Egress" are one APIM service with two APIs, not two
 *     gateways.
 *   - The client did hold a secret — its subscription key. What it never saw
 *     is the BACKEND credential, which is the claim worth making.
 *
 * `inLab` carries the rest of the honesty: steps that describe a capability
 * APIM offers but this deployment does not configure are marked, using the
 * same vocabulary as the capability cards on the same tab. Without it this
 * sequence would quietly re-assert the very things the check above removed.
 */

export type Localised = Record<Locale, string>;

/** Kinds are labelled as well as coloured; the palette has two hues, not four. */
export type StepKind = "req" | "token" | "self" | "resp";

export interface SequenceStep {
  /** Lane indices into LANES. Equal values render as a self-call loop. */
  from: number;
  to: number;
  kind: StepKind;
  title: Localised;
  detail: Localised;
  /** Verbatim configuration or wire content — never invented syntax. */
  code: string;
  /** false = an APIM capability this deployment does not configure. */
  inLab: boolean;
}

export const LANES: { title: Localised; subtitle: Localised }[] = [
  { title: { en: "Client", es: "Cliente" }, subtitle: { en: "console", es: "consola" } },
  { title: { en: "API Management", es: "API Management" }, subtitle: { en: "hosted-agents-responses", es: "hosted-agents-responses" } },
  { title: { en: "Entra ID", es: "Entra ID" }, subtitle: { en: "tokens", es: "tokens" } },
  { title: { en: "Hosted Agent", es: "Hosted Agent" }, subtitle: { en: "your container", es: "tu contenedor" } },
  { title: { en: "API Management", es: "API Management" }, subtitle: { en: "inference", es: "inference" } },
  { title: { en: "gpt-5-mini", es: "gpt-5-mini" }, subtitle: { en: "model", es: "modelo" } },
];

export const STEPS: SequenceStep[] = [
  {
    from: 0, to: 1, kind: "req", inLab: true,
    title: { en: "The client calls the published API", es: "El cliente llama a la API publicada" },
    detail: {
      en: "A subscription key, not a token of the client's own. The agent name is a segment of the URL, which is how one API serves any number of agents.",
      es: "Una clave de suscripción, no un token propio del cliente. El nombre del agente es un segmento de la URL, y así una sola API sirve a cualquier número de agentes.",
    },
    code: 'POST /hosted-agents-responses/agents/{agent}/endpoint/protocols/openai/responses\napi-key: <clave de suscripción de APIM>',
  },
  {
    from: 1, to: 1, kind: "self", inLab: true,
    title: { en: "API Management validates the subscription key", es: "API Management valida la clave de suscripción" },
    detail: {
      en: "The key is revocable from the portal without touching the agent, the model or any client code. That is the whole of the inbound authentication in this lab.",
      es: "La clave es revocable desde el portal sin tocar el agente, el modelo ni el código del cliente. Eso es toda la autenticación de entrada en este laboratorio.",
    },
    code: 'Producto/suscripción de APIM · 401 si falta o no es válida',
  },
  {
    from: 1, to: 1, kind: "self", inLab: false,
    title: { en: "Where JWT validation and rate limiting would go", es: "Dónde irían la validación de JWT y el límite de tasa" },
    detail: {
      en: "validate-azure-ad-token, rate-limit-by-key, quotas and CORS attach at this point. None is configured here — a grep across the lab returns nothing — and they are shown to place them, not to claim them.",
      es: "validate-azure-ad-token, rate-limit-by-key, cuotas y CORS se enganchan en este punto. Ninguno está configurado aquí — un grep sobre el laboratorio no devuelve nada — y se muestran para ubicarlos, no para afirmarlos.",
    },
    code: '(no está en hosted-agent-policy.xml)',
  },
  {
    from: 1, to: 2, kind: "token", inLab: true,
    title: { en: "The gateway asks Entra ID for a token", es: "El gateway pide un token a Entra ID" },
    detail: {
      en: "Here the identity changes. The caller was a subscription key; from this point the request travels as API Management's own managed identity.",
      es: "Aquí cambia la identidad. Quien llamó era una clave de suscripción; a partir de este punto la petición viaja como la identidad administrada de API Management.",
    },
    code: '<authentication-managed-identity resource="https://ai.azure.com"\n  output-token-variable-name="managed-id-access-token" />',
  },
  {
    from: 2, to: 1, kind: "token", inLab: true,
    title: { en: "Entra ID issues the first token", es: "Entra ID emite el primer token" },
    detail: {
      en: "Short-lived, and scoped to the Foundry audience. No secret was stored anywhere to obtain it.",
      es: "De corta duración y con alcance a la audiencia de Foundry. No hubo ningún secreto almacenado para obtenerlo.",
    },
    code: 'aud = https://ai.azure.com',
  },
  {
    from: 1, to: 1, kind: "self", inLab: true,
    title: { en: "The policy rewrites three headers", es: "La política reescribe tres encabezados" },
    detail: {
      en: "The bearer token, the content type, and the preview flag the hosted-agent API requires. This is the whole of the transformation here.",
      es: "El token bearer, el tipo de contenido y la bandera de vista previa que exige la API de agentes alojados. Esta es toda la transformación aquí.",
    },
    code: 'Authorization: Bearer @(context.Variables["managed-id-access-token"])\nContent-Type: application/json\nFoundry-Features: HostedAgents=V1Preview',
  },
  {
    from: 1, to: 3, kind: "req", inLab: true,
    title: { en: "The request reaches the agent", es: "La petición llega al agente" },
    detail: {
      en: "Your container receives a call already carrying a Foundry-scoped token. It never had to hold a credential to be reachable.",
      es: "Tu contenedor recibe una llamada que ya trae un token con alcance a Foundry. Nunca tuvo que guardar una credencial para ser alcanzable.",
    },
    code: '→ Hosted Agent (Responses 1.0.0)',
  },
  {
    from: 3, to: 3, kind: "self", inLab: true,
    title: { en: "The agent decides it needs the model", es: "El agente decide que necesita el modelo" },
    detail: {
      en: "And here is the part that surprises people: its OpenAI endpoint is the gateway, not Foundry. deploy.ps1 injects it that way, so the agent's own outbound traffic is governed too.",
      es: "Y aquí está la parte que sorprende: su endpoint de OpenAI es el gateway, no Foundry. deploy.ps1 lo inyecta así, de modo que el tráfico de salida del propio agente también queda gobernado.",
    },
    code: 'AZURE_OPENAI_ENDPOINT = https://<apim>.azure-api.net/inference/models\nAZURE_OPENAI_DEPLOYMENT = gpt-5-mini',
  },
  {
    from: 3, to: 4, kind: "req", inLab: true,
    title: { en: "The agent calls the second API", es: "El agente llama a la segunda API" },
    detail: {
      en: "Same API Management service, a different API and a different policy. The agent authenticates with the subscription key it was given as an environment variable.",
      es: "El mismo servicio de API Management, otra API y otra política. El agente se autentica con la clave de suscripción que recibió como variable de entorno.",
    },
    code: 'api-key: APIM_SUBSCRIPTION_KEY',
  },
  {
    from: 4, to: 2, kind: "token", inLab: true,
    title: { en: "A second token, for a different audience", es: "Un segundo token, para otra audiencia" },
    detail: {
      en: "The Foundry token is useless here. Each resource has its own audience, so the gateway asks Entra ID again with a different resource.",
      es: "El token de Foundry no sirve aquí. Cada recurso tiene su propia audiencia, así que el gateway vuelve a pedirle a Entra ID con otro recurso.",
    },
    code: '<authentication-managed-identity\n  resource="https://cognitiveservices.azure.com" />',
  },
  {
    from: 2, to: 4, kind: "token", inLab: true,
    title: { en: "Entra ID issues the second token", es: "Entra ID emite el segundo token" },
    detail: {
      en: "Two tokens, two audiences, one flow — and no key for the model exists anywhere to be leaked or rotated.",
      es: "Dos tokens, dos audiencias, un solo flujo — y no existe en ninguna parte una clave del modelo que se pueda filtrar o rotar.",
    },
    code: 'aud = https://cognitiveservices.azure.com',
  },
  {
    from: 4, to: 5, kind: "req", inLab: true,
    title: { en: "The gateway routes to the model", es: "El gateway enruta al modelo" },
    detail: {
      en: "It sets the Authorization header and picks the backend. The deployment name came in on the URL the framework built — API Management does not decide which model is used.",
      es: "Fija el encabezado Authorization y elige el backend. El nombre del deployment llegó en la URL que armó el framework — API Management no decide qué modelo se usa.",
    },
    code: '<set-backend-service backend-id="{backend-id}" />',
  },
  {
    from: 5, to: 4, kind: "resp", inLab: true,
    title: { en: "The model answers", es: "El modelo responde" },
    detail: {
      en: "With the completion and its token usage. That usage reaches Log Analytics through the APIM diagnostic settings — not through an outbound policy, which is empty here.",
      es: "Con la salida y su consumo de tokens. Ese consumo llega a Log Analytics por los diagnostic settings de APIM — no por una política de salida, que aquí está vacía.",
    },
    code: 'ApiManagementGatewayLlmLog · PromptTokens, CompletionTokens',
  },
  {
    from: 4, to: 3, kind: "resp", inLab: true,
    title: { en: "Back through the second API", es: "De vuelta por la segunda API" },
    detail: {
      en: "The outbound section is a bare <base />. Nothing is transformed on the way out, and the measured cost of this hop was single-digit milliseconds.",
      es: "La sección de salida es un <base /> pelado. Nada se transforma a la vuelta, y el costo medido de este salto fue de milisegundos de un solo dígito.",
    },
    code: '<outbound><base /></outbound>',
  },
  {
    from: 3, to: 1, kind: "resp", inLab: true,
    title: { en: "The agent composes its answer", es: "El agente compone su respuesta" },
    detail: {
      en: "Whatever the framework does — Pydantic AI or Strands — happens here, and the path around it is identical for both.",
      es: "Lo que haga el framework — Pydantic AI o Strands — ocurre aquí, y el camino a su alrededor es idéntico para ambos.",
    },
    code: '← respuesta del agente',
  },
  {
    from: 1, to: 1, kind: "self", inLab: false,
    title: { en: "Where response caching would go", es: "Dónde iría la caché de respuestas" },
    detail: {
      en: "cache-store and outbound transformation attach here. Not configured: every answer in this demo was generated by the model at that moment.",
      es: "cache-store y la transformación de salida se enganchan aquí. No configurado: cada respuesta de esta demo la generó el modelo en ese momento.",
    },
    code: '(no está en hosted-agent-policy.xml)',
  },
  {
    from: 1, to: 0, kind: "resp", inLab: true,
    title: { en: "The client gets its answer", es: "El cliente recibe su respuesta" },
    detail: {
      en: "It held one revocable subscription key and never saw a backend credential — not Foundry's, not the model's. Both identity changes happened inside the gateway.",
      es: "Tuvo una clave de suscripción revocable y nunca vio una credencial de backend — ni la de Foundry ni la del modelo. Los dos cambios de identidad ocurrieron dentro del gateway.",
    },
    code: '{ "output": "...", "usage": { ... } }',
  },
];
