import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { previewInboxTranslate } from './api'

const AUTO_TRANSLATE_KEY = 'cskh.inbox.autoTranslate'

type ChatMessageInputProps = {
  conversationId: string
  customerLang?: string | null
  customerLangLabel?: string | null
  onSend: (text: string, options?: { autoTranslate?: boolean }) => Promise<void> | void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  draftText?: string
  onDraftApplied?: () => void
}

export function ChatMessageInput({
  conversationId,
  customerLang,
  customerLangLabel,
  onSend,
  onTyping,
  disabled,
  placeholder = 'Gõ tiếng Việt... (Shift+Enter xuống dòng)',
  draftText,
  onDraftApplied,
}: ChatMessageInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [autoTranslate, setAutoTranslate] = useState(() => {
    try {
      return localStorage.getItem(AUTO_TRANSLATE_KEY) !== '0'
    } catch {
      return true
    }
  })
  const [preview, setPreview] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewLangLabel, setPreviewLangLabel] = useState(customerLangLabel || '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewReqRef = useRef(0)

  useEffect(() => {
    if (draftText) {
      setText(draftText)
      onDraftApplied?.()
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.selectionStart = textareaRef.current.value.length
          textareaRef.current.selectionEnd = textareaRef.current.value.length
        }
      }, 50)
    }
  }, [draftText, onDraftApplied])

  const sendingRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_TRANSLATE_KEY, autoTranslate ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [autoTranslate])

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    const trimmed = text.trim()
    if (!autoTranslate || !trimmed || disabled) {
      setPreview('')
      setPreviewLoading(false)
      return
    }
    if (customerLang === 'vi') {
      setPreview('')
      setPreviewLoading(false)
      return
    }

    setPreviewLoading(true)
    const reqId = ++previewReqRef.current
    previewTimerRef.current = setTimeout(async () => {
      try {
        const res = await previewInboxTranslate(
          conversationId,
          trimmed,
          customerLang || undefined
        )
        if (reqId !== previewReqRef.current) return
        setPreviewLangLabel(res.customerLangLabel || res.targetLang || '')
        if (res.sameLanguage || res.translatedText === trimmed) {
          setPreview('')
        } else {
          setPreview(res.translatedText)
        }
      } catch {
        if (reqId === previewReqRef.current) setPreview('')
      } finally {
        if (reqId === previewReqRef.current) setPreviewLoading(false)
      }
    }, 450)

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [text, autoTranslate, conversationId, customerLang, disabled])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    try {
      await onSend(trimmed, { autoTranslate })
      setText('')
      setPreview('')
      textareaRef.current?.focus()
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    if (onTyping) {
      onTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const height = Math.min(textareaRef.current.scrollHeight, 120)
      textareaRef.current.style.height = `${height}px`
    }
  }, [text])

  const langHint = customerLangLabel || customerLang || 'ngôn ngữ khách'

  return (
    <div className="border-t border-slate-100 bg-white">
      {autoTranslate && (preview || previewLoading) && text.trim() && (
        <div className="px-3.5 pt-2.5">
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-600">
            <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
              Gửi đi ({langHint})
            </div>
            {previewLoading && !preview ? (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang dịch…
              </div>
            ) : (
              <div className="leading-relaxed whitespace-pre-wrap">{preview}</div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-3.5 pt-2">
        <label className="flex cursor-pointer items-center gap-1.5 select-none text-[11.5px] text-slate-600">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
            disabled={disabled || sending}
          />
          AI Tự dịch khi gửi
        </label>
        {customerLang && customerLang !== 'vi' && (
          <span className="text-[10.5px] text-slate-400">→ {langHint}</span>
        )}
      </div>

      <div className="flex gap-2 p-3.5 pt-2">
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          rows={1}
          className="resize-none py-2.5 px-4 text-[12.5px] text-slate-700 border border-slate-200/60 bg-slate-50/20 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-100 focus-visible:border-indigo-300 rounded-xl transition-all duration-200 placeholder:text-slate-400 min-h-[38px] max-h-[120px]"
        />
        <Button
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          size="sm"
          className="self-end h-[38px] bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200 text-white rounded-xl shadow-sm shadow-blue-200/40 px-4 cursor-pointer font-semibold"
        >
          {sending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              <span className="hidden sm:inline text-xs">Gửi</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline text-xs">Gửi</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
