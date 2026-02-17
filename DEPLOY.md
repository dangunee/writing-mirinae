# writing.mirinae.jp 배포 가이드

## 1. Git 저장소 초기화 및 GitHub 푸시

```bash
cd /Users/dangunee/Desktop/writing-mirinae

# Git 초기화
git init

# 파일 추가
git add .
git commit -m "Initial commit: writing-mirinae"

# GitHub에서 새 저장소 생성 후 (예: writing-mirinae)
git remote add origin https://github.com/YOUR_USERNAME/writing-mirinae.git
git branch -M main
git push -u origin main
```

## 2. Vercel에 프로젝트 Import

1. [vercel.com](https://vercel.com) 로그인
2. **Add New...** → **Project**
3. **Import Git Repository**에서 `writing-mirinae` 저장소 선택
4. **Import** 클릭
5. Framework Preset: Next.js (자동 감지)
6. **Deploy** 클릭

## 3. 도메인 추가

1. 배포된 프로젝트 → **Settings** → **Domains**
2. `writing.mirinae.jp` 입력 후 **Add**
3. Vercel이 DNS 설정 방법을 안내합니다

## 4. DNS 설정

도메인 관리 페이지(예: お名前.com, ムームードメイン 등)에서:

### CNAME 방식 (권장)
| 타입 | 이름 | 값 |
|------|------|-----|
| CNAME | writing | cname.vercel-dns.com |

### A 레코드 방식
| 타입 | 이름 | 값 |
|------|------|-----|
| A | writing | 76.76.21.21 |

> **참고**: `writing.mirinae.jp`의 경우 `writing`이 서브도메인입니다.  
> 루트 도메인 `mirinae.jp`에 `writing` 서브도메인을 추가하는 형태입니다.

## 5. SSL 인증서

Vercel이 자동으로 Let's Encrypt SSL을 발급합니다. DNS 전파 후 몇 분~몇 시간 소요될 수 있습니다.
