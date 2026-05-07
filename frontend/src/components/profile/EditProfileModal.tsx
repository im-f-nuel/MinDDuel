'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const INK = '#1D1D1F'
const MUTED = '#6E6E73'
const BLUE = '#0071E3'
const RED = '#FF3B30'

export interface EditableProfile {
  displayName: string
  bio: string
  avatarSeed: string
}

interface Props {
  open: boolean
  initial: EditableProfile
  defaultSeed: string
  onClose: () => void
  onSave: (next: EditableProfile) => void
}

const NAME_MAX = 24
const BIO_MAX = 140

export function EditProfileModal({ open, initial, defaultSeed, onClose, onSave }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [bio, setBio] = useState(initial.bio)
  const [avatarSeed, setAvatarSeed] = useState(initial.avatarSeed)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDisplayName(initial.displayName)
      setBio(initial.bio)
      setAvatarSeed(initial.avatarSeed)
      setError('')
    }
  }, [open, initial])

  function handleSave() {
    const trimmedName = displayName.trim()
    if (trimmedName.length > NAME_MAX) {
      setError(`Display name must be ${NAME_MAX} characters or fewer.`)
      return
    }
    if (bio.length > BIO_MAX) {
      setError(`Bio must be ${BIO_MAX} characters or fewer.`)
      return
    }
    onSave({
      displayName: trimmedName,
      bio: bio.trim(),
      avatarSeed: avatarSeed.trim() || defaultSeed,
    })
  }

  function handleResetSeed() {
    setAvatarSeed(defaultSeed)
  }

  function handleRandomSeed() {
    setAvatarSeed(Math.random().toString(36).slice(2, 12))
  }

  const inputStyle: React.CSSProperties = {
    appearance: 'none', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 10,
    padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', color: INK,
    background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box',
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 100 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="edit-profile-modal"
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 'min(92vw, 460px)',
              maxHeight: '92vh', overflowY: 'auto',
              background: '#fff', borderRadius: 22,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 101,
              padding: 28,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 id="edit-profile-title" style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: INK }}>
                Edit Profile
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ appearance: 'none', border: 'none', background: '#F5F5F7', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontFamily: 'inherit' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Display name */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 6 }}>
                  Display name
                  <span style={{ fontWeight: 400, color: MUTED, marginLeft: 8 }}>
                    {displayName.length}/{NAME_MAX}
                  </span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value.slice(0, NAME_MAX))}
                  placeholder="e.g. SolanaPhantom"
                  maxLength={NAME_MAX}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = BLUE)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.08)')}
                />
              </div>

              {/* Bio */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 6 }}>
                  Bio
                  <span style={{ fontWeight: 400, color: MUTED, marginLeft: 8 }}>
                    {bio.length}/{BIO_MAX}
                  </span>
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, BIO_MAX))}
                  placeholder="Trivia king. Bluff master. Send it."
                  maxLength={BIO_MAX}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 70, lineHeight: 1.5 }}
                  onFocus={e => (e.target.style.borderColor = BLUE)}
                  onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.08)')}
                />
              </div>

              {/* Avatar seed */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 6 }}>
                  Avatar seed
                  <span style={{ fontWeight: 400, color: MUTED, marginLeft: 8 }}>
                    Changes the identicon pattern
                  </span>
                </label>
                <div className="seed-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={avatarSeed}
                    onChange={e => setAvatarSeed(e.target.value.slice(0, 32))}
                    placeholder={defaultSeed}
                    style={{ ...inputStyle, flex: '1 1 100%', minWidth: 0 }}
                    onFocus={e => (e.target.style.borderColor = BLUE)}
                    onBlur={e => (e.target.style.borderColor = 'rgba(0,0,0,0.08)')}
                  />
                  <button
                    type="button"
                    onClick={handleRandomSeed}
                    style={{ appearance: 'none', border: '1.5px solid rgba(0,0,0,0.08)', background: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: INK, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flex: '1 1 auto' }}
                    title="Generate random seed"
                  >
                    🎲 Random
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSeed}
                    style={{ appearance: 'none', border: '1.5px solid rgba(0,0,0,0.08)', background: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: MUTED, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flex: '1 1 auto' }}
                    title="Reset to wallet default"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {error && (
                <p style={{ margin: 0, fontSize: 12.5, color: RED, fontWeight: 500 }}>{error}</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button
                onClick={onClose}
                style={{ appearance: 'none', border: '1.5px solid rgba(0,0,0,0.10)', background: '#fff', color: INK, padding: '10px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{ appearance: 'none', border: 'none', background: BLUE, color: '#fff', padding: '10px 22px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,113,227,0.25)' }}
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
