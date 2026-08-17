import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: Request,
  // 🚀 FIX: Next.js 15+ requires params to be awaited as a Promise
  { params }: { params: Promise<{ filename: string }> }
) {
  // 🚀 Await the params before extracting the filename
  const resolvedParams = await params;
  const filename = resolvedParams.filename;
  
  // Security: Prevent directory traversal attacks
  if (!filename || filename.includes('/') || filename.includes('..')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  try {
    // Look in the dedicated uploads folder
    const filePath = path.join(process.cwd(), 'uploads', filename);
    const fileBuffer = await fs.readFile(filePath);

    // Determine the correct Content-Type for the browser
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'image/webp';
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    if (ext === 'png') contentType = 'image/png';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        // Cache the image in the user's browser for 1 year to save bandwidth
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new NextResponse('File not found', { status: 404 });
  }
}