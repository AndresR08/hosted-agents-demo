# Preguntas frecuentes y cómo responderlas

Respuestas sugeridas a las preguntas difíciles que un cliente hace típicamente durante o después de la presentación. Complementa a [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md) — léela primero para el contexto completo del guion.

**"¿Esto es un producto de Microsoft? ¿Lo puedo comprar / lo tiene soportado?"**
No. Es una herramienta de preventa construida sobre un laboratorio open-source oficial de Microsoft. Lo que sí es soportado y real es la arquitectura subyacente: Foundry, API Management, Log Analytics.

**"¿Esto reemplaza el portal de Azure AI Foundry?"**
No, en absoluto. Todo lo que ven aquí se lee en vivo de los mismos recursos que verían en el portal de Foundry o en Azure Portal. Registrar agentes, cambiar políticas, operar el día a día — eso sigue pasando ahí, no aquí. Esta consola es la narración, no la herramienta de trabajo.

**"¿Por qué dos frameworks? ¿Cuál es mejor?"**
No es una comparación de rendimiento. Es la prueba de que la plataforma es agnóstica al framework: el equipo de un cliente puede seguir usando las herramientas que ya conoce y aun así heredar la misma identidad, el mismo gateway y la misma auditoría. Pydantic AI y Strands existen por razones de ingeniería distintas — tipado de salida y validación en un caso, gestión de contexto y control del loop del agente en el otro.

**"¿Cuánto cuesta esto en producción?"**
No mostramos cifras de costo en esta demo porque no las estamos capturando de forma confiable en este laboratorio — decirles un número inventado sería precisamente el tipo de dato fabricado que esta aplicación se niega a mostrar. Podemos llevar esa conversación a un ejercicio de costos con su equipo de FinOps. *(Nota para el presentador: el modelo de costo detrás de esto — qué es fijo, qué es variable, y cómo obtener una cifra real — está en [`DESPLIEGUE_Y_COSTOS.md`](../01-general/DESPLIEGUE_Y_COSTOS.md).)*

**"¿Es suficientemente seguro para un banco / asegurador / hospital?"**
Lo que acaban de ver — autenticación por clave revocable, identidad administrada en ambos saltos, auditoría completa de prompt y respuesta, filtrado de contenido en el modelo — es real y está activo hoy en este laboratorio. Lo que no está encendido (límite de tasa, redes privadas, autenticación exclusiva con Entra, Key Vault) son cambios de configuración conocidos, no vacíos arquitectónicos, y se los mostramos explícitamente en la sección Plataforma en lugar de ocultarlos.

**"¿Qué pasa si se cae la conexión a internet durante la presentación?"**
Existe un modo Simulación como red de seguridad de rehearsal — cada panel se re-etiqueta visiblemente cuando cambias a él, así que nunca se presenta como datos reales. Es preferible pausar y explicarlo así, en lugar de fingir que sigue en vivo.

**"¿Puedo personalizar esto para mi industria / mi caso de uso?"**
La arquitectura sí — cualquier framework de agentes puede convertirse en un Hosted Agent siguiendo el mismo patrón. Esta consola específica es una herramienta de preventa interna; lo que se personaliza es la conversación y el laboratorio subyacente, no esta aplicación.

**"¿Cómo lo despliego yo mismo?"**
Con el notebook `ai-foundry-hosted-agents-custom-framework.ipynb` del laboratorio oficial — corre de extremo a extremo, con una variable para elegir el framework (`strands` o `pydantic`), y no requiere Docker local porque la imagen se construye en Azure Container Registry.

**"¿Cómo sabe APIM qué modelo usa cada agente?"**
No lo sabe, y no lo decide. Al registrar el agente se le entrega el nombre del deployment como variable de entorno; su framework pone ese nombre en la URL de la petición, y API Management actúa como proxy genérico — lee el destino desde la URL, inyecta el token de identidad administrada y reenvía. No hay lógica de enrutamiento por agente en el gateway. Cambiar de modelo implica una nueva versión del agente con la variable actualizada, no un interruptor en tiempo de ejecución. *(Nota para el presentador: el guion completo de esto, y los seguimientos probables, están en [`GUIA_CAPACIDADES_APIM.md`](GUIA_CAPACIDADES_APIM.md).)*

## Ver también

- [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md) — el guion completo de la presentación.
- [`PROPOSITO_DEMO.md`](../01-general/PROPOSITO_DEMO.md) — el objetivo, alcance y filosofía completos.
