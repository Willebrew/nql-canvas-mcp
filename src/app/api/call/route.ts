import { NextRequest, NextResponse } from 'next/server';
import { CanvasAPI } from '@/lib/canvas';
import { handleCanvasTool } from '@/lib/handler';

interface CallPayload {
  tool: string;
  parameters: Record<string, unknown>;
  // Canvas credentials
  baseUrl?: string;
  apiKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
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

    const body: CallPayload = await request.json();
    const { tool, parameters } = body;

    if (!tool) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: tool' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Check both top-level and inside parameters for credentials
    const baseUrl = body.baseUrl || parameters.baseUrl as string;
    const apiKey = body.apiKey || parameters.apiKey as string;

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing required Canvas credentials: baseUrl and apiKey' },
        { status: 400 }
      );
    }

    const canvas = new CanvasAPI({ baseUrl, apiKey });
    const result = await handleCanvasTool(canvas, tool, parameters);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: result.data,
      metadata: {
        tool,
        executionTime
      }
    });

  } catch (error) {
    console.error('Tool call error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    },
  });
}
