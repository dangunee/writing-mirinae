import type { IntroCorrectionSegment } from '../../lib/introCorrectionMarketingSample'

function ReplaceSpan({ seg }: { seg: Extract<IntroCorrectionSegment, { kind: 'replace' }> }) {
  const rightClass =
    seg.tone === 'vocab'
      ? 'rounded-sm bg-primary/10 px-1 font-semibold text-primary'
      : 'rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container'

  return (
    <>
      <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
        {seg.wrong}
      </span>{' '}
      <span className={rightClass}>{seg.right}</span>
    </>
  )
}

export function IntroCorrectionSampleParagraph({ segments }: { segments: IntroCorrectionSegment[] }) {
  return (
    <p>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <ReplaceSpan key={i} seg={seg} />
        ),
      )}
    </p>
  )
}
