import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const pass = searchParams.get('pass');

    // Reject the upload if the password doesn't match the environment variable
    if (pass !== process.env.EDITOR_PASSWORD) {
        return NextResponse.json({ error: 'Unauthorized upload attempt' }, { status: 401 });
    }

    if (!filename) {
        return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    try {
        const blob = await put(filename, request.body as ReadableStream, {
            access: 'public',
        });
        return NextResponse.json(blob);
    } catch (error) {
        console.error("Upload failed", error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}