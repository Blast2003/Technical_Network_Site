// src/controllers/datasetTestController.js
import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { analyzeToxicityLevel } from "../services/aiToxicity.js";

/**
 * Robust, simple per-row writer:
 * - counts rows
 * - processes rows sequentially
 * - writes each processed row immediately (append)
 * - uses simple cache to avoid duplicate LLM calls
 *
 * Body JSON options:
 * {
 *   datasetPath: "./data/train.csv",
 *   textColumn: null,         // auto-detect if null
 *   limit: 100,               // null => all rows
 *   start: 0,
 *   useLocalModel: true,      // used inside analyzeToxicityLevel (keeps signature)
 *   timeoutMs: 6000
 * }
 */
export async function testDataset(req, res) {
  const {
    datasetPath = path.resolve(process.cwd(), "data", "train.csv"),
    textColumn = null,
    limit = 2000,
    start = 0,
    useLocalModel = true,
    timeoutMs = 60000,
  } = req.body || {};

  if (!fs.existsSync(datasetPath)) {
    return res.status(400).json({ error: "datasetPath not found", datasetPath });
  }

  // 1) Count rows
  let totalRows = 0;
  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(datasetPath)
        .pipe(csvParser())
        .on("data", () => { totalRows += 1; })
        .on("end", resolve)
        .on("error", reject);
    });
  } catch (err) {
    return res.status(500).json({ error: "failed-counting-csv-rows", details: err.message });
  }

  // prepare output file
  const timestamp = Date.now();
  const outDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `processed_results_${timestamp}.csv`);

  // cache LLM results by exact text
  const cache = new Map();

  // helper: call analyzer with a couple retries and cache
  async function callAnalyzer(text) {
    const key = String(text || "");
    if (cache.has(key)) return cache.get(key);

    const MAX_ATTEMPTS = 3;
    let attempt = 0;
    let lastErr = null;
    while (attempt < MAX_ATTEMPTS) {
      attempt += 1;
      try {
        // analyzeToxicityLevel should itself be resilient (fallback heuristic)
        const res = await analyzeToxicityLevel(text, {}, timeoutMs);
        const out = { level: res.level || 0, explanation: res.explanation || "no-explanation" };
        cache.set(key, out);
        return out;
      } catch (e) {
        lastErr = e;
        const wait = Math.min(2000 * attempt, 5000);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    console.warn("Analyzer failed after retries; falling back to neutral result:", lastErr && lastErr.message);
    const fallback = { level: 0, explanation: "ai-check-failed-or-unclear" };
    cache.set(key, fallback);
    return fallback;
  }

  // We'll create the CSV writer once we know the output headers.
  let csvWriter = null;
  let headerOrder = null;

  const resultsToReturn = []; // keep up to `limit` entries to return in response
  let idx = -1;
  let processed = 0;
  let detectedTextKey = textColumn; // may be discovered on first row

  // process stream
  try {
    const stream = fs.createReadStream(datasetPath).pipe(csvParser());
    let endedEarly = false;

    await new Promise((resolve, reject) => {
      stream.on("data", async (row) => {
        stream.pause();
        idx += 1;

        try {
          // skip until start index
          if (idx < start) {
            stream.resume();
            return;
          }

          // if limit is set and we've processed enough, stop the stream cleanly
          if (limit && processed >= limit) {
            endedEarly = true;
            stream.destroy(); // will trigger 'close' or 'end' depending on stream impl
            stream.resume();
            return;
          }

          // detect text column if needed
          if (!detectedTextKey) {
            const keys = Object.keys(row);
            detectedTextKey = keys.find(k => /comment|text|message/i.test(k)) || keys[0];
          }

          const comment_text = String(row[detectedTextKey] || "");

          // call analyzer (cached)
          const aiRes = await callAnalyzer(comment_text);
          const level = (typeof aiRes.level === "number") ? aiRes.level : 0;
          const explanation = aiRes.explanation || "no-explanation";
          const is_toxic_system = level === 1 ? 1 : 0;

          // prepare outRow: keep original columns and add new ones
          const outRow = { ...row, level, explanation, is_toxic_system };

          // initialize csv writer (header) on first processed row
          if (!csvWriter) {
            headerOrder = Object.keys(outRow);
            csvWriter = createObjectCsvWriter({
              path: outFile,
              header: headerOrder.map(h => ({ id: h, title: h })),
              append: false
            });
            // write header + this first row
            await csvWriter.writeRecords([outRow]);
          } else {
            // append this single row - create an append writer with same header order
            const appendWriter = createObjectCsvWriter({
              path: outFile,
              header: headerOrder.map(h => ({ id: h, title: h })),
              append: true
            });
            await appendWriter.writeRecords([outRow]);
          }

          // save to resultsToReturn if within return limit
          if (resultsToReturn.length < (limit || Infinity)) resultsToReturn.push(outRow);

          processed += 1;
          // progress log every 50 rows
          if (processed % 50 === 0) console.log(`Processed ${processed} rows...`);
        } catch (rowErr) {
          console.error("Error processing row", idx, rowErr && rowErr.message ? rowErr.message : rowErr);
        } finally {
          stream.resume();
        }
      });

      stream.on("end", () => {
        resolve();
      });
      stream.on("close", () => {
        // when we call stream.destroy() for early stop, 'close' may fire
        resolve();
      });
      stream.on("error", (err) => {
        reject(err);
      });
    });

    return res.json({
      datasetPath,
      totalRows,
      processed,
      start,
      limit,
      processedFile: outFile,
      results: resultsToReturn
    });
  } catch (err) {
    console.error("processing failure:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "processing-csv-failed", details: String(err) });
  }
}
