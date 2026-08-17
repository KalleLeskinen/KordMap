'use server';

import prisma from '@/lib/prisma';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { headers } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';

EventEmitter.defaultMaxListeners = 50;

const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD;

// -------------------------------------------------------------------------
// 🛡️ SECURITY: LOCAL REDIS RATE LIMITING (For Coolify/Hetzner)
// -------------------------------------------------------------------------
const redisClient = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

const rateLimiter = redisClient ? new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ratelimit',
  points: 10, // 10 requests allowed
  duration: 3600, // Per 1 hour
}) : null;

async function checkRateLimit(password?: string): Promise<boolean> {
  if (EDITOR_PASSWORD && password === EDITOR_PASSWORD) return true; 
  if (!rateLimiter) return true; 

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') ?? '127.0.0.1';
  
  try {
    await rateLimiter.consume(`guest_${ip}`);
    return true;
  } catch (rejRes) {
    console.warn(`🔴 Rate limit hit for IP: ${ip}`);
    return false;
  }
}

// -------------------------------------------------------------------------
// 🛡️ SECURITY: SCHEMA VALIDATION
// -------------------------------------------------------------------------
const MarkerSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  lat: z.number(),
  lng: z.number(),
  floorId: z.string().max(50),
  type: z.string().max(50),
  // 🚀 FIX: Removed .url() so it accepts local paths like "/uploads/..."
  // Also increased max length to 2000 to safely accommodate long external URLs
  imageUrl: z.string().max(2000).optional().nullable(),
  submitter: z.string().max(50).optional().nullable(),
  mapName: z.string().max(50),
});

const tarpit = async (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

// -------------------------------------------------------------------------
// 🚀 LOCAL FILE SYSTEM IMAGE HOSTING
// -------------------------------------------------------------------------
export async function uploadImage(base64Image: string): Promise<string | null> {
  await tarpit();

  if (!rateLimiter) return null;
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') ?? '127.0.0.1';
  
  try {
    await rateLimiter.consume(`upload_${ip}`);
  } catch (e) {
    return null; // Rate limited
  }

  try {
    const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const mimeType = matches[1];
    const allowedTypes = ['image/webp', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(mimeType)) return null;

    const buffer = Buffer.from(matches[2], 'base64');
    const extension = mimeType.split('/')[1];
    const filename = `marker-${Date.now()}-${Math.round(Math.random()*1000)}.${extension}`;

    // Save directly to the server's hard drive volume
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), buffer);
    
    return `/uploads/${filename}`;
  } catch (error) {
    console.error("Local upload failed:", error);
    return null;
  }
}

async function ensureHostedImage(url: string | null | undefined): Promise<string | null | undefined> {
  if (!url) return url;
  
  // Download external images and save them to the local server volume
  if (url.startsWith('http') && !url.includes(process.env.NEXT_PUBLIC_SITE_URL || 'localhost')) {
    try {
      const res = await fetch(url);
      if (!res.ok) return url; 
      
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = res.headers.get('content-type') || 'image/webp';
      const extension = contentType.split('/')[1] || 'webp';
      const filename = `marker-${Date.now()}-${Math.round(Math.random()*1000)}.${extension}`;
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      
      return `/uploads/${filename}`; 
    } catch(e) {
      return url;
    }
  }
  return url;
}

// -------------------------------------------------------------------------
// DATABASE ACTIONS
// -------------------------------------------------------------------------

export async function verifyEditorPassword(password: string) {
  await tarpit(1000); 
  return Boolean(EDITOR_PASSWORD && password === EDITOR_PASSWORD);
}

export async function getAllApprovedMarkerStats() {
  return prisma.marker.findMany({ where: { approved: true }, select: { mapName: true, type: true } });
}

export async function getMarkers(mapName: string, localPendingIds: string[] = []) {
  return prisma.marker.findMany({ 
    where: { mapName, OR: [ { approved: true }, { id: { in: localPendingIds } } ] }, 
    orderBy: { createdAt: 'desc' } 
  });
}

export async function getAllPendingMarkerStats(password: string) {
  if (!EDITOR_PASSWORD || password !== EDITOR_PASSWORD) return [];
  return prisma.marker.findMany({ where: { approved: false }, select: { mapName: true, id: true } });
}

export async function getPendingMarkers(password: string, mapName: string) {
  if (!EDITOR_PASSWORD || password !== EDITOR_PASSWORD) return { error: 'Unauthorized' };
  const markers = await prisma.marker.findMany({ where: { approved: false, mapName }, orderBy: { createdAt: 'asc' } });
  return { markers };
}

export async function createMarker(rawData: any, password?: string) {
  await tarpit();
  if (!(await checkRateLimit(password))) return { success: false, error: "Rate limit exceeded. Try again later." };

  try {
    const data = MarkerSchema.parse(rawData);
    const isEditor = Boolean(EDITOR_PASSWORD && password === EDITOR_PASSWORD);
    
    if (isEditor && data.imageUrl) {
      data.imageUrl = await ensureHostedImage(data.imageUrl);
    }

    const newMarker = await prisma.marker.create({
      data: { ...data, approved: isEditor }
    });
    return { success: true, marker: newMarker, autoApproved: isEditor };
  } catch (error) {
    return { success: false, error: "Invalid data or failed to save" };
  }
}

export async function updateMarker(id: string, rawData: any, password?: string) {
  await tarpit();
  if (!(await checkRateLimit(password))) return { success: false, error: "Rate limit exceeded. Try again later." };

  try {
    const data = MarkerSchema.parse(rawData);
    const isEditor = Boolean(EDITOR_PASSWORD && password === EDITOR_PASSWORD);
    
    if (isEditor) {
      if (data.imageUrl) data.imageUrl = await ensureHostedImage(data.imageUrl);
      
      const updatedMarker = await prisma.marker.update({
        where: { id }, 
        data: {
          ...data,
          lastEditor: data.submitter || "Admin"
        }
      });
      return { success: true, marker: updatedMarker, autoApproved: true };
    } else {
      const pendingEdit = await prisma.marker.create({
        data: { ...data, approved: false, originalId: id }
      });
      return { success: true, marker: pendingEdit, autoApproved: false };
    }
  } catch (error) {
    return { success: false, error: "Invalid data or failed to update" };
  }
}

export async function suggestDeleteMarker(id: string, reason: string) {
  await tarpit();
  if (!(await checkRateLimit())) return { success: false, error: "Rate limit exceeded. Try again later." };

  try {
    const original = await prisma.marker.findUnique({ where: { id } });
    if (!original) return { success: false, error: "Marker not found" };

    const pendingDelete = await prisma.marker.create({
      data: {
        title: original.title, description: original.description, lat: original.lat, lng: original.lng,
        floorId: original.floorId, type: original.type, imageUrl: original.imageUrl, 
        submitter: "Guest (Deletion Request)", mapName: original.mapName,
        approved: false, originalId: id, isDeletion: true,
        deletionReason: reason 
      }
    });
    return { success: true, marker: pendingDelete };
  } catch (error) { return { success: false, error: "Failed to suggest deletion" }; }
}

export async function approveMarker(id: string, password: string) {
  if (!EDITOR_PASSWORD || password !== EDITOR_PASSWORD) return { success: false };
  const pending = await prisma.marker.findUnique({ where: { id } });
  
  if (pending?.isDeletion) {
    if (pending.originalId) await prisma.marker.delete({ where: { id: pending.originalId } }).catch(() => {});
    await prisma.marker.delete({ where: { id } });
    return { success: true };
  }

  let finalImageUrl = pending?.imageUrl;
  if (finalImageUrl) finalImageUrl = await ensureHostedImage(finalImageUrl);

  if (pending?.originalId) {
    await prisma.marker.update({
      where: { id: pending.originalId },
      data: {
        title: pending.title, description: pending.description, lat: pending.lat, lng: pending.lng,
        floorId: pending.floorId, type: pending.type, imageUrl: finalImageUrl,
        lastEditor: pending.submitter || "Guest",
      }
    });
    await prisma.marker.delete({ where: { id } }); 
    return { success: true };
  }
  
  await prisma.marker.update({ 
    where: { id }, data: { approved: true, originalId: null, imageUrl: finalImageUrl } 
  });
  return { success: true };
}

export async function deleteMarker(id: string, password: string) {
  if (!EDITOR_PASSWORD || password !== EDITOR_PASSWORD) return { success: false };
  await prisma.marker.delete({ where: { id } });
  return { success: true };
}

export async function importLegacyMarkers(markers: any[], password: string) {
  if (!EDITOR_PASSWORD || password !== EDITOR_PASSWORD) return { success: false, error: 'Unauthorized' };
  try {
    await prisma.marker.createMany({
      data: markers.map(m => ({
        title: m.title, description: m.description, lat: m.lat, lng: m.lng,
        floorId: m.floorId, type: m.type, imageUrl: m.imageUrl, submitter: m.submitter,
        mapName: m.mapName, approved: true 
      }))
    });
    return { success: true };
  } catch (error) { return { success: false, error: "Import failed" }; }
}