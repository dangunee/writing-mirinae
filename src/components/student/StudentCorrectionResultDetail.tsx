import { isHtmlVisiblyNonEmpty, parseTeacherHtmlV1 } from '../../lib/teacherRichDocument'
import { sanitizeTeacherCorrectionHtml } from '../../lib/teacherCorrectionSanitize'
import type {
  PublishedCorrection,
  ResultSessionCommon,
  StudentCorrectionAttachment,
  StudentWritingResultPayload,
} from '../../lib/studentWritingResult'
import { formatSessionMetaLine, textNonEmpty } from '../../lib/studentWritingResult'

function hasPublishedCorrectionContent(correction: PublishedCorrection | null): boolean {
  if (!correction) return false
  const rawHtml = parseTeacherHtmlV1(correction.richDocumentJson)
  const safeHtml = rawHtml != null ? sanitizeTeacherCorrectionHtml(rawHtml) : ''
  if (safeHtml !== '' && isHtmlVisiblyNonEmpty(safeHtml)) return true
  if (textNonEmpty(correction.polishedSentence)) return true
  if (textNonEmpty(correction.improvedText)) return true
  if (textNonEmpty(correction.teacherComment)) return true
  if (textNonEmpty(correction.modelAnswer)) return true
  return false
}

function AttachmentsBlock({ attachments }: { attachments: StudentCorrectionAttachment[] }) {
  if (attachments.length === 0) return null
  return (
    <div className="mt-3 space-y-3">
      {attachments.map((a) =>
        a.downloadUrl && a.mimeType?.startsWith('image/') ? (
          <p key={a.id}>
            <img src={a.downloadUrl} alt="" style={{ maxWidth: '100%', height: 'auto' }} />
          </p>
        ) : a.downloadUrl ? (
          <p key={a.id}>
            <a href={a.downloadUrl} target="_blank" rel="noreferrer">
              {a.originalFilename ?? '첨부 파일 (PDF 등)'}
            </a>
          </p>
        ) : null,
      )}
    </div>
  )
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="learner-correction-result-card">
      <h3 className="learner-correction-result-card__head">{title}</h3>
      <div className="learner-correction-result-card__body">{children}</div>
    </section>
  )
}

/**
 * Student-facing correction body — same blocks as /writing/app/view/:submissionId (no shell/header).
 */
export default function StudentCorrectionResultDetail({ result }: { result: StudentWritingResultPayload }) {
  const originalText = result.submission?.bodyText ?? ''
  const hasSubmittedText = originalText.trim().length > 0
  const attachments = Array.isArray(result.attachments) ? result.attachments : []
  const submittedDisplay = hasSubmittedText ? originalText : ''

  if (result.outcome === 'missed') {
    const snap = result.session.modelAnswerSnapshot
    const snapText = snap != null && String(snap).trim() !== '' ? String(snap).trim() : ''

    return (
      <div className="correction-view learner-correction-result-root">
        {(hasSubmittedText || attachments.length > 0) && (
          <ResultSection title="提出文">
            {hasSubmittedText ? (
              <div className="original-content">{submittedDisplay}</div>
            ) : (
              <p className="pending text-sm">（提出本文がありません）</p>
            )}
            <AttachmentsBlock attachments={attachments} />
          </ResultSection>
        )}

        {textNonEmpty(snapText) ? (
          <ResultSection title="模範文">
            <div className="corrected-content corrected-content--model-answer whitespace-pre-wrap">{snapText}</div>
          </ResultSection>
        ) : null}

        <p className="pending text-sm px-1">
          提出期限を過ぎたため、添削は提供されません
          <span className="block mt-2 not-italic text-[#454652] text-xs">
            {formatSessionMetaLine(result.session as ResultSessionCommon & { modelAnswerSnapshot?: string | null })}
          </span>
        </p>
      </div>
    )
  }

  const correction = result.correction
  const hasCorrectedBody = hasPublishedCorrectionContent(correction)

  const rawHtml = correction ? parseTeacherHtmlV1(correction.richDocumentJson) : null
  const safeHtml = rawHtml != null ? sanitizeTeacherCorrectionHtml(rawHtml) : ''
  const hasRich = safeHtml !== '' && isHtmlVisiblyNonEmpty(safeHtml)

  return (
    <div className="correction-view learner-correction-result-root">
      {(hasSubmittedText || attachments.length > 0) && (
        <ResultSection title="提出文">
          {hasSubmittedText ? (
            <div className="original-content">{submittedDisplay}</div>
          ) : (
            <p className="pending text-sm">（提出本文がありません）</p>
          )}
          <AttachmentsBlock attachments={attachments} />
        </ResultSection>
      )}

      <ResultSection title="添削文">
        {correction != null && hasCorrectedBody ? (
          <>
            {hasRich ? (
              <div
                className="corrected-content teacher-rich-content"
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />
            ) : textNonEmpty(correction.polishedSentence) ? (
              <div className="corrected-content whitespace-pre-wrap">{correction.polishedSentence}</div>
            ) : (
              <p className="pending text-sm">（添削文がありません）</p>
            )}
          </>
        ) : (
          <p className="pending text-sm">아직 첨삭이 완료되지 않았습니다.</p>
        )}
      </ResultSection>

      {correction != null && textNonEmpty(correction.improvedText) ? (
        <ResultSection title="比較文">
          <div className="corrected-content whitespace-pre-wrap">{correction.improvedText}</div>
        </ResultSection>
      ) : null}

      {correction != null && textNonEmpty(correction.modelAnswer) ? (
        <ResultSection title="模範文">
          <div className="corrected-content corrected-content--model-answer whitespace-pre-wrap">
            {correction.modelAnswer}
          </div>
        </ResultSection>
      ) : null}

      {correction != null && textNonEmpty(correction.teacherComment) ? (
        <ResultSection title="講師の一言">
          <div className="corrected-content whitespace-pre-wrap">{correction.teacherComment}</div>
        </ResultSection>
      ) : null}
    </div>
  )
}
