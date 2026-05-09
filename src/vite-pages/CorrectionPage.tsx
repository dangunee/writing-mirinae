import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import WritingLayout from "../components/WritingLayout";
import { apiUrl } from "../lib/apiUrl";
import TeacherRichCorrectionEditor, {
  type TeacherRichCorrectionEditorHandle,
} from "../components/teacher/TeacherRichCorrectionEditor";
import { TeacherPageNav } from "../components/teacher/TeacherPageNav";
import { buildInitialEditorHtml, extractComparisonPlainText } from "../lib/teacherRichDocument";

/** GET /api/teacher/writing/submissions/:id 응답 (TeacherSubmissionDetail 요약) */
type TeacherAssignmentSnapshot = {
  sessionIndex: number;
  termTitle: string | null;
  title: string | null;
  theme: string | null;
  prompt: string | null;
  requirementItems: Array<{
    grammarLevel?: string;
    expressionLabel?: string;
    pattern?: string;
    translationJa?: string;
    exampleKo?: string;
  }>;
  requiredExpressions: unknown | null;
  referenceModelAnswer: string | null;
};

type TeacherSubmissionDetail = {
  submission: {
    id: string;
    bodyText: string | null;
    grammarCheckResult?: unknown | null;
  };
  session: { index: number };
  /** Session/course theme & reference model (read-only for teacher). */
  assignment?: TeacherAssignmentSnapshot;
  correction: null | {
    id: string;
    polishedSentence: string | null;
    modelAnswer: string | null;
    teacherComment: string | null;
    richDocumentJson?: unknown | null;
    improvedText?: string | null;
    updatedAt?: string;
    /** 발행된 첨삭만 학생 결과 페이지와 정합 */
    publishedAt: string | null;
  };
  evaluation?: null | {
    grammarAccuracy: number | null;
    vocabularyUsage: number | null;
    contextualFluency: number | null;
  };
};

function GrammarCheckSummary({ raw }: { raw: unknown | null | undefined }) {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as {
    results?: Array<{ expressionLabel?: string; grammarLevel?: string; matched?: boolean }>;
  };
  if (!Array.isArray(o.results) || o.results.length === 0) return null;
  return (
    <div className="editor-section">
      <label>필수 표현 자동 검사 (제출 시)</label>
      <ul className="text-sm text-[#454652] list-disc list-inside space-y-1">
        {o.results.map((r, i) => (
          <li key={i}>
            {r.grammarLevel ? `[${r.grammarLevel}] ` : ""}
            {r.expressionLabel ?? "—"}: {r.matched ? "감지됨" : "미검출"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function parseScoreField(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function RequirementCard({ item }: { item: TeacherAssignmentSnapshot["requirementItems"][number] }) {
  const hasAny = [item.grammarLevel, item.expressionLabel, item.pattern, item.translationJa, item.exampleKo].some(
    (x) => x != null && String(x).trim() !== ""
  );
  if (!hasAny) return null;
  const el = item.expressionLabel?.trim();
  const pat = item.pattern?.trim();
  const head = el || pat || null;
  const g = item.grammarLevel?.trim() || "—";
  const p = pat || "—";
  const t = item.translationJa?.trim() || "—";
  const ex = item.exampleKo?.trim();
  return (
    <div className="requirement-card">
      {head != null && head !== "" ? <div className="requirement-card-head">{head}</div> : null}
      <div className="requirement-card-meta">
        レベル：{g} ｜ パターン：{p} ｜ 訳：{t}
      </div>
      {ex != null && ex !== "" ? <div className="requirement-card-example">例：{ex}</div> : null}
    </div>
  );
}

function AssignmentSnapshotPanel({ a }: { a: TeacherAssignmentSnapshot }) {
  const termLine = [a.termTitle && `コース・ターム: ${a.termTitle}`, `第${a.sessionIndex}回`]
    .filter(Boolean)
    .join(" · ");
  const req = a.requiredExpressions;
  const requiredStrings = Array.isArray(req) ? req.filter((x): x is string => typeof x === "string") : [];
  const hasThemeBlock =
    (a.title != null && a.title.trim() !== "") ||
    (a.theme != null && a.theme.trim() !== "") ||
    (a.prompt != null && a.prompt.trim() !== "");
  const hasStructuredReq = a.requirementItems != null && a.requirementItems.length > 0;
  const hasAnyAssignment = hasThemeBlock || hasStructuredReq || requiredStrings.length > 0;
  return (
    <div className="editor-section">
      <label>課題・出題（参照）</label>
      <div className="original-text assignment-snapshot">
        {termLine ? <p className="assignment-snapshot-meta">{termLine}</p> : null}
        {!hasAnyAssignment ? (
          <p className="assignment-snapshot-empty">出題テーマが未登録です</p>
        ) : (
          <>
            {hasThemeBlock ? (
              <>
                {a.title != null && a.title.trim() !== "" ? (
                  <h2 className="assignment-snapshot-title">{a.title}</h2>
                ) : null}
                {a.theme != null && a.theme.trim() !== "" ? (
                  <div className="assignment-snapshot-block">
                    <strong className="assignment-snapshot-h">テーマ</strong>
                    <p className="whitespace-pre-wrap assignment-snapshot-body">{a.theme}</p>
                  </div>
                ) : null}
                {a.prompt != null && a.prompt.trim() !== "" ? (
                  <div className="assignment-snapshot-block">
                    <strong className="assignment-snapshot-h">出題文・指示</strong>
                    <p className="whitespace-pre-wrap assignment-snapshot-body">{a.prompt}</p>
                  </div>
                ) : null}
              </>
            ) : null}
            {hasStructuredReq ? (
              <div className="assignment-snapshot-req">
                <strong className="assignment-snapshot-h">必須表現（要件）</strong>
                <div className="requirement-cards">
                  {a.requirementItems!.map((item, i) => (
                    <RequirementCard key={i} item={item} />
                  ))}
                </div>
              </div>
            ) : null}
            {requiredStrings.length > 0 ? (
              <div className="assignment-snapshot-req">
                <strong className="assignment-snapshot-h">必須表現</strong>
                <ul>
                  {requiredStrings.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

type ListRow = {
  id: string;
  studentName: string;
  content: string;
};

export default function CorrectionPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [detail, setDetail] = useState<TeacherSubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<ListRow | null>(null);
  const [improvedText, setImprovedText] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [grammarScore, setGrammarScore] = useState("");
  const [vocabularyScore, setVocabularyScore] = useState("");
  const [contextScore, setContextScore] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedRich, setSavedRich] = useState(false);
  const [savedImproved, setSavedImproved] = useState(false);
  const [copyCorrectedMessage, setCopyCorrectedMessage] = useState<string | null>(null);
  const saveLockRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [savingRich, setSavingRich] = useState(false);
  const [savingImproved, setSavingImproved] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const richEditorRef = useRef<TeacherRichCorrectionEditorHandle | null>(null);

  const loadDetail = useCallback(async () => {
    if (!submissionId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}`), {
        credentials: "include",
      });
      if (!res.ok) {
        setDetail(null);
        return;
      }
      const data = (await res.json()) as TeacherSubmissionDetail;
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setSelectedSubmission(null);
  }, [submissionId]);

  const sessionIdx = detail?.assignment?.sessionIndex ?? detail?.session.index ?? 0;
  const submissions: ListRow[] = detail
    ? [
        {
          id: detail.submission.id,
          studentName: `세션 ${sessionIdx}회`,
          content: detail.submission.bodyText ?? "",
        },
      ]
    : [];

  const activeRow = selectedSubmission ?? submissions[0] ?? null;

  const initialEditorHtml = useMemo(() => {
    if (!detail) return "<p><br></p>";
    return buildInitialEditorHtml(
      detail.submission.bodyText ?? "",
      detail.correction?.richDocumentJson,
      detail.correction?.polishedSentence
    );
  }, [detail?.submission.bodyText, detail?.correction?.richDocumentJson, detail?.correction?.polishedSentence]);

  const richEditorSeedKey = useMemo(() => {
    if (!detail || !submissionId) return "";
    return `${submissionId}-${detail.correction?.id ?? "none"}-${detail.correction?.updatedAt ?? "0"}`;
  }, [detail, submissionId]);

  useEffect(() => {
    if (!detail) {
      setImprovedText("");
      setTeacherComment("");
      setGrammarScore("");
      setVocabularyScore("");
      setContextScore("");
      return;
    }
    setImprovedText(detail.correction?.improvedText ?? "");
    setTeacherComment(detail.correction?.teacherComment ?? "");
    const ev = detail.evaluation;
    setGrammarScore(ev?.grammarAccuracy != null ? String(ev.grammarAccuracy) : "");
    setVocabularyScore(ev?.vocabularyUsage != null ? String(ev.vocabularyUsage) : "");
    setContextScore(ev?.contextualFluency != null ? String(ev.contextualFluency) : "");
  }, [detail]);

  const busy = saving || savingRich || savingImproved || isPublishing;

  /** 모범답 · 코멘트 · 점수만 저장 (기존 「저장」) */
  const handleSave = async () => {
    if (!activeRow || !submissionId || !detail || busy || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const refModel = detail.assignment?.referenceModelAnswer?.trim() ?? "";
      const storedModel = detail.correction?.modelAnswer?.trim() ?? "";
      const modelAnswerToPersist = refModel || storedModel;
      const correctionRes = await fetch(
        apiUrl(`/api/teacher/writing/submissions/${submissionId}/correction`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelAnswer: modelAnswerToPersist,
            teacherComment: teacherComment ?? "",
          }),
        }
      );
      if (!correctionRes.ok) return;

      const g = parseScoreField(grammarScore);
      const v = parseScoreField(vocabularyScore);
      const c = parseScoreField(contextScore);
      const evalPayload: Record<string, number> = {};
      if (g !== null) evalPayload.grammarScore = g;
      if (v !== null) evalPayload.vocabularyScore = v;
      if (c !== null) evalPayload.contextScore = c;

      const evaluationRes = await fetch(
        apiUrl(`/api/teacher/writing/submissions/${submissionId}/evaluation`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(evalPayload),
        }
      );

      await loadDetail();
      if (!evaluationRes.ok) return;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* minimal */
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  const handleSaveRich = async () => {
    if (!activeRow || !submissionId || busy || saveLockRef.current) return;
    const doc = richEditorRef.current?.getDocumentJson();
    if (!doc) return;
    saveLockRef.current = true;
    setSavingRich(true);
    try {
      const res = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}/correction`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ richDocumentJson: doc }),
      });
      if (!res.ok) return;
      await loadDetail();
      setSavedRich(true);
      setTimeout(() => setSavedRich(false), 2000);
    } catch {
      /* minimal */
    } finally {
      saveLockRef.current = false;
      setSavingRich(false);
    }
  };

  const handleSaveImproved = async () => {
    if (!activeRow || !submissionId || busy || saveLockRef.current) return;
    saveLockRef.current = true;
    setSavingImproved(true);
    try {
      const res = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}/correction`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ improvedText: improvedText ?? "" }),
      });
      if (!res.ok) return;
      await loadDetail();
      setSavedImproved(true);
      setTimeout(() => setSavedImproved(false), 2000);
    } catch {
      /* minimal */
    } finally {
      saveLockRef.current = false;
      setSavingImproved(false);
    }
  };

  const handleCopyCorrected = async () => {
    const sourceHtml = richEditorRef.current?.getHtml?.() ?? "";
    const plain = extractComparisonPlainText(sourceHtml);
    if (import.meta.env.DEV) {
      console.info("[writing teacher copy comparison]", {
        sourceHtmlLen: sourceHtml.length,
        outputTextLen: plain.length,
        head50: plain.slice(0, 50),
        tail50: plain.slice(Math.max(0, plain.length - 50)),
      });
    }
    setImprovedText(plain);
    let copied = false;
    try {
      await navigator.clipboard.writeText(plain);
      copied = true;
    } catch {
      copied = false;
    }
    if (copied) {
      setCopyCorrectedMessage("修正文をコピーし、比較文欄に反映しました");
    } else {
      setCopyCorrectedMessage("比較文欄に反映しました（コピーは失敗しました）");
    }
    setTimeout(() => setCopyCorrectedMessage(null), 3000);
  };

  const handlePublish = async () => {
    if (!activeRow || !submissionId || busy || saveLockRef.current) return;
    setIsPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(apiUrl(`/api/teacher/writing/submissions/${submissionId}/publish`), {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await loadDetail();
        return;
      }
      if (res.status === 422) {
        setPublishError("공개 조건이 아직 충족되지 않았습니다.");
      } else if (res.status === 409) {
        setPublishError("이미 공개되었습니다.");
      }
    } catch {
      /* minimal */
    } finally {
      setIsPublishing(false);
    }
  };

  const showPublishButton =
    detail != null &&
    detail.correction != null &&
    (detail.correction.publishedAt == null || String(detail.correction.publishedAt).trim() === "");

  if (!submissionId) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <div className="correction-header">
            <div className="correction-header-row">
              <div className="correction-header-main">
                <Link to="/writing/teacher" className="back-link">
                  ← 목록으로
                </Link>
                <p>과제를 찾을 수 없습니다.</p>
              </div>
              <TeacherPageNav />
            </div>
          </div>
        </div>
      </WritingLayout>
    );
  }

  if (loading) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <div className="correction-header">
            <div className="correction-header-row">
              <div className="correction-header-main">
                <Link to="/writing/teacher" className="back-link">
                  ← 목록으로
                </Link>
                <p>로딩 중...</p>
              </div>
              <TeacherPageNav />
            </div>
          </div>
        </div>
      </WritingLayout>
    );
  }

  if (!detail) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <div className="correction-header">
            <div className="correction-header-row">
              <div className="correction-header-main">
                <Link to="/writing/teacher" className="back-link">
                  ← 목록으로
                </Link>
                <p>과제를 찾을 수 없습니다.</p>
              </div>
              <TeacherPageNav />
            </div>
          </div>
        </div>
      </WritingLayout>
    );
  }

  return (
    <WritingLayout>
      <div className="correction-page">
        <div className="correction-header">
          <div className="correction-header-row">
            <div className="correction-header-main">
              <Link to="/writing/teacher" className="back-link">
                ← 목록으로
              </Link>
              <h1>첨삭: 세션 {sessionIdx}회</h1>
            </div>
            <TeacherPageNav />
          </div>
        </div>

        <div className="correction-layout">
          <aside className="student-list">
            <h3>학생 목록</h3>
            {submissions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`student-item ${activeRow?.id === s.id ? "active" : ""}`}
                onClick={() => setSelectedSubmission(s)}
              >
                {s.studentName}
                {detail.correction && <span className="badge">완료</span>}
              </button>
            ))}
          </aside>

          <div className="correction-editor-area">
            {activeRow ? (
              <>
                <p className="instructor-label">↑ 강사 편집</p>
                {detail.assignment && <AssignmentSnapshotPanel a={detail.assignment} />}
                <div className="editor-section">
                  <label>원문 (학생 제출)</label>
                  <div className="original-text">{activeRow.content}</div>
                </div>
                <GrammarCheckSummary raw={detail.submission.grammarCheckResult} />
                <div className="editor-section">
                  <label>修正文（リッチ）</label>
                  <TeacherRichCorrectionEditor
                    ref={richEditorRef}
                    key={richEditorSeedKey}
                    initialHtml={initialEditorHtml}
                  />
                  <div className="editor-actions" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => void handleSaveRich()}
                      disabled={busy}
                    >
                      {savedRich ? "保存しました ✓" : "修正文を保存"}
                    </button>
                    <button
                      type="button"
                      className="save-btn save-btn--secondary"
                      onClick={() => void handleCopyCorrected()}
                    >
                      修正文をコピー
                    </button>
                    {copyCorrectedMessage && (
                      <span className="copy-toast" role="status">
                        {copyCorrectedMessage}
                      </span>
                    )}
                  </div>
                </div>
                <div className="editor-section">
                  <label>整理した比較文（ 정서문 ）</label>
                  <textarea
                    value={improvedText}
                    onChange={(e) => setImprovedText(e.target.value)}
                    className="correction-textarea correction-textarea--comparison"
                    rows={10}
                    placeholder="比較用の清書テキストを入力"
                  />
                  <div className="editor-actions" style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => void handleSaveImproved()}
                      disabled={busy}
                    >
                      {savedImproved ? "保存しました ✓" : "比較文を保存"}
                    </button>
                  </div>
                </div>
                <div className="editor-section">
                  <label>模範文（参考）</label>
                  <div className="original-text">
                    {detail.assignment?.referenceModelAnswer != null &&
                    String(detail.assignment.referenceModelAnswer).trim() !== "" ? (
                      <div className="whitespace-pre-wrap">{detail.assignment.referenceModelAnswer}</div>
                    ) : (
                      <p className="assignment-snapshot-empty">模範文が登録されていません</p>
                    )}
                  </div>
                </div>
                <div className="editor-section">
                  <label>강사 코멘트</label>
                  <textarea
                    value={teacherComment}
                    onChange={(e) => setTeacherComment(e.target.value)}
                    className="correction-textarea"
                    rows={6}
                    placeholder="코멘트를 입력하세요"
                  />
                </div>
                <div className="editor-section">
                  <label>평가 점수 (0–100)</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <label style={{ fontWeight: 500 }}>문법</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={grammarScore}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            setGrammarScore("");
                            return;
                          }
                          const n = parseInt(v, 10);
                          if (!Number.isNaN(n)) setGrammarScore(String(Math.min(100, Math.max(0, n))));
                        }}
                        className="correction-textarea"
                        style={{ width: "100%", maxWidth: "10rem", minHeight: "auto", padding: "0.5rem 0.75rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 500 }}>어휘</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={vocabularyScore}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            setVocabularyScore("");
                            return;
                          }
                          const n = parseInt(v, 10);
                          if (!Number.isNaN(n)) setVocabularyScore(String(Math.min(100, Math.max(0, n))));
                        }}
                        className="correction-textarea"
                        style={{ width: "100%", maxWidth: "10rem", minHeight: "auto", padding: "0.5rem 0.75rem" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontWeight: 500 }}>맥락</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={contextScore}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") {
                            setContextScore("");
                            return;
                          }
                          const n = parseInt(v, 10);
                          if (!Number.isNaN(n)) setContextScore(String(Math.min(100, Math.max(0, n))));
                        }}
                        className="correction-textarea"
                        style={{ width: "100%", maxWidth: "10rem", minHeight: "auto", padding: "0.5rem 0.75rem" }}
                      />
                    </div>
                  </div>
                </div>
                <div className="editor-actions">
                  <button
                    type="button"
                    className="save-btn"
                    onClick={() => void handleSave()}
                    disabled={busy}
                  >
                    {saved ? "저장됨 ✓" : "저장"}
                  </button>
                  {showPublishButton && (
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => void handlePublish()}
                      disabled={busy}
                    >
                      {isPublishing ? "공개 중…" : "공개"}
                    </button>
                  )}
                  {publishError && <span className="status pending">{publishError}</span>}
                  {detail.correction?.publishedAt != null &&
                    String(detail.correction.publishedAt).trim() !== "" && (
                      <Link to={`/writing/app/view/${activeRow.id}`} className="view-student-link">
                        학생 보기 →
                      </Link>
                    )}
                </div>
              </>
            ) : (
              <p className="no-submissions">제출된 과제가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </WritingLayout>
  );
}
