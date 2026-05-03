'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { IconCheck, IconX, IconClock } from '@/components/ui/Icons'

export interface TriviaQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  timeLimit: number
}

type AnswerState = 'idle' | 'correct' | 'wrong' | 'timeout'

interface TriviaPanelProps {
  question: TriviaQuestion
  onAnswer: (index: number) => void
  onTimeout?: () => void
  disabled?: boolean
  className?: string
}

const difficultyBadge = {
  easy:   'success' as const,
  medium: 'warning' as const,
  hard:   'danger'  as const,
}

// ─── Sub-component: single option button ─────────────────────────
interface OptionButtonProps {
  index: number
  option: string
  isSelected: boolean
  isCorrect: boolean
  showResult: boolean
  disabled: boolean
  answerState: AnswerState
  activationKey: number
  onClick: () => void
}

function OptionButton({
  index, option, isSelected, isCorrect, showResult, disabled,
  answerState, activationKey, onClick,
}: OptionButtonProps) {
  const controls = useAnimation()
  const isWrongSelected = isSelected && !isCorrect && showResult
  const isCorrectSelected = isSelected && isCorrect && showResult

  // Stagger entrance animation when panel activates (disabled → enabled)
  useEffect(() => {
    if (activationKey > 0) {
      controls.set({ opacity: 0, x: -10 })
      controls.start({
        opacity: 1,
        x: 0,
        transition: {
          delay: index * 0.045,
          type: 'spring',
          stiffness: 380,
          damping: 28,
        },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activationKey])

  // Shake animation for wrong answer
  useEffect(() => {
    if (isWrongSelected) {
      controls.start({
        x: [0, -9, 9, -6, 6, -3, 3, 0],
        transition: { duration: 0.45, ease: 'easeInOut' },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWrongSelected])

  // Pulse animation for correct answer
  useEffect(() => {
    if (isCorrectSelected) {
      controls.start({
        scale: [1, 1.025, 0.99, 1],
        transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCorrectSelected])

  let optionStyle: string
  if (showResult) {
    if (isCorrect)       optionStyle = 'bg-success/10 border-success/50 text-success'
    else if (isSelected) optionStyle = 'bg-danger/10 border-danger/50 text-danger'
    else                 optionStyle = 'bg-white/[0.02] border-white/[0.04] text-text-muted opacity-35'
  } else if (disabled) {
    optionStyle = 'bg-white/[0.02] border-white/[0.05] text-text-muted'
  } else {
    optionStyle = [
      'bg-white/[0.03] border-white/[0.07] text-text-secondary',
      'hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-text-primary',
    ].join(' ')
  }

  return (
    <motion.button
      animate={controls}
      onClick={onClick}
      disabled={disabled || showResult || answerState === 'timeout'}
      whileHover={!disabled && !showResult ? { x: 3 } : {}}
      whileTap={!disabled && !showResult ? { scale: 0.985 } : {}}
      className={cn(
        'w-full text-left px-4 py-3 rounded-xl border text-sm font-body',
        'transition-colors duration-200 flex items-center gap-3',
        'disabled:cursor-not-allowed',
        optionStyle,
      )}
    >
      <span className={cn(
        'w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-mono font-semibold shrink-0 transition-all duration-200',
        showResult && isCorrect   ? 'bg-success/20 border-success/50 text-success' :
        showResult && isSelected  ? 'bg-danger/20  border-danger/50  text-danger' :
        'bg-white/[0.04] border-white/[0.10] text-text-muted',
      )}>
        {String.fromCharCode(65 + index)}
      </span>

      <span className="flex-1 leading-snug">{option}</span>

      <AnimatePresence>
        {showResult && isCorrect && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 440, damping: 18 }}
            className="ml-auto text-success shrink-0"
          >
            <IconCheck className="w-4 h-4" />
          </motion.span>
        )}
        {showResult && isWrongSelected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 440, damping: 18 }}
            className="ml-auto text-danger shrink-0"
          >
            <IconX className="w-4 h-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Main component ───────────────────────────────────────────────
export function TriviaPanel({
  question, onAnswer, onTimeout, disabled = false, className,
}: TriviaPanelProps) {
  const [selected, setSelected]      = useState<number | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [timeLeft, setTimeLeft]      = useState(question.timeLimit)
  const [activationKey, setActivationKey] = useState(0)
  const prevDisabled = useRef(disabled)

  // Detect transition from disabled → enabled (cell selected)
  useEffect(() => {
    if (prevDisabled.current && !disabled) {
      setActivationKey(k => k + 1)
    }
    prevDisabled.current = disabled
  }, [disabled])

  const handleAnswer = useCallback((index: number) => {
    if (selected !== null || disabled) return
    setSelected(index)
    const correct = index === question.correctIndex
    setAnswerState(correct ? 'correct' : 'wrong')
    onAnswer(index)
  }, [selected, disabled, question.correctIndex, onAnswer])

  // Reset on question change
  useEffect(() => {
    setSelected(null)
    setAnswerState('idle')
    setTimeLeft(question.timeLimit)
  }, [question.id, question.timeLimit])

  // Timer — only counts when active (not disabled, not answered)
  useEffect(() => {
    if (answerState !== 'idle' || disabled) return
    if (timeLeft <= 0) { setAnswerState('timeout'); onTimeout?.(); return }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, answerState, disabled, onTimeout])

  const progress  = (timeLeft / question.timeLimit) * 100
  const isUrgent  = timeLeft <= 8 && answerState === 'idle' && !disabled
  const timerBar  = progress > 50 ? 'bg-success' : progress > 20 ? 'bg-warning' : 'bg-danger'

  return (
    <motion.div
      animate={{
        boxShadow: isUrgent
          ? '0 0 0 2px rgba(239,68,68,0.22), 0 0 32px rgba(239,68,68,0.08)'
          : !disabled && answerState === 'idle'
          ? '0 0 0 1.5px rgba(124,58,237,0.28), 0 0 28px rgba(124,58,237,0.07)'
          : '0 0 0 0 rgba(0,0,0,0)',
      }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex flex-col gap-4 rounded-2xl', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge variant={difficultyBadge[question.difficulty]}>{question.difficulty}</Badge>
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
          {question.category}
        </span>
      </div>

      {/* Timer */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-text-muted">
            <IconClock className="w-3 h-3" />
            <span>Time remaining</span>
          </div>
          <motion.span
            key={disabled ? 'locked' : timeLeft}
            initial={{ scale: timeLeft <= 5 && !disabled ? 1.3 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className={cn(
              'font-semibold tabular-nums',
              disabled        ? 'text-text-muted' :
              timeLeft <= 5   ? 'text-danger' :
              timeLeft <= 10  ? 'text-warning' : 'text-text-secondary',
            )}
          >
            {disabled ? '—' : `${timeLeft}s`}
          </motion.span>
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full transition-colors duration-500',
              disabled ? 'bg-white/[0.14]' : timerBar,
            )}
            animate={{ width: disabled ? '100%' : `${progress}%` }}
            transition={{ duration: disabled ? 0.4 : 1, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Question */}
      <div className={cn(
        'bg-white/[0.03] rounded-xl p-4 border border-white/[0.07]',
        'transition-opacity duration-300',
        disabled && answerState === 'idle' ? 'opacity-65' : 'opacity-100',
      )}>
        <p className="font-body leading-relaxed text-sm md:text-base text-text-primary">
          {question.question}
        </p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-2">
        {question.options.map((option, index) => (
          <OptionButton
            key={index}
            index={index}
            option={option}
            isSelected={selected === index}
            isCorrect={index === question.correctIndex}
            showResult={answerState !== 'idle'}
            disabled={disabled}
            answerState={answerState}
            activationKey={activationKey}
            onClick={() => handleAnswer(index)}
          />
        ))}
      </div>

      {/* Bottom status */}
      <AnimatePresence mode="wait">
        {disabled && answerState === 'idle' ? (
          <motion.div
            key="select-cell"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
            />
            <p className="text-xs font-mono text-text-muted">
              Tap a cell on the board to unlock
            </p>
          </motion.div>
        ) : answerState !== 'idle' ? (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            className={cn(
              'text-center py-3 px-4 rounded-xl font-display font-semibold text-sm border',
              'flex items-center justify-center gap-2',
              answerState === 'correct' && 'bg-success/10 border-success/30 text-success',
              answerState === 'wrong'   && 'bg-danger/10  border-danger/30  text-danger',
              answerState === 'timeout' && 'bg-warning/10 border-warning/30 text-warning',
            )}
          >
            {answerState === 'correct' && <><IconCheck className="w-4 h-4" /> Correct! Move placed.</>}
            {answerState === 'wrong'   && <><IconX className="w-4 h-4" /> Wrong answer. Turn lost.</>}
            {answerState === 'timeout' && <><IconClock className="w-4 h-4" /> Time&apos;s up! Forfeited.</>}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
