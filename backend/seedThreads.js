// scripts/seedThreadQuestions.js
// Usage: NODE_ENV=development node scripts/seedThreadQuestions.js
//
// Creates 2 questions per thread (Announcements, Career Path Questions, Troubleshooting / Debug Help)
// and 2 answers per question (one top-level answer + one reply to that answer).
// It tries to use forum members as authors when available.

import { sequelize } from "./src/config/database.js";
import { Forum, ForumMember, Thread, Question, Answer } from "./src/models/forumModel.js";
import { User } from "./src/models/userModel.js";
import { Op } from "sequelize";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run seed script in production. Set NODE_ENV != 'production'.");
  process.exit(1);
}

const THREAD_TITLES = [
  "Announcements",
  "Career Path Questions",
  "Troubleshooting / Debug Help",
];

// Basic templates per forum field_key and per thread type
const TEMPLATES = {
  "core-infra": {
    "Announcements": [
      {
        title: "Upcoming scheduled maintenance - any prep tips?",
        content: "We have a scheduled maintenance window for core infrastructure next week. What are the recommended steps teams should take to prepare and minimize impact?"
      },
      {
        title: "How will logging change after the new infra rollout?",
        content: "The platform is migrating to a centralized log pipeline. Which dashboards and alerts should ops teams expect to update?"
      }
    ],
    "Career Path Questions": [
      {
        title: "How to transition from sysadmin to cloud infra engineer?",
        content: "I have 3 years of on-prem sysadmin experience. What skills and certifications are most valuable to make the move into cloud infrastructure roles?"
      },
      {
        title: "Career progression for SRE roles",
        content: "What does a typical SRE career path look like from junior to principal? Which measurable achievements help promotions?"
      }
    ],
    "Troubleshooting / Debug Help": [
      {
        title: "Intermittent latency spikes in internal RPC calls",
        content: "We see occasional 500–800ms spikes in RPC. CPU and memory look fine. What debugging steps or tools should we use to narrow root cause?"
      },
      {
        title: "Disk I/O saturation in storage nodes",
        content: "A subset of storage nodes reports high iowait during backups. How to safely throttle backups or identify noisy neighbors?"
      }
    ]
  },

  "software-dev": {
    "Announcements": [
      { title: "New frontend component library released", content: "We published a shared UI component library v1.0.0 — migration notes and breaking changes?" },
      { title: "API versioning policy update", content: "We are updating API versioning strategy. How should teams deprecate old endpoints safely?" }
    ],
    "Career Path Questions": [
      { title: "How to move from frontend to full-stack", content: "I focus on React. What backend skills and small projects should I build to become full-stack?" },
      { title: "Interview prep for mid-level backend roles", content: "Which algorithm and system-design topics are prioritized for mid-level backend interviews?" }
    ],
    "Troubleshooting / Debug Help": [
      { title: "Memory leak in Node.js service", content: "Heap grows steadily until restart. Which profiler and heap analysis steps are most effective?" },
      { title: "Database deadlocks under load", content: "Under peak load we hit deadlocks on writes. How to analyze and mitigate deadlock sources?" }
    ]
  },

  "data-eng": {
    "Announcements": [
      { title: "New data pipeline for event ingestion", content: "A new Kafka-backed ingestion pipeline will roll out. Migration checklist for consumers?" },
      { title: "Data retention policy changes", content: "Retention window will be reduced to 90 days. How to backfill aggregated metrics?" }
    ],
    "Career Path Questions": [
      { title: "From ETL engineer to data platform owner", content: "What extra responsibilities and skills move you from ETL dev to platform owner?" },
      { title: "Learning path for streaming systems", content: "Which books/courses and hands-on projects are recommended to master stream processing?" }
    ],
    "Troubleshooting / Debug Help": [
      { title: "Late-arriving events breaking joins", content: "Joining streaming tables causes missing rows due to late events. What patterns can handle this?" },
      { title: "High GC pauses in Spark jobs", content: "We see GC spikes on certain Spark jobs. GC tuning or memory config suggestions?" }
    ]
  },

  "ai-analytics": {
    "Announcements": [
      { title: "Model training cluster upgrade", content: "Training cluster upgraded with new GPUs — how to test model reproducibility?" },
      { title: "New evaluation metrics dashboard", content: "A dashboard to track model drift has been deployed. How to connect to alerting?" }
    ],
    "Career Path Questions": [
      { title: "From ML research to ML engineering", content: "I have research experience; how to focus on productionization and reliability?" },
      { title: "Portfolio projects to land data scientist roles", content: "Which types of projects demonstrate both modeling and production-readiness?" }
    ],
    "Troubleshooting / Debug Help": [
      { title: "Model performance gap after deployment", content: "Model A had 0.85 validation but drops in prod — what checks should we run first?" },
      { title: "Feature pipeline skew between train and prod", content: "How to detect and fix feature skew introduced by online transform differences?" }
    ]
  },

  "security-ops": {
    "Announcements": [
      { title: "New vulnerability disclosure policy", content: "We've published guidelines for vulnerability reporting. How should external researchers submit issues?" },
      { title: "Upcoming penetration test schedule", content: "Full-app pentest scheduled next month — recommended prep steps for teams?" }
    ],
    "Career Path Questions": [
      { title: "Transitioning into SecOps from DevOps", content: "What certifications and hands-on labs help bridge DevOps → SecOps?" },
      { title: "Skills for incident response lead", content: "Key technical and process skills needed to lead incident response efforts?" }
    ],
    "Troubleshooting / Debug Help": [
      { title: "Suspicious outbound traffic from service X", content: "How to safely investigate encrypted outbound sessions without breaking production?" },
      { title: "False positives from IDS", content: "Our IDS flags many benign events — strategies to reduce noise while preserving coverage?" }
    ]
  },

  "emerging-tech": {
    "Announcements": [
      { title: "Experimental edge runtime launched", content: "Edge runtime available for testing — what workloads are good candidates?" },
      { title: "Grant program for proofs-of-concept", content: "Small grants available for internal blockchain/edge POCs. How to apply?" }
    ],
    "Career Path Questions": [
      { title: "Breaking into Web3 engineering", content: "What projects and languages should I learn to be effective in Web3 roles?" },
      { title: "Skills for quantum-safe cryptography research", content: "Which mathematical foundations and practical skills help in quantum-safe crypto?" }
    ],
    "Troubleshooting / Debug Help": [
      { title: "Edge device flakiness under intermittent connectivity", content: "How to design resilient sync protocols for flaky connectivity?" },
      { title: "Smart contract reentrancy issues", content: "Tools and patterns to detect and prevent reentrancy bugs in contracts?" }
    ]
  }
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function pickAuthorForForum(forumId, exclude = []) {
  const members = await ForumMember.findAll({ where: { forum_id: forumId } });
  const candidateMemberUserIds = members.map(m => m.user_id).filter(id => !exclude.includes(id));

  if (candidateMemberUserIds.length > 0) {
    const id = pickRandom(candidateMemberUserIds);
    const user = await User.findByPk(id);
    if (user) return user;
  }

  // fallback: pick any user not excluded
  const anyUser = await User.findOne({ where: { id: { [Op.notIn]: exclude.length ? exclude : [0] } } });
  return anyUser;
}

async function ensureTwoQuestionsAndAnswersForThread(thread, forumFieldKey, tx) {
  // Count existing questions for this thread
  const existingQuestions = await Question.findAll({ where: { thread_id: thread.id }, transaction: tx, order: [["createdAt", "ASC"]] });
  const toCreate = Math.max(0, 2 - existingQuestions.length);

  const templatesForThread = (TEMPLATES[forumFieldKey] && TEMPLATES[forumFieldKey][thread.title]) || [];
  for (let i = 0; i < toCreate; i++) {
    const template = templatesForThread[i] || { title: `Auto question ${Date.now()}-${i}`, content: "Auto-generated question content." };

    const author = await pickAuthorForForum(thread.forum_id);
    const creatorId = author ? author.id : null;

    const newQ = await Question.create({
      thread_id: thread.id,
      creator_id: creatorId,
      title: template.title,
      content: template.content,
      image_url: null
    }, { transaction: tx });

    console.log(`  Created question (${newQ.id}) in thread "${thread.title}" -> "${newQ.title}" (creator ${creatorId})`);

    // Now ensure answers: create one top-level answer then one reply to it
    const ansAuthor1 = await pickAuthorForForum(thread.forum_id, [creatorId]);
    const ansAuthor2 = await pickAuthorForForum(thread.forum_id, [creatorId, ansAuthor1 ? ansAuthor1.id : null]);

    const answer1 = await Answer.create({
      question_id: newQ.id,
      sender_id: ansAuthor1 ? ansAuthor1.id : creatorId,
      content: `Thanks — here's a practical suggestion for this question in ${thread.title.toLowerCase()}.`,
      image_url: null,
      parent_answer_id: null
    }, { transaction: tx });

    const answer2 = await Answer.create({
      question_id: newQ.id,
      sender_id: ansAuthor2 ? ansAuthor2.id : (ansAuthor1 ? ansAuthor1.id : creatorId),
      content: `Following up: an additional tip or rebuttal to the earlier answer.`,
      image_url: null,
      parent_answer_id: answer1.id
    }, { transaction: tx });

    console.log(`    Created answers ${answer1.id} (root) and ${answer2.id} (reply to ${answer1.id})`);
  }

  // For existing questions, ensure they have at least 2 answers
  for (const q of existingQuestions) {
    const existingAnswers = await Answer.findAll({ where: { question_id: q.id }, transaction: tx, order: [["createdAt", "ASC"]] });
    if (existingAnswers.length >= 2) continue;

    // create missing answers
    if (existingAnswers.length === 0) {
      const ansAuthor1 = await pickAuthorForForum(thread.forum_id, [q.creator_id]);
      const ansAuthor2 = await pickAuthorForForum(thread.forum_id, [q.creator_id, ansAuthor1 ? ansAuthor1.id : null]);

      const a1 = await Answer.create({
        question_id: q.id,
        sender_id: ansAuthor1 ? ansAuthor1.id : q.creator_id,
        content: `Auto answer: here's an experienced take for the question "${q.title}".`,
        image_url: null,
        parent_answer_id: null
      }, { transaction: tx });

      const a2 = await Answer.create({
        question_id: q.id,
        sender_id: ansAuthor2 ? ansAuthor2.id : (ansAuthor1 ? ansAuthor1.id : q.creator_id),
        content: `Auto follow-up reply to the first answer.`,
        image_url: null,
        parent_answer_id: a1.id
      }, { transaction: tx });

      console.log(`  Backfilled answers for existing question ${q.id}: created ${a1.id} and ${a2.id}`);
    } else if (existingAnswers.length === 1) {
      const existing = existingAnswers[0];
      const ansAuthor = await pickAuthorForForum(thread.forum_id, [q.creator_id, existing.sender_id]);
      const a = await Answer.create({
        question_id: q.id,
        sender_id: ansAuthor ? ansAuthor.id : q.creator_id,
        content: `Additional answer to expand on earlier point.`,
        image_url: null,
        parent_answer_id: null
      }, { transaction: tx });
      console.log(`  Added second answer ${a.id} to existing question ${q.id}`);
    }
  }
}

async function run() {
  console.log("=> Seed Thread/Question/Answer script started");

  try {
    await sequelize.authenticate();
    console.log("DB authenticated ✅");
  } catch (err) {
    console.error("DB authentication failed:", err);
    process.exit(1);
  }

  const tx = await sequelize.transaction();
  try {
    // Find the six forums: prefer the known field_keys; skip those not found
    const wantedKeys = Object.keys(TEMPLATES);
    const forums = await Forum.findAll({ where: { field_key: { [Op.in]: wantedKeys } }, transaction: tx });

    if (!forums || forums.length === 0) {
      console.error("No matching forums found. Ensure forums exist with expected field_key values.");
      await tx.rollback();
      process.exit(1);
    }

    for (const forum of forums) {
      console.log(`Processing forum ${forum.id} / ${forum.title} (${forum.field_key})`);

      // find the three threads for this forum
      const threads = await Thread.findAll({
        where: { forum_id: forum.id, title: { [Op.in]: THREAD_TITLES } },
        transaction: tx,
        order: [["id", "ASC"]]
      });

      if (!threads || threads.length === 0) {
        console.warn(`  No template threads found in forum ${forum.title}. Skipping forum.`);
        continue;
      }

      for (const thread of threads) {
        console.log(`  Thread: ${thread.id} - ${thread.title}`);
        await ensureTwoQuestionsAndAnswersForThread(thread, forum.field_key, tx);
      }
    }

    await tx.commit();
    console.log("✅ Seeded questions & answers successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed, rolling back:", err);
    try { await tx.rollback(); } catch (rbErr) { console.error("Rollback failed:", rbErr); }
    process.exit(1);
  }
}

run();
