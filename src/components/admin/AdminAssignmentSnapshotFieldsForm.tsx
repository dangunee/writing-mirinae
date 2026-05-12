import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { apiUrl } from '../../lib/apiUrl'
import { normalizeImportedProseLineBreaks } from '../../lib/normalizeImportedProseLineBreaks'
import {
  ADMIN_ASSIGNMENT_REQUIRED_SLOT_COUNT,
  isRequirementSlotDuplicateOfPrevious,
  normalizeAdminAssignmentRequirementsPayload,
  requirementSlotHasAnyContent,
} from '../../lib/adminAssignmentRequirements'
import { KOREAN_GRAMMAR_LEVELS_JA } from '../../lib/koreanGrammarLevel'
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  emptyAssignmentRequirement,
  padAssignmentRequirementsToSlotCount,
  type AssignmentRequirement,
} from '../../lib/writingThemeSnapshot'

const REQ_SLOT_INDICES = Array.from(
  { length: ASSIGNMENT_REQUIREMENT_SLOT_COUNT },
  (_, i) => i
) as readonly number[]

const GRAMMAR_LEVEL_RADIO_GROUP = 'mt-1 flex flex-wrap gap-2'
const grammarLevelRadioBase =
  'inline-flex min-h-[2.25rem] shrink-0 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const grammarLevelRadioUnselected = `${grammarLevelRadioBase} border-[#c5c8cc] bg-white text-[#2c2f32] hover:bg-[#f5f7fa]`
const grammarLevelRadioSelected = `${grammarLevelRadioBase} border-[#000666] bg-[#eceef8] text-[#000666] shadow-sm`

export type AssignmentRequirementsTuple = [
  AssignmentRequirement,
  AssignmentRequirement,
  AssignmentRequirement,
  AssignmentRequirement,
  AssignmentRequirement,
]

export type AssignmentSnapshotFormSeed = {
  theme: string
  title: string
  prompt: string
  modelAnswer: string
  requirements: AssignmentRequirement[]
}

export function emptyAssignmentSnapshotSeed(): AssignmentSnapshotFormSeed {
  return {
    theme: '',
    title: '',
    prompt: '',
    modelAnswer: '',
    requirements: padAssignmentRequirementsToSlotCount([]),
  }
}

function serializeSeed(s: AssignmentSnapshotFormSeed): string {
  const reqs = padAssignmentRequirementsToSlotCount(s.requirements)
  return JSON.stringify({
    theme: s.theme.trim(),
    title: s.title.trim(),
    prompt: s.prompt.trim(),
    modelAnswer: s.modelAnswer.trim(),
    requirements: reqs.map((r) => ({
      grammarLevel: r.grammarLevel.trim(),
      expressionKey: r.expressionKey.trim(),
      expressionLabel: r.expressionLabel.trim(),
      pattern: r.pattern.trim(),
      translationJa: r.translationJa.trim(),
      exampleKo: r.exampleKo.trim(),
    })),
  })
}

export type AdminAssignmentSnapshotFieldsFormProps = {
  courseId: string
  sessionIndex: number
  /** Bump to re-apply `seed` into field state (sync baseline). */
  seedVersion: number
  seed: AssignmentSnapshotFormSeed
  legacyMigrationHint?: boolean
  disabled?: boolean
  /** Single submit CTA vs inline save + cancel */
  actionsVariant: 'standalone' | 'inline'
  onSaved: () => void | Promise<void>
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export default function AdminAssignmentSnapshotFieldsForm({
  courseId,
  sessionIndex,
  seedVersion,
  seed,
  legacyMigrationHint,
  disabled,
  actionsVariant,
  onSaved,
  onCancel,
  onDirtyChange,
}: AdminAssignmentSnapshotFieldsFormProps) {
  const [theme, setTheme] = useState(() => seed.theme)
  const [title, setTitle] = useState(() => seed.title)
  const [prompt, setPrompt] = useState(() => normalizeImportedProseLineBreaks(seed.prompt))
  const [modelAnswer, setModelAnswer] = useState(() =>
    normalizeImportedProseLineBreaks(seed.modelAnswer)
  )
  const [req, setReq] = useState<AssignmentRequirementsTuple>(
    () => padAssignmentRequirementsToSlotCount(seed.requirements) as AssignmentRequirementsTuple
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const baselineSerialized = useRef(
    serializeSeed({
      theme: seed.theme,
      title: seed.title,
      prompt: normalizeImportedProseLineBreaks(seed.prompt),
      modelAnswer: normalizeImportedProseLineBreaks(seed.modelAnswer),
      requirements: padAssignmentRequirementsToSlotCount(seed.requirements),
    })
  )

  const dirtyCbRef = useRef(onDirtyChange)
  dirtyCbRef.current = onDirtyChange

  useEffect(() => {
    const padded = padAssignmentRequirementsToSlotCount(seed.requirements)
    const nextSeed: AssignmentSnapshotFormSeed = {
      theme: seed.theme,
      title: seed.title,
      prompt: normalizeImportedProseLineBreaks(seed.prompt),
      modelAnswer: normalizeImportedProseLineBreaks(seed.modelAnswer),
      requirements: padded,
    }
    setTheme(nextSeed.theme)
    setTitle(nextSeed.title)
    setPrompt(nextSeed.prompt)
    setModelAnswer(nextSeed.modelAnswer)
    setReq(padded as AssignmentRequirementsTuple)
    baselineSerialized.current = serializeSeed(nextSeed)
    setError(null)
    setMessage(null)
    dirtyCbRef.current?.(false)
  }, [seedVersion, seed])

  useEffect(() => {
    const now = serializeSeed({
      theme,
      title,
      prompt,
      modelAnswer,
      requirements: [...req],
    })
    dirtyCbRef.current?.(now !== baselineSerialized.current)
  }, [theme, title, prompt, modelAnswer, req])

  function patchReq(i: number, field: keyof AssignmentRequirement, value: string) {
    setReq((prev) => {
      const next = [...prev] as AssignmentRequirement[]
      next[i] = { ...next[i], [field]: value }
      return next as AssignmentRequirementsTuple
    })
  }

  function clearReqSlot(slotIndex: number) {
    setReq((prev) => {
      const next = [...prev] as AssignmentRequirement[]
      next[slotIndex] = emptyAssignmentRequirement()
      return next as AssignmentRequirementsTuple
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)
    try {
      const normalizedReq = normalizeAdminAssignmentRequirementsPayload(req)
      if (!normalizedReq.ok) {
        setError(
          normalizedReq.code === 'invalid_requirements'
            ? '必須文法・表現: スロット1・2はすべて必須です。スロット3〜5はすべて空か、すべての項目を入力してください。'
            : normalizedReq.code === 'requirements_slot_count'
              ? '要件スロット数が不正です。'
              : normalizedReq.code
        )
        return
      }

      const idx = sessionIndex
      const res = await fetch(apiUrl('/api/writing/admin/assignments/create'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseId.trim(),
          sessionIndex: Number.isFinite(idx) ? idx : 1,
          theme: theme.trim(),
          title: title.trim(),
          prompt: prompt.trim(),
          modelAnswer: modelAnswer.trim() || undefined,
          requirements: normalizedReq.requirements,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; code?: string }
      if (!res.ok || !data.ok) {
        setError(data.code ?? `HTTP ${res.status}`)
        return
      }
      const n = Number.isFinite(idx) ? idx : 1
      setMessage(`第${n}回の課題を保存しました。`)
      baselineSerialized.current = serializeSeed({
        theme,
        title,
        prompt,
        modelAnswer,
        requirements: normalizedReq.requirements,
      })
      dirtyCbRef.current?.(false)
      await onSaved()
    } catch {
      setError('request_failed')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelHandler = useCallback(() => {
    const padded = padAssignmentRequirementsToSlotCount(seed.requirements)
    const promptNorm = normalizeImportedProseLineBreaks(seed.prompt)
    const modelNorm = normalizeImportedProseLineBreaks(seed.modelAnswer)
    setTheme(seed.theme)
    setTitle(seed.title)
    setPrompt(promptNorm)
    setModelAnswer(modelNorm)
    setReq(padded as AssignmentRequirementsTuple)
    baselineSerialized.current = serializeSeed({
      theme: seed.theme,
      title: seed.title,
      prompt: promptNorm,
      modelAnswer: modelNorm,
      requirements: padded,
    })
    setError(null)
    setMessage(null)
    dirtyCbRef.current?.(false)
    onCancel?.()
  }, [seed, onCancel])

  const submitDisabled = submitting || disabled || !courseId.trim()

  return (
    <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
      {legacyMigrationHint ? (
        <p className="rounded border border-[#ffe082] bg-[#fff8e1] px-3 py-2 text-sm text-[#795548]">
          レガシー形式の課題です。保存するにはスロット1・2を入力してください。スロット3〜5は任意です（空のまま保存できます）。
        </p>
      ) : null}

      <label className="block">
        <span className="font-semibold text-[#2c2f32]">テーマ（theme）</span>
        <input
          className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          required
          disabled={disabled}
        />
      </label>
      <label className="block">
        <span className="font-semibold text-[#2c2f32]">タイトル（title）</span>
        <input
          className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          disabled={disabled}
        />
      </label>
      <label className="block">
        <span className="font-semibold text-[#2c2f32]">課題文・指示（prompt）</span>
        <textarea
          className="mt-1 min-h-[120px] w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          disabled={disabled}
        />
      </label>

      <p className="pt-2 font-semibold text-[#2c2f32]">
        必須文法・表現（スロット1〜2必須、スロット3〜5は任意・最大 {ASSIGNMENT_REQUIREMENT_SLOT_COUNT}件）
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
        {REQ_SLOT_INDICES.map((slot) => {
          const optionalSlot = slot >= ADMIN_ASSIGNMENT_REQUIRED_SLOT_COUNT
          const isLastSlot = slot === ASSIGNMENT_REQUIREMENT_SLOT_COUNT - 1
          return (
            <div
              key={slot}
              className={`space-y-2 rounded border border-[#c5c8cc] bg-white/80 p-3 ${isLastSlot ? 'md:col-span-2' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#595c5e]">
                  スロット {slot + 1}
                  {optionalSlot ? (
                    <span className="ml-1 font-normal text-[#595c5e]">（任意）</span>
                  ) : null}
                </p>
                {optionalSlot && requirementSlotHasAnyContent(req[slot]) ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-[#c5c8cc] bg-[#f5f7fa] px-2 py-1 text-xs font-semibold text-[#4052b6] hover:bg-[#eef0fb]"
                    disabled={disabled}
                    onClick={() => clearReqSlot(slot)}
                  >
                    {isRequirementSlotDuplicateOfPrevious(slot, req)
                      ? '重複スロットを空にする'
                      : 'このスロットを空にする'}
                  </button>
                ) : null}
              </div>
              <div>
                <p id={`admin-assignment-grammar-level-slot-${slot}`} className="text-xs font-semibold text-[#2c2f32]">
                  韓国語文法レベル
                </p>
                <div
                  className={GRAMMAR_LEVEL_RADIO_GROUP}
                  role="radiogroup"
                  aria-labelledby={`admin-assignment-grammar-level-slot-${slot}`}
                  aria-required={!optionalSlot}
                >
                  {KOREAN_GRAMMAR_LEVELS_JA.map((lv) => {
                    const selected = req[slot].grammarLevel === lv
                    return (
                      <button
                        key={lv}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={disabled}
                        onClick={() => patchReq(slot, 'grammarLevel', lv)}
                        className={selected ? grammarLevelRadioSelected : grammarLevelRadioUnselected}
                      >
                        {lv}
                      </button>
                    )
                  })}
                </div>
              </div>
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="expressionKey（集計用）"
                value={req[slot].expressionKey}
                onChange={(e) => patchReq(slot, 'expressionKey', e.target.value)}
                required={!optionalSlot}
                disabled={disabled}
              />
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="expressionLabel（韓国語ラベル）"
                value={req[slot].expressionLabel}
                onChange={(e) => patchReq(slot, 'expressionLabel', e.target.value)}
                required={!optionalSlot}
                disabled={disabled}
              />
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="pattern（本文照合用部分文字列）"
                value={req[slot].pattern}
                onChange={(e) => patchReq(slot, 'pattern', e.target.value)}
                required={!optionalSlot}
                disabled={disabled}
              />
              <input
                className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="translationJa"
                value={req[slot].translationJa}
                onChange={(e) => patchReq(slot, 'translationJa', e.target.value)}
                required={!optionalSlot}
                disabled={disabled}
              />
              <textarea
                className="min-h-[48px] w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                placeholder="exampleKo"
                value={req[slot].exampleKo}
                onChange={(e) => patchReq(slot, 'exampleKo', e.target.value)}
                required={!optionalSlot}
                disabled={disabled}
              />
            </div>
          )
        })}
      </div>

      <label className="block">
        <span className="font-semibold text-[#2c2f32]">模範解答</span>
        <textarea
          className="mt-1 min-h-[14rem] w-full resize-y rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
          value={modelAnswer}
          onChange={(e) => setModelAnswer(e.target.value)}
          disabled={disabled}
        />
      </label>

      {error ? (
        <p className="text-sm text-[#ba1a1a]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[#1b5e20]" role="status">
          {message}
        </p>
      ) : null}

      {actionsVariant === 'inline' ? (
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={submitDisabled}
            className="rounded bg-[#4052b6] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            disabled={submitting}
            className="rounded border border-[#c5c8cc] bg-white px-4 py-2 font-semibold text-[#2c2f32] hover:bg-[#f5f7fa] disabled:opacity-50"
            onClick={cancelHandler}
          >
            キャンセル
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={submitDisabled}
          className="rounded bg-[#4052b6] px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? '保存中…' : '保存'}
        </button>
      )}
    </form>
  )
}
