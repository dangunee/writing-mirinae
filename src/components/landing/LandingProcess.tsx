/**
 * 学習のプロセス — 상단 이미지 카드 + 번호/제목/설명 (Stitch)
 * 이미지는 `public/writing/images/*.jpg` 로 교체 가능 (동일 파일명).
 */
const REMOTE = {
  write:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuByd-HjL2Xq6LjKDTPKewDP1d-XibER1uyRB7qsY8owQdUXosjqc-c98r9wnKONCFSu7OVrBj2jajGVBUaqj4cFNQBg0BpQaH0W3TQbcrSklbVQ2_jYDFDs-MhKbv6X5W3LFNdTWuMmLGIiaTeuvheE9-4WQTA9ZnPzPXLZafz8_h08gpis4eVFuFjr3gNbgjt_cOoQ8sk5MK9JvVZCEvWTHMePazkl-CZj5l890eLwgkdmQOEJLfTauXBAMhfK1hphXJKTOuJ5kQw',
  feedback:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAqrypyCjE5ARPXIZZi5ZQ4TibTmvlcis6noa4Cc_ZPBnD6InkBkq7KaK08EmB1bcSN7yoQSF4ia9yaprZJfPQLLf6bhCgaJ7tDrwyKhjzW38__4ACL4FGjimXLmyMwJDu2gOMBd1bzE-JPPy487ULU7WeLpIpIGa3KvJu-8P6ywLspyfOc60nqAOej_2SKcbwiv1mIuBmfJ4KkBArUNCqW2AssLG4oKBXOoLV1_sLtgDC8z_QyTf-1EfnCvm4wvSdC9Am2iLJ0Nps',
  review:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAFv1t1cmWV1UwuEImjtK3xc6AimIiuPueOOg5Ofw7p26mk2uBEmAgayzdH8D-iR7UqN0TPBQu221B-9XCbPCUwVJvcvl1ilNfxC9gJvK_nvpPnE2mVbTf-EmflKAo19kwPvQRdmG5skSpRNrDH0f8bHpGT8ngSHWm8i7cyZQXNMdU-rkYLhOLAeInzZzS4TvaXXi09yAkKCD-7Knp-S6IzoiLFlTTiFXh6smOz_1h23hVGWmdgVuoq0xthRDMNF0OVegV8RMbPb1Q',
}

const STEPS = [
  {
    no: '01',
    title: 'Write & Submit',
    desc: '独自のプラットフォームで課題を執筆・提出します。',
    sub: '학생용 과제 제출',
    img: REMOTE.write,
  },
  {
    no: '02',
    title: 'Professional Feedback',
    desc: '専門講師が文法、語彙、文体を緻密に添削します。',
    sub: '전문 첨삭',
    img: REMOTE.feedback,
  },
  {
    no: '03',
    title: 'Model Answer & Review',
    desc: '模範解答を参考に、自身の表現をアップデートします。',
    sub: '모범문 확인',
    img: REMOTE.review,
  },
]

export default function LandingProcess() {
  return (
    <section id="learning-system" className="py-20 md:py-24 px-6 md:px-8 max-w-7xl mx-auto">
      <h2 className="headline-font text-3xl md:text-4xl font-extrabold text-[#000666] mb-12 md:mb-20 text-center tracking-tight">
        学習のプロセス
      </h2>

      <div className="grid md:grid-cols-3 gap-10 md:gap-12">
        {STEPS.map((item) => (
          <div key={item.no} className="relative group">
            <div className="mb-8 overflow-hidden rounded-xl shadow-lg">
              <img
                src={item.img}
                alt={item.title}
                className="w-full h-40 md:h-48 object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            <div className="flex items-start gap-4">
              <span className="text-4xl font-extrabold text-[#000666]/10 headline-font">{item.no}</span>
              <div>
                <h3 className="font-bold text-xl mb-4 headline-font text-[#000666]">{item.title}</h3>
                <p className="text-[#454652] text-sm leading-relaxed mb-4">{item.desc}</p>
                <span className="text-[10px] font-bold text-[#000666]/40 tracking-widest uppercase">{item.sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
