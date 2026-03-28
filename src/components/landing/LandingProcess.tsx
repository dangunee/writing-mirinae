const IMG_WRITE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuByd-HjL2Xq6LjKDTPKewDP1d-XibER1uyRB7qsY8owQdUXosjqc-c98r9wnKONCFSu7OVrBj2jajGVBUaqj4cFNQBg0BpQaH0W3TQbcrSklbVQ2_jYDFDs-MhKbv6X5W3LFNdTWuMmLGIiaTeuvheE9-4WQTA9ZnPzPXLZafz8_h08gpis4eVFuFjr3gNbgjt_cOoQ8sk5MK9JvVZCEvWTHMePazkl-CZj5l890eLwgkdmQOEJLfTauXBAMhfK1hphXJKTOuJ5kQw'
const IMG_FEEDBACK =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAqrypyCjE5ARPXIZZi5ZQ4TibTmvlcis6noa4Cc_ZPBnD6InkBkq7KaK08EmB1bcSN7yoQSF4ia9yaprZJfPQLLf6bhCgaJ7tDrwyKhjzW38__4ACL4FGjimXLmyMwJDu2gOMBd1bzE-JPPy487ULU7WeLpIpIGa3KvJu-8P6ywLspyfOc60nqAOej_2SKcbwiv1mIuBmfJ4KkBArUNCqW2AssLG4oKBXOoLV1_sLtgDC8z_QyTf-1EfnCvm4wvSdC9Am2iLJ0Nps'
const IMG_REVIEW =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAFv1t1cmWV1UwuEImjtK3xc6AimIiuPueOOg5Ofw7p26mk2uBEmAgayzdH8D-iR7UqN0TPBQu221B-9XCbPCUwVJvcvl1ilNfxC9gJvK_nvpPnE2mVbTf-EmflKAo19kwPvQRdmG5skSpRNrDH0f8bHpGT8ngSHWm8i7cyZQXNMdU-rkYLhOLAeInzZzS4TvaXXi09yAkKCD-7Knp-S6IzoiLFlTTiFXh6smOz_1h23hVGWmdgVuoq0xthRDMNF0OVegV8RMbPb1Q'

export default function LandingProcess() {
  return (
    <section id="learning-system" className="py-20 md:py-24 px-6 md:px-8 max-w-7xl mx-auto">
      <h2 className="headline-font text-3xl md:text-4xl font-extrabold text-[#000666] mb-12 md:mb-20 text-center tracking-tight">
        学習のプロセス
      </h2>
      <div className="grid md:grid-cols-3 gap-10 md:gap-12">
        <div className="relative group">
          <div className="mb-5 md:mb-8 overflow-hidden rounded-xl shadow-lg">
            <img alt="Writing" className="w-full h-40 md:h-48 object-cover group-hover:scale-105 transition-transform duration-500" src={IMG_WRITE} />
          </div>
          <div className="flex items-start gap-4">
            <span className="text-4xl font-extrabold text-[#000666]/10 headline-font">01</span>
            <div>
              <h3 className="font-bold text-lg md:text-xl mb-2 md:mb-4 headline-font">Write &amp; Submit</h3>
              <p className="text-[#454652] text-sm leading-relaxed mb-3 md:mb-4">
                独自のプラットフォームで課題を執筆・提出します。
              </p>
              <span className="text-[10px] font-bold text-[#000666]/40 tracking-widest uppercase">학생용 과제 제출</span>
            </div>
          </div>
        </div>
        <div className="relative group">
          <div className="mb-5 md:mb-8 overflow-hidden rounded-xl shadow-lg">
            <img alt="Feedback" className="w-full h-40 md:h-48 object-cover group-hover:scale-105 transition-transform duration-500" src={IMG_FEEDBACK} />
          </div>
          <div className="flex items-start gap-4">
            <span className="text-4xl font-extrabold text-[#000666]/10 headline-font">02</span>
            <div>
              <h3 className="font-bold text-lg md:text-xl mb-2 md:mb-4 headline-font">Professional Feedback</h3>
              <p className="text-[#454652] text-sm leading-relaxed mb-3 md:mb-4">
                専門講師が文法、語彙、文体を緻密に添削します。
              </p>
              <span className="text-[10px] font-bold text-[#000666]/40 tracking-widest uppercase">전문 첨삭</span>
            </div>
          </div>
        </div>
        <div className="relative group">
          <div className="mb-5 md:mb-8 overflow-hidden rounded-xl shadow-lg">
            <img alt="Review" className="w-full h-40 md:h-48 object-cover group-hover:scale-105 transition-transform duration-500" src={IMG_REVIEW} />
          </div>
          <div className="flex items-start gap-4">
            <span className="text-4xl font-extrabold text-[#000666]/10 headline-font">03</span>
            <div>
              <h3 className="font-bold text-lg md:text-xl mb-2 md:mb-4 headline-font">Model Answer &amp; Review</h3>
              <p className="text-[#454652] text-sm leading-relaxed mb-3 md:mb-4">
                模範解答を参考に、自身の表現をアップデートします。
              </p>
              <span className="text-[10px] font-bold text-[#000666]/40 tracking-widest uppercase">모범문 확인</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
