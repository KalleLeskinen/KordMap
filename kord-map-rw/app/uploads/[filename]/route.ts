import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: { filename: string } }
) {
  const filename = params.filename;
  
  // Security: Prevent directory traversal attacks
  if (!filename || filename.includes('/') || filename.includes('..')) {
    return new NextResponse('Invalid filename', { status: 400 });
  }

  try {
    // Look in the new dedicated uploads folder (outside of public)
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
        // Cache the image in the user's browser for 1 month to save bandwidth
        'Cache-Control': 'public, max-age=2628000, immutable',
      },
    });
  } catch (error) {
    return new NextResponse('File not found', { status: 404 });
  }
}