/*
  Lab infrastructure WITHOUT an API Management instance of its own.

  Why this file exists at all, given that vendor/ has a main.bicep that does
  almost exactly this: the shared gateway lives in a DIFFERENT resource group
  (rg-shared-apim-gateway-V2), and upstream's main.bicep cannot express that.
  It creates its APIM unconditionally (modules/apim/v3/apim.bicep line 81 has no
  condition) and reaches for it with `existing` BY NAME IN THE CURRENT RESOURCE
  GROUP. Teaching it otherwise means a conditional module, two new parameters,
  moving the inference and responses APIs into foreign-scoped modules and
  rewriting five outputs - roughly 150 lines of diff against upstream, in the
  middle of the file, that would conflict on every sync-vendor.ps1 run. The
  existing Consumption patch is ten lines at the edge. That is the difference
  between a patch and a fork, so this orchestration lives here instead and
  vendor/ stays byte-identical.

  What is NOT re-implemented: every module below is upstream's, referenced in
  place and unmodified. This file only decides which of them run and how they
  are wired. The APIM-side registration is a separate deployment - see
  shared-apim-registration.bicep - because it targets another resource group.

  Deployed by scripts/deploy.ps1 against the lab resource group.
*/

// ------------------
//    PARAMETERS
// ------------------

@description('Configuration array for AI Services. Each item needs name and location.')
param aiServicesConfig array = []

@description('Configuration array for model deployments.')
param modelsConfig array = []

@description('Name of the AI Foundry project')
param foundryProjectName string = 'default'

@description('Index of the AI Services config entry that hosts the Foundry hosted agents (default: second entry).')
param foundryAgentAiServiceIndex int = 1

@description('Microsoft Entra object IDs to assign Foundry User (Azure AI User) across all Foundry resources in this deployment.')
param foundryUserObjectIds array = []

/*
  The system-assigned identity of the SHARED gateway, not of an APIM we own.

  This is the whole point of the migration: upstream's foundry module already
  grants `Cognitive Services User` to whatever principal it is handed
  (modules/cognitive-services/v3/foundry.bicep, roleAssignmentCognitiveServicesUser),
  so handing it the shared gateway's principal gives that gateway exactly the
  access it needs to OUR Foundry accounts, and nothing else. The grant is written
  on our own resources, which is what makes it safe: nothing is modified on the
  shared gateway to obtain it. Every lab already connected there does the same -
  the shared identity holds eight narrow assignments, one set per lab, and no
  broad ones.
*/
@description('Principal id of the shared API Management system-assigned identity.')
param sharedApimPrincipalId string

// ------------------
//    VARIABLES
// ------------------

var resourceSuffix = uniqueString(subscription().id, resourceGroup().id)
var azureAIUserRoleDefinitionId = resourceId('Microsoft.Authorization/roleDefinitions', '53ca6127-db72-4b80-b1b0-d745d6d5456d')

// Azure OpenAI data-plane role. Upstream's foundry module grants only
// `Cognitive Services User`, which is what this lab has always run on. It is
// granted here as well because every other lab connected to the shared gateway
// holds both on its own Foundry accounts, and matching that precedent costs
// nothing and removes a difference that would otherwise have to be explained
// the first time an inference call returns 401.
var cognitiveServicesOpenAIUserRoleDefinitionId = resourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')

// ------------------
//    RESOURCES
// ------------------

// 1. Log Analytics Workspace - ours, and the one /api/journey queries.
module lawModule '../../../vendor/ai-gateway/modules/operational-insights/v1/workspaces.bicep' = {
  name: 'lawModule'
}

// 2. Application Insights
module appInsightsModule '../../../vendor/ai-gateway/modules/monitor/v1/appinsights.bicep' = {
  name: 'appInsightsModule'
  params: {
    lawId: lawModule.outputs.id
    customMetricsOptedInType: 'WithDimensions'
  }
}

// 3. (deliberately absent) API Management.
//    The shared instance is used instead; see shared-apim-registration.bicep.

// 4. AI Foundry with model deployments
module foundryModule '../../../vendor/ai-gateway/modules/cognitive-services/v3/foundry.bicep' = {
  name: 'foundryModule'
  params: {
    aiServicesConfig: aiServicesConfig
    modelsConfig: modelsConfig
    // The shared gateway's identity, not ours - see the parameter's comment.
    apimPrincipalId: sharedApimPrincipalId
    foundryProjectName: foundryProjectName
    appInsightsId: appInsightsModule.outputs.id
    appInsightsInstrumentationKey: appInsightsModule.outputs.instrumentationKey
    appInsightsConnectionString: appInsightsModule.outputs.connectionString
  }
}

// Foundry accounts created by the module, referenced here for RBAC assignments.
resource aiFoundryAccounts 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = [for config in aiServicesConfig: {
  name: '${config.name}-${resourceSuffix}'
  dependsOn: [foundryModule]
}]

// Azure OpenAI data-plane access for the shared gateway, on our accounts only.
resource sharedApimOpenAIUserRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (config, i) in aiServicesConfig: {
  name: guid(resourceGroup().id, '${config.name}-${resourceSuffix}', sharedApimPrincipalId, cognitiveServicesOpenAIUserRoleDefinitionId)
  scope: aiFoundryAccounts[i]
  properties: {
    roleDefinitionId: cognitiveServicesOpenAIUserRoleDefinitionId
    principalId: sharedApimPrincipalId
    principalType: 'ServicePrincipal'
  }
}]

// 5. (deliberately absent) the inference API.
//    Registered on the shared gateway instead; see shared-apim-registration.bicep.

// 6. Container Registry (for hosted agent images)
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: 'acr${resourceSuffix}'
  location: resourceGroup().location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    anonymousPullEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

// Assign Foundry User role for all provided users on the model-hosting Foundry resource.
resource modelFoundryUserRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in foundryUserObjectIds: {
  name: guid(resourceGroup().id, aiFoundryAccounts[0].name, principalId, azureAIUserRoleDefinitionId)
  scope: aiFoundryAccounts[0]
  properties: {
    roleDefinitionId: azureAIUserRoleDefinitionId
    principalId: principalId
    principalType: 'User'
  }
}]

// Assign Foundry User role for all provided users on the hosted-agent Foundry resource.
resource agentFoundryUserRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principalId in foundryUserObjectIds: {
  name: guid(resourceGroup().id, aiFoundryAccounts[foundryAgentAiServiceIndex].name, principalId, azureAIUserRoleDefinitionId)
  scope: aiFoundryAccounts[foundryAgentAiServiceIndex]
  properties: {
    roleDefinitionId: azureAIUserRoleDefinitionId
    principalId: principalId
    principalType: 'User'
  }
}]

// Reference the Foundry projects created by the module to assign ACR roles to their managed identities.
resource modelFoundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-04-01-preview' existing = {
  parent: aiFoundryAccounts[0]
  name: '${foundryProjectName}-foundry-models'
}

resource agentFoundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-04-01-preview' existing = {
  parent: aiFoundryAccounts[foundryAgentAiServiceIndex]
  name: '${foundryProjectName}-foundry-agents'
}

// Repository-level ACR roles (ABAC-enabled roles)
var acrRepositoryReaderRoleId = resourceId('Microsoft.Authorization/roleDefinitions', 'b93aa761-3e63-49ed-ac28-beffa264f7ac')
var acrRepositoryWriterRoleId = resourceId('Microsoft.Authorization/roleDefinitions', '2a1e307c-b015-4ebd-883e-5b7698a07328')
var acrRepositoryCatalogListerRoleId = resourceId('Microsoft.Authorization/roleDefinitions', 'bfdb9389-c9a5-478a-bb2f-ba9ca092c3c7')
var acrPullRoleId = resourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var foundryModelAccountName = '${aiServicesConfig[0].name}-${resourceSuffix}'
var foundryAgentAccountName = '${aiServicesConfig[foundryAgentAiServiceIndex].name}-${resourceSuffix}'

// Assign AcrPull to Foundry models account for any container image pulls
resource foundryModelAcrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, foundryModelAccountName, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: foundryModule.outputs.extendedAIServicesConfig[0].principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign AcrPull to Foundry models project for container image pulls
resource foundryModelProjectAcrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, modelFoundryProject.id, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: modelFoundryProject.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource foundryAgentAcrRepositoryReaderRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, foundryAgentAccountName, acrRepositoryReaderRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrRepositoryReaderRoleId
    principalId: foundryModule.outputs.extendedAIServicesConfig[foundryAgentAiServiceIndex].principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign AcrPull to Foundry hosted-agent account for container image pulls
resource foundryAgentAcrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, foundryAgentAccountName, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: foundryModule.outputs.extendedAIServicesConfig[foundryAgentAiServiceIndex].principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign AcrPull to Foundry hosted-agent project for container image pulls
resource foundryAgentProjectAcrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, agentFoundryProject.id, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrPullRoleId
    principalId: agentFoundryProject.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deployerAcrRepositoryWriterRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, deployer().objectId, containerRegistry.id, acrRepositoryWriterRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrRepositoryWriterRoleId
    principalId: deployer().objectId
  }
}

resource deployerAcrRepositoryCatalogListerRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, deployer().objectId, containerRegistry.id, acrRepositoryCatalogListerRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: acrRepositoryCatalogListerRoleId
    principalId: deployer().objectId
  }
}

// ------------------
//    OUTPUTS
// ------------------

// Everything the SECOND deployment (shared-apim-registration.bicep) and
// deploy.ps1 need. No APIM values appear here: this deployment does not know
// the gateway exists, which is the property that keeps the two halves separable.
output logAnalyticsWorkspaceId string = lawModule.outputs.customerId
output logAnalyticsWorkspaceResourceId string = lawModule.outputs.id
output appInsightsId string = appInsightsModule.outputs.id
output appInsightsInstrumentationKey string = appInsightsModule.outputs.instrumentationKey
output extendedAIServicesConfig array = foundryModule.outputs.extendedAIServicesConfig
output foundryProjectEndpoint string = foundryModule.outputs.extendedAIServicesConfig[0].foundryProjectEndpoint
output foundryAiServicesEndpoint string = foundryModule.outputs.extendedAIServicesConfig[0].endpoint
output foundryAgentProjectEndpoint string = foundryModule.outputs.extendedAIServicesConfig[foundryAgentAiServiceIndex].foundryProjectEndpoint
output foundryAgentAiServicesEndpoint string = foundryModule.outputs.extendedAIServicesConfig[foundryAgentAiServiceIndex].endpoint
output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
