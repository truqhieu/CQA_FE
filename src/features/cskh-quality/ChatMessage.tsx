import { Check, CheckCheck, Loader2, AlertCircle } from 'lucide-react'
import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { CskhInboxMessage } from './api'
import { cskhMediaProxySrc } from './messageMedia'

type ChatMessageProps = {
  message: CskhInboxMessage
  isOwn: boolean
}

export const ChatMessage = memo(function ChatMessage({ message, isOwn }: ChatMessageProps) {
  const statusIcon =
    message.status === 'pending' ? (
      <Loader2 className="w-3 h-3 animate-spin" />
    ) : message.status === 'sent' ? (
      <Check className="w-3 h-3" />
    ) : message.status === 'read' ? (
      <CheckCheck className="w-3 h-3 text-blue-100" />
    ) : message.status === 'failed' ? (
      <span title="Gửi lỗi">
        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      </span>
    ) : null

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const viText = (message.originalText || message.translatedText || '').trim()
  const showVi =
    Boolean(viText) &&
    viText !== (message.text || '').trim() &&
    (message.messageType === 'text' || !message.messageType)

  const renderContent = () => {
    if (!message.text && !message.attachmentUrl) {
      return <p className="text-sm italic text-gray-500">[Tin nhắn không hỗ trợ]</p>
    }

    if (message.messageType === 'image' || message.messageType === 'video') {
      return message.attachmentUrl ? (
        <img
          src={cskhMediaProxySrc(message.attachmentUrl)}
          alt="attachment"
          className="max-w-xs rounded max-h-96 object-cover"
          loading="lazy"
        />
      ) : (
        <p className="text-sm italic">{message.messageType === 'video' ? '[Video]' : '[Ảnh]'}</p>
      )
    }

    if (message.messageType === 'sticker') {
      return message.attachmentUrl ? (
        <img
          src={cskhMediaProxySrc(message.attachmentUrl)}
          alt="sticker"
          className="max-w-xs"
          loading="lazy"
        />
      ) : (
        <p className="text-sm">[Sticker]</p>
      )
    }

    return (
      <div className="text-sm leading-relaxed break-words space-y-1.5">
        <div>{message.text || <span className="italic text-gray-500">[Tin nhắn trống]</span>}</div>
        {showVi && (
          <div
            className={cn(
              'text-[11.5px] leading-snug border-t pt-1.5',
              isOwn ? 'border-white/25 text-blue-50/90' : 'border-gray-200 text-slate-500'
            )}
          >
            <span className={cn('font-medium', isOwn ? 'text-blue-50' : 'text-slate-600')}>
              {isOwn ? 'Tiếng Việt: ' : 'Dịch: '}
            </span>
            {viText}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex mb-3 gap-2',
        isOwn ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-xs px-4 py-2 rounded-lg shadow-md',
          isOwn
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-none shadow-blue-200/50'
            : 'bg-gray-100 text-gray-900 rounded-bl-none border border-gray-200 shadow-gray-100/50'
        )}
      >
        {renderContent()}

        <div
          className={cn(
            'text-xs mt-1 flex items-center justify-end gap-1',
            isOwn ? 'text-blue-100' : 'text-gray-500'
          )}
        >
          <span>{formatTime(message.sentAt)}</span>
          {isOwn && statusIcon}
        </div>
      </div>
    </div>
  )
})
