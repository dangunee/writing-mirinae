import { useEffect, useRef, useState } from 'react'

import {
  attachCourseIdToPreviewRows,
  parseAdminAssignmentsCsvText,
  type AdminAssignmentCsvPreviewRow,
} from '../../lib/adminAssignmentCsvImport'
import { apiUrl } from '../../lib/apiUrl'
import { ASSIGNMENT_REQUIREMENT_SLOT_COUNT } from '../../lib/writingThemeSnapshot'

type Props = {
  courseId: string
  disabled?: boolean
  onImported: () => void | Promise<void>
}

type ImportRowResult = { sessionIndex: number; ok: boolean; detail?: string }

export default function AdminAssignmentsCsvImport({ courseId, disabled, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [previewRows, setPreviewRows] = useState<AdminAssignmentCsvPreviewRow[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [results, setResults] = useState<ImportRowResult[] | null>(null)

  useEffect(() => {
    if (!open) return
    setPreviewRows(null)
    setWarnings([])
    setParseError(null)
    setImporting(false)
    setProgress(null)
    setResults(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [open])

  const handlePickClick = () => {
    setParseError(null)
    fileRef.current?.click()
  }

  const handleFile = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('.csv ファイルを選択してください。')
      setPreviewRows(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const parsed = parseAdminAssignmentsCsvText(text)
      if (!parsed.ok) {
        setParseError(parsed.error)
        setPreviewRows(null)
        setWarnings([])
        return
      }
      setParseError(null)
      setPreviewRows(parsed.rows)
      setWarnings(parsed.warnings)
    }
    reader.onerror = () => {
      setParseError('ファイルを読み込めませんでした。')
      setPreviewRows(null)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const runImport = async () => {
    const cid = courseId.trim()
    if (!cid || !previewRows?.length || importing) return
    setImporting(true)
    setResults(null)
    const rows = attachCourseIdToPreviewRows(previewRows, cid)
    const out: ImportRowResult[] = []
    let done = 0
    setProgress({ done: 0, total: rows.length })
    for (const row of rows) {
      try {
        const res = await fetch(apiUrl('/api/writing/admin/assignments/create'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: row.createBody.courseId,
            sessionIndex: row.createBody.sessionIndex,
            theme: row.createBody.theme,
            title: row.createBody.title,
            prompt: row.createBody.prompt,
            modelAnswer: row.createBody.modelAnswer,
            requirements: row.createBody.requirements,
          }),
        })
        const data = (await res.json()) as { ok?: boolean; code?: string }
        if (!res.ok || !data.ok) {
          out.push({
            sessionIndex: row.sessionIndex,
            ok: false,
            detail: data.code ?? `HTTP ${res.status}`,
          })
        } else {
          out.push({ sessionIndex: row.sessionIndex, ok: true })
        }
      } catch {
        out.push({ sessionIndex: row.sessionIndex, ok: false, detail: 'request_failed' })
      }
      done += 1
      setProgress({ done, total: rows.length })
    }
    setResults(out)
    setImporting(false)
    await Promise.resolve(onImported())
  }

  const failedCount = results?.filter((r) => !r.ok).length ?? 0

  return (
    <>
      <button
        type="button"
        disabled={disabled || !courseId.trim()}
        onClick={() => setOpen(true)}
        className="rounded border border-[#4052b6] bg-white px-3 py-2 text-xs font-semibold text-[#4052b6] hover:bg-[#4052b6]/5 disabled:opacity-50 sm:text-sm"
      >
        Import CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          handleFile(e.target.files)
          e.target.value = ''
        }}
      />

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-import-title"
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#c5c8cc] bg-[#f5f7fa] shadow-xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-[#c5c8cc] bg-white px-4 py-3">
              <div className="min-w-0">
                <p id="csv-import-title" className="font-['Plus_Jakarta_Sans'] text-lg font-extrabold text-[#2c2f32]">
                  CSV で課題を一括登録
                </p>
                <p className="mt-1 text-xs text-[#595c5e]">
                  列: session_index, theme_title, prompt, requirement_1〜3, example_1〜3, model_answer（API のため必須スロット{' '}
                  {ASSIGNMENT_REQUIREMENT_SLOT_COUNT} 件に足りない分は 3 件目を複製します）
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded border border-[#c5c8cc] bg-white px-3 py-1.5 text-xs font-semibold text-[#2c2f32] hover:bg-[#f5f7fa]"
                onClick={() => setOpen(false)}
              >
                閉じる
              </button>
            </div>

            <div className="space-y-4 px-4 py-4 text-sm text-[#2c2f32]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePickClick}
                  disabled={importing}
                  className="rounded bg-[#4052b6] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 sm:text-sm"
                >
                  CSV を選択
                </button>
                {previewRows?.length ? (
                  <button
                    type="button"
                    onClick={() => void runImport()}
                    disabled={importing || !courseId.trim()}
                    className="rounded bg-[#1b5e20] px-3 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 sm:text-sm"
                  >
                    {importing ? 'インポート中…' : '確認してインポート実行'}
                  </button>
                ) : null}
              </div>

              {parseError ? (
                <p className="rounded border border-[#ffcdd2] bg-[#ffebee] px-3 py-2 text-sm text-[#ba1a1a]" role="alert">
                  {parseError}
                </p>
              ) : null}

              {warnings.length > 0 ? (
                <ul className="list-disc space-y-1 rounded border border-[#ffe082] bg-[#fff8e1] px-5 py-2 text-xs text-[#795548]">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              {progress ? (
                <p className="text-xs font-semibold text-[#595c5e]" role="status">
                  進捗: {progress.done} / {progress.total}
                </p>
              ) : null}

              {previewRows?.length ? (
                <div className="overflow-x-auto rounded border border-[#c5c8cc] bg-white">
                  <table className="min-w-[640px] w-full border-collapse text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#c5c8cc] bg-[#eceff3]">
                        <th className="px-2 py-2 font-bold text-[#595c5e]">回次</th>
                        <th className="px-2 py-2 font-bold text-[#595c5e]">テーマ</th>
                        <th className="px-2 py-2 font-bold text-[#595c5e]">prompt（冒頭）</th>
                        <th className="px-2 py-2 font-bold text-[#595c5e]">結果</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => {
                        const hit = results?.find((r) => r.sessionIndex === row.sessionIndex)
                        const fail = hit && !hit.ok
                        const ok = hit && hit.ok
                        return (
                          <tr
                            key={row.sessionIndex}
                            className={`border-b border-[#eceff3] ${fail ? 'bg-[#ffebee]' : ''}`}
                          >
                            <td className="whitespace-nowrap px-2 py-2 font-semibold">第{row.sessionIndex}回</td>
                            <td className="max-w-[140px] px-2 py-2 align-top">
                              <span className="block max-h-[3.25rem] overflow-hidden break-words text-[#2c2f32]">
                                {row.themeTitle}
                              </span>
                            </td>
                            <td className="max-w-[280px] px-2 py-2 align-top text-[#595c5e]">
                              <span className="block max-h-[4.5rem] overflow-hidden break-words">{row.promptHead}</span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 align-top">
                              {!hit ? (
                                <span className="text-[#595c5e]">—</span>
                              ) : ok ? (
                                <span className="font-semibold text-[#1b5e20]">成功</span>
                              ) : (
                                <span className="font-semibold text-[#ba1a1a]" title={hit.detail}>
                                  失敗{hit.detail ? ` (${hit.detail})` : ''}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : !parseError ? (
                <p className="text-xs text-[#595c5e]">CSV を選択するとプレビューが表示されます。</p>
              ) : null}

              {results?.length ? (
                <p className={`text-xs font-semibold ${failedCount ? 'text-[#ba1a1a]' : 'text-[#1b5e20]'}`}>
                  完了: {results.length} 件中 {results.length - failedCount} 件成功
                  {failedCount ? `、${failedCount} 件失敗` : ''}。一覧は自動更新済みです。
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
