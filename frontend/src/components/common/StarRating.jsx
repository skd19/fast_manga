import { Star } from 'lucide-react'
import clsx from 'clsx'

export default function StarRating({ value, onChange, readonly = false, size = 20 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          className={clsx(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
          )}
        >
          <Star
            size={size}
            className={clsx(
              'transition-colors',
              star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600',
            )}
          />
        </button>
      ))}
    </div>
  )
}
