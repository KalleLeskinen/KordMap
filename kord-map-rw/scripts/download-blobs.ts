import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.HETZNER_DB_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("🔍 Scanning Hetzner DB for Vercel Blobs...");
  const markers = await prisma.marker.findMany({
    where: { imageUrl: { contains: 'vercel-storage.com' } }
  });

  if (markers.length === 0) return console.log("✅ No Vercel Blobs found!");

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  console.log(`📦 Downloading ${markers.length} images...`);

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    try {
      console.log(`[${i+1}/${markers.length}] Downloading ${m.title}...`);
      const res = await fetch(m.imageUrl!);
      const buffer = Buffer.from(await res.arrayBuffer());
      
      const ext = m.imageUrl!.split('.').pop() || 'webp';
      const filename = `migrated-${m.id}.${ext}`;
      
      // Save locally
      await fs.writeFile(path.join(uploadDir, filename), buffer);

      // Update DB to use local path
      await prisma.marker.update({
        where: { id: m.id },
        data: { imageUrl: `/uploads/${filename}` }
      });
      
    } catch (e) {
      console.error(`❌ Failed on ${m.title}`);
    }
  }
  console.log("🎉 Image Migration Complete!");
}
main();