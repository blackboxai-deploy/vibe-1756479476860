import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const deviceId = formData.get('deviceId') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', deviceId);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || '';
    const filename = `${timestamp}_${file.name}`;
    const filepath = join(uploadsDir, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const fileInfo = {
      filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      deviceId,
      uploadedAt: new Date(),
      path: `/api/download/${deviceId}/${filename}`
    };

    return NextResponse.json({
      message: 'File uploaded successfully',
      file: fileInfo
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ 
      error: 'File upload failed' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId');
    
    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID is required' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'uploads', deviceId);
    
    if (!existsSync(uploadsDir)) {
      return NextResponse.json({ files: [] });
    }

    const fs = require('fs');
    const files = fs.readdirSync(uploadsDir).map((filename: string) => {
      const stats = fs.statSync(join(uploadsDir, filename));
      return {
        filename,
        size: stats.size,
        uploadedAt: stats.birthtime,
        path: `/api/download/${deviceId}/${filename}`
      };
    });

    return NextResponse.json({ files });

  } catch (error) {
    console.error('Error getting files:', error);
    return NextResponse.json({ 
      error: 'Failed to get files' 
    }, { status: 500 });
  }
}