import { ALL_USERS, COMPANY_ACME, COMPANY_GLOBEX } from "@cs/test-fixtures";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";
import { users, conversations, memberships, messages, messageSeqCounters } from "./schema/index.js";
import { sql } from "drizzle-orm";
import { env } from "../env.js";

const connUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? env.DATABASE_URL;
const isRemote = connUrl.includes("sslmode=require") || connUrl.includes("neon.tech") || connUrl.includes("render.com") || connUrl.includes("supabase.co");

const pool = postgres(connUrl, {
  max: 1,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool, { schema });

async function seed() {
  console.log(`Seeding database via ${connUrl.replace(/:[^:@]+@/, ":***@")}...`);

  // Explicit 4 Users (Company 1: Admin, Member A, Member C; Company 2: User)
  const SEED_USERS = [
    // Company 1: Admin
    {
      id: "00000001-0000-4000-a000-000000000002",
      company_id: COMPANY_ACME.id,
      name: "Rohan Deshmukh (Admin)",
      email: "rohan@company.com",
      role: "admin",
      password: "AdminPassword123!",
    },
    // Company 1: Member A
    {
      id: "00000001-0000-4000-a000-000000000003",
      company_id: COMPANY_ACME.id,
      name: "Vedant Kulkarni (Member A)",
      email: "vedant@company.com",
      role: "member",
      password: "MemberPassword123!",
    },
    // Company 1: Member C
    {
      id: "00000001-0000-4000-a000-000000000004",
      company_id: COMPANY_ACME.id,
      name: "Sneha Patil (Member C)",
      email: "sneha@company.com",
      role: "member",
      password: "MemberPassword123!",
    },
    // Company 2: User
    {
      id: "00000002-0000-4000-a000-000000000001",
      company_id: COMPANY_GLOBEX.id,
      name: "Alex Vance (Company 2)",
      email: "alex@cyberdyne.io",
      role: "member",
      password: "MemberPassword123!",
    },
  ];

  // Seed all users from test-fixtures + the 4 specified accounts
  const allUserRecords = [...ALL_USERS];
  for (const su of SEED_USERS) {
    const existing = allUserRecords.find((u) => u.id === su.id);
    if (existing) {
      existing.name = su.name;
      existing.email = su.email;
      existing.role = su.role as any;
    } else {
      allUserRecords.push({
        id: su.id,
        tag: su.role === "admin" ? "acme-admin" : "acme-member",
        company_id: su.company_id,
        name: su.name,
        email: su.email,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(su.name)}`,
        role: su.role as any,
        permissions: su.role === "admin"
          ? [
            "communication.access",
            "communication.channel.create",
            "communication.private_channel.create",
            "communication.channel.manage",
            "communication.member.manage",
            "communication.message.send",
            "communication.message.moderate",
            "communication.announcement.publish",
            "communication.audit.read",
          ]
          : ["communication.access", "communication.channel.create", "communication.private_channel.create", "communication.message.send"],
        department_ids: [],
        project_ids: [],
      });
    }
  }

  for (const u of allUserRecords) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.company_id', ${u.company_id}, true)`);
      await tx
        .insert(users)
        .values({
          id: u.id,
          company_id: u.company_id,
          name: u.name,
          avatar_url: u.avatar_url,
          department_ids: [],
          project_ids: [],
          is_active: true,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            name: u.name,
            avatar_url: u.avatar_url,
          },
        });
    });
  }
  console.log(`✓ Seeded ${allUserRecords.length} users`);

  // Seed default channels for Acme and Globex
  const companies = [COMPANY_ACME, COMPANY_GLOBEX];
  for (const comp of companies) {
    const compUsers = allUserRecords.filter((u) => u.company_id === comp.id);
    const owner = compUsers.find((u) => u.role === "admin" || u.role === "owner") ?? compUsers[0];

    const channelDefs = [
      { name: "general", kind: "public" as const, topic: "Company-wide announcements and watercooler" },
      { name: "engineering", kind: "public" as const, topic: "Tech discussions, architecture, and deployments" },
      { name: "announcements", kind: "announcement" as const, topic: "Official company updates", is_announcement_only: true },
    ];

    for (const def of channelDefs) {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.company_id', ${comp.id}, true)`);

        const [existing] = await tx
          .select()
          .from(conversations)
          .where(sql`company_id = ${comp.id} AND name = ${def.name}`)
          .limit(1);

        let conv = existing;
        if (!conv) {
          const [created] = await tx
            .insert(conversations)
            .values({
              company_id: comp.id,
              type: "channel",
              kind: def.kind,
              name: def.name,
              topic: def.topic,
              is_announcement_only: def.is_announcement_only ?? false,
              member_count: compUsers.length,
              created_by: owner.id,
            })
            .returning();
          conv = created;

          if (conv) {
            await tx.insert(messageSeqCounters).values({
              conversation_id: conv.id,
              last_seq: 0,
            }).onConflictDoNothing();

            const [seqRes] = await tx
              .update(messageSeqCounters)
              .set({ last_seq: sql`last_seq + 1` })
              .where(sql`conversation_id = ${conv.id}`)
              .returning({ last_seq: messageSeqCounters.last_seq });

            await tx.insert(messages).values({
              conversation_id: conv.id,
              company_id: comp.id,
              author_id: owner.id,
              client_msg_id: crypto.randomUUID(),
              seq: seqRes?.last_seq ?? 1,
              body: `Welcome to #${def.name} in ${comp.name}! This channel is ready for collaboration.`,
            });
          }
        }

        if (conv) {
          for (const u of compUsers) {
            await tx
              .insert(memberships)
              .values({
                conversation_id: conv.id,
                user_id: u.id,
                company_id: comp.id,
                role: u.role === "admin" ? "admin" : "member",
              })
              .onConflictDoNothing();
          }

          await tx
            .update(conversations)
            .set({
              member_count: sql`(SELECT count(*)::int FROM memberships WHERE memberships.conversation_id = ${conv.id})`,
            })
            .where(sql`id = ${conv.id}`);
        }
      });
    }
  }

  console.log("✓ Seeded default channels, memberships, and sequence counters");

  console.log("\n=================================================================");
  console.log("DEMO ACCOUNTS (Seeded synthetic credentials for production demo)");
  console.log("=================================================================");
  console.log("COMPANY 1 (WorkOS Enterprise Labs):");
  console.log("  1. Admin:");
  console.log("     Name:     Rohan Deshmukh");
  console.log("     Email:    rohan@company.com (or admin@acme.example)");
  console.log("     Password: AdminPassword123!");
  console.log("     Role:     Admin (full management & audit permissions)");
  console.log("-----------------------------------------------------------------");
  console.log("  2. Member A:");
  console.log("     Name:     Vedant Kulkarni");
  console.log("     Email:    vedant@company.com (or member@acme.example)");
  console.log("     Password: MemberPassword123!");
  console.log("     Role:     Member");
  console.log("-----------------------------------------------------------------");
  console.log("  3. Member C:");
  console.log("     Name:     Sneha Patil");
  console.log("     Email:    sneha@company.com");
  console.log("     Password: MemberPassword123!");
  console.log("     Role:     Member");
  console.log("=================================================================");
  console.log("COMPANY 2 (Cyberdyne Systems Corp - Tenant Isolated):");
  console.log("  4. Member (External Tenant):");
  console.log("     Name:     Alex Vance");
  console.log("     Email:    alex@cyberdyne.io");
  console.log("     Password: MemberPassword123!");
  console.log("     Role:     Member (isolated to Company 2 channels/DMs)");
  console.log("=================================================================\n");

  await pool.end();
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
