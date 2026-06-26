// PDF text extraction via pdfjs-dist (no native dependencies).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PageText {
  page: number;
  text: string;
}

export async function extractPdf(data: Uint8Array): Promise<PageText[]> {
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Reconstruct lines: insert a newline when the y-position drops.
    let text = "";
    let lastY: number | null = null;
    for (const item of content.items as any[]) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 3) text += "\n";
      else if (text && !text.endsWith(" ") && !text.endsWith("\n")) text += " ";
      text += item.str;
      lastY = y;
    }
    pages.push({ page: p, text: text.replace(/[ \t]+/g, " ").trim() });
  }
  return pages;
}
