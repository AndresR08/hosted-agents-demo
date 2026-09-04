/*
  Registers this lab on the SHARED API Management gateway.

  Deployed against rg-shared-apim-gateway-V2, which is not this lab's resource
  group. That is the entire reason this is a separate deployment rather than a
  module of infra.bicep: a resource-group-scoped deployment cannot create child
  resources of a service that lives in another group, and keeping it separate
  also means it can be previewed with `what-if` on its own, before anything is
  written to a gateway other teams depend on.

  ─── The rules this file obeys, and why ──────────────────────────────────

  1. EVERY name is prefixed `hosted-agents-`. Not style: ARM creating a child
     resource with an existing name is an update-in-place, so an unprefixed name
     silently takes over someone else's. This lab shipped with the notebook's
     default subscription name `subscription1`, which already exists here owned
     by the FinOps lab and carries a $0.05 quota wired to an auto-suspend Logic
     App. Deploying that name would have hijacked their subscription AND put our
     traffic under their quota.

  2. NOTHING service-level is created. The gateway already has an
     `appinsights-logger`, an `azuremonitor` logger, an `azuremonitor` service
     diagnostic and three diagnostic settings. Upstream's apim.bicep creates the
     first three, which is why that module is not used here at all - recreating
     `appinsights-logger` would repoint every other lab's telemetry at our
     Application Insights. Upstream's inference-api.bicep, by contrast, only
     REFERENCES the logger by resourceId, so it is safe to reuse as-is and is
     reused unmodified.

  3. The one service-level thing we do add is a fourth diagnostic setting, and
     it is additive: a new name, our workspace, alongside the three that exist.
     Azure allows five per resource, so this leaves one spare. It must be
     removed by teardown.ps1 - Microsoft's guidance is explicit that a setting
     outliving its destination can be re-applied to a resource recreated with
     the same name.
*/

targetScope = 'resourceGroup'

// ------------------
//    PARAMETERS
// ------------------

@description('Name of the SHARED API Management service. This deployment targets its resource group.')
param sharedApimName string

@description('Our inference API name, lab-prefixed.')
param inferenceApiName string = 'hosted-agents-inference-api'

@description('Our inference API path, lab-prefixed. The module appends the endpoint segment.')
param inferenceApiPath string = 'hosted-agents-inference'

@description('Type of inference API, passed through to upstream inference-api.bicep.')
param inferenceApiType string = 'AzureAI'

@description('Our APIM backend name for the models Foundry account, lab-prefixed.')
param inferenceBackendName string = 'hosted-agents-foundry-models'

@description('Endpoint of our models Foundry account, from infra.bicep outputs.')
param modelFoundryEndpoint string

@description('Our responses API name, lab-prefixed.')
param responsesApiName string = 'hosted-agents-responses-api'

@description('Our responses API path, lab-prefixed.')
param responsesApiPath string = 'hosted-agents-responses'

@description('Foundry project endpoint of our hosted-agent account, from infra.bicep outputs.')
param agentFoundryProjectEndpoint string

@description('Our product name, lab-prefixed.')
param productName string = 'hosted-agents-product'

@description('Our subscription name, lab-prefixed. NEVER "subscription1" - see the header.')
param subscriptionName string = 'hosted-agents-subscription'

@description('Display name for our subscription.')
param subscriptionDisplayName string = 'Hosted Agents Subscription'

@description('Resource id of OUR Log Analytics workspace, the one /api/journey queries.')
param logAnalyticsWorkspaceResourceId string

@description('Resource id of OUR Application Insights instance.')
param appInsightsId string

@description('Instrumentation key of OUR Application Insights instance.')
@secure()
param appInsightsInstrumentationKey string

@description('Name of the diagnostic setting this lab adds to the shared gateway.')
param diagnosticSettingName string = 'hosted-agents-demo-to-loganalytics'

// ------------------
//    EXISTING
// ------------------

resource apimService 'Microsoft.ApiManagement/service@2024-06-01-preview' existing = {
  name: sharedApimName
}

// Referenced, never created. This is the logger the shared gateway already owns.
resource azureMonitorLogger 'Microsoft.ApiManagement/service/loggers@2024-06-01-preview' existing = {
  parent: apimService
  name: 'azuremonitor'
}

// ------------------
//    OUR API SURFACE
// ------------------

/*
  Upstream's inference API module, reused unmodified and pointed at the shared
  gateway by `apiManagementName` plus this deployment's scope. It creates the
  API, the backend (named from aiServicesConfig[0].name, which is also what it
  substitutes into policy.xml's {backend-id} placeholder - so renaming the
  backend cannot desynchronise the policy), the API policy, and both per-API
  diagnostics. Its `applicationinsights` diagnostic references
  `appinsights-logger` by resourceId in the current resource group, which here
  resolves to the shared gateway's existing logger. Nothing is created that
  another lab already owns.
*/
module inferenceApi '../../../vendor/ai-gateway/modules/apim/v3/inference-api.bicep' = {
  name: 'hostedAgentsInferenceApi'
  params: {
    apiManagementName: sharedApimName
    apimLoggerId: azureMonitorLogger.id
    appInsightsId: appInsightsId
    appInsightsInstrumentationKey: appInsightsInstrumentationKey
    policyXml: loadTextContent('../../../vendor/ai-gateway/labs/ai-foundry-hosted-agents-custom-framework/policy.xml')
    aiServicesConfig: [
      {
        name: inferenceBackendName
        endpoint: modelFoundryEndpoint
      }
    ]
    inferenceAPIName: inferenceApiName
    inferenceAPIPath: inferenceApiPath
    inferenceAPIType: inferenceApiType
    inferenceBackendPoolName: 'hosted-agents-inference-backend-pool'
  }
}

/*
  The responses API. Upstream keeps this inline in the lab's main.bicep rather
  than in a module, so it is reproduced here - the only genuinely duplicated
  block in this migration. `subscriptionKeyParameterNames` is carried over
  verbatim and matters: the console sends the key as `api-key`, and without
  declaring it API Management only accepts Ocp-Apim-Subscription-Key and answers
  401.
*/
resource responsesApi 'Microsoft.ApiManagement/service/apis@2024-06-01-preview' = {
  name: responsesApiName
  parent: apimService
  properties: {
    apiType: 'http'
    description: 'Proxy for Azure AI Foundry Responses API - routes requests to specific hosted agents by agent name in URL path'
    displayName: 'Hosted Agents Responses API'
    path: responsesApiPath
    protocols: [
      'https'
    ]
    serviceUrl: agentFoundryProjectEndpoint
    subscriptionKeyParameterNames: {
      header: 'api-key'
      query: 'api-key'
    }
    subscriptionRequired: true
    type: 'http'
  }
}

resource responsesOperation 'Microsoft.ApiManagement/service/apis/operations@2024-06-01-preview' = {
  name: 'create-response'
  parent: responsesApi
  properties: {
    displayName: 'Create Response'
    description: 'Create a model response using a specific hosted agent. Agent name must be specified in the URL path.'
    method: 'POST'
    urlTemplate: '/agents/{agentName}/endpoint/protocols/openai/responses'
    templateParameters: [
      {
        name: 'agentName'
        description: 'Name of the hosted agent to invoke'
        type: 'string'
        required: true
        values: []
      }
    ]
    responses: [
      {
        statusCode: 200
        description: 'Successful response from the agent'
      }
    ]
  }
}

resource responsesApiPolicy 'Microsoft.ApiManagement/service/apis/policies@2024-06-01-preview' = {
  name: 'policy'
  parent: responsesApi
  properties: {
    format: 'rawxml'
    value: loadTextContent('../../../vendor/ai-gateway/labs/ai-foundry-hosted-agents-custom-framework/hosted-agent-policy.xml')
  }
}

/*
  Per-API diagnostics for the responses API. Upstream's main.bicep never created
  these - it only gets them for the inference API, through the module. They are
  added here because the two APIs already registered on this gateway that are
  closest to ours (finops-framework-inference-api, inference-api-tazvvonn4lhea)
  both carry both, and because a lab connected here previously found that
  correct policy XML alone does not put telemetry where it is expected.
*/
resource responsesApiAzureMonitorDiagnostic 'Microsoft.ApiManagement/service/apis/diagnostics@2024-06-01-preview' = {
  parent: responsesApi
  name: 'azuremonitor'
  properties: {
    alwaysLog: 'allErrors'
    verbosity: 'verbose'
    logClientIp: true
    loggerId: azureMonitorLogger.id
    sampling: {
      samplingType: 'fixed'
      percentage: json('100')
    }
  }
}

resource responsesApiAppInsightsDiagnostic 'Microsoft.ApiManagement/service/apis/diagnostics@2022-08-01' = {
  parent: responsesApi
  name: 'applicationinsights'
  properties: {
    alwaysLog: 'allErrors'
    httpCorrelationProtocol: 'W3C'
    logClientIp: true
    loggerId: resourceId(resourceGroup().name, 'Microsoft.ApiManagement/service/loggers', sharedApimName, 'appinsights-logger')
    metrics: true
    verbosity: 'verbose'
    sampling: {
      samplingType: 'fixed'
      percentage: json('100')
    }
  }
}

// ------------------
//    PRODUCT + SUBSCRIPTION
// ------------------

/*
  Our own product and our own subscription scoped to it, which is the convention
  the recently connected labs actually follow (webapp-chat-product /
  webapp-chat-subscription). The gateway also has a `shared-subscription` scoped
  to /apis - every API on the gateway - and the README suggests using it. It is
  deliberately NOT used: a key scoped to /apis would let this demo's browser key
  reach other teams' APIs, which is a security property we should not adopt for
  convenience.
*/
resource product 'Microsoft.ApiManagement/service/products@2024-06-01-preview' = {
  name: productName
  parent: apimService
  properties: {
    displayName: 'Hosted Agents Demo'
    description: 'Custom-framework hosted agents demo - inference and responses APIs.'
    state: 'published'
    subscriptionRequired: true
    approvalRequired: false
  }
}

resource productInferenceApiLink 'Microsoft.ApiManagement/service/products/apis@2024-06-01-preview' = {
  parent: product
  name: inferenceApiName
  dependsOn: [inferenceApi]
}

resource productResponsesApiLink 'Microsoft.ApiManagement/service/products/apis@2024-06-01-preview' = {
  parent: product
  name: responsesApi.name
}

resource subscription 'Microsoft.ApiManagement/service/subscriptions@2024-06-01-preview' = {
  name: subscriptionName
  parent: apimService
  properties: {
    displayName: subscriptionDisplayName
    scope: product.id
    state: 'active'
    allowTracing: true
  }
}

// ------------------
//    TELEMETRY
// ------------------

/*
  The fourth diagnostic setting. GatewayLogs is what ApiManagementGatewayLogs is
  built from, and that table is what /api/journey/:askId reads to show per-hop
  timings - so without this, the Observability screen would go blank after the
  migration even though every policy worked.

  It is resource-level, not per-API: Azure offers no way to route one API's
  gateway logs to one workspace. So our workspace will also receive the other
  labs' gateway traffic, and theirs already receives what ours will send. That is
  a property of the shared gateway, not something this file can fix; it is
  recorded in DESIGN_DECISIONS.md rather than left to be discovered.
*/
resource labDiagnosticSetting 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: diagnosticSettingName
  scope: apimService
  properties: {
    workspaceId: logAnalyticsWorkspaceResourceId
    /*
      'Dedicated' is what puts these rows in the resource-specific table
      ApiManagementGatewayLogs. Without it the default is 'AzureDiagnostics',
      the rows land in the generic AzureDiagnostics table instead, and
      /api/journey/:askId - which queries ApiManagementGatewayLogs by name -
      waits for ingestion that will never arrive. The first version of this file
      omitted it and the Observability screen stayed empty with no error
      anywhere; upstream's own apim.bicep sets it, which is what the comparison
      that found this was against.
    */
    logAnalyticsDestinationType: 'Dedicated'
    logs: [
      {
        category: 'GatewayLogs'
        enabled: true
      }
      {
        category: 'GatewayLlmLogs'
        enabled: true
      }
    ]
  }
}

// ------------------
//    OUTPUTS
// ------------------

output gatewayUrl string = apimService.properties.gatewayUrl
output inferenceApiPathFull string = '${apimService.properties.gatewayUrl}/${inferenceApiPath}'
output responsesApiUrl string = '${apimService.properties.gatewayUrl}/${responsesApiPath}'
output subscriptionResourceName string = subscription.name
output productResourceName string = product.name
output diagnosticSettingResourceName string = labDiagnosticSetting.name
