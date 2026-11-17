import fs from "fs";

/**
 * Streaming RFC-4180 CSV parser.
 * Constant memory: processes records incrementally from a read stream.
 */
export async function streamCsvRecords(
  filePath: string,
  onRecord: (record: Record<string, string>, rowNumber: number) => Promise<void> | void,
): Promise<number> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8", highWaterMark: 64 * 1024 });

  let headers: string[] | null = null;
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let justClosedQuote = false;
  let isFirstChunk = true;
  let recordCount = 0;
  let rowNumber = 1; // 1 = header

  async function emitRow(fields: string[]): Promise<void> {
    if (fields.length === 1 && fields[0] === "") return;
    if (!headers) {
      headers = fields.map((h) => h.trim());
      return;
    }
    rowNumber += 1;
    recordCount += 1;
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (key) {
        record[key] = fields[i] ?? "";
      }
    }
    await onRecord(record, rowNumber);
  }

  for await (const rawChunk of stream) {
    let chunk = rawChunk as string;
    if (isFirstChunk) {
      isFirstChunk = false;
      if (chunk.charCodeAt(0) === 0xfeff) {
        chunk = chunk.slice(1);
      }
    }

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      if (inQuotes) {
        if (ch === '"') {
          inQuotes = false;
          justClosedQuote = true;
        } else {
          currentField += ch;
        }
        continue;
      }

      if (justClosedQuote) {
        justClosedQuote = false;
        if (ch === '"') {
          currentField += '"';
          inQuotes = true;
          continue;
        }
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (ch === "\r") {
        // Ignore CR; handle LF next
      } else if (ch === "\n") {
        currentRow.push(currentField);
        currentField = "";
        const completed = currentRow;
        currentRow = [];
        await emitRow(completed);
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    await emitRow(currentRow);
  }

  return recordCount;
}
