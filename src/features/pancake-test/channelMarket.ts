/**
 * Phân loại thị trường kênh Pancake theo tên page + username (heuristic).
 * Không gọi LLM — đủ nhanh cho filter UI.
 */

export type ChannelMarket = 'th' | 'jp' | 'other'

const THAI_SCRIPT = /[\u0E00-\u0E7F]/
const HIRAGANA = /[\u3040-\u309F]/
const KATAKANA = /[\u30A0-\u30FF]/
const CJK = /[\u4E00-\u9FFF]/
const HANGUL = /[\uAC00-\uD7AF]/

/** VN — xếp other (tránh gán Thái vì thợ / thương…) */
const VN_KEYWORDS =
  /thợ|thương hiệu|trang sức|dây chuyền|xưởng|chế tác|vàng bạc|kim hoàn|viễn chí|bảo tín|\bvn\b|vietnam|việt nam/i

/** Username / handle đặc trưng Thái */
const TH_HANDLE =
  /thailand|thailank|_thai\b|jewelerthai|changthong|changphet|_thl\b|huyk0thailand|nambacthai|huyk\.thailand|huyk_thai|huyk\.thailank/i

/** Từ khóa / emoji đặc trưng Thái (không dùng \bth\b — khớp nhầm thợ/thương) */
const TH_KEYWORDS =
  /🇹🇭|thailand|thai\b|thái lan|bạc thái|nam bạc thái|เครื่องประดับ|ช่างทอง|ช่างเพชร|ช่างเครื่อง|ช่างอัญมณี|งานฝีมือ|เรื่องราว|ร้านขาย|รักการทำ|การทำเครื่อง|changthong|jewelcraft|gemcraft|huyksilver|huykchang/i

/** Username / handle đặc trưng Nhật */
const JP_HANDLE = /\.jp\b|_jp\b|japan|shokunin|takumi|chokin|hoseki|ヒユク|nambling\.jp|namjewelry\.jp/i

/** Từ khóa đặc trưng Nhật */
const JP_KEYWORDS =
  /🇯🇵|japan|\bjp\b|nhật|ジュエリー|アクセサリー|手作り|宝飾|飾り|彫金|銀工房|金工|職人|マニア|ヒユク|匠堂|シルバー|仕上げ|銀の手仕事|宝飾工房|宝飾職人|金工師|フイケー|ナムジュエル|Hōshoku|Akusesarī|Takumi/i

/** Malay / Indo / KR / Romance — other */
const OTHER_LOCALE =
  /perak|pengrajin|kerajinan|perhiasan|indonesia|\bid\b|jewerlyindo|tukang emas|bengkel|joyeria|artigiano|orafa|보석|세공|korea|\bkr\b/i

export function detectChannelMarket(
  name: string | null | undefined,
  username?: string | null,
): ChannelMarket {
  const n = (name || '').trim()
  const u = (username || '').trim()
  const blob = [n, u].filter(Boolean).join(' ')
  if (!blob) return 'other'

  // Script rõ ràng trước
  if (THAI_SCRIPT.test(blob) || /🇹🇭/.test(blob)) return 'th'
  if (HIRAGANA.test(blob) || KATAKANA.test(blob)) return 'jp'
  if (HANGUL.test(blob)) return 'other'

  // Handle / locale rõ
  if (TH_HANDLE.test(blob) || TH_KEYWORDS.test(blob)) return 'th'
  if (JP_HANDLE.test(blob) || JP_KEYWORDS.test(blob)) return 'jp'

  if (VN_KEYWORDS.test(blob)) return 'other'
  if (OTHER_LOCALE.test(blob)) return 'other'

  // Kanji không có marker JP/TH → other (trừ brand JP đã biết)
  if (CJK.test(blob)) {
    if (/宝飾|銀飾|金工|職人|工房/.test(blob)) return 'jp'
    return 'other'
  }

  // English HuyK/NamBling jewelry không có marker → other (không mặc định Thái)
  return 'other'
}

export function marketLabel(market: ChannelMarket): string {
  if (market === 'th') return 'Thái'
  if (market === 'jp') return 'Nhật'
  return 'Khác'
}

export function marketBadgeClass(market: ChannelMarket): string {
  if (market === 'th') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300'
  }
  if (market === 'jp') {
    return 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300'
  }
  return 'border-border bg-muted text-n-500'
}
