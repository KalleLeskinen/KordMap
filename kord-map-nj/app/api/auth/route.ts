import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!process.env.EDITOR_PASSWORD) {
            return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
        }

        if (password === process.env.EDITOR_PASSWORD) {
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Bad request' }, { status: 400 });
    }
}