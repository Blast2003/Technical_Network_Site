// scripts/seedForums.js
// Usage: NODE_ENV=development node scripts/seedForums.js
//
// Safer seeder that:
//  - avoids sequelize.sync({ alter: true }) when tables already exist (that caused the MySQL UNIQUE change error)
//  - explicitly adds the is_global_admin column only if missing
//  - creates missing tables via sequelize.sync() (no alter) if necessary
//  - creates/updates admin user, sets is_global_admin = true
//  - creates forums, template threads, and ForumMember rows for admin

import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";
import { sequelize } from "./src/config/database.js";
import { User } from "./src/models/userModel.js";
import {
  Forum,
  ForumMember,
  Thread
} from "./src/models/forumModel.js";

async function run() {
  console.log("=> Seed script started");

  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run seed script in production. Set NODE_ENV != 'production'.");
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log("✅ DB authenticated");
  } catch (err) {
    console.error("DB authentication failed:", err);
    process.exit(1);
  }

  const qi = sequelize.getQueryInterface();

  // Helper: check if table exists (describeTable will throw if not)
  async function tableExists(tableName) {
    try {
      await qi.describeTable(tableName);
      return true;
    } catch (e) {
      return false;
    }
  }

  try {
    // If users table does not exist at all, create missing tables (safe sync without alter)
    const usersPresent = await tableExists("users");
    const forumsPresent = await tableExists("forums");

    if (!usersPresent || !forumsPresent) {
      console.log("⏳ Some tables missing. Running sequelize.sync() to create missing tables...");
      // sync() without alter will create missing tables only
      await sequelize.sync();
      console.log("✅ sequelize.sync finished (created missing tables)");
    } else {
      // Users table exists. Ensure `is_global_admin` column exists; if not, add it explicitly.
      const userCols = await qi.describeTable("users");
      if (!Object.prototype.hasOwnProperty.call(userCols, "is_global_admin")) {
        console.log("Adding column `is_global_admin` to users table...");
        await qi.addColumn(
          "users",
          "is_global_admin",
          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
        );
        console.log("✅ added is_global_admin");
      } else {
        console.log("users.is_global_admin already exists — skipping addColumn");
      }

      // ensure other tables exist (forums, forummembers, threads). If any missing, create missing tables
      const otherNeeded = ["forums", "forummembers", "threads", "questions", "answers", "foruminvites", "forumaudits", "answer_views"];
      const missing = [];
      for (const t of otherNeeded) {
        if (!(await tableExists(t))) missing.push(t);
      }
      if (missing.length > 0) {
        console.log("Missing tables detected:", missing.join(", "));
        console.log("Running sequelize.sync() to create the missing tables...");
        await sequelize.sync();
        console.log("✅ Created missing tables");
      } else {
        console.log("All expected forum-related tables exist.");
      }
    }
  } catch (err) {
    console.error("Schema check / migration step failed:", err);
    console.error("You can inspect current indexes for `users` with: SHOW INDEX FROM `users`;");
    process.exit(1);
  }

  // Now run seeding (in a transaction)
  const t = await sequelize.transaction();
  try {
    // 1) Ensure admin user
    const adminEmail = "admin@gmail.com";
    const adminPlain = "123456";
    const hashed = await bcrypt.hash(adminPlain, 10);

    let admin = await User.findOne({ where: { email: adminEmail }, transaction: t });
    if (!admin) {
      admin = await User.create({
        name: "Platform Admin",
        username: "admin",
        email: adminEmail,
        password: hashed,
        profilePic: "",
        bio: "",
        is_global_admin: true, // set the flag at creation
      }, { transaction: t });
      console.log("Created admin user:", adminEmail);
    } else {
      // Ensure the flag is set. We DO NOT overwrite existing password by default.
      if (!admin.is_global_admin) {
        await admin.update({ is_global_admin: true }, { transaction: t });
        console.log("Updated existing user -> set is_global_admin = true:", adminEmail);
      } else {
        console.log("Found existing admin user (already global admin):", adminEmail);
      }
    }

    // 2) Create forums (if missing)
    const forumTemplates = [
      { field_key: "core-infra", title: "Core Infrastructure & Operations", desc: "Infra, sysops, cloud." },
      { field_key: "software-dev", title: "Software & Application Development", desc: "Web, mobile, backend." },
      { field_key: "data-eng", title: "Data Engineering & Management", desc: "Data pipelines, warehouses." },
      { field_key: "ai-analytics", title: "Artificial Intelligence & Analytics", desc: "ML, data science." },
      { field_key: "security-ops", title: "Security & Operations Management", desc: "SecOps, incident response." },
      { field_key: "emerging-tech", title: "Emerging Technologies", desc: "Blockchain, edge, quantum." },
    ];

    const createdForums = [];
    for (const f of forumTemplates) {
      let forum = await Forum.findOne({ where: { field_key: f.field_key }, transaction: t });
      if (!forum) {
        forum = await Forum.create({
          field_key: f.field_key,
          title: f.title,
          description: f.desc,
          member_count: 0,
          created_by: admin.id,
          visibility: "public",
          template_threads_created: false,
          is_active: true,
        }, { transaction: t });
        console.log("Created forum:", f.title);
      } else {
        // backfill created_by if missing
        if (!forum.created_by) {
          await forum.update({ created_by: admin.id }, { transaction: t }).catch(()=>{});
        }
        console.log("Found forum:", f.title);
      }
      createdForums.push(forum);
    }

    // 3) Add admin as global_admin for each forum and increment member_count only once
    for (const forum of createdForums) {
      const existing = await ForumMember.findOne({
        where: { forum_id: forum.id, user_id: admin.id },
        transaction: t,
      });
      if (!existing) {
        await ForumMember.create({ forum_id: forum.id, user_id: admin.id, role: "global_admin" }, { transaction: t });
        // increment member_count by 1
        try { await forum.increment("member_count", { by: 1, transaction: t }); } catch (incErr) { console.warn("Increment failed:", incErr); }
        console.log(`Assigned admin as global_admin for forum "${forum.title}" (new membership created)`);
      } else {
        if (existing.role !== "global_admin") {
          await existing.update({ role: "global_admin" }, { transaction: t });
          console.log(`Updated admin role -> global_admin for forum "${forum.title}"`);
        } else {
          console.log(`Admin already forum member/global_admin for "${forum.title}"`);
        }
      }
    }
a
    // 4) Create template threads for each forum (if not exist)
    const threadTemplates = ["Announcements", "Career Path Questions", "Troubleshooting / Debug Help"];
    const createdThreads = [];
    for (const forum of createdForums) {
      for (const tname of threadTemplates) {
        let thr = await Thread.findOne({ where: { forum_id: forum.id, title: tname }, transaction: t });
        if (!thr) {
          thr = await Thread.create({
            forum_id: forum.id,
            creator_id: admin.id,
            title: tname,
            content: `Welcome to ${forum.title} - ${tname}`,
            image_url: null,
          }, { transaction: t });
          console.log(`Created thread "${tname}" in forum "${forum.title}"`);
        } else {
          console.log(`Thread "${tname}" already exists in forum "${forum.title}"`);
        }
        createdThreads.push(thr);
      }
    }

    await t.commit();

    console.log("✅ Seeding finished successfully.");
    console.log(`Admin: ${adminEmail} (global admin flag set)`);
    console.log(`Forums created/found: ${createdForums.length}`);
    console.log(`Threads (templates per forum): ${createdThreads.length}`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed, rolling back:", err);
    try { await t.rollback(); } catch (rb) { console.error("Rollback error:", rb); }
    process.exit(1);
  }
}

run();
