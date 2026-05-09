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

function OriginalSection({
  originalDisplay,
  attachments,
}: {
  originalDisplay: string
  attachments: StudentCorrectionAttachment[]
}) {
  return (
    <div className="view-section">
      <h3>내가 제출한 글</h3>
      <div className="original-content">{originalDisplay}</div>
      {attachments.length > 0 ? (
        <div className="original-content" style={{ marginTop: '0.75rem' }}>
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
      ) : null}
    </div>
  )
}

/**
 * Student-facing correction body — same blocks as /writing/app/view/:submissionId (no shell/header).
 * Uses global `.correction-view` / `.view-section` styles from App.css.
 */
export default function StudentCorrectionResultDetail({ result }: { result: StudentWritingResultPayload }) {
  const originalText = result.submission?.bodyText ?? ''
  const originalDisplay = originalText.trim() === '' ? '내용이 없습니다.' : originalText
  const attachments = Array.isArray(result.attachments) ? result.attachments : []

  if (result.outcome === 'missed') {
    const snap = result.session.modelAnswerSnapshot
    const snapText = snap != null && String(snap).trim() !== '' ? String(snap) : null

    return (
      <div className="correction-view">
        <OriginalSection originalDisplay={originalDisplay} attachments={attachments} />

        <div className="view-section">
          <h3>강사님 첨삭</h3>
          <p className="pending">提出期限を過ぎたため、添削は提供されません</p>
          {snapText ? <div className="corrected-content">{snapText}</div> : null}
          <p className="pending" style={{ marginTop: '0.75rem' }}>
            {formatSessionMetaLine(result.session as ResultSessionCommon & { modelAnswerSnapshot?: string | null })}
          </p>
        </div>
      </div>
    )
  }

  const correction = result.correction
  const hasCorrectedBody = hasPublishedCorrectionContent(correction)

  return (
    <div className="correction-view">
      <OriginalSection originalDisplay={originalDisplay} attachments={attachments} />

      <div className="view-section">
        <h3>강사님 첨삭</h3>
        {correction != null && hasCorrectedBody ? (
          <div className="published-correction-blocks">
            {(() => {
              const rawHtml = parseTeacherHtmlV1(correction.richDocumentJson)
              const safeHtml = rawHtml != null ? sanitizeTeacherCorrectionHtml(rawHtml) : ''
              const hasRich = safeHtml !== '' && isHtmlVisiblyNonEmpty(safeHtml)
              return (
                <>
                  {hasRich && (
                    <div
                      className="corrected-content teacher-rich-content"
                      dangerouslySetInnerHTML={{ __html: safeHtml }}
                    />
                  )}
                  {!hasRich && textNonEmpty(correction.polishedSentence) && (
                    <div className="corrected-content whitespace-pre-wrap">{correction.polishedSentence}</div>
                  )}
                  {textNonEmpty(correction.improvedText) && (
                    <div className="improved-block" style={{ marginTop: '1rem' }}>
                      <h4 className="improved-block-title">整理した比較文</h4>
                      <div className="corrected-content whitespace-pre-wrap">{correction.improvedText}</div>
                    </div>
                  )}
                  {textNonEmpty(correction.teacherComment) && (
                    <div style={{ marginTop: '1rem' }}>
                      <strong>강사 코멘트</strong>
                      <div className="corrected-content whitespace-pre-wrap">{correction.teacherComment}</div>
                    </div>
                  )}
                  {textNonEmpty(correction.modelAnswer) && (
                    <div style={{ marginTop: '1rem' }}>
                      <strong>模範文（参考）</strong>
                      <div className="corrected-content whitespace-pre-wrap">{correction.modelAnswer}</div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        ) : (
          <p className="pending">아직 첨삭이 완료되지 않았습니다.</p>
        )}
      </div>
    </div>
  )
}
