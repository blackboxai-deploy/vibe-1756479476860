import { NextRequest, NextResponse } from 'next/server';

// Mock database for devices (in production, use a real database)
let devices: any[] = [];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('id');

    if (deviceId) {
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }
      return NextResponse.json(device);
    }

    return NextResponse.json(devices);
  } catch (error) {
    console.error('Error getting devices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, model, androidVersion, screenResolution } = body;

    if (!name || !model || !androidVersion || !screenResolution) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, model, androidVersion, screenResolution' 
      }, { status: 400 });
    }

    const device = {
      id: `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      model,
      androidVersion,
      screenResolution,
      isConnected: false,
      lastSeen: new Date(),
      createdAt: new Date(),
      sessionId: null,
      controllers: []
    };

    devices.push(device);

    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    console.error('Error creating device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const deviceIndex = devices.findIndex(d => d.id === id);
    if (deviceIndex === -1) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    devices[deviceIndex] = {
      ...devices[deviceIndex],
      ...updateData,
      lastSeen: new Date()
    };

    return NextResponse.json(devices[deviceIndex]);
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const deviceIndex = devices.findIndex(d => d.id === deviceId);
    if (deviceIndex === -1) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const deletedDevice = devices.splice(deviceIndex, 1)[0];

    return NextResponse.json({ 
      message: 'Device deleted successfully', 
      device: deletedDevice 
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}