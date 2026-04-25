import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import WritingLayout from "../components/WritingLayout";
import { apiUrl } from "../lib/apiUrl";
import TeacherRichCorrectionEditor, {
  type TeacherRichCorrectionEditorHandle,
} from "../components/teacher/TeacherRichCorrectionEditor";
import { buildInitialEditorHtml } from "../lib/teacherRichDocument";

/** GET /api/teacher/writing/submissions/:id 응답 (TeacherSubmissionDetail 요약) */
type TeacherSubmissionDetail = {
  submission: {
    id: string;
    bodyText: string | null;
    grammarCheckResult?: unknown | null;
  };
  session: { index: number };
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
  const [modelAnswer, setModelAnswer] = useState("");
  const [teacherComment, setTeacherComment] = useState("");
  const [grammarScore, setGrammarScore] = useState("");
  const [vocabularyScore, setVocabularyScore] = useState("");
  const [contextScore, setContextScore] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedRich, setSavedRich] = useState(false);
  const [savedImproved, setSavedImproved] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
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

  const submissions: ListRow[] = detail
    ? [
        {
          id: detail.submission.id,
          studentName: `세션 ${detail.session.index}회`,
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
      setModelAnswer("");
      setTeacherComment("");
      setGrammarScore("");
      setVocabularyScore("");
      setContextScore("");
      return;
    }
    setImprovedText(detail.correction?.improvedText ?? "");
    setModelAnswer(detail.correction?.modelAnswer ?? "");
    setTeacherComment(detail.correction?.teacherComment ?? "");
    const ev = detail.evaluation;
    setGrammarScore(ev?.grammarAccuracy != null ? String(ev.grammarAccuracy) : "");
    setVocabularyScore(ev?.vocabularyUsage != null ? String(ev.vocabularyUsage) : "");
    setContextScore(ev?.contextualFluency != null ? String(ev.contextualFluency) : "");
  }, [detail]);

  const busy = saving || savingRich || savingImproved || isPublishing;

  /** 모범답 · 코멘트 · 점수만 저장 (기존 「저장」) */
  const handleSave = async () => {
    if (!activeRow || !submissionId || busy || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const correctionRes = await fetch(
        apiUrl(`/api/teacher/writing/submissions/${submissionId}/correction`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelAnswer: modelAnswer ?? "",
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

  const handleCopyImproved = async () => {
    const text = improvedText ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("コピーしました");
    } catch {
      setCopyMessage("コピーに失敗しました");
    }
    setTimeout(() => setCopyMessage(null), 2500);
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
          <p>과제를 찾을 수 없습니다.</p>
          <Link to="/writing/teacher">목록으로</Link>
        </div>
      </WritingLayout>
    );
  }

  if (loading) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <p>로딩 중...</p>
          <Link to="/writing/teacher">목록으로</Link>
        </div>
      </WritingLayout>
    );
  }

  if (!detail) {
    return (
      <WritingLayout>
        <div className="correction-page">
          <p>과제를 찾을 수 없습니다.</p>
          <Link to="/writing/teacher">목록으로</Link>
        </div>
      </WritingLayout>
    );
  }

  return (
    <WritingLayout>
      <div className="correction-page">
        <div className="correction-header">
          <Link to="/writing/teacher" className="back-link">
            ← 목록으로
          </Link>
          <h1>첨삭: 세션 {detail.session.index}회</h1>
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
                  <div className="editor-actions" style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => void handleSaveRich()}
                      disabled={busy}
                    >
                      {savedRich ? "保存しました ✓" : "修正文を保存"}
                    </button>
                  </div>
                </div>
                <div className="editor-section">
                  <label>整理した比較文（ 정서문 ）</label>
                  <textarea
                    value={improvedText}
                    onChange={(e) => setImprovedText(e.target.value)}
                    className="correction-textarea"
                    rows={6}
                    placeholder="比較用の清書テキストを入力"
                  />
                  <div className="editor-actions" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="save-btn"
                      onClick={() => void handleSaveImproved()}
                      disabled={busy}
                    >
                      {savedImproved ? "保存しました ✓" : "比較文を保存"}
                    </button>
                    <button
                      type="button"
                      className="save-btn save-btn--secondary"
                      onClick={() => void handleCopyImproved()}
                    >
                      比較文をコピー
                    </button>
                    {copyMessage && (
                      <span className="copy-toast" role="status">
                        {copyMessage}
                      </span>
                    )}
                  </div>
                </div>
                <div className="editor-section">
                  <label>모범답</label>
                  <textarea
                    value={modelAnswer}
                    onChange={(e) => setModelAnswer(e.target.value)}
                    className="correction-textarea"
                    rows={6}
                    placeholder="모범답을 입력하세요"
                  />
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
