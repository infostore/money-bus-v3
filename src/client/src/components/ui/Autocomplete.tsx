// PRD-FEAT-014: Autocomplete input for product selection
import * as React from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '../../lib/utils'

interface AutocompleteOption {
  readonly value: string
  readonly label: string
  readonly sub?: string
}

interface AutocompleteProps {
  readonly options: readonly AutocompleteOption[]
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly className?: string
}

const Autocomplete = React.forwardRef<HTMLDivElement, AutocompleteProps>(
  ({ options, value, onChange, placeholder = '검색', disabled, className }, ref) => {
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [highlightIndex, setHighlightIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)

    const selectedOption = options.find((o) => o.value === value)

    const filtered = useMemo(() => {
      if (!query) return options
      const lower = query.toLowerCase()
      return options.filter(
        (o) =>
          o.label.toLowerCase().includes(lower) ||
          (o.sub && o.sub.toLowerCase().includes(lower)),
      )
    }, [options, query])

    useEffect(() => {
      setHighlightIndex(-1)
    }, [filtered])

    // Scroll highlighted item into view
    useEffect(() => {
      if (highlightIndex >= 0 && listRef.current) {
        const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
        item?.scrollIntoView({ block: 'nearest' })
      }
    }, [highlightIndex])

    const handleSelect = (optionValue: string) => {
      onChange(optionValue)
      setQuery('')
      setIsOpen(false)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      if (!isOpen) setIsOpen(true)
      // Clear selection when typing
      if (value) onChange('')
    }

    const handleFocus = () => {
      setIsOpen(true)
      setQuery('')
    }

    const handleBlur = () => {
      // Delay to allow click on option
      setTimeout(() => setIsOpen(false), 200)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setIsOpen(true)
          e.preventDefault()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (highlightIndex >= 0 && filtered[highlightIndex]) {
            handleSelect(filtered[highlightIndex].value)
          }
          break
        case 'Escape':
          setIsOpen(false)
          setQuery('')
          break
      }
    }

    const displayValue = isOpen ? query : (selectedOption?.label ?? '')

    return (
      <div ref={ref} className={cn('relative', className)}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex h-10 w-full rounded-xl border border-white/[0.08] bg-surface-950/60 backdrop-blur-md px-3 py-2 text-sm text-surface-200 ring-offset-surface-900 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40 focus:bg-surface-950/80 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
        />

        {isOpen && filtered.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-white/[0.08] bg-surface-900/95 backdrop-blur-xl shadow-glass"
            role="listbox"
          >
            {filtered.map((option, i) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm transition-colors',
                  i === highlightIndex
                    ? 'bg-primary-500/15 text-surface-100'
                    : 'text-surface-300 hover:bg-white/[0.04]',
                  option.value === value && 'font-medium text-primary-400',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSelect(option.value)
                }}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <div>{option.label}</div>
                {option.sub && (
                  <div className="text-xs text-surface-500">{option.sub}</div>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOpen && filtered.length === 0 && query && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/[0.08] bg-surface-900/95 backdrop-blur-xl px-3 py-3 text-sm text-surface-500 shadow-glass">
            검색 결과가 없습니다
          </div>
        )}
      </div>
    )
  },
)
Autocomplete.displayName = 'Autocomplete'

export { Autocomplete }
export type { AutocompleteProps, AutocompleteOption }
