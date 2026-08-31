import type { ComponentType } from "react";
import {
  ArrowSwapRegular,
  BranchRegular,
  CloudRegular,
  DatabaseRegular,
  GaugeRegular,
  PeopleTeamRegular,
  PulseRegular,
  ShieldKeyholeRegular,
} from "@fluentui/react-icons";
import type { Locale } from "@/state/types";

/**
 * The curated content behind the "What else API Management offers" screen.
 *
 * Why a content module rather than ~70 more keys in `i18n/translations.ts`:
 * that file holds UI *chrome* — labels, buttons, captions — a few words each.
 * This is prose that only exists on one screen, where a title, its body and
 * its "does this lab use it" note have to be read and edited together to stay
 * coherent. Splitting one paragraph across three flat keys in two locales is
 * how the Spanish and English versions drift apart. `demoKnowledge.ts` on the
 * broker is the same shape for the same reason.
 *
 * THE RULE THIS FILE LIVES UNDER
 *
 * Everything here is reference material about the Azure API Management
 * product. It is NOT read from this deployment, and most of it is NOT
 * configured in this lab. That is exactly why it renders on its own screen,
 * behind an `illustrative` provenance badge, never beside the live Gateway
 * journey. The one thing on that screen that IS live — which tier this
 * deployment runs on — comes from the broker's `/api/environment`.
 *
 * `usedHere` is therefore load-bearing, not decoration: it is what stops a
 * presenter from reading this list aloud as a list of things that are
 * currently switched on.
 */

export type Localised = Record<Locale, string>;

export interface Capability {
  id: string;
  icon: ComponentType<{ fontSize?: number }>;
  title: Localised;
  body: Localised;
  /**
   * How this lab relates to the capability. "yes" — configured and running
   * here, and the note says where to see it. "no" — available in the product,
   * deliberately not configured here. Rendered as a pill, so the distinction
   * survives being skim-read.
   */
  usedHere: "yes" | "no";
  note: Localised;
}

export const CAPABILITIES: Capability[] = [
  {
    id: "traffic",
    icon: GaugeRegular,
    title: { en: "Traffic management", es: "Gestión de tráfico" },
    body: {
      en: "Rate limits and quotas per subscription, product or caller, and circuit breakers that stop sending traffic to a backend that has started failing.",
      es: "Límites de tasa y cuotas por suscripción, producto o llamante, y circuit breakers que dejan de enviar tráfico a un backend que empezó a fallar.",
    },
    usedHere: "no",
    note: {
      en: "Not configured in this lab. It is a policy change, not an architectural gap.",
      es: "No configurado en este laboratorio. Es un cambio de política, no un vacío arquitectónico.",
    },
  },
  {
    id: "security",
    icon: ShieldKeyholeRegular,
    title: { en: "Security and authentication", es: "Seguridad y autenticación" },
    body: {
      en: "Subscription keys, OAuth2 / JWT validation, client certificates (mTLS), IP filtering and CORS — combinable per API, so the caller's credential and the backend's credential need not be the same thing.",
      es: "Claves de suscripción, validación OAuth2 / JWT, certificados de cliente (mTLS), filtrado por IP y CORS — combinables por API, de modo que la credencial del llamante y la del backend no tienen por qué ser la misma.",
    },
    usedHere: "yes",
    note: {
      en: "This lab uses two of them: a revocable subscription key at the front door, and managed identity outbound, so no model key exists to leak. See the live policy on the Gateway screen.",
      es: "Este laboratorio usa dos: una clave de suscripción revocable en la puerta de entrada, e identidad administrada hacia el backend, así que no existe ninguna clave de modelo que se pueda filtrar. Ver la política real en la pantalla Gateway.",
    },
  },
  {
    id: "transform",
    icon: ArrowSwapRegular,
    title: { en: "Request and response transformation", es: "Transformación de peticiones y respuestas" },
    body: {
      en: "XML ↔ JSON conversion, header manipulation, URL rewriting and body edits — so a backend's contract and the contract you publish to consumers can differ.",
      es: "Conversión XML ↔ JSON, manipulación de encabezados, reescritura de URLs y edición del cuerpo — de modo que el contrato del backend y el que publicas a los consumidores puedan ser distintos.",
    },
    usedHere: "yes",
    note: {
      en: "Partially: this lab's policy rewrites headers (Authorization, Content-Type, Foundry-Features). It does no body or format transformation.",
      es: "Parcialmente: la política de este laboratorio reescribe encabezados (Authorization, Content-Type, Foundry-Features). No transforma cuerpo ni formato.",
    },
  },
  {
    id: "backends",
    icon: BranchRegular,
    title: { en: "Multiple backends", es: "Múltiples backends" },
    body: {
      en: "Load balancing across backend pools, API versions and revisions, and traffic splitting for canary releases — moving 5% of callers to a new version without touching the client.",
      es: "Balanceo de carga entre pools de backends, versiones y revisiones de API, y división de tráfico para despliegues canary — mover el 5% de los llamantes a una versión nueva sin tocar al cliente.",
    },
    usedHere: "no",
    note: {
      en: "Not configured here: one backend, one revision.",
      es: "No configurado aquí: un backend, una revisión.",
    },
  },
  {
    id: "cache",
    icon: DatabaseRegular,
    title: { en: "Response caching", es: "Caché de respuestas" },
    body: {
      en: "Cache responses at the gateway, keyed by whatever identifies an equivalent request, so repeated calls never reach the backend — less load, and on a per-token backend, less cost.",
      es: "Cachear respuestas en el gateway, con la clave que identifique una petición equivalente, para que las llamadas repetidas no lleguen al backend — menos carga y, en un backend que cobra por token, menos costo.",
    },
    usedHere: "no",
    note: {
      en: "Not configured in this lab. Every answer you see was generated by the model just now.",
      es: "No configurado en este laboratorio. Cada respuesta que ves la generó el modelo en ese momento.",
    },
  },
  {
    id: "portal",
    icon: PeopleTeamRegular,
    title: { en: "Developer Portal", es: "Portal de desarrolladores" },
    body: {
      en: "A self-service site where external consumers discover the published APIs, read their documentation, request a subscription and try calls from the browser.",
      es: "Un sitio self-service donde consumidores externos descubren las APIs publicadas, leen su documentación, solicitan una suscripción y prueban llamadas desde el navegador.",
    },
    usedHere: "no",
    note: {
      en: "Not exposed in this lab — there are no external consumers to onboard here.",
      es: "No se expone en este laboratorio — aquí no hay consumidores externos que incorporar.",
    },
  },
  {
    id: "analytics",
    icon: PulseRegular,
    title: { en: "Built-in analytics and observability", es: "Analítica y observabilidad integradas" },
    body: {
      en: "Every call through the gateway is measurable at the gateway: latency, status, caller, backend. It ships to Application Insights and Log Analytics without instrumenting the backend.",
      es: "Cada llamada por el gateway es medible en el gateway: latencia, estado, llamante, backend. Se envía a Application Insights y Log Analytics sin instrumentar el backend.",
    },
    usedHere: "yes",
    note: {
      en: "Live here. The Observability section of this console reads exactly that telemetry.",
      es: "Activo aquí. La sección Observabilidad de esta consola lee justamente esa telemetría.",
    },
  },
  {
    id: "hybrid",
    icon: CloudRegular,
    title: { en: "Multi-cloud and hybrid", es: "Multinube e híbrido" },
    body: {
      en: "The self-hosted gateway runs as a container in your own datacentre or another cloud, managed from the same Azure control plane — one set of policies over backends that are not in Azure.",
      es: "El gateway autohospedado corre como contenedor en tu propio centro de datos u otra nube, gestionado desde el mismo plano de control de Azure — un solo conjunto de políticas sobre backends que no están en Azure.",
    },
    usedHere: "no",
    note: {
      en: "Not used here: this lab is entirely inside one Azure region.",
      es: "No se usa aquí: este laboratorio vive por completo en una sola región de Azure.",
    },
  },
];

// ── Tier comparison — our own measurement, not a datasheet ────────────────

export interface TierRow {
  sku: string;
  cost: Localised;
  coldStart: Localised;
  fit: Localised;
}

/**
 * The two tiers this project actually deployed and measured, in this
 * subscription, in swedencentral. The cold-start figure is ours: an
 * unauthenticated call that APIM rejects with 401 before reaching any
 * backend, so it measures the gateway waking up and nothing else.
 *
 * Kept here rather than stated as generic guidance because a measured number
 * from the room's own architecture is the part a datasheet cannot give them —
 * and because it is honest to show what a tier choice costs in behaviour, not
 * only in money. Full write-up, including the two ways to measure it wrong:
 * labs/…-automation/docs/06-apim-consumption.md
 */
export const TIER_ROWS: TierRow[] = [
  {
    sku: "Basicv2",
    cost: { en: "~$197 / month, fixed", es: "~$197 / mes, fijo" },
    coldStart: { en: "None — always warm", es: "Ninguno — siempre caliente" },
    fit: {
      en: "Live sessions, anything with an audience",
      es: "Sesiones en vivo, cualquier cosa con audiencia",
    },
  },
  {
    sku: "Consumption",
    cost: { en: "~$0 idle, per-call", es: "~$0 en reposo, por llamada" },
    coldStart: {
      en: "54 s measured, after 35 min idle",
      es: "54 s medidos, tras 35 min de reposo",
    },
    fit: {
      en: "Disposable test environments",
      es: "Entornos de prueba desechables",
    },
  },
];

// ── How the model is chosen — the question an architect actually asks ─────

export interface RoutingStep {
  actor: string;
  detail: Localised;
}

/**
 * Answers "how does APIM know which model each agent uses?" — and the answer
 * is that it does not. Included because the intuitive assumption (APIM must be
 * routing per agent) is wrong, and a wrong mental model here leads a customer
 * to design routing rules they do not need.
 */
export const ROUTING_STEPS: RoutingStep[] = [
  {
    actor: "deploy.ps1",
    detail: {
      en: "Injects environment variables into the agent at registration: AZURE_OPENAI_DEPLOYMENT (\"gpt-5-mini\") and AZURE_OPENAI_ENDPOINT (the APIM gateway).",
      es: "Inyecta variables de entorno en el agente al registrarlo: AZURE_OPENAI_DEPLOYMENT (\"gpt-5-mini\") y AZURE_OPENAI_ENDPOINT (el gateway de APIM).",
    },
  },
  {
    actor: "Pydantic AI / Strands",
    detail: {
      en: "The framework builds the inference URL with that deployment name in the path, OpenAI-compatible style.",
      es: "El framework arma la URL de inferencia con ese nombre de deployment en la ruta, al estilo compatible con OpenAI.",
    },
  },
  {
    actor: "API Management",
    detail: {
      en: "Acts as a generic proxy: reads the deployment from the URL, injects the managed-identity token, forwards to Foundry. No per-agent logic exists.",
      es: "Actúa como proxy genérico: lee el deployment desde la URL, inyecta el token de identidad administrada, reenvía a Foundry. No existe lógica por agente.",
    },
  },
];
