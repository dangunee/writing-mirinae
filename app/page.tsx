"use client";

import { useState, useEffect, useRef } from "react";

type AssignmentStatus = "미제출" | "제출완료" | "첨삭완료";
type CorrectionStatus = "-" | "확인" | "완료";

interface Assignment {
  id: string;
  title: string;
  dateRange: string;
  status: AssignmentStatus;
  correction: CorrectionStatus;
  studentView: boolean;
  content?: string;
  correctedContent?: string; // HTML with 첨삭 formatting
  submittedAt?: string;
  feedback?: string;
}

const MOCK_ASSIGNMENTS: Assignment[] = [
  { id: "1", title: "과제 1", dateRange: "2/15 ~ 2/21", status: "미제출", correction: "-", studentView: false },
  { id: "2", title: "과제 2", dateRange: "2/8 ~ 2/14", status: "미제출", correction: "-", studentView: false },
];

const MOCK_STUDENTS = [
  { id: "1", name: "학생 1" },
  { id: "2", name: "학생 2" },
];

interface AssignmentExample {
  id: number;
  title: string;
  topic: string;
  modelContent?: {
    courseInfo?: string;
    theme: string;
    question: string;
    grammarNote?: string;
    patterns: { pattern: string; example: string }[];
  };
}

const ASSIGNMENT_EXAMPLES: AssignmentExample[] = [
  {
    id: 1,
    title: "오늘 하루 일과",
    topic: "오늘 하루 동안 한 일을 3문장 이상으로 써 보세요.",
    modelContent: {
      courseInfo: "10回コースの第１回課題",
      theme: "오늘 하루 일과",
      question: "오늘 하루 동안 무엇을 했습니까? 아침, 점심, 저녁 시간을 어떻게 보냈는지 3문장 이상으로 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-ㄹ/줄 몰랐다　～とは思わなかった", example: "예) 그런 좋은 방법이 있는 줄 몰랐다." },
        { pattern: "○-(으)ㄹ까 한다 ～しようかと思う", example: "예) 스트레스를 풀러 여행을 갈까 한다." },
      ],
    },
  },
  {
    id: 2,
    title: "스트레스 푸는 법",
    topic: "스트레스를 느낄 때와 푸는 방법에 대해 써 보세요.",
    modelContent: {
      courseInfo: "10回コースの第４回課題",
      theme: "스트레스 푸는 법",
      question:
        "당신은 어떨 때 스트레스를 느낍니까？ 스트레스가 쌓였을 때는 어떤 방법으로 풉니까? 추천하고 싶은 방법이 있으면 소개해 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-ㄹ/줄 몰랐다　～とは思わなかった", example: "예) 그런 좋은 방법이 있는 줄 몰랐다." },
        { pattern: "○-(으)ㄹ까 한다 ～しようかと思う", example: "예) 스트레스를 풀러 여행을 갈까 한다." },
        { pattern: "○-(으)려고 ～しようと", example: "예) 살을 빼려고 저녁을 굶기로 했다." },
      ],
    },
  },
  {
    id: 3,
    title: "내가 좋아하는 음식",
    topic: "가장 좋아하는 음식과 그 이유를 써 보세요.",
    modelContent: {
      theme: "내가 좋아하는 음식",
      question: "가장 좋아하는 음식은 무엇입니까? 그 음식을 좋아하는 이유를 3문장 이상으로 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-ㄴ/은/는/(으)ㄹ 것 같다 ～ようだ", example: "예) 그 음식은 맛있을 것 같다." },
        { pattern: "○-기 때문에 ～ので", example: "예) 맛있기 때문에 자주 먹는다." },
      ],
    },
  },
  {
    id: 4,
    title: "주말 계획",
    topic: "이번 주말에 할 계획을 한국어로 써 보세요.",
    modelContent: {
      theme: "주말 계획",
      question: "이번 주말에 무엇을 할 계획입니까? 3문장 이상으로 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-(으)ㄹ 예정이다 ～予定だ", example: "예) 친구를 만날 예정이다." },
        { pattern: "○-기로 했다 ～することにした", example: "예) 영화를 보기로 했다." },
      ],
    },
  },
  {
    id: 5,
    title: "가족 소개",
    topic: "가족 구성원을 소개하는 글을 써 보세요.",
    modelContent: {
      theme: "가족 소개",
      question: "가족 구성원을 소개해 보세요. 각 가족에 대해 1문장 이상씩 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-ㄴ/은/는/(으)ㄹ N ～するN", example: "예) 요리를 하는 엄마가 있다." },
        { pattern: "○-고 ～て（接続）", example: "예) 아버지는 회사에 가고, 엄마는 집에 있다." },
      ],
    },
  },
  {
    id: 6,
    title: "한국 여행",
    topic: "한국에서 가고 싶은 곳과 그 이유를 써 보세요.",
    modelContent: {
      theme: "한국 여행",
      question: "한국에서 가고 싶은 곳이 있습니까? 그곳에 가고 싶은 이유를 3문장 이상으로 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-(으)ㄹ까 하다 ～しようかと思う", example: "예) 부산에 갈까 한다." },
        { pattern: "○-기로 했다 ～することにした", example: "예) 경복궁을 보기로 했다." },
      ],
    },
  },
  {
    id: 7,
    title: "나의 취미",
    topic: "취미 생활에 대해 5문장 이상으로 써 보세요.",
    modelContent: {
      theme: "나의 취미",
      question: "취미가 무엇입니까? 그 취미를 어떻게 즐기고 있는지 5문장 이상으로 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-는/(으)ㄴ/(으)ㄹ 때 ～時", example: "예) 심심할 때 음악을 듣는다." },
        { pattern: "○-기 시작하다 ～し始める", example: "예) 3년 전부터 기타를 치기 시작했다." },
      ],
    },
  },
  {
    id: 8,
    title: "기억에 남는 날",
    topic: "특별히 기억에 남는 하루를 써 보세요.",
    modelContent: {
      theme: "기억에 남는 날",
      question: "특별히 기억에 남는 날이 있습니까? 그날 무슨 일이 있었는지 3문장 이상으로 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-ㄴ/은/(으)ㄹ 때 ～時", example: "예) 그날은 날씨가 좋았다." },
        { pattern: "○-기 때문에 ～ので", example: "예) 특별한 날이었기 때문에 잊을 수 없다." },
      ],
    },
  },
  {
    id: 9,
    title: "한국어 공부 방법",
    topic: "한국어를 어떻게 공부하고 있는지 써 보세요.",
    modelContent: {
      theme: "한국어 공부 방법",
      question: "한국어를 어떻게 공부하고 있습니까? 효과적인 방법이 있다면 소개해 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-(으)면서 ～ながら", example: "예) 드라마를 보면서 한국어를 배운다." },
        { pattern: "○-는/(으)ㄴ/(으)ㄹ 것 같다 ～ようだ", example: "예) 이 방법이 효과적일 것 같다." },
      ],
    },
  },
  {
    id: 10,
    title: "내 꿈",
    topic: "미래의 꿈이나 목표에 대해 써 보세요.",
    modelContent: {
      theme: "내 꿈",
      question: "미래의 꿈이나 목표가 있습니까? 그 꿈을 위해 무엇을 하고 있는지 5문장 이상으로 써 보세요.",
      grammarNote: "下記に提示された文型を、必ず2つ以上使用すること。",
      patterns: [
        { pattern: "○-(으)려고 ～しようと", example: "예) 꿈을 이루려고 열심히 공부한다." },
        { pattern: "○-기 위해 ～ために", example: "예) 좋은 직업을 갖기 위해 노력한다." },
      ],
    },
  },
];

const STORAGE_KEY = "writing_assignments";

function getStoredAssignments(): Assignment[] {
  if (typeof window === "undefined") return MOCK_ASSIGNMENTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.length > 0 ? parsed : MOCK_ASSIGNMENTS;
    }
  } catch {}
  return MOCK_ASSIGNMENTS;
}

function saveAssignments(assignments: Assignment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

type TabId = "experience" | "writing" | "topik";

const TABS: { id: TabId; label: string }[] = [
  { id: "experience", label: "体験例" },
  { id: "writing", label: "作文トレーニング" },
  { id: "topik", label: "TOPIK作文トレーニング" },
];

export default function WritingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("writing");
  const [assignments, setAssignments] = useState<Assignment[]>(MOCK_ASSIGNMENTS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [submitContent, setSubmitContent] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<Assignment | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<Assignment | null>(null);
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [expandedExampleId, setExpandedExampleId] = useState<number | null>(null);
  const [showExampleSubmitModal, setShowExampleSubmitModal] = useState(false);
  const [exampleSubmitContent, setExampleSubmitContent] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewingStudent && editorRef.current) {
      editorRef.current.innerHTML =
        viewingStudent.correctedContent ??
        (viewingStudent.content ? viewingStudent.content.replace(/\n/g, "<br>") : "<p><br></p>");
    }
  }, [viewingStudent]);

  useEffect(() => {
    setAssignments(getStoredAssignments());
  }, []);

  const groupedByDate = assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
    if (!acc[a.dateRange]) acc[a.dateRange] = [];
    acc[a.dateRange].push(a);
    return acc;
  }, {});

  const sortedDateRanges = Object.keys(groupedByDate).sort((a, b) => {
    const parseDate = (s: string) => {
      const [start] = s.split(" ~ ");
      const [m, d] = start.split("/").map(Number);
      return m * 100 + d;
    };
    return parseDate(b) - parseDate(a);
  });

  const handleSubmitClick = () => {
    setSelectedAssignment(null);
    setSelectedStudentId("");
    setSelectedAssignmentId("");
    setSubmitContent("");
    setShowSubmitModal(true);
  };

  const handleExampleSubmitClick = () => {
    setExampleSubmitContent("");
    setShowExampleSubmitModal(true);
  };

  const handleCloseExampleSubmitModal = () => {
    setShowExampleSubmitModal(false);
    setExampleSubmitContent("");
  };

  const selectedExample = expandedExampleId ? ASSIGNMENT_EXAMPLES.find((ex) => ex.id === expandedExampleId) : null;

  const handleSubmitAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setSelectedAssignmentId(assignment.id);
    setSelectedStudentId("");
    setSubmitContent(assignment.content || "");
    setShowSubmitModal(true);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
    setSelectedAssignment(null);
    setSelectedStudentId("");
    setSelectedAssignmentId("");
    setSubmitContent("");
  };

  const handleConfirmSubmit = () => {
    if (!submitContent.trim()) return;
    setSubmitLoading(true);

    setTimeout(() => {
      const targetId = selectedAssignmentId || selectedAssignment?.id || assignments.find((x) => x.status === "미제출")?.id;
      const updated = assignments.map((a) =>
        a.id === targetId
          ? {
              ...a,
              status: "제출완료" as AssignmentStatus,
              content: submitContent,
              submittedAt: new Date().toISOString(),
            }
          : a
      );

      setAssignments(updated);
      saveAssignments(updated);
      setSubmitLoading(false);
      handleCloseSubmitModal();
    }, 600);
  };

  const handleViewStudent = (a: Assignment) => {
    setViewingStudent(a);
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleSaveCorrectedContent = () => {
    if (!viewingStudent || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const updated = assignments.map((a) =>
      a.id === viewingStudent.id ? { ...a, correctedContent: html, correction: "완료" as CorrectionStatus, status: "첨삭완료" as AssignmentStatus } : a
    );
    setAssignments(updated);
    saveAssignments(updated);
    setViewingStudent(null);
  };

  const handleOpenFeedback = (a: Assignment) => {
    setFeedbackModal(a);
    setTeacherFeedback(a.feedback || "");
  };

  const handleSaveFeedback = () => {
    if (!feedbackModal) return;
    const updated = assignments.map((a) =>
      a.id === feedbackModal.id
        ? { ...a, feedback: teacherFeedback, correction: "완료" as CorrectionStatus, status: "첨삭완료" as AssignmentStatus }
        : a
    );
    setAssignments(updated);
    saveAssignments(updated);
    setFeedbackModal(null);
    setTeacherFeedback("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f6f1]">
      {/* Header */}
      <header className="bg-[#1a4d2e] text-white py-4 md:py-6 px-4 md:px-6 shadow-lg">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-xl md:text-3xl font-bold tracking-wide">writing.mirinae.jp</h1>
          <p className="text-xs md:text-base mt-1 opacity-90">ミリネ韓国語教室・作文トレーニング</p>
        </div>
      </header>

      <div className="flex flex-1 justify-center">
        <div className="flex flex-1 flex-col md:flex-row max-w-4xl w-full">
        {/* Sidebar - hidden on mobile, shown on desktop */}
        <aside
          className={`hidden md:flex ${
            sidebarCollapsed ? "md:w-16" : "md:w-56"
          } shrink-0 bg-[#f5f0e6] border-r border-[#e5dfd4] transition-all duration-300 flex-col`}
        >
          <div className="p-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-[#ebe5da] transition-colors"
              aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            >
              <span className={`text-gray-500 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}>◀</span>
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="px-4 pb-6">
              <div className="bg-white rounded-xl border border-[#e5dfd4] shadow-sm p-4">
                <h2 className="font-semibold text-gray-800 mb-3 text-sm">과제 제출</h2>
                <button
                  onClick={handleSubmitClick}
                  className="w-full py-3 px-4 bg-[#1a4d2e] hover:bg-[#2d6a4a] text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  과제 제출 버튼
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Tabs - 메인 영역 안에 배치 (사이드바 위로 가지 않음) */}
          <div className="bg-white border-b border-[#e5dfd4] shadow-sm shrink-0">
            <nav className="flex gap-4 sm:gap-8 overflow-x-auto px-4 md:px-6 py-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-[#1a4d2e] text-[#1a4d2e]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-6">
          {/* 体験例 Tab */}
          {activeTab === "experience" && (
            <div className="max-w-2xl">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">体験例</h2>
              <div className="bg-white rounded-xl border border-[#e5dfd4] shadow-sm p-6">
                <p className="text-gray-600">体験例のコンテンツはこちらに表示されます。</p>
                <p className="text-gray-500 text-sm mt-2">準備中です。</p>
              </div>
            </div>
          )}

          {/* 作文トレーニング Tab */}
          {activeTab === "writing" && (
            <>
              {/* Mobile: Submit card */}
              <div className="md:hidden mb-4">
                <div className="bg-white rounded-xl border border-[#e5dfd4] shadow-sm p-4">
                  <h2 className="font-semibold text-gray-800 mb-2 text-sm">과제 제출</h2>
                  <button
                    onClick={handleSubmitClick}
                    className="w-full py-3 px-4 bg-[#1a4d2e] hover:bg-[#2d6a4a] text-white font-medium rounded-lg"
                  >
                    과제 제출 버튼
                  </button>
                </div>
              </div>

              {/* 과제 예시 게시판 (10개) - 풀다운 */}
              <div className="mb-6 md:mb-8">
                <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">과제 예시 게시판</h2>
                <div className="bg-white rounded-xl border border-[#e5dfd4] shadow-sm overflow-hidden">
                  <div className="px-4 md:px-5 py-3 bg-[#faf8f5] border-b border-[#e5dfd4] font-semibold text-gray-800 text-sm md:text-base">
                    과제 예시 (10개)
                  </div>
                  <div className="divide-y divide-[#e5dfd4]">
                    {ASSIGNMENT_EXAMPLES.map((ex) => (
                      <div key={ex.id} className="">
                        <button
                          type="button"
                          onClick={() => setExpandedExampleId(expandedExampleId === ex.id ? null : ex.id)}
                          className="w-full px-4 md:px-5 py-3 hover:bg-[#faf8f5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 text-xs w-4 inline-block">
                              {expandedExampleId === ex.id ? "▼" : "▶"}
                            </span>
                            <span className="font-medium text-gray-800">{ex.title}</span>
                          </div>
                          <p className="text-gray-600 text-sm pl-9 sm:pl-0 sm:max-w-md">{ex.topic}</p>
                        </button>
                        {expandedExampleId === ex.id && ex.modelContent && (
                          <div className="px-4 md:px-5 pb-4 pt-0 border-t border-[#e5dfd4] bg-[#fafbfc]">
                            <div className="mt-3 flex flex-col sm:flex-row gap-3">
                              <div className="flex-1 p-4 rounded-xl bg-white border border-[#e5dfd4] text-sm space-y-4">
                                {ex.modelContent.courseInfo && (
                                  <p className="text-gray-600 font-medium">
                                    {ex.modelContent.courseInfo}：　テーマ： {ex.modelContent.theme}
                                  </p>
                                )}
                                {!ex.modelContent.courseInfo && (
                                  <p className="text-gray-600 font-medium">テーマ：{ex.modelContent.theme}</p>
                                )}
                                <p className="text-gray-800 leading-relaxed">{ex.modelContent.question}</p>
                                {ex.modelContent.grammarNote && (
                                  <p className="text-gray-600 font-medium">{ex.modelContent.grammarNote}</p>
                                )}
                                <div className="space-y-2 pt-2">
                                  {ex.modelContent.patterns.map((p, i) => (
                                    <div key={i} className="text-gray-700">
                                      <p className="font-medium text-gray-800">○ {p.pattern}</p>
                                      <p className="text-gray-600 pl-2">{p.example}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="sm:shrink-0 flex sm:flex-col justify-end">
                                <button
                                  onClick={handleExampleSubmitClick}
                                  className="w-full sm:w-auto px-5 py-3 bg-[#1a4d2e] hover:bg-[#2d6a4a] text-white font-medium rounded-xl shadow-md whitespace-nowrap"
                                >
                                  과제 제출
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6">게시글 리스트</h2>

              <div className="space-y-4 md:space-y-6">
            {sortedDateRanges.map((dateRange) => (
              <div
                key={dateRange}
                className="bg-white rounded-xl border border-[#e5dfd4] shadow-sm overflow-hidden"
              >
                <div className="px-4 md:px-5 py-3 bg-[#faf8f5] border-b border-[#e5dfd4] font-semibold text-gray-800 text-sm md:text-base">
                  {dateRange}
                </div>
                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#f5f0e6] text-gray-700 text-sm">
                        <th className="text-left py-3 px-4 font-medium">과제</th>
                        <th className="text-left py-3 px-4 font-medium">과제 제출</th>
                        <th className="text-left py-3 px-4 font-medium">첨삭</th>
                        <th className="text-left py-3 px-4 font-medium">학생 보기</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedByDate[dateRange].map((a) => (
                        <tr key={a.id} className="border-t border-[#e5dfd4] hover:bg-[#faf8f5]">
                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-800">{a.title}</span>
                          </td>
                          <td className="py-3 px-4">
                            {a.status === "미제출" ? (
                              <button
                                onClick={() => handleSubmitAssignment(a)}
                                className="text-[#c53030] hover:text-[#9b2c2c] font-medium underline"
                              >
                                미제출
                              </button>
                            ) : (
                              <span className="text-[#2d7d46] font-medium">{a.status}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {a.correction === "-" ? (
                              <span className="text-gray-400">-</span>
                            ) : a.status === "첨삭완료" ? (
                              <button
                                onClick={() => handleOpenFeedback(a)}
                                className="text-[#1a4d2e] hover:underline font-medium"
                              >
                                확인
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenFeedback(a)}
                                className="text-[#1a4d2e] hover:underline"
                              >
                                {a.correction}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {a.content ? (
                              <button
                                onClick={() => handleViewStudent(a)}
                                className="text-[#1a4d2e] hover:underline"
                              >
                                학생 보기
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile: Card layout */}
                <div className="md:hidden divide-y divide-[#e5dfd4]">
                  {groupedByDate[dateRange].map((a) => (
                    <div key={a.id} className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-800">{a.title}</span>
                        {a.status === "미제출" ? (
                          <button
                            onClick={() => handleSubmitAssignment(a)}
                            className="text-sm text-[#c53030] font-medium underline"
                          >
                            미제출
                          </button>
                        ) : (
                          <span className="text-sm text-[#2d7d46] font-medium">{a.status}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        {a.content && (
                          <button
                            onClick={() => handleOpenFeedback(a)}
                            className="text-[#1a4d2e] hover:underline"
                          >
                            {a.correction === "-" ? "첨삭하기" : "첨삭 확인"}
                          </button>
                        )}
                        {a.content && (
                          <button
                            onClick={() => handleViewStudent(a)}
                            className="text-[#1a4d2e] hover:underline"
                          >
                            학생 보기
                          </button>
                        )}
                        {!a.content && <span className="text-gray-400">첨삭: -</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
            </>
          )}

          {/* TOPIK作文トレーニング Tab */}
          {activeTab === "topik" && (
            <div className="max-w-2xl">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">TOPIK作文トレーニング</h2>
              <div className="bg-white rounded-xl border border-[#e5dfd4] shadow-sm p-6">
                <p className="text-gray-600">TOPIK作文トレーニングのコンテンツはこちらに表示されます。</p>
                <p className="text-gray-500 text-sm mt-2">準備中です。</p>
              </div>
            </div>
          )}
          </div>
        </main>
        </div>
      </div>


      {/* 과제 예시 기반 제출 모달 */}
      {showExampleSubmitModal && selectedExample?.modelContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="relative px-4 sm:px-6 py-4 shrink-0 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 text-center pr-14">
                과제 제출 - {selectedExample.title}
              </h3>
              <button
                onClick={handleCloseExampleSubmitModal}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 font-medium shrink-0"
              >
                취소
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* 과제 예시 내용 */}
              <div className="p-4 rounded-xl bg-[#faf8f5] border border-[#e5dfd4] text-sm space-y-3">
                {selectedExample.modelContent.courseInfo && (
                  <p className="text-gray-600 font-medium">
                    {selectedExample.modelContent.courseInfo}：　テーマ： {selectedExample.modelContent.theme}
                  </p>
                )}
                {!selectedExample.modelContent.courseInfo && (
                  <p className="text-gray-600 font-medium">テーマ：{selectedExample.modelContent.theme}</p>
                )}
                <p className="text-gray-800 leading-relaxed">{selectedExample.modelContent.question}</p>
                {selectedExample.modelContent.grammarNote && (
                  <p className="text-gray-600 font-medium">{selectedExample.modelContent.grammarNote}</p>
                )}
                <div className="space-y-2 pt-2">
                  {selectedExample.modelContent.patterns.map((p, i) => (
                    <div key={i} className="text-gray-700">
                      <p className="font-medium text-gray-800">○ {p.pattern}</p>
                      <p className="text-gray-600 pl-2">{p.example}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* 구분선 */}
              <div className="border-t-2 border-dashed border-[#e5dfd4]" />
              {/* 학생 입력 영역 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">작문 내용</label>
                <textarea
                  value={exampleSubmitContent}
                  onChange={(e) => setExampleSubmitContent(e.target.value)}
                  placeholder="여기에 글을 입력해 주세요..."
                  className="w-full min-h-[200px] p-4 border border-gray-200 rounded-xl resize-y focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 flex justify-end shrink-0 border-t border-gray-200">
              <button
                onClick={() => {
                  const targetId = assignments.find((x) => x.status === "미제출")?.id;
                  if (targetId) {
                    const updated = assignments.map((a) =>
                      a.id === targetId
                        ? {
                            ...a,
                            status: "제출완료" as AssignmentStatus,
                            content: exampleSubmitContent,
                            submittedAt: new Date().toISOString(),
                          }
                        : a
                    );
                    setAssignments(updated);
                    saveAssignments(updated);
                  }
                  handleCloseExampleSubmitModal();
                }}
                disabled={!exampleSubmitContent.trim()}
                className="px-6 py-2.5 bg-[#86efac] hover:bg-[#4ade80] disabled:opacity-50 text-gray-800 font-medium rounded-xl"
              >
                제출하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Modal - 새로운 스레드 */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="relative px-4 sm:px-6 py-4 shrink-0">
              <h3 className="text-lg font-bold text-gray-800 text-center pr-14">새로운 스레드</h3>
              <button
                onClick={handleCloseSubmitModal}
                className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 font-medium shrink-0"
              >
                취소
              </button>
            </div>
            <div className="px-4 sm:px-6 pb-6 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">학생 선택</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent bg-white"
                >
                  <option value="">선택하세요</option>
                  {MOCK_STUDENTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">과제 선택</label>
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent bg-white"
                >
                  <option value="">선택하세요</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.dateRange})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">과제 내용</label>
                <textarea
                  value={submitContent}
                  onChange={(e) => setSubmitContent(e.target.value)}
                  placeholder="새로운 소식이 있나요?"
                  className="w-full h-40 p-4 border border-gray-200 rounded-xl resize-y focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-4 sm:px-6 py-4 flex justify-end shrink-0">
              <button
                onClick={handleConfirmSubmit}
                disabled={!submitContent.trim() || submitLoading}
                className="px-6 py-2.5 bg-[#86efac] hover:bg-[#4ade80] disabled:opacity-50 text-gray-800 font-medium rounded-xl transition-colors"
              >
                {submitLoading ? "제출 중..." : "게시"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student View Modal - 첨삭용 텍스트 에디터 */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-gray-800">학생 보기 - {viewingStudent.title}</h3>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {/* 포맷 툴바 */}
            <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap gap-2 shrink-0 bg-gray-50">
              <button
                type="button"
                onClick={() => applyFormat("strikeThrough")}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-200"
                title="가운데 선"
              >
                S̶
              </button>
              <button
                type="button"
                onClick={() => applyFormat("foreColor", "#dc2626")}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-200 text-red-600"
                title="빨간색"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => applyFormat("foreColor", "#2563eb")}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-200 text-blue-600"
                title="파란색"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => applyFormat("underline")}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-200 underline"
                title="밑줄"
              >
                U
              </button>
              <button
                type="button"
                onClick={() => applyFormat("removeFormat")}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-200 text-gray-500"
                title="포맷 제거"
              >
                ✕
              </button>
            </div>
            {/* 에디터 영역 */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[200px] p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent outline-none text-gray-800 leading-relaxed"
              />
              {viewingStudent.feedback && (
                <div className="mt-4 p-4 bg-[#f0fdf4] rounded-xl border border-[#86efac]">
                  <h4 className="font-semibold text-[#166534] mb-2">첨삭 피드백</h4>
                  <p className="whitespace-pre-wrap text-gray-700">{viewingStudent.feedback}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setViewingStudent(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSaveCorrectedContent}
                className="px-5 py-2 bg-[#1a4d2e] hover:bg-[#2d6a4a] text-white font-medium rounded-lg"
              >
                첨삭 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal (Teacher) */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">첨삭 - {feedbackModal.title}</h3>
              <button
                onClick={() => {
                  setFeedbackModal(null);
                  setTeacherFeedback("");
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {feedbackModal.content && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">학생 제출 내용</h4>
                  <p className="whitespace-pre-wrap text-gray-600 bg-gray-50 p-4 rounded-lg">
                    {feedbackModal.content}
                  </p>
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-700 mb-2">첨삭 피드백</label>
                <textarea
                  value={teacherFeedback}
                  onChange={(e) => setTeacherFeedback(e.target.value)}
                  placeholder="첨삭 내용을 입력해 주세요..."
                  className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-[#1a4d2e] focus:border-transparent"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleSaveFeedback}
                className="px-5 py-2 bg-[#1a4d2e] hover:bg-[#2d6a4a] text-white font-medium rounded-lg"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
