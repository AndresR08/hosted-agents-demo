# Default lab configuration.
#
# These values mirror notebook cell 0 of the official lab
# (labs/ai-foundry-hosted-agents-custom-framework). Change them here rather than
# editing the lab. Nothing in this file is environment-specific: there are no
# subscription ids, object ids, resource names or keys.

@{
    # Resource group / deployment naming. The notebook derives these from its own
    # folder name; here they are explicit and overridable on the command line.
    ResourceGroupName = 'lab-ai-foundry-hosted-agents-custom-framework'
    DeploymentName    = 'ai-foundry-hosted-agents-custom-framework'
    Location          = 'swedencentral'

    # Two Microsoft Foundry resources: index 0 hosts the model, index 1 hosts the agent.
    AiServicesConfig = @(
        @{ name = 'foundry-models'; location = 'swedencentral' }
        @{ name = 'foundry-agents'; location = 'swedencentral' }
    )

    ModelsConfig = @(
        @{
            name      = 'gpt-5-mini'
            publisher = 'OpenAI'
            version   = '2025-08-07'
            sku       = 'GlobalStandard'
            capacity  = 10
            aiservice = 'foundry-models'
        }
    )

    ApimSku                 = 'Basicv2'
    ApimSubscriptionsConfig = @(
        @{ name = 'subscription1'; displayName = 'Subscription 1' }
    )

    InferenceApiPath            = 'inference'
    InferenceApiType            = 'AzureAI'
    HostedAgentResponsesApiPath = 'hosted-agent-responses'
    FoundryProjectName          = 'default'
    FoundryAgentAiServiceIndex  = 1

    # Hosted agent container sizing - same values the notebook passes.
    AgentCpu    = '1'
    AgentMemory = '2Gi'

    # Framework -> agent name / image repository, from the notebook's frameworks dict.
    Frameworks = @{
        strands  = @{ agentName = 'strands-agent';  image = 'strands-agent' }
        pydantic = @{ agentName = 'pydantic-agent'; image = 'pydantic-agent' }
    }

    # Environment variables injected into the hosted agent container.
    # AZURE_OPENAI_ENDPOINT / DEPLOYMENT / APIM_SUBSCRIPTION_KEY are computed at
    # runtime from the deployment outputs.
    AgentApiVersion = '2024-05-01-preview'
    AgentLogLevel   = 'INFO'

    # Companion demo (broker + console) on a single Linux App Service.
    # B1 rather than the Free tier: F1 has no Always On, so the site cold-starts
    # for 20-30 seconds in the middle of a presentation, and it is capped at 60
    # CPU minutes a day. Overridable with -AppServiceSku.
    AppServiceSku     = 'B1'
    AppServiceRuntime = 'NODE:22-lts'
}
