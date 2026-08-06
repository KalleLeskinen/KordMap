import { promises as fs } from 'fs';
import path from 'path';
import { get, list, put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const revalidate = 30;

const getMapFilePath = (map: string, kind: string) => {
    if (kind === 'mapdata') return path.join(process.cwd(), 'public', 'maps', map, 'mapdata.json');
    if (kind === 'images') return path.join(process.cwd(), 'public', 'maps', map, 'images.json');
    return path.join(process.cwd(), 'public', 'maps', map, `${map}-points.json`);
};

const isAuthorized = (pass: string | null) => pass === process.env.EDITOR_PASSWORD;

async function readPublicMapData(map: string, kind: string) {
    const filePath = getMapFilePath(map, kind);

    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
            if (kind === 'images') return { images: {} };
            if (kind === 'points') return { points: [] };
            if (kind === 'mapdata') return { floors: ['0', '1'], icons: [], mapScale: [1, 7] };
        }
        throw error;
    }
}

async function readPersistedMapData(map: string, kind: string) {
    const prefix = `maps/${map}/${kind}.json`;
    const { blobs } = await list({ prefix });
    const match = blobs.find((blob) => blob.pathname === prefix);
    if (!match) return null;

    const blob = await get(match.pathname, { access: 'private', useCache: false });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return null;

    const text = await new Response(blob.stream).text();
    return JSON.parse(text);
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
            access: 'private',
            contentType: 'application/json',
            allowOverwrite: true,
        });

        return NextResponse.json({ ok: true, url: blob.url });
    } catch (error) {
        console.error('Failed to save map data', error);
        return NextResponse.json({ error: 'Failed to save map data' }, { status: 500 });
    }
}
