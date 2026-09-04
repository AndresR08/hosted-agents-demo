# Default lab configuration.
#
# These values mirror notebook cell 0 of the official lab
# (labs/ai-foundry-hosted-agents-custom-framework). Change them here rather than
# editing the lab. Nothing in this file is environment-specific: there are no
# subscription ids, object ids, resource names or keys.

@{
    # Resource group / deployment naming. The notebook derives these from its own
    # folder name; here they are explicit and overridable on the command line.
    #
    # ResourceGroupName is the one value that deliberately does NOT mirror the
    # notebook: this repository's deployment lives in 'lab-hosted-agents-demo',
    # so the folder-derived name pointed at a group that does not exist and every
    # run had to pass -ResourceGroupName to get past "Reading deployment outputs".
    # DeploymentName still mirrors the notebook, because the ARM deployment inside
    # that group really is called 'ai-foundry-hosted-agents-custom-framework'.
    ResourceGroupName = 'lab-hosted-agents-demo'
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

    <#
      The SHARED API Management gateway this lab registers on, instead of
      deploying one of its own. A Developer-tier instance several teams' labs
      share, which is the whole point: an APIM per lab is the most expensive
      thing any of these deployments creates.

      Everything below is a single source of truth on purpose. deploy.ps1 uses
      these names to create, and teardown.ps1 uses the SAME values to remove; if
      each kept its own list they would drift, and the teardown would silently
      leave behind whatever was added after the lists diverged - on a resource
      other teams depend on.
    #>
    SharedApimName              = 'apim-shared-pdcibwky2f5ms'
    SharedApimResourceGroupName = 'rg-shared-apim-gateway-V2'
    # System-assigned identity of the shared gateway. infra.bicep hands this to
    # upstream's foundry module, which grants it Cognitive Services User on OUR
    # Foundry accounts - a write on our own resources, never on the shared one.
    SharedApimPrincipalId       = '944ee3f2-5dc4-446a-9507-0424cd3020e7'

    # Every name this lab creates on the shared gateway. All lab-prefixed: ARM
    # creating a child that already exists is an update-in-place, so an
    # unprefixed name silently takes over another team's resource.
    SharedApimResources = @{
        InferenceApiName     = 'hosted-agents-inference-api'
        InferenceApiPath     = 'hosted-agents-inference'
        ResponsesApiName     = 'hosted-agents-responses-api'
        ResponsesApiPath     = 'hosted-agents-responses'
        BackendName          = 'hosted-agents-foundry-models'
        BackendPoolName      = 'hosted-agents-inference-backend-pool'
        ProductName          = 'hosted-agents-product'
        DiagnosticSettingName = 'hosted-agents-demo-to-loganalytics'
    }

    <#
      Subscriptions on the shared gateway that belong to this lab and must be
      removed by teardown.

      The second one is not ours by choice: API Management generates a
      GUID-named subscription of its own whenever a product is published, and it
      is bound to hosted-agents-product. Every pre-existing product on that
      gateway has one. It is listed explicitly rather than discovered, because
      teardown deletes only from a fixed allow-list and refuses anything it was
      not told about - a rule worth more than the convenience of globbing.
    #>
    SharedApimOwnedSubscriptions = @(
        'hosted-agents-subscription'
        '6a9ac1a44634611ed4f78c17'
    )

    ApimSku                 = 'Basicv2'
    # Every name this lab creates inside API Management is prefixed with the lab,
    # because the gateway is shared. 'subscription1' - the notebook's default, and
    # what this lab used until the shared-gateway migration - ALREADY EXISTS on
    # apim-shared-pdcibwky2f5ms, owned by the FinOps lab, scoped to its
    # finops-framework-platinum product and carrying a $0.05 cost quota wired to an
    # auto-suspend Logic App. Creating it there is an ARM update-in-place: it would
    # have hijacked their subscription and put our traffic under their quota.
    # If you change this name, change it in broker/src/routes/auditRecord.ts too.
    ApimSubscriptionsConfig = @(
        @{ name = 'hosted-agents-subscription'; displayName = 'Hosted Agents Subscription' }
    )

    <#
      Legacy path keys. They belong to the VENDORED main.bicep, which this lab no
      longer deploys - SharedApimResources above is the authority for what is
      actually registered on the shared gateway.

      They are kept because Preflight validates their presence, and they are kept
      IN STEP with SharedApimResources on purpose: leaving 'inference' and
      'hosted-agent-responses' here produced a 404 on the first migrated run,
      because a validation step still read them. Two keys holding one truth is
      already a smell; two keys holding two different truths is a bug waiting to
      be re-found, so if you change the paths above, change these too.
    #>
    InferenceApiPath            = 'hosted-agents-inference'
    InferenceApiType            = 'AzureAI'
    HostedAgentResponsesApiPath = 'hosted-agents-responses'
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
