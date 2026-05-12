/**
 * 学習のプロセス — Stitch: 상단 컬러 카드 + 번호/제목/설명
 * 실제 이미지: `public/writing/images/process-write.jpg` 등 추가 후 `imageSrc` 설정
 */
type Step = {
  no: string
  title: string
  desc: string
  sub: string
  imageClass: string
  /** 예: `${import.meta.env.BASE_URL}writing/images/process-write.jpg` */
  imageSrc?: string
  imageAlt: string
}

const STEPS: Step[] = [
  {
    no: '01',
    title: '執筆と提出',
    desc: '独自のプラットフォームで課題を執筆・提出します。',
    sub: '課題の提出',
    imageClass: 'bg-[#efe7cc]',
    imageAlt: '執筆と提出のイメージ',
  },
  {
    no: '02',
    title: '講師からのフィードバック',
    desc: '専門講師が文法、語彙、文体を緻密に添削します。',
    sub: '専門家による添削',
    imageClass: 'bg-[#e0e4f0]',
    imageAlt: '講師からのフィードバック',
  },
  {
    no: '03',
    title: '模範文と復習',
    desc: '模範解答を参考に、自身の表現をアップデートします。',
    sub: '模範文で確認',
    imageClass: 'bg-[#eeeeee]',
    imageAlt: '模範文と復習',
  },
]

export default function LandingProcess() {
  return (
    <section id="learning-system" className="py-24 px-6 md:px-8 max-w-7xl mx-auto">
      <h2 className="headline-font text-3xl md:text-4xl font-extrabold text-[#000666] mb-16 md:mb-20 text-center tracking-tight">
        学習のプロセス
      </h2>

      <div className="grid md:grid-cols-3 gap-10 md:gap-12">
        {STEPS.map((item) => (
          <div key={item.no} className="relative group">
            <div className="mb-6 md:mb-8 overflow-hidden rounded-xl shadow-[0_14px_34px_rgba(0,0,0,0.08)]">
              {item.imageSrc ? (
                <img
                  src={item.imageSrc}
                  alt={item.imageAlt}
                  className="w-full h-28 md:h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="h-28 md:h-40 w-full relative overflow-hidden">
                  <div
                    className={`absolute inset-0 ${item.imageClass} group-hover:scale-105 transition-transform duration-500`}
                  />
                  <div className="relative z-10 h-full flex items-center justify-center px-4 text-center">
                    <div>
                      <div className="text-[8px] md:text-[10px] font-bold tracking-[0.18em] text-[#000666]/35 mb-2">
                        {item.no}
                      </div>
                      <div className="text-[11px] md:text-sm font-bold text-[#000666]/55 italic">{item.title}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start gap-4">
              <span className="text-3xl md:text-4xl font-extrabold text-[#000666]/10 headline-font leading-none">
                {item.no}
              </span>

              <div>
                <h3 className="font-bold text-base md:text-xl mb-2 md:mb-4 headline-font text-[#000666]">{item.title}</h3>
                <p className="text-[#454652] text-xs md:text-sm leading-relaxed mb-3 md:mb-4">{item.desc}</p>
                <span className="text-[9px] md:text-[10px] font-bold text-[#000666]/40 tracking-wide">
                  {item.sub}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
