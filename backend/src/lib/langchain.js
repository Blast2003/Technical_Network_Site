import "reflect-metadata";
import fs from "fs";
import { DataSource } from "typeorm";
import { Variables } from "../config/variables.js";
import { ChatOllama } from "@langchain/ollama";
import { SqlDatabase } from "@langchain/classic/sql_db";

import ollama from 'ollama';



export let popularityChain, topicChain, llm, db;

export async function initLangChain() {
  llm = new ChatOllama({
     model: 'llama3.2',
    baseUrl: "http://localhost:11434",
    options: {
      num_ctx: 2048,
      num_thread: 8,
      temperature: 0,
      stream: true 
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

}

export async function generatePopularityQuery(userInput, top_k, dateClause) {
  const systemPrompt = `
You are a MySQL expert. Return ONLY a single, flat SELECT that:

 • Finds the {top_k} most popular posts
 • Use only posts, postlikes, postreplies, userposts, users
 • Excludes frozen users (u.isFrozen = true)
 • Compute LikesNumber and RepliesNumber. **MUST** include “ORDER BY LikesNumber DESC, RepliesNumber DESC”
 • **MUST** include “WHERE u.isFrozen = false {dateClause}”. Do not add any other conditions to the WHERE clause.
 • **MUST** end with “LIMIT {top_k};” — do not remove or modify it

Query Format: -- Must Follow Exactly
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
`.trim();

  const res = await ollama.chat({
     model: 'llama3.2',
    baseUrl:   'http://localhost:11434', 
    options: { num_ctx: 2048, num_thread: 8, temperature: 0 },
    messages: [
      { role: 'system', content: systemPrompt.replace('{top_k}', top_k).replace('{userInput}', userInput).replace('{dateClause}', dateClause) },
      { role: 'user', content: userInput }
    ]
  });

  return res.message.content.trim();
}

export async function generateTopicQuery(userInput, topic, escaped_topic, top_k, dateClause) {

    const systemPrompt = `
You are a MySQL expert. Return a flat SELECT that: 
  • Finds posts related to "{topic}".
  • Use only posts, postlikes, postreplies, userposts, users.
  • Exclude frozen users (users.isFrozen = true).
  • **MUST** Match the literal string '{escaped_topic}' against p.mainField and p.title.
  • Compute LikesNumber and RepliesNumber. **MUST** include “ORDER BY LikesNumber DESC, RepliesNumber DESC”
  • **MUST** include “WHERE … {dateClause}” if provided  
  • **MUST** end with “LIMIT {top_k};” — do not remove or modify it  

Query Format: -- Must Follow Exactly
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
  AND (p.mainField LIKE CONCAT('%', '{escaped_topic}', '%') OR p.title LIKE CONCAT('%', '{escaped_topic}', '%')) 
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
{userInput}

-- Top K: {top_k}
-- Table info:
{posts: id, title, text, type, mainField, createdAt}
{postlikes: post_id, user_id}
{postreplies: post_id, reply_id}
{userposts: post_id, user_id}
{users: id, isFrozen}
`.trim();

  const res = await ollama.chat({
     model: 'llama3.2',
    baseUrl:   'http://localhost:11434', 
    options: { num_ctx: 2048, num_thread: 8, temperature: 0 },
    messages: [
      { role: 'system', content: systemPrompt.replace('{top_k}', top_k).replace('{userInput}', userInput).replace('{dateClause}', dateClause).replace(/{escaped_topic}/g, escaped_topic).replace('{topic}', topic) },
      { role: 'user', content: userInput }
    ]
  });

  return res.message.content.trim();
}


export async function generateSummary(summaryPrompt, { maxTokens = 200, temperature = 0 } = {}) {
  const systemMessage = {
    role: 'system',
    content: 'You are a helpful and engaging AI assistant that can discuss technology trends. You aim to provide insights in a conversational manner, inviting further questions or exploration. You can use markdown for emphasis but avoid strict lists unless necessary.'
  };
  const userMessage = { role: 'user', content: summaryPrompt };

  const res = await ollama.chat({
    model: 'llama3.2',
    baseUrl: 'http://localhost:11434',
    options: {
      num_ctx:    2048,
      num_thread: 8,
      temperature,
      max_tokens: maxTokens,
      stream:     true
    },
    messages: [systemMessage, userMessage]
  });

  return res.message.content.trim();
}


