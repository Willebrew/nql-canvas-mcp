import { NextRequest, NextResponse } from 'next/server';
import { allTools } from '@/lib/tools';
import { CanvasAPI } from '@/lib/canvas';
import { handleCanvasTool } from '@/lib/handler';

// MCP Protocol Types
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// MCP Methods
const MCP_METHODS = {
  INITIALIZE: 'initialize',
  LIST_TOOLS: 'tools/list',
  CALL_TOOL: 'tools/call',
  LIST_RESOURCES: 'resources/list',
  LIST_PROMPTS: 'prompts/list'
};

class MCPServer {
  private serverInfo = {
    name: 'canvas-mcp-server',
    version: '1.0.0',
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false }
    }
  };
  
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case MCP_METHODS.INITIALIZE:
          return this.handleInitialize(request);
        case MCP_METHODS.LIST_TOOLS:
          return this.handleListTools(request);
        case MCP_METHODS.CALL_TOOL:
          return this.handleCallTool(request);
        case MCP_METHODS.LIST_RESOURCES:
          return this.handleListResources(request);
        case MCP_METHODS.LIST_PROMPTS:
          return this.handleListPrompts(request);
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: this.serverInfo.capabilities,
        serverInfo: {
          name: this.serverInfo.name,
          version: this.serverInfo.version
        }
      }
    };
  }

  private handleListTools(request: MCPRequest): MCPResponse {
    // Return tools with proper JSON Schema format
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: allTools
      }
    };
  }

  private async handleCallTool(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as { name: string; arguments: Record<string, unknown> } | undefined;
    const name = params?.name;
    const args = params?.arguments;

    if (!name || !args) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Invalid params: name and arguments required'
        }
      };
    }

    try {
      const baseUrl = args.baseUrl as string;
      const apiKey = args.apiKey as string;

      if (!baseUrl || !apiKey) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: 'Missing required Canvas credentials: baseUrl and apiKey'
          }
        };
      }

      const canvas = new CanvasAPI({ baseUrl, apiKey });
      const result = await handleCanvasTool(canvas, name, args);

      if (result.error) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: result.error }
        };
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2)
            }
          ]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private handleListResources(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { resources: [] }
    };
  }

  private handleListPrompts(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { prompts: [] }
    };
  }
}

// HTTP POST endpoint for MCP protocol
export async function POST(request: NextRequest) {
  try {
    // Check authentication (required)
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '') ||
                     request.headers.get('x-auth-token');
    const requiredToken = process.env.API_AUTH_TOKEN;

    if (!requiredToken) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Server configuration error: API_AUTH_TOKEN not set'
        }
      }, { status: 500 });
    }

    if (!authToken || authToken !== requiredToken) {
      return NextResponse.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Unauthorized: Invalid or missing authentication token'
        }
      }, { status: 401 });
    }

    const mcpRequest: MCPRequest = await request.json();
    
    // Construct base URL for internal API calls
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    
    const server = new MCPServer(baseUrl);
    const response = await server.handleRequest(mcpRequest);

    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
      },
    });
  } catch {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error'
      }
    }, { status: 400 });
  }
}

// OPTIONS endpoint for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    },
  });
}

// GET endpoint for server info (standard MCP discovery)
export async function GET() {
  return NextResponse.json({
    name: 'Canvas MCP Server',
    version: '1.0.0',
    description: 'MCP Server for Canvas LMS API',
    protocolVersion: '2024-11-05',
    capabilities: ['tools'],
    tools: allTools.length,
    endpoints: {
      mcp: '/api/mcp',
      tools: '/api/tools'
    }
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
