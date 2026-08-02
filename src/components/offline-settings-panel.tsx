'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VideoCategoryFilters } from '@/components/video-category-filters'
import { useTvAutoFocus } from '@/hooks/use-tv-focus'
import { titleFromFileName } from '@/lib/local-video-catalog'
import type { OfflineAppSettings } from '@/lib/offline-app-settings'
import { cn } from '@/lib/utils'
import {
  createEmptyVideoCategoryFilters,
  filterItemsByVideoCategory,
  getVideoCategoryMeta,
} from '@/lib/video-categories'
import type { LocalVideoFile } from '@/plugins/local-videos/definitions'
import type { VideoCategoryFiltersState } from '@/types/video-category'

type OfflineSettingsPanelProps = {
  settings: OfflineAppSettings
  files: LocalVideoFile[]
  folderName: string | null
  onClose: () => void
  onSave: (settings: Partial<OfflineAppSettings>) => void
}

/**
 * Offline settings drawer: user name and video selection (fixed LantaPilates folder).
 * Scoped for D-pad remotes so Cancel / Save stay reachable from the name field.
 */
export const OfflineSettingsPanel = ({
  settings,
  files,
  folderName,
  onClose,
  onSave,
}: OfflineSettingsPanelProps) => {
  const [userName, setUserName] = useState(settings.userName)
  const [selected, setSelected] = useState<string[]>(settings.selectedFileNames)
  const [filters, setFilters] = useState<VideoCategoryFiltersState>(
    createEmptyVideoCategoryFilters,
  )
  const nameInputRef = useRef<HTMLInputElement>(null)

  useTvAutoFocus(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 50)
    return () => window.clearTimeout(timer)
  }, [])

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [files],
  )

  const filteredFiles = useMemo(
    () => filterItemsByVideoCategory(sortedFiles, (file) => file.name, filters),
    [sortedFiles, filters],
  )

  const toggleVideo = (fileName: string) => {
    setSelected((current) =>
      current.includes(fileName)
        ? current.filter((name) => name !== fileName)
        : [...current, fileName],
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
      <div
        className={cn(
          'flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-2xl bg-lanta-cream shadow-xl',
          'sm:rounded-2xl',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-settings-title"
        data-tv-focus-root="true"
      >
        <div className="flex items-center justify-between border-b border-lanta-sand px-5 py-4">
          <h2 id="offline-settings-title" className="font-display text-2xl text-lanta-charcoal">
            Settings
          </h2>
          <button
            type="button"
            tabIndex={0}
            onClick={onClose}
            className={cn(
              'rounded-sm border-2 border-transparent px-4 py-2 text-sm text-lanta-charcoal/70',
              'hover:bg-white focus:outline-none',
              'focus:border-lanta-taupe focus:bg-white focus:ring-4 focus:ring-lanta-taupe/50',
              'focus-visible:border-lanta-taupe focus-visible:ring-4 focus-visible:ring-lanta-taupe/50',
            )}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="offline-user-name">User name</Label>
            <Input
              ref={nameInputRef}
              id="offline-user-name"
              data-tv-autofocus="true"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              onKeyDown={(event) => {
                // Enter moves focus toward Save for remote/keyboard users.
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const saveButton = document.querySelector<HTMLButtonElement>(
                    '[data-tv-settings-save]',
                  )
                  saveButton?.focus()
                }
              }}
              placeholder="Enter name"
              className="focus-visible:ring-4 focus-visible:ring-lanta-taupe/50"
            />
            <p className="text-xs text-lanta-charcoal/50">
              Remote: ↓ from name to videos / Save · OK to select
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-lanta-charcoal">Video source folder</p>
            <p className="text-sm text-lanta-charcoal/60">
              Auto-picks <span className="font-medium text-lanta-charcoal">LantaPilates</span> on
              internal storage or USB.
            </p>
            <p className="text-sm text-lanta-charcoal/80">
              Found:{' '}
              <span className="font-medium text-lanta-charcoal">
                {folderName ?? 'LantaPilates (not found yet)'}
              </span>
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-lanta-charcoal">Videos to play</p>
              <p className="text-xs text-lanta-charcoal/60">{selected.length} selected</p>
            </div>

            {sortedFiles.length === 0 ? (
              <p className="text-sm text-lanta-charcoal/60">
                No videos found in LantaPilates yet.
              </p>
            ) : (
              <>
                <VideoCategoryFilters
                  compact
                  filters={filters}
                  onChange={setFilters}
                />

                <p className="text-xs text-lanta-charcoal/55">
                  Showing {filteredFiles.length} of {sortedFiles.length}
                  {filteredFiles.length !== sortedFiles.length ? ' (filtered)' : ''}
                </p>

                {filteredFiles.length === 0 ? (
                  <p className="rounded-lg border border-lanta-sand bg-white/80 px-3 py-4 text-sm text-lanta-charcoal/60">
                    No videos match these filters. Clear or adjust filters to see more.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-lanta-sand bg-white/80 p-2">
                    {filteredFiles.map((file) => {
                      const checked = selected.includes(file.name)
                      const meta = getVideoCategoryMeta(file.name)
                      return (
                        <li key={file.id}>
                          <button
                            type="button"
                            tabIndex={0}
                            aria-pressed={checked}
                            onClick={() => toggleVideo(file.name)}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-md border-2 border-transparent px-3 py-3 text-left',
                              'focus:outline-none',
                              'focus:border-lanta-taupe focus:ring-4 focus:ring-lanta-taupe/50',
                              'focus-visible:border-lanta-taupe focus-visible:ring-4 focus-visible:ring-lanta-taupe/50',
                              checked ? 'bg-lanta-cream' : 'hover:bg-lanta-cream/60',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border',
                                checked
                                  ? 'border-lanta-taupe bg-lanta-taupe text-white'
                                  : 'border-lanta-sand bg-white',
                              )}
                              aria-hidden="true"
                            >
                              {checked ? '✓' : ''}
                            </span>
                            <span className="min-w-0 text-sm text-lanta-charcoal">
                              <span className="font-medium">{titleFromFileName(file.name)}</span>
                              {meta ? (
                                <span className="mt-1 block text-xs leading-relaxed text-lanta-charcoal/55">
                                  {meta.accent} · {meta.paceCategory} · {meta.wordsPerMinute} wpm
                                </span>
                              ) : (
                                <span className="mt-0.5 block text-xs text-lanta-charcoal/50">
                                  {file.name}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-lanta-sand px-5 py-4">
          <Button
            type="button"
            variant="secondary"
            tabIndex={0}
            className={cn(
              'flex-1 border-2 border-transparent',
              'focus:border-lanta-taupe focus:ring-4 focus:ring-lanta-taupe/50',
              'focus-visible:border-lanta-taupe focus-visible:ring-4 focus-visible:ring-lanta-taupe/50',
            )}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            tabIndex={0}
            data-tv-settings-save="true"
            className={cn(
              'flex-1 border-2 border-transparent',
              'focus:border-lanta-taupe focus:ring-4 focus:ring-lanta-taupe/50',
              'focus-visible:border-lanta-taupe focus-visible:ring-4 focus-visible:ring-lanta-taupe/50',
            )}
            disabled={!userName.trim()}
            onClick={() =>
              onSave({
                userName: userName.trim(),
                selectedFileNames: selected,
              })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
