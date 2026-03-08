import { NextRequest, NextResponse } from 'next/server';
import { allTools } from '@/lib/tools';

export async function GET(request: NextRequest) {
  try {
    // Check authentication (required)
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '') ||
                     request.headers.get('x-auth-token');
    const requiredToken = process.env.API_AUTH_TOKEN;

    if (!requiredToken) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: API_AUTH_TOKEN not set' },
        { status: 500 }
      );
    }

    if (!authToken || authToken !== requiredToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    // Return tools in a format compatible with the workspace
    const tools = allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: 'canvas',
      parameters: Object.fromEntries(
        Object.entries(tool.inputSchema.properties).map(([key, value]) => [
          key,
          {
            ...value,
            required: tool.inputSchema.required?.includes(key) || false
          }
        ])
      )
    }));

    return NextResponse.json({
      services: [
        {
          name: 'Canvas LMS',
          version: '1.0.0',
          description: 'Canvas LMS API',
          tools
        }
      ],
      totalTools: tools.length,
      version: '1.0.0'
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Tools API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list tools' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    },
  });
}
