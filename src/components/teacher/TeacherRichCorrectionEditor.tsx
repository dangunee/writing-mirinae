import {
  useRef,
  useLayoutEffect,
  useImperativeHandle,
  forwardRef,
  type RefObject,
} from "react";
import { buildTeacherRichJson, type TeacherRichDocumentHtmlV1 } from "../../lib/teacherRichDocument";
import { sanitizeTeacherCorrectionHtml } from "../../lib/teacherCorrectionSanitize";

export type TeacherRichCorrectionEditorHandle = {
  /** Full contenteditable HTML (for comparison-text extraction — not selection-scoped). */
  getHtml: () => string;
  getDocumentJson: () => TeacherRichDocumentHtmlV1;
  focus: () => void;
};

type Props = {
  initialHtml: string;
};

function runOnEditable(ref: RefObject<HTMLDivElement | null>, fn: () => void) {
  const el = ref.current;
  if (!el) return;
  el.focus();
  fn();
}

const TeacherRichCorrectionEditor = forwardRef<TeacherRichCorrectionEditorHandle, Props>(
  function TeacherRichCorrectionEditor({ initialHtml }, ref) {
    const editableRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      if (editableRef.current) {
        editableRef.current.innerHTML = initialHtml;
      }
    }, [initialHtml]);

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => editableRef.current?.innerHTML ?? "",
        getDocumentJson: () => buildTeacherRichJson(editableRef.current?.innerHTML ?? ""),
        focus: () => {
          editableRef.current?.focus();
        },
      }),
      []
    );

    return (
      <div className="teacher-rich-wrap">
        <div className="teacher-rich-toolbar" role="toolbar" aria-label="書式">
          <button
            type="button"
            className="teacher-rich-tool"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runOnEditable(editableRef, () => document.execCommand("bold"))}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="teacher-rich-tool"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runOnEditable(editableRef, () => document.execCommand("underline"))}
            title="Underline"
          >
            <span style={{ textDecoration: "underline" }}>U</span>
          </button>
          <button
            type="button"
            className="teacher-rich-tool"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runOnEditable(editableRef, () => document.execCommand("strikeThrough"))}
            title="Strikethrough"
          >
            <span style={{ textDecoration: "line-through" }}>S</span>
          </button>
          <label className="teacher-rich-color">
            文字
            <input
              type="color"
              defaultValue="#111827"
              onChange={(e) => {
                const v = e.target.value;
                runOnEditable(editableRef, () => document.execCommand("foreColor", false, v));
              }}
            />
          </label>
          <label className="teacher-rich-color">
            背景
            <input
              type="color"
              defaultValue="#fff59d"
              onChange={(e) => {
                const v = e.target.value;
                runOnEditable(editableRef, () => {
                  const okHilite = document.execCommand("hiliteColor", false, v);
                  if (!okHilite) {
                    document.execCommand("backColor", false, v);
                  }
                });
              }}
            />
          </label>
        </div>
        <div
          ref={editableRef}
          className="teacher-rich-editable"
          contentEditable
          suppressContentEditableWarning
          onPaste={(e) => {
            e.preventDefault();
            const cd = e.clipboardData;
            const html = cd.getData("text/html");
            const plain = cd.getData("text/plain") ?? "";
            runOnEditable(editableRef, () => {
              if (typeof html === "string" && html.trim()) {
                const clean = sanitizeTeacherCorrectionHtml(html);
                if (clean.trim()) {
                  document.execCommand("insertHTML", false, clean);
                  return;
                }
              }
              if (plain) {
                document.execCommand("insertText", false, plain);
              }
            });
          }}
        />
      </div>
    );
  }
);

export default TeacherRichCorrectionEditor;
