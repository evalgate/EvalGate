/**
 * OpenAPI/Swagger documentation generator
 * Provides API documentation for developers
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'AI Evaluation Platform API',
    version: '1.0.0',
    description: 'Comprehensive API for AI model evaluation, testing, and monitoring',
    contact: {
      name: 'API Support',
      email: 'support@evalai.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.evalai.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      ValidationError: {
        description: 'Invalid input',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      QuotaExceeded: {
        description: 'Usage quota exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    schemas: {
      Trace: {
        type: 'object',
        required: ['name', 'traceId', 'organizationId'],
        properties: {
          id: { type: 'integer', readOnly: true },
          name: { type: 'string', minLength: 1, maxLength: 255 },
          traceId: { type: 'string', minLength: 1, maxLength: 255 },
          organizationId: { type: 'integer' },
          status: { type: 'string', enum: ['pending', 'success', 'error'] },
          durationMs: { type: 'integer', nullable: true },
          metadata: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      Evaluation: {
        type: 'object',
        required: ['name', 'type', 'organizationId', 'createdBy'],
        properties: {
          id: { type: 'integer', readOnly: true },
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', nullable: true },
          type: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'running', 'completed', 'failed'] },
          organizationId: { type: 'integer' },
          createdBy: { type: 'string' },
          executionSettings: { type: 'object', nullable: true },
          modelSettings: { type: 'object', nullable: true },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
          updatedAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      APIKey: {
        type: 'object',
        properties: {
          id: { type: 'integer', readOnly: true },
          name: { type: 'string' },
          keyPrefix: { type: 'string', readOnly: true },
          scopes: { type: 'array', items: { type: 'string' } },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      Annotation: {
        type: 'object',
        properties: {
          id: { type: 'integer', readOnly: true },
          testCaseId: { type: 'integer' },
          annotatorId: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          feedback: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      LLMJudgeConfig: {
        type: 'object',
        required: ['name', 'model', 'rubric'],
        properties: {
          id: { type: 'integer', readOnly: true },
          name: { type: 'string' },
          model: { type: 'string' },
          rubric: { type: 'object' },
          organizationId: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      LLMJudgeResult: {
        type: 'object',
        properties: {
          id: { type: 'integer', readOnly: true },
          configId: { type: 'integer' },
          testCaseId: { type: 'integer' },
          score: { type: 'number' },
          reasoning: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'integer', readOnly: true },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' } },
          secret: { type: 'string' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object', nullable: true },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Health Check',
        description: 'Check the health status of the API and its dependencies',
        tags: ['System'],
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number' },
                    version: { type: 'string' },
                    checks: {
                      type: 'object',
                      properties: {
                        database: {
                          type: 'object',
                          properties: {
                            status: { type: 'string' },
                            responseTime: { type: 'number' },
                          },
                        },
                        redis: {
                          type: 'object',
                          properties: {
                            status: { type: 'string' },
                            responseTime: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '503': {
            description: 'System is unhealthy',
          },
        },
      },
    },
    '/api/traces': {
      get: {
        summary: 'List Traces',
        description: 'Retrieve a list of execution traces',
        tags: ['Traces'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by organization ID',
          },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['pending', 'success', 'error'] },
            description: 'Filter by status',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50, maximum: 100 },
            description: 'Number of results to return',
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
            description: 'Number of results to skip',
          },
        ],
        responses: {
          '200': {
            description: 'List of traces',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Trace' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
      post: {
        summary: 'Create Trace',
        description: 'Create a new execution trace',
        tags: ['Traces'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Trace' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Trace created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Trace' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '402': { $ref: '#/components/responses/QuotaExceeded' },
        },
      },
    },
    '/api/evaluations': {
      get: {
        summary: 'List Evaluations',
        description: 'Retrieve a list of evaluations',
        tags: ['Evaluations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
            description: 'Search by name',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 10, maximum: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0 },
          },
        ],
        responses: {
          '200': {
            description: 'List of evaluations',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Evaluation' },
                },
              },
            },
          },
        },
      },
    },
    '/api/developer/api-keys': {
      get: {
        summary: 'List API Keys',
        description: 'Retrieve API keys for the authenticated user',
        tags: ['Developer'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'List of API keys',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/APIKey' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create API Key',
        description: 'Generate a new API key',
        tags: ['Developer'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'organizationId', 'scopes'],
                properties: {
                  name: { type: 'string' },
                  organizationId: { type: 'integer' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  expiresAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'API key created (shown only once)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    apiKey: { type: 'string' },
                    key: { $ref: '#/components/schemas/APIKey' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/annotations': {
      get: {
        summary: 'List Annotations',
        description: 'Retrieve annotations for human-in-the-loop evaluation',
        tags: ['Annotations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'taskId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by annotation task ID',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
          },
        ],
        responses: {
          '200': {
            description: 'List of annotations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    annotations: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Annotation' },
                    },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create Annotation',
        description: 'Submit a new human annotation',
        tags: ['Annotations'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Annotation' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Annotation created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    annotation: { $ref: '#/components/schemas/Annotation' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/llm-judge/configs': {
      get: {
        summary: 'List LLM Judge Configurations',
        description: 'Retrieve LLM judge configurations',
        tags: ['LLM Judge'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
          },
        ],
        responses: {
          '200': {
            description: 'List of configurations',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LLMJudgeConfig' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create LLM Judge Configuration',
        description: 'Create a new LLM judge configuration with rubric',
        tags: ['LLM Judge'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LLMJudgeConfig' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Configuration created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LLMJudgeConfig' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/llm-judge/results': {
      get: {
        summary: 'List LLM Judge Results',
        description: 'Retrieve evaluation results from LLM judge',
        tags: ['LLM Judge'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'configId',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            name: 'minScore',
            in: 'query',
            schema: { type: 'number' },
          },
          {
            name: 'maxScore',
            in: 'query',
            schema: { type: 'number' },
          },
        ],
        responses: {
          '200': {
            description: 'List of results',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LLMJudgeResult' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/llm-judge/evaluate': {
      post: {
        summary: 'Run LLM Judge Evaluation',
        description: 'Execute an evaluation using LLM judge',
        tags: ['LLM Judge'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['configId', 'testCases'],
                properties: {
                  configId: { type: 'integer' },
                  testCases: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        input: { type: 'string' },
                        output: { type: 'string' },
                        expectedOutput: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Evaluation completed',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LLMJudgeResult' },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/developer/webhooks': {
      get: {
        summary: 'List Webhooks',
        description: 'Retrieve configured webhooks',
        tags: ['Developer'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of webhooks',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Webhook' },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        summary: 'Create Webhook',
        description: 'Register a new webhook endpoint',
        tags: ['Developer'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['url', 'events'],
                properties: {
                  url: { type: 'string', format: 'uri' },
                  events: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Webhook created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Webhook' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/developer/usage': {
      get: {
        summary: 'Get API Usage',
        description: 'Retrieve API usage statistics',
        tags: ['Developer'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            required: true,
            schema: { type: 'integer' },
          },
          {
            name: 'startDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'endDate',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Usage statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    totalRequests: { type: 'integer' },
                    requestsByEndpoint: { type: 'object' },
                    quotaUsed: { type: 'number' },
                    quotaLimit: { type: 'number' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/api/traces/{id}': {
      get: {
        summary: 'Get Trace by ID',
        description: 'Retrieve a specific trace with details',
        tags: ['Traces'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Trace details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Trace' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/evaluations/{id}': {
      get: {
        summary: 'Get Evaluation by ID',
        description: 'Retrieve a specific evaluation',
        tags: ['Evaluations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Evaluation details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Evaluation' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        summary: 'Update Evaluation',
        description: 'Update an existing evaluation',
        tags: ['Evaluations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Evaluation' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Evaluation updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Evaluation' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        summary: 'Delete Evaluation',
        description: 'Delete an evaluation',
        tags: ['Evaluations'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'Evaluation deleted',
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
  tags: [
    { name: 'System', description: 'System health and status' },
    { name: 'Traces', description: 'Execution trace management' },
    { name: 'Evaluations', description: 'Evaluation management' },
    { name: 'Annotations', description: 'Human-in-the-loop annotations' },
    { name: 'LLM Judge', description: 'LLM-powered evaluation' },
    { name: 'Developer', description: 'API keys and developer tools' },
  ],
};

