import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

async function main() {
  const vercelUrl = process.env.VERCEL_DB_URL;
  const hetznerUrl = process.env.HETZNER_DB_URL;

  if (!vercelUrl || !hetznerUrl) return console.error("❌ Missing DB URLs in .env");

  // 1. Connect to Vercel
  const vercelPool = new Pool({ connectionString: vercelUrl });
  const vercelPrisma = new PrismaClient({ adapter: new PrismaPg(vercelPool) });

  // 2. Connect to Hetzner
  const hetznerPool = new Pool({ connectionString: hetznerUrl });
  const hetznerPrisma = new PrismaClient({ adapter: new PrismaPg(hetznerPool) });

  try {
    console.log("📥 Fetching markers from Vercel...");
    const markers = await vercelPrisma.marker.findMany();
    
    console.log(`📦 Found ${markers.length} markers. Pushing to Hetzner...`);
    await hetznerPrisma.marker.deleteMany(); // Clear any test data
    await hetznerPrisma.marker.createMany({ data: markers });

    console.log("✅ Database successfully migrated to Hetzner!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await vercelPrisma.$disconnect();
    await hetznerPrisma.$disconnect();
  }
}
main();