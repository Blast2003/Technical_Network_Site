import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ollama from 'ollama';
// import { sequelize } from '../config/database.js';

import { db, generatePopularityQuery, generateSummary, generateTopicQuery } from "../lib/langchain.js";
import analyzeInputTaxonomy from '../gemini/DefineUserInputFromTaxonomy.js';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Post} from '../models/postModel.js';
import {sequelize} from "../config/database.js";
import { Op } from "sequelize";

// const taxonomyKeywords = {
//   'Core Infrastructure & Operations': ['infrastructure', 'operations', 'servers', 'networking', 'storage', 'virtualization', 'cloud infrastructure', 'system administration'],
//   'Software & Application Development': ['software development', 'application development', 'programming', 'coding', 'web development', 'mobile development', 'frameworks', 'libraries', 'api'],
//   'Data & Intelligence': ['data', 'intelligence', 'analytics', 'machine learning', 'ai', 'big data', 'databases', 'data science', 'reporting', 'visualization'],
//   'Security & Operations Management': ['security', 'cybersecurity', 'operations management', 'monitoring', 'incident response', 'compliance', 'risk management', 'devops'],
//   'Emerging Technologies': ['emerging technologies', 'blockchain', 'iot', 'artificial intelligence', 'quantum computing', 'vr', 'ar', 'metaverse']
// };


function getKnowledgeContent() {
    try {
        const knowledgePath = path.join(
            __dirname, 
            'knowledge.docx'
        );
        return fs.readFileSync(knowledgePath, 'utf8');
    } catch (err) {
        console.error("Error reading knowledge file:", err);
        return '';
    }
}


/**
 * Starts a new conversation thread.
 * @returns {string} A new thread ID.
 */

const conversations = {};
const globalCache = {}; 

export async function startConversation(id) {
    const threadId = id;
    // Load knowledge content to provide context for the assistant.
    const knowledgeContent = getKnowledgeContent();
  
    // Initialize the conversation context with a system message containing the knowledge content.
    conversations[threadId] = [
      { role: 'system', content: knowledgeContent }
    ];

    
    return threadId;
}

// utility to classify user intent
function isPopularityQuery(input) {
  const popKeywords   = /\b(?:popular|famous|favorite|trending|hot|best|most liked|most commented)\b/i;
  const rankPattern   = /\b(?:top|highest)\s+\d+/i;
  const topicBlacklist = /\btopics?\b/i;  
  const postBlacklist = /\bposts?\b/i;  

  const hasPop       = popKeywords.test(input) || rankPattern.test(input);
  const hasTopicWord = topicBlacklist.test(input);
  const hasPostWord = postBlacklist.test(input);

  return hasPop || hasTopicWord || hasPostWord;
}

// New function to check for topic keywords
function containsTopicKeywords(input) {
    const topicKeywords = /(about|related to|on|in|regarding|pertain to|concerning|correspond|to|at|from)/i;
    return topicKeywords.test(input);
}

const NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

function extractTopK(input, defaultK = 3) {
  const lower = input.toLowerCase();

  // 1) Try to match an explicit number (digit or word) before “post[s]”
  const numRegex = new RegExp(
    `\\b(\\d+|${Object.keys(NUMBER_WORDS).join("|")})\\b(?:\\s+\\w+){0,5}?\\s+posts?\\b`,
    "i"
  );
  const m = lower.match(numRegex);
  if (m) {
    const tok = m[1];
    if (/^\d+$/.test(tok)) {
      return Math.max(1, parseInt(tok, 10));
    }
    if (tok in NUMBER_WORDS) {
      return Math.max(1, NUMBER_WORDS[tok]);
    }
  }

  // 2) If *no* explicit number but the user said “most” as a standalone word → 1
  if (/\bmost\b/.test(lower)) {
    return 1;
  }

  // 3) Otherwise fall back to defaultK
  return defaultK;
}

function formatRelativeTime(isoDateString) {
  const now = Date.now();
  const then = new Date(isoDateString).getTime();
  const deltaSec = Math.floor((now - then) / 1000);

  const intervals = [
    { label: 'year',   seconds: 365 * 24 * 3600 },
    { label: 'month',  seconds: 30 * 24 * 3600 },
    { label: 'day',    seconds: 24 * 3600 },
    { label: 'hour',   seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ];

  for (const { label, seconds } of intervals) {
    const count = Math.floor(deltaSec / seconds);
    if (count >= 1) {
      return `${count} ${label}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

function renderPostsMarkdown(rows, top_k = 3, host = process.env.APP_HOST || 'http://localhost:4500') {
  if (!rows?.length) return "We don't have any posts related to that topic.";

  const available   = rows.length;
  const limitedRows = rows.slice(0, top_k);

  const notice =
    available < top_k
      ? `After a few seconds of searching on our platform, we could only find ${available} post${available === 1 ? "" : "s"} related to your request.\n\n`
      : `After a few seconds of searching on our platform, we found ${top_k} post${top_k === 1 ? "" : "s"} related to your request.\n\n`;

  const postsMarkdown = limitedRows
    .map((r, index) => {
      const relTime = formatRelativeTime(r.createdAt);
      const url = `${host.replace(/\/$/, '')}/tech/post/${r.id}`;

      return [
        `**${index + 1}. ${r.title}**  *(${relTime})*`,
        `${r.text}`,
        // URL label và link nằm trên cùng 1 hàng
        `**URL**: <a href="${url}" class="post-link">${url}</a>`,
        // Likes/Replies: vẫn dùng markdown bold cho label nhưng không có background
        `**Likes**: ${r.LikesNumber}, **Replies**: ${r.RepliesNumber}`,
      ].join("\n\n"); // 1 blank line giữa các block
    })
    .join("\n\n---\n\n"); // optional separator giữa posts

  return notice + postsMarkdown;
}


function parseDateInterval(input) {
  const m = input.match(/(\d+)\s*(day|month|year)s?\s*ago/i);
  return m
    ? { type: 'relative', value: +m[1], unit: m[2].toUpperCase() }
    : null;
}
  
function parseExactDate(input) {
  // 1) DD/MM/YYYY
  let m = input.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) {
    let [ , d, mo, y ] = m;
    d  = d.padStart(2,'0');
    mo = mo.padStart(2,'0');
    return { type: 'day',   date: `${y}-${mo}-${d}` };
  }
  // 2) YYYY-MM-DD
  m = input.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    let [ , y, mo, d ] = m;
    mo = mo.padStart(2,'0');
    d  = d.padStart(2,'0');
    return { type: 'day',   date: `${y}-${mo}-${d}` };
  }
  // 3) YYYY-MM
  m = input.match(/\b(\d{4})-(\d{1,2})\b/);
  if (m) {
    let [ , y, mo ] = m;
    mo = mo.padStart(2,'0');
    return { type: 'month', date: `${y}-${mo}-01` };
  }
  // 4) YYYY
  m = input.match(/\b(20\d{2}|19\d{2})\b/);
  if (m) {
    return { type: 'year',  date: `${m[1]}-01-01` };
  }
  return null;
}

function buildDateClause(input) {
  const lower = input.toLowerCase();

  // 1) today
  if (/\btoday\b/.test(lower)) {
    return ` AND p.createdAt >= CURDATE()`;
  }

  // 2) yesterday
  if (/\byesterday\b/.test(lower)) {
    return (
      ` AND p.createdAt >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
      + ` AND p.createdAt < CURDATE()`
    );
  }

  // 3) last/past N units (days, weeks, months, years, hours…)
  const ago = lower.match(
    /\b(?:last|past)\s+(\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/
  );
  if (ago) {
    let [ , num, unit ] = ago;
    // force singular + uppercase
    unit = unit.replace(/s$/i, '').toUpperCase();
    return ` AND p.createdAt >= DATE_SUB(NOW(), INTERVAL ${num} ${unit})`;
  }


  // 4) “in the last week/month/year”
  const inLast = lower.match(/\bin the last (week|month|year)\b/);
  if (inLast) {
    const u = inLast[1];
    if (u === 'week')    return ` AND p.createdAt >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
    if (u === 'month')   return ` AND p.createdAt >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`;
    if (u === 'year')    return ` AND p.createdAt >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`;
  }

  // 5) this week/month/year
  const thisPeriod = lower.match(/\bthis (week|month|year)\b/);
  if (thisPeriod) {
    const p = thisPeriod[1];
    if (p === 'week')  return ` AND p.createdAt >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`;
    if (p === 'month') return ` AND p.createdAt >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    if (p === 'year')  return ` AND p.createdAt >= DATE_FORMAT(CURDATE(), '%Y-01-01')`;
  }

  // 6) since YYYY-MM-DD
  const since = lower.match(/\bsince\s+(\d{4}-\d{2}-\d{2})\b/);
  if (since) {
    return ` AND p.createdAt >= '${since[1]} 00:00:00'`;
  }

  // 7) between DATE1 and DATE2
  const between = lower.match(
    /\bbetween\s+(\d{4}-\d{2}-\d{2})\s+and\s+(\d{4}-\d{2}-\d{2})\b/
  );
  if (between) {
    return (
      ` AND p.createdAt >= '${between[1]} 00:00:00'`
      + ` AND p.createdAt <= '${between[2]} 23:59:59'`
    );
  }

  // 8) fallback to your existing parsers
  const rel = parseDateInterval(input);
  if (rel) {
    return ` AND p.createdAt >= DATE_SUB(NOW(), INTERVAL ${rel.value} ${rel.unit})`;
  }
  const ex = parseExactDate(input);
  if (ex) {
    return ` AND p.createdAt >= '${ex.date} 00:00:00'`;
  }

  // no date clause found
  return '';
}


export async function chatResponseFromQueries(threadId, userInput) {
  const history = conversations[threadId];
  if (!history) throw new Error("Invalid thread ID; call startConversation first");
  if (typeof userInput !== 'string') throw new Error('userInput must be a string');

  // Build request metadata
  const dateClause = buildDateClause(userInput);
  const top_k = extractTopK(userInput, 3);
  const isPopQuery = isPopularityQuery(userInput);
  const isTopicQuery = isPopQuery && containsTopicKeywords(userInput);
  const category = isPopQuery && !isTopicQuery ? 'Type1' : (isPopQuery && isTopicQuery ? 'Type2' : 'Type3');
  let taxonomy = '';
  
  console.log("dateClause: ", dateClause);
  console.log("top_k: ", top_k);
  console.log("isPopQuery: ", isPopQuery);
  console.log("isTopicQuery: ", isTopicQuery);
  console.log("category: ", category);

  if (isTopicQuery) {
    taxonomy = await analyzeInputTaxonomy(userInput) || '';
  }

  console.log("Taxonomy: ", taxonomy);

  // Generate a cache key for exact-match queries
  const cacheKey = JSON.stringify({ category, dateClause, top_k, taxonomy });

  // 1) Exact match in global cache
  if (globalCache[cacheKey]) {
    const { requestEntry, responseEntry } = globalCache[cacheKey];
    history.push({ role: 'user', content: userInput });
    history.push({ role: 'assistant', content: responseEntry.content });
    return responseEntry.content;
  }

  // 2) Fallback: reuse larger cached results for Type1/Type2
  if (category === 'Type1' || category === 'Type2') {
    for (const key in globalCache) {
      const { requestEntry, responseEntry } = globalCache[key];
      if (
        requestEntry.category === category &&
        requestEntry.dateClause === dateClause &&
        (category === 'Type1' || requestEntry.taxonomy === taxonomy) &&
        requestEntry.top_k >= top_k
      ) {
        // slice stored rows
        const allRows = JSON.parse(responseEntry._cachedRows);
        const sliced = allRows.slice(0, top_k);
        const content = renderPostsMarkdown(sliced, top_k);
        history.push({ role: 'user', content: userInput });
        history.push({ role: 'assistant', content });
        return content;
      }
    }
  }

  // 3) Proceed with generation for Type1/Type2/Type3
  history.push({ role: 'user', content: userInput });
  let sqlRaw;
  try {
    if (category === 'Type1') {
      sqlRaw = `SELECT
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
              WHERE u.isFrozen = false ${dateClause}
              GROUP BY
                  p.id,
                  p.title,
                  p.text,
                  p.type,
                  p.mainField,
                  p.createdAt
              ORDER BY LikesNumber DESC, RepliesNumber DESC
              LIMIT ${top_k};`
    } else if (category === 'Type2') {
      if (!taxonomy || taxonomy === '""') {
        sqlRaw = `SELECT
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
                WHERE u.isFrozen = false ${dateClause}
                GROUP BY
                    p.id,
                    p.title,
                    p.text,
                    p.type,
                    p.mainField,
                    p.createdAt
                ORDER BY LikesNumber DESC, RepliesNumber DESC
                LIMIT ${top_k};`
      } else {
        const escaped = taxonomy.replace(/%/g, '\\%');
        sqlRaw = `
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
        WHERE u.isFrozen = false AND (p.title LIKE CONCAT('%', '${escaped}', '%') OR p.mainField LIKE CONCAT('%', '${escaped}', '%')) ${dateClause}
        GROUP BY
          p.id,
          p.title,
          p.text,
          p.type,
          p.mainField,
          p.createdAt
        ORDER BY LikesNumber DESC, RepliesNumber DESC
        LIMIT ${top_k};
        `.trim();
      }
    } else {
      const answer = 'We do not provide that service!';
      history.push({ role: 'assistant', content: answer });
      return answer;
    }

    // Extract and clean SQL
    const sqlMatches = sqlRaw.match(/```sql([\s\S]*?)```/i);
    let cleanedSQL = sqlMatches ? sqlMatches[1].trim() : sqlRaw.trim();


    // 1) Ensure LIMIT
    if (!/limit\s+\d+/i.test(cleanedSQL)) {
      cleanedSQL = cleanedSQL.replace(/;?$/, `\nLIMIT ${top_k};`);
    }

    // 2) Strip any existing ORDER BY before LIMIT
    cleanedSQL = cleanedSQL.replace(
      /ORDER\s+BY[\s\S]*?(?=LIMIT\s+\d+)/i,
      ''
    );

    // 3) Inject canonical ORDER BY if missing
    const simpleOrder = /ORDER\s+BY\s+LikesNumber\s+DESC\s*;?/i;
    const fullOrder   = /ORDER\s+BY\s+LikesNumber\s+DESC\s*,\s*RepliesNumber\s+DESC\s*;?/i;
    const orderClause = 'ORDER BY LikesNumber DESC, RepliesNumber DESC';

    if (!simpleOrder.test(cleanedSQL) && !fullOrder.test(cleanedSQL)) {
      cleanedSQL = cleanedSQL.replace(
        /(LIMIT\s+\d+;?)/i,
        `${orderClause}\n$1`
      );
    }


    // 4: strip any extra predicates in the WHERE 
    if(isPopQuery){
      // Preserve any extra predicates (e.g. topic filters) and just ensure dateClause is present
      const whereRegex = /(WHERE\s+u\.isFrozen\s*=\s*false)([\s\S]*?)(?=\bGROUP\s+BY\b)/i;
      const match = cleanedSQL.match(whereRegex);
      if (match) {
        const prefix = match[1];             // "WHERE u.isFrozen = false"
        const existingPredicates = match[2] || ''; // everything after that up to GROUP BY

        let newPredicates = existingPredicates;

        if (dateClause) {
          // if there's already a createdAt/date predicate, try to replace it; otherwise append
          if (/\bp\.createdAt\b/i.test(existingPredicates)) {
            newPredicates = existingPredicates.replace(/\bAND\s+p\.createdAt[^\n]*/i, ` ${dateClause}`);
          } else {
            newPredicates = `${existingPredicates} ${dateClause}`;
          }
        }

        cleanedSQL = cleanedSQL.replace(whereRegex, `${prefix}${newPredicates}`);
      }
    }

    console.log("\ncleanedSQL:", cleanedSQL);

    // start time
    const startTime = process.hrtime();

    // validate and execute
    const rawRows = await db.run(cleanedSQL);

    // stop time
    const [sec, nano] = process.hrtime(startTime);

    const durationSec = sec + nano / 1e9;

    // log execution time + raw rows
    console.log(`✅ SQL executed in ${durationSec.toFixed(3)} s`);
    console.log("rawRows:", rawRows);

    // parse and render
    const rows = JSON.parse(rawRows);
    const answerContent = renderPostsMarkdown(rows, top_k);

    // Prepare cache entries
    const requestEntry = { role: 'user', content: userInput, category, dateClause, top_k, taxonomy };
    const responseEntry = { role: 'assistant', content: answerContent, category, dateClause, top_k, taxonomy, _cachedRows: rawRows };

    // Store in both local and global caches
    globalCache[cacheKey] = { requestEntry, responseEntry };

    history.push(responseEntry);
    return answerContent;


  } catch (error) {
    console.error('❌ SQL processing error:', error);
    const msg = 'There was an issue processing your request. Please try again.';
    history.push({ role: 'assistant', content: msg });
    return msg;
  }
}



async function handleHistoryQuery(threadId, userInput, conversationHistory) {
  const lowerInput = userInput.toLowerCase();
  const ordinalMatch = lowerInput.match(/first|second|third|([0-9]+)(st|nd|rd|th)/i);

  // Filter only user messages for ordinal counting
  const userMessages = conversationHistory.filter(msg => msg.role === 'user');
  
  if (!ordinalMatch) {
    return `I can only respond to specific history queries like "first," "second," etc. You have asked ${userMessages.length} previous questions.`;
  }

  let targetIndex = -1;
  if (ordinalMatch[1]) {
    targetIndex = parseInt(ordinalMatch[1]) - 1; // e.g., "3rd" → index 2
  } else {
    const ordinals = ['first', 'second', 'third'];
    targetIndex = ordinals.indexOf(ordinalMatch[0].toLowerCase());
  }

  if (targetIndex < 0 || targetIndex >= userMessages.length) {
    return `I only have record of ${userMessages.length} previous questions.`;
  }

  const targetPrompt = userMessages[targetIndex].content;

  // For KNOWLEDGE_ONLY prompts, use the knowledge base to summarize
  const analysisPrompt = `
Based on the website's knowledge base, summarize the following user question in a concise and factual manner. Do not fabricate details or provide information not explicitly listed in the knowledge base.
Question: ${targetPrompt}
`.trim();

  const messages = [
    { role: 'system', content: getKnowledgeContent() },
    { role: 'user', content: analysisPrompt }
  ];

  const response = await ollama.chat({
     model: 'llama3.2',
    baseUrl:   'http://localhost:11434', 
    options: {
      num_ctx: 2048,
      num_thread: 8,
      temperature: 0,
    },
    messages,
  });

  return `You asked: "${targetPrompt}"\nSummary: ${response.message.content}`;
}

/**
 * Sends a message to the Ollama chat and returns the assistant's response.
 * The conversation context is maintained in memory.
 * @param {string} threadId - The conversation thread ID.
 * @param {string} userInput - The user's message.
 * @returns {string} The assistant's response.
 */
export async function chatResponse(threadId, userInput) {
  if (!conversations[threadId]) {
    throw new Error('Invalid thread ID');
  }

  // Append the user's message to the conversation history
  conversations[threadId].push({ role: 'user', content: userInput });

  // Check if the prompt is a history-related question
  const lowerInput = userInput.toLowerCase();
  const isHistoryQuery = /remember|previous|first|second|third|[0-9]+(st|nd|rd|th)|content/i.test(lowerInput);

  if (isHistoryQuery) {
    const responseContent = await handleHistoryQuery(threadId, userInput, conversations[threadId]);
    conversations[threadId].push({ role: 'assistant', content: responseContent });
    
    // console.log("History: ", conversations[threadId]);
    return responseContent;
  }

  if (/\b(?:most\s+)?trending\s+topics?\b/i.test(userInput)) {
  const answer =
    'On the right sidebar of the Technical Networking Platform, the top three trending topics are displayed.';
  conversations[threadId].push({ role: 'assistant', content: answer });
  return answer;
}

  // For knowledge-based queries, respond solely based on provided knowledge
  const messages = [
    {
      role: 'system',
      content: getKnowledgeContent() + '\n\n' +
        'Respond ONLY based on the provided knowledge base. If the question refers to listing posts or querying dynamic data, respond with: "This question requires a database query. Please ask again to retrieve the results." Otherwise, provide a concise factual answer derived from the knowledge base.'
    },
    ...conversations[threadId].filter(msg => msg.role !== 'system')
  ];

  // Call Ollama chat with the conversation history
  const response = await ollama.chat({
     model: 'llama3.2',
    baseUrl:   'http://localhost:11434', 
    options: {
      num_ctx: 2048,
      num_thread: 8,
      temperature: 0,
    },
    messages,
  });

  // Save the assistant's reply back into the conversation history
  conversations[threadId].push({ role: 'assistant', content: response.message.content });

  console.log("History: ", conversations[threadId]);

  return response.message.content;
}

export function isSupportedQuery(userInput) {
  const q = userInput.toLowerCase();

  const patterns = [
    /\bpopular posts?\b/,
    /\bfamous posts?\b/,
    /\bfavorite posts?\b/,
    /\btrending posts?\b/,
    /\b(?:most|favourite|favorite|famous)\s+posts?\b/,
    /\bposts?\s+(?:about|on|for)\b/,
    /\blist\s+\d+\s+posts?\b/,
    /\bposts?\b/,

    // Topics
    /\bpopular topics?\b/,
    /\bfamous topics?\b/,
    /\bfavorite topics?\b/,
    /\btrending topics?\b/,
    /\b(?:most|favourite|favorite|famous)\s+topics?\b/,
    /\btopics?\s+(?:about|on|for)\b/,
    /\blist\s+\d+\s+topics?\b/,
    /\btopics?\b/,
  ];

  return patterns.some(rx => rx.test(q));
}

// Keyword lists
const SUMMARY_KEYWORDS = [
  'summarize', 'summary', 'overview', 'insight', 'recap', 'digest', 'summarizes', 'sumarizes'
];


// Date/Time regex patterns
const DATE_PATTERNS = [
  { label: '24h', regex: /\b(24\s*hours?|one\s*day|1\s*day|24h|today)\b/i },
  { label: '1w', regex: /\b(7\s*days?|one\s*week|1\s*week|past\s*week|last\s*week)\b/i },
  { 
    label: '1m', 
    regex: /\b(30\s*days?|one\s*month|1\s*month|past\s*month|last\s*month)\b/i 
  }
];

// Relative time extractor: "2 days ago", "3 months ago", etc.
const RELATIVE_REGEX = /(?<value>\d+)\s*(?<unit>seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s*ago/i;
// Exact date formats: dd/mm/yyyy or dd-mm-yyyy
const EXACT_DATE_REGEX = /\b(?<day>\d{1,2})[-\/](?<month>\d{1,2})[-\/](?<year>\d{2,4})\b/;

/**
 * Determine if input is a trending request and extract period label
 */
export function parseTrendingRequest(input) {
  const lower = input.toLowerCase();
  const hasSummary = SUMMARY_KEYWORDS.some(k => lower.includes(k));

  if (!hasSummary) return null;

  for (const { label, regex } of DATE_PATTERNS) {
    if (regex.test(input)) return { periodLabel: label };
  }

  const relMatch = input.match(RELATIVE_REGEX);
  if (relMatch?.groups) {
    return { relative: { value: parseInt(relMatch.groups.value, 10), unit: relMatch.groups.unit } };
  }

  const exactMatch = input.match(EXACT_DATE_REGEX);
  if (exactMatch?.groups) {
    const { day, month, year } = exactMatch.groups;
    return { exact: new Date(`${year}-${month}-${day}`) };
  }

  return { periodLabel: '24h' };
}

/**
 * Compute the starting Date based on parsed period
 */
function computeSinceDate(parsed) {
  let since = new Date();

  if (parsed.periodLabel) {
    switch (parsed.periodLabel) {
      case '1w': since.setDate(since.getDate() - 7); break;
      case '1m': since.setMonth(since.getMonth() - 1); break;
      default: since.setDate(since.getDate() - 1);
    }
  } else if (parsed.relative) {
    const { value, unit } = parsed.relative;
    switch (unit.toLowerCase()) {
      case 'second': case 'seconds': since.setSeconds(since.getSeconds() - value); break;
      case 'minute': case 'minutes': since.setMinutes(since.getMinutes() - value); break;
      case 'hour': case 'hours': since.setHours(since.getHours() - value); break;
      case 'day': case 'days': since.setDate(since.getDate() - value); break;
      case 'week': case 'weeks': since.setDate(since.getDate() - value * 7); break;
      case 'month': case 'months': since.setMonth(since.getMonth() - value); break;
      case 'year': case 'years': since.setFullYear(since.getFullYear() - value); break;
    }
  } else if (parsed.exact) {
    since = parsed.exact;
  }

  return since;
}

/**
 * Generate and return a markdown-formatted trending summary
 */
export async function chatTrendingSummary(threadId, userInput) {
  const history = conversations[threadId];
  if (!history) throw new Error("Invalid thread ID; call startConversation first");
  
  history.push({ role: 'user', content: userInput });
  const parsed = parseTrendingRequest(userInput);
  if (!parsed) return null;

  const sinceDate = computeSinceDate(parsed);
  const postCounts = await Post.findAll({
    attributes: ['mainField', [sequelize.fn('COUNT', sequelize.col('mainField')), 'count']],
    where: { createdAt: { [Op.gte]: sinceDate } },
    group: ['mainField'], order: [[sequelize.literal('count'), 'DESC']], limit: 1
  });

  if (!postCounts.length) {
    const latestPost = await Post.findOne({
      order: [['createdAt', 'DESC']], // sắp xếp giảm dần theo thời gian tạo
    });

    if (!latestPost) return null;

    const createdAt = latestPost.createdAt;

    // Parse sang dd/mm/yyyy
    const day = createdAt.getDate().toString().padStart(2, '0');
    const month = (createdAt.getMonth() + 1).toString().padStart(2, '0'); // tháng bắt đầu từ 0
    const year = createdAt.getFullYear();
    const msg = `Cannot summarize: no posts found since ${day}/${month}/${year}.`;
    history.push({ role: 'assistant', content: msg });
    return msg;
  }

  const topTopic = postCounts[0].mainField;
  const topicCount = postCounts[0].dataValues.count;

  // const posts = await Post.findAll({
  //   where: { mainField: topTopic, createdAt: { [Op.gte]: sinceDate } },
  //   order: [['createdAt', 'DESC']], limit: 10
  // });


   // Build your summarization prompt exactly as before
  const prompt =
    `In 100-150 words, give me a comprehensive and insightful overview of the real-time technology trends and their future outlook. ` +
    `Summarize the top trending topic "${topTopic}" (${topicCount} posts) from the past ${parsed.period}, focusing on its main themes, emerging directions, and potential impact. ` +
    `Do NOT list individual posts. Conclude with a forward-looking statement about the significance or future trajectory of these trends.`;

  // Call your new helper instead of the SQL chain
  const summary = await generateSummary(prompt);

  history.push({ role: 'assistant', content: summary });
  return summary;
}



