export type ParsedAssistantReply = {
  body: string
  options: string[]
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^---+\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\*)([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const LEAK_LINE =
  /(sop|checklist|quy\s*tắc|bước\s*\d+|bước vàng|bước bắt buộc|đúng chuẩn|theo quy tắc|nhận xét nhanh|lý do theo|tài liệu nội bộ)/i

function stripInternalJargon(text: string): string {
  return text
    .split('\n')
    .filter((line) => !LEAK_LINE.test(line) && !/^\s*[✅⚠️✔✘]/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanDraft(text: string): string {
  return stripMarkdown(text)
    .replace(/^(cách\s*\d+|phương án\s*\d+|gợi ý\s*\d+)[:.\-–]?\s*/i, '')
    .replace(/^["«»“”]+|["«»“”]+$/g, '')
    .trim()
}

function optionsFromMarkers(raw: string): { body: string; options: string[] } | null {
  const parts = raw.split(/<<\s*OPTION\s*>>/i)
  if (parts.length < 3) return null
  const body = stripMarkdown(parts[0] || '')
  const options = parts
    .slice(1)
    .map(cleanDraft)
    .filter((t) => t.length >= 8)
    .slice(0, 2)
  if (options.length < 2) return null
  return { body, options }
}

function optionsFromCachBlocks(raw: string): string[] {
  const chunks = raw.split(/(?=Cách\s*[12]\b)/i)
  const found: string[] = []
  for (const chunk of chunks) {
    const m = chunk.match(/^Cách\s*[12]\s*[:.\-–]?\s*([\s\S]+)/i)
    if (!m) continue
    const quoted = m[1].match(/[“"]([\s\S]*?)[”"]/)
    found.push(cleanDraft(quoted?.[1] || m[1]))
  }
  return found.filter((t) => t.length >= 8).slice(0, 2)
}

export function parseAssistantReply(raw: string): ParsedAssistantReply {
  const marked = optionsFromMarkers(raw)
  if (marked) {
    return { body: stripInternalJargon(marked.body), options: marked.options }
  }

  const cach = optionsFromCachBlocks(raw)
  if (cach.length >= 2) {
    const body = stripInternalJargon(stripMarkdown(raw.replace(/Cách\s*1[\s\S]*/i, '')))
    return { body, options: cach }
  }

  return { body: stripInternalJargon(stripMarkdown(raw)), options: [] }
}
