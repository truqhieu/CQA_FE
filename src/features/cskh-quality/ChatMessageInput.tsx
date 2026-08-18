import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { previewInboxTranslate } from './api'

const ASSIST_TRANSLATE_KEY = 'cskh.inbox.autoTranslate'

type ChatMessageInputProps = {
  conversationId: string
  customerLang?: string | null
  customerLangLabel?: string | null
  onSend: (
    text: string,
    options?: { autoTranslate?: boolean; originalText?: string },
  ) => Promise<void> | void
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
  const [assistTranslate, setAssistTranslate] = useState(() => {
    try {
      return localStorage.getItem(ASSIST_TRANSLATE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [preview, setPreview] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewReqRef = useRef(0)
  const previewEditedRef = useRef(false)
  const sendingRef = useRef(false)

  useEffect(() => {
    if (draftText) {
      setText(draftText)
      previewEditedRef.current = false
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

  useEffect(() => {
    try {
      localStorage.setItem(ASSIST_TRANSLATE_KEY, assistTranslate ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [assistTranslate])

  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    const trimmed = text.trim()
    if (!assistTranslate || !trimmed || disabled) {
      setPreview('')
      setPreviewLoading(false)
      previewEditedRef.current = false
      return
    }

    previewEditedRef.current = false
    setPreviewLoading(true)
    const reqId = ++previewReqRef.current
    previewTimerRef.current = setTimeout(async () => {
      try {
        const res = await previewInboxTranslate(conversationId, trimmed, 'vi')
        if (reqId !== previewReqRef.current) return
        const next = (res.translatedText || trimmed).trim()
        setPreview(next || trimmed)
      } catch {
        if (reqId === previewReqRef.current) setPreview(trimmed)
      } finally {
        if (reqId === previewReqRef.current) setPreviewLoading(false)
      }
    }, 400)

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [text, assistTranslate, conversationId, disabled])

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || sendingRef.current) return
    if (assistTranslate && previewLoading) return

    const outbound = assistTranslate && preview.trim() ? preview.trim() : trimmed

    sendingRef.current = true
    setSending(true)
    try {
      await onSend(outbound, { autoTranslate: false })
      setText('')
      setPreview('')
      previewEditedRef.current = false
      textareaRef.current?.focus()
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
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

  return (
    <div className="border-t border-slate-100 bg-white">
      {assistTranslate && text.trim() && (
        <div className="px-3.5 pt-2.5">
          <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/60 px-3 py-2">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-indigo-500">
              Bản dịch (Tiếng Việt) — kiểm tra rồi gửi
            </div>
            {previewLoading && !preview ? (
              <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang dịch…
              </div>
            ) : (
              <textarea
                value={preview}
                onChange={(e) => {
                  previewEditedRef.current = true
                  setPreview(e.target.value)
                }}
                rows={2}
                className="w-full resize-none rounded-md border border-indigo-100 bg-white px-2 py-1.5 text-[12.5px] leading-relaxed text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200"
              />
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-3.5 pt-2">
        <label className="flex cursor-pointer items-center gap-1.5 select-none text-[11.5px] text-slate-600">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
            checked={assistTranslate}
            onChange={(e) => setAssistTranslate(e.target.checked)}
            disabled={disabled || sending}
          />
          AI hỗ trợ dịch
        </label>
        {assistTranslate && (
          <span className="text-[10.5px] text-slate-400">Xem bản dịch rồi mới gửi</span>
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
          onClick={() => void handleSend()}
          disabled={!text.trim() || sending || disabled || (assistTranslate && previewLoading)}
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
