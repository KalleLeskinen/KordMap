import { promises as fs } from 'fs';
import path from 'path';
import { list, put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const getMapFilePath = (map: string, kind: string) => {
    const fileName = kind === 'mapdata' ? 'mapdata.json' : `${map}-points.json`;
    return path.join(process.cwd(), 'public', 'maps', map, fileName);
};

const isAuthorized = (pass: string | null) => pass === process.env.EDITOR_PASSWORD;

async function readPublicMapData(map: string, kind: string) {
    const filePath = getMapFilePath(map, kind);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function readPersistedMapData(map: string, kind: string) {
    const prefix = `maps/${map}/${kind}.json`;
    const { blobs } = await list({ prefix });
    const match = blobs.find((blob) => blob.pathname === prefix);
    if (!match?.url) return null;

    const response = await fetch(match.url);
    if (!response.ok) return null;
    return response.json();
}

export async function GET(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const map = searchParams.get('map');
    const kind = searchParams.get('kind');

    if (!map || !kind) {
        return NextResponse.json({ error: 'Map and kind are required' }, { status: 400 });
    }

    try {
        const persisted = await readPersistedMapData(map, kind);
        if (persisted !== null) {
            return NextResponse.json(persisted);
        }

        const publicData = await readPublicMapData(map, kind);
        return NextResponse.json(publicData);
    } catch (error) {
        console.error('Failed to load map data', error);
        return NextResponse.json({ error: 'Failed to load map data' }, { status: 500 });
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const map = searchParams.get('map');
    const kind = searchParams.get('kind');
    const pass = searchParams.get('pass');

    if (!map || !kind) {
        return NextResponse.json({ error: 'Map and kind are required' }, { status: 400 });
    }

    if (!isAuthorized(pass)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await request.json();
        const blobPath = `maps/${map}/${kind}.json`;
        const blob = await put(blobPath, JSON.stringify(payload, null, 2), {
            access: 'public',
            contentType: 'application/json',
        });

        return NextResponse.json({ ok: true, url: blob.url });
    } catch (error) {
        console.error('Failed to save map data', error);
        return NextResponse.json({ error: 'Failed to save map data' }, { status: 500 });
    }
}
