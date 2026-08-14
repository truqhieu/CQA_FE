import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'

type ChatMessageInputProps = {
  onSend: (text: string) => Promise<void> | void
  onTyping?: () => void
  disabled?: boolean
  placeholder?: string
  draftText?: string
  onDraftApplied?: () => void
}

export function ChatMessageInput({
  onSend,
  onTyping,
  disabled,
  placeholder = 'Gõ tin nhắn... (Shift+Enter để xuống dòng)',
  draftText,
  onDraftApplied,
}: ChatMessageInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<any>(null)

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

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || sendingRef.current) return

    sendingRef.current = true
    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
      // Auto-focus after sending
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

    // Notify typing
    if (onTyping) {
      onTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const height = Math.min(textareaRef.current.scrollHeight, 120)
      textareaRef.current.style.height = `${height}px`
    }
  }, [text])

  return (
    <div className="flex gap-2 p-3.5 border-t border-slate-100 bg-white">
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
  )
}
