'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { titleFromFileName } from '@/lib/local-video-catalog'
import type { OfflineAppSettings } from '@/lib/offline-app-settings'
import { cn } from '@/lib/utils'
import type { LocalVideoFile } from '@/plugins/local-videos/definitions'

type OfflineSettingsPanelProps = {
  settings: OfflineAppSettings
  files: LocalVideoFile[]
  folderName: string | null
  onClose: () => void
  onChangeFolder: () => void
  onSave: (settings: Partial<OfflineAppSettings>) => void
}

/**
 * Offline settings drawer: user name, video selection, and folder change.
 */
export const OfflineSettingsPanel = ({
  settings,
  files,
  folderName,
  onClose,
  onChangeFolder,
  onSave,
}: OfflineSettingsPanelProps) => {
  const [userName, setUserName] = useState(settings.userName)
  const [selected, setSelected] = useState<string[]>(settings.selectedFileNames)

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [files],
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
          'flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-lanta-cream shadow-xl',
          'sm:rounded-2xl',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-settings-title"
      >
        <div className="flex items-center justify-between border-b border-lanta-sand px-5 py-4">
          <h2 id="offline-settings-title" className="font-display text-2xl text-lanta-charcoal">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-lanta-charcoal/70 hover:bg-white"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="offline-user-name">User name</Label>
            <Input
              id="offline-user-name"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder="Enter name"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-lanta-charcoal">Video source folder</p>
                <p className="text-sm text-lanta-charcoal/60">
                  {folderName ?? 'No folder selected'}
                </p>
              </div>
              <Button type="button" variant="secondary" className="w-auto px-4" onClick={onChangeFolder}>
                Change folder
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-lanta-charcoal">Videos to play</p>
              <p className="text-xs text-lanta-charcoal/60">{selected.length} selected</p>
            </div>

            {sortedFiles.length === 0 ? (
              <p className="text-sm text-lanta-charcoal/60">
                No videos found in the selected folder.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-lanta-sand bg-white/80 p-2">
                {sortedFiles.map((file) => {
                  const checked = selected.includes(file.name)
                  return (
                    <li key={file.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-md px-3 py-2',
                          checked ? 'bg-lanta-cream' : 'hover:bg-lanta-cream/60',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleVideo(file.name)}
                          className="mt-1 h-4 w-4 accent-lanta-taupe"
                        />
                        <span className="text-sm text-lanta-charcoal">
                          <span className="font-medium">{titleFromFileName(file.name)}</span>
                          <span className="mt-0.5 block text-xs text-lanta-charcoal/50">
                            {file.name}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex gap-3 border-t border-lanta-sand px-5 py-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
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
