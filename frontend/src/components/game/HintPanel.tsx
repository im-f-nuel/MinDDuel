'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { HINTS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  IconScissors, IconTag, IconTimerPlus, IconType, IconSkipForward,
} from '@/components/ui/Icons'
import type { ComponentType } from 'react'

interface HintPanelProps {
  usedHints: string[]
  onUseHint: (hintId: string) => Promise<void>
  disabled?: boolean
  className?: string
}

const hintIconMap: Record<string, ComponentType<{ className?: string }>> = {
  scissors: IconScissors,
  tag: IconTag,
  'timer-plus': IconTimerPlus,
  type: IconType,
  skip: IconSkipForward,
}

export function HintPanel({ usedHints, onUseHint, disabled = false, className }: HintPanelProps) {
  const [confirmHint, setConfirmHint] = useState<typeof HINTS[number] | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)

  async function handleConfirm() {
    if (!confirmHint) return
    setPurchasing(confirmHint.id)
    setConfirmHint(null)
    try {
      await onUseHint(confirmHint.id)
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">
          Hints · SOL
        </p>
        {HINTS.map(hint => {
          const used = usedHints.includes(hint.id)
          const loading = purchasing === hint.id
          const HintIcon = hintIconMap[hint.iconId]

          return (
            <motion.button
              key={hint.id}
              onClick={() => !used && !disabled && !loading && setConfirmHint(hint)}
              disabled={used || disabled}
              whileHover={!used && !disabled ? { x: 2 } : {}}
              whileTap={!used && !disabled ? { scale: 0.98 } : {}}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left',
                'transition-all duration-200 text-sm',
                used
                  ? 'bg-white/[0.02] border-white/[0.04] opacity-35 cursor-not-allowed'
                  : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] cursor-pointer',
              )}
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                {HintIcon && <HintIcon className={cn('w-4 h-4', used ? 'text-text-muted' : 'text-accent/70')} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-display font-semibold text-xs', used ? 'text-text-muted' : 'text-text-primary')}>
                  {hint.label}
                </p>
                <p className="text-text-muted text-xs truncate">{hint.description}</p>
              </div>
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-accent/40 border-t-accent rounded-full animate-spin shrink-0" />
              ) : used ? (
                <span className="text-text-muted text-xs font-mono shrink-0">used</span>
              ) : (
                <span className="font-mono text-accent text-xs font-medium shrink-0">
                  {hint.price} SOL
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {confirmHint && (
          <Modal
            open={confirmHint !== null}
            onClose={() => setConfirmHint(null)}
            title="Use Hint"
          >
            <div className="space-y-4">
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.07] text-center">
                {hintIconMap[confirmHint.iconId] && (
                  <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-3">
                    {(() => {
                      const ConfirmIcon = hintIconMap[confirmHint.iconId]
                      return <ConfirmIcon className="w-6 h-6 text-accent" />
                    })()}
                  </div>
                )}
                <p className="font-display font-bold text-text-primary">{confirmHint.label}</p>
                <p className="text-text-secondary text-sm mt-1">{confirmHint.description}</p>
              </div>
              <div className="flex items-center justify-between py-3 border-y border-white/[0.06]">
                <span className="text-text-secondary text-sm">Cost</span>
                <span className="font-mono font-semibold text-accent">{confirmHint.price} SOL</span>
              </div>
              <p className="text-xs text-text-muted text-center">
                This will trigger an on-chain transaction from your wallet.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" fullWidth onClick={() => setConfirmHint(null)}>
                  Cancel
                </Button>
                <Button variant="accent" fullWidth onClick={handleConfirm}>
                  Confirm Purchase
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}
