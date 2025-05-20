import "reflect-metadata";
import fs from "fs";
import { DataSource } from "typeorm";
import { Variables } from "../config/variables.js";
import { ChatOllama } from "@langchain/ollama";
import { SqlDatabase } from "langchain/sql_db";
import { createSqlQueryChain } from "langchain/chains/sql_db";
import { PromptTemplate } from "@langchain/core/prompts";



export let popularityChain, topicChain, llm, db;

export async function initLangChain() {
  llm = new ChatOllama({
    model: "llama3.2",
    baseUrl: "http://localhost:11434",
    options: {
      num_ctx: 4096,
      num_thread: 4,
      temperature: 0,
    },
  });

  const ds = new DataSource({
    type: "mysql",
    host: Variables.MYSQL_HOST,
    port: Number(Variables.MYSQL_PORT),
    username: Variables.MYSQL_USER,
    password: Variables.MYSQL_PASSWORD,
    database: Variables.MYSQL_DATABASE_NAME,
    extra: {
      ssl: {
        ca: fs.readFileSync(Variables.CA),
      },
    },
  });

  await ds.initialize();

  const sqlDb = await SqlDatabase.fromDataSourceParams({
    appDataSource: ds,
    includesTables: ["posts", "users", "userposts", "postlikes", "postreplies", "replies"],
  });

  db = sqlDb;

  // Prompt template for popularity queries (Case 1)
  const popTemplate = PromptTemplate.fromTemplate(`
You are a MySQL expert.  Return ONLY a single, flat SELECT that:

  • Finds the {top_k} most popular posts  
  • Uses only posts, postlikes, postreplies, userposts, users  
  • Excludes frozen users (u.isFrozen = true)  
  • Compute LikesNumber and RepliesNumber. **MUST** include “ORDER BY LikesNumber DESC, RepliesNumber DESC”
  • **MUST** include “WHERE … {dateClause}” if provided  
  • **MUST** end with “LIMIT {top_k};” — do not remove or modify it  

Query Format: -- Must Follow
SELECT
    p.id,
    p.title,
    p.text,
    p.type,
    p.createdAt,
    COUNT(DISTINCT pl.user_id) AS LikesNumber,
    COUNT(DISTINCT pr.reply_id) AS RepliesNumber
FROM posts p
LEFT JOIN postlikes pl ON pl.post_id = p.id
LEFT JOIN postreplies pr ON pr.post_id = p.id
JOIN userposts up ON up.post_id = p.id
JOIN users u ON u.id = up.user_id
WHERE u.isFrozen = false {dateClause}
GROUP BY 
  p.id,
  p.title,
  p.text,
  p.type,
  p.mainField,
  p.createdAt
ORDER BY LikesNumber DESC, RepliesNumber DESC
LIMIT {top_k};

-- Return only the raw SQL, no markdown or explanation.

-- User question:
{input}

-- Top K: {top_k}
-- Table info:
{table_info}
`);


  popularityChain = await createSqlQueryChain({
    llm,
    db: sqlDb,
    dialect: "mysql",
    topK: 5,
    returnDirect: true,
    prompt: popTemplate,
  });

  // Prompt template for topic-based queries (Case 2)
  const topicTemplate = PromptTemplate.fromTemplate(`
You are a MySQL expert. Return a flat SELECT that: 
  • Finds posts related to "{topic}".
  • Use only posts, postlikes, postreplies, userposts, users.
  • Exclude frozen users (users.isFrozen = true).
  • **MUST** Match "{escaped_topic}" against posts.mainField and posts.title.
  • Compute LikesNumber and RepliesNumber. **MUST** include “ORDER BY LikesNumber DESC, RepliesNumber DESC”
  • **MUST** include “WHERE … {dateClause}” if provided  
  • **MUST** end with “LIMIT {top_k};” — do not remove or modify it  

Query Format: -- Must Follow
SELECT
    p.id,
    p.title,
    p.text,
    p.type,
    p.mainField,
    p.createdAt,
    COUNT(DISTINCT pl.user_id) AS LikesNumber,
    COUNT(DISTINCT pr.reply_id) AS RepliesNumber
FROM posts p
LEFT JOIN postlikes pl ON pl.post_id = p.id
LEFT JOIN postreplies pr ON pr.post_id = p.id
JOIN userposts up ON up.post_id = p.id
JOIN users u ON u.id = up.user_id
WHERE u.isFrozen = false{dateClause}
  AND (p.mainField LIKE CONCAT('%', {escaped_topic}, '%') OR p.title LIKE CONCAT('%', {escaped_topic}, '%')) 
GROUP BY 
  p.id,
  p.title,
  p.text,
  p.type,
  p.mainField,
  p.createdAt,
ORDER BY LikesNumber DESC, RepliesNumber DESC
LIMIT {top_k};

-- Return only the raw SQL, no markdown or explanation.

-- User question:
{input}

-- Top K: {top_k}
-- Table info:
{table_info}
`);

  topicChain = await createSqlQueryChain({
    llm,
    db: sqlDb,
    dialect: "mysql",
    topK: 5,
    returnDirect: true,
    prompt: topicTemplate,
  });
}
