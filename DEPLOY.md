# writing.mirinae.jp Vercel 배포 가이드

## 1. 로컬에서 빌드 확인

```bash
cd /Users/dangunee/writing-mirinae
npm install
npm run build
```

`dist/` 폴더가 생성되면 빌드 성공입니다.

## 2. Vercel 배포

### 방법 A: Vercel CLI

```bash
# Vercel CLI 설치 (처음 한 번만)
npm i -g vercel

# 로그인 (브라우저가 열림)
vercel login

# 배포
cd /Users/dangunee/writing-mirinae
vercel --prod
```

### 방법 B: Vercel 웹사이트 (Git 연동)

1. [vercel.com](https://vercel.com) 로그인
2. **Add New** → **Project**
3. GitHub에 writing-mirinae 저장소가 있다면 **Import**  
   없다면 **Deploy** → **Browse**에서 `writing-mirinae` 폴더 선택
4. Framework Preset: **Vite** (자동 감지됨)
5. **Deploy** 클릭

## 3. 커스텀 도메인 추가 (writing.mirinae.jp)

1. Vercel 대시보드 → 프로젝트 선택 → **Settings** → **Domains**
2. **Add** 클릭 후 `writing.mirinae.jp` 입력
3. Vercel이 표시하는 DNS 설정대로 진행:

   **CNAME 레코드 추가:**
   - Name: `writing` (또는 `writing.mirinae`)
   - Value: `cname.vercel-dns.com`

4. mirinae.jp 도메인 관리 페이지(가비아, Cloudflare 등)에서 위 설정 추가
5. 전파 완료까지 수 분~24시간 소요될 수 있음

## 4. 확인

배포 후 `https://writing.mirinae.jp` 로 접속해 확인하세요.
