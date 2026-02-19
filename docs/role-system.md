# KMCC 역할 기반 권한 관리 체계

> 카카오모빌리티 고객센터(KMCC) 상담사/관리자 권한 구분 방식 및 참조 데이터

## 1. 역할 계층 (ROLE_HIERARCHY)

| Level | 역할 | 설명 |
|-------|------|------|
| 6 | 마스터권한자 | 시스템 전체 관리. 역할 부여/해제, 시스템 설정 변경 |
| 5 | 본사권한자 | 본사 직원 (`@kakaomobility.com`). 전체 센터 데이터 조회 |
| 4 | LB (LB담당자) | Learning & Business 담당. 전체 센터 접근, 문제 승인 |
| 3 | 강사 | 교육 담당. 문제 출제, 채점 정정, 결과 공개 |
| 2 | 관리자 | 센터 관리자. 본인 센터 결과 조회, 피드백 작성 |
| 1 | 상담사 | 일반 상담사. 본인 데이터만 조회 |

```python
ROLE_HIERARCHY = {
    '마스터권한자': 6, '본사권한자': 5, 'LB': 4, 'LB담당자': 4,
    '강사': 3, '관리자': 2, '상담사': 1
}
```

## 2. 역할별 권한 매트릭스

| 권한 | 상담사 | 관리자 | 강사 | LB | 본사 | 마스터 |
|------|:------:|:------:|:----:|:--:|:----:|:------:|
| 본인 결과 조회 | O | O | O | O | O | O |
| 센터 결과 조회 | - | O | O | O | O | O |
| 전체 결과 조회 | - | - | - | - | O | O |
| 피드백 작성 | - | O | O | O | O | O |
| 문제 출제 | - | - | O | O | O | O |
| 채점 정정 | - | - | O | O | O | O |
| 결과 공개 | - | - | O | O | O | O |
| 문제 승인 | - | - | - | O | O | O |
| 역할 관리 | - | - | - | - | - | O |
| 시스템 설정 | - | - | - | - | - | O |
| 데이터 수정 | - | - | - | - | - | O |

```python
# 권한 생성 로직 (_build_permissions)
permissions = {
    'canManageRoles':        level >= 6,  # 역할 관리
    'canManageSystem':       level >= 6,  # 시스템 설정
    'canModifyData':         level >= 6,  # 데이터 수정
    'canViewAllResults':     level >= 5,  # 전체 결과 조회
    'canApproveQuestions':   level >= 4,  # 문제 승인
    'canCreateQuestions':    level >= 3,  # 문제 출제
    'canCorrectScores':      level >= 3,  # 채점 정정
    'canPublishResults':     level >= 3,  # 결과 공개
    'canViewCenterResults':  level >= 2,  # 센터 결과 조회
    'canGiveFeedback':       level >= 2,  # 피드백 작성
}
```

## 3. 데이터 접근 범위

| Level | 접근 범위 |
|-------|----------|
| 5~6 (마스터/본사) | 전체 센터 (제한 없음) |
| 4 (LB) | 전체 센터 (제한 없음) |
| 2~3 (관리자/강사) | 본인 소속 센터만 (`모빌리티크루`는 전체) |
| 1 (상담사) | 본인 데이터만 |

```python
def get_accessible_centers(user_id, email):
    level = get_user_role(user_id, email)['level']
    if level >= 4:       return None   # 전체
    if level >= 2:       return [center]  # 본인 센터
    return []            # 본인만
```

## 4. 역할 판별 흐름

```
사용자 로그인
  │
  ├─ 1) MASTER_USERS 하드코딩 목록에 포함?
  │     → YES: 마스터권한자 (level 6)
  │
  ├─ 2) user_roles 테이블에 is_active=TRUE 레코드 존재?
  │     → YES: 해당 role 반환 (최고 레벨 우선)
  │
  ├─ 3) 이메일 도메인이 @kakaomobility.com? (본사 직원)
  │     → YES: 본사권한자 (level 5)
  │
  └─ 4) 위 모두 해당 없음
        → 상담사 (level 1, 기본값)
```

## 5. 참조 데이터세트 (BigQuery)

### 5.1 프로젝트 정보
- **GCP 프로젝트**: `csopp-25f2`
- **데이터세트**: `quiz_results`
- **리전**: `asia-northeast3` (서울)

### 5.2 users 테이블

모든 사용자 계정 정보. 로그인 시 생성/업데이트.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | STRING | 아이디 (`hong.koc`, `kim.itx`) |
| email | STRING | 이메일 (`hong.koc@cs-kakaomobility.com`) |
| password_hash | STRING | 비밀번호 해시 (werkzeug) |
| name | STRING | 이름 |
| center | STRING | 소속 센터 (`용산`, `광주`) |
| group | STRING | 그룹 |
| detailed_group | STRING | 상세 그룹 |
| counsel_channel | STRING | 상담 채널 |
| training_start | DATE | 교육 시작일 |
| work_shift | STRING | 근무 형태 |
| must_change_password | BOOL | 임시 비밀번호 변경 필요 여부 |
| is_active | BOOL | 활성 상태 |
| role | STRING | 역할 (레거시, user_roles로 이전) |
| created_at | TIMESTAMP | 생성 시간 |
| last_login_at | TIMESTAMP | 마지막 로그인 |

### 5.3 user_roles 테이블

역할 관리 전용 테이블. 관리자 이상 역할만 등록 (상담사는 기본값이므로 미등록).

| 컬럼 | 타입 | NOT NULL | 설명 |
|------|------|:--------:|------|
| user_id | STRING | O | 아이디 |
| email | STRING | - | 이메일 |
| role | STRING | O | 역할 (`강사`, `관리자`, `LB`, `본사권한자`, `마스터권한자`) |
| center | STRING | - | 소속 센터 |
| service | STRING | - | 담당 서비스 |
| name | STRING | - | 이름 |
| slack_user_id | STRING | - | 슬랙 사용자 ID |
| is_active | BOOL | O | 활성 상태 |
| created_at | TIMESTAMP | O | 생성 시간 |
| created_by | STRING | - | 등록자 |
| updated_at | TIMESTAMP | - | 수정 시간 |
| updated_by | STRING | - | 수정자 |

### 5.4 admins 테이블

레거시 관리자 테이블 (user_roles로 이전 중, 폴백용 유지).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| user_id | STRING | 아이디 |
| center | STRING | 소속 센터 |
| service | STRING | 담당 서비스 |
| admin_group | STRING | 관리자 그룹 |
| created_at | TIMESTAMP | 생성 시간 |
| created_by | STRING | 등록자 |

## 6. 사용자 식별 체계

### 6.1 아이디 형식

```
{영문이름}.{센터코드}
```

| 센터코드 | 센터 | 이메일 도메인 |
|---------|------|-------------|
| `.koc` | 용산 (KOC) | `@cs-kakaomobility.com` |
| `.itx` | 광주 (ITX) | `@cs-kakaomobility.com` |

- 아이디 검증 정규식: `^[a-zA-Z0-9]+\.(itx|koc)$`
- 예: `hong.koc`, `kim.itx`

### 6.2 이메일 도메인 구분

| 도메인 | 사용자 유형 | 비고 |
|--------|-----------|------|
| `@kakaomobility.com` | 본사 직원 | Google OAuth 로그인, 자동 본사권한자 |
| `@cs-kakaomobility.com` | 상담사/관리자 | ID/PW 로그인 |
| `@nomail.kakaocorp.com` | 카카오 내부 | Google OAuth 로그인 |

### 6.3 센터 자동 판별 로직

```python
def get_center_from_email(email):
    if '.koc' in email:                         → '용산'
    elif '.itx' in email:                       → '광주'
    elif '@cs-kakaomobility.com' in email:      → '용산' (기본)
    elif '@nomail.kakaocorp.com' in email:       → '용산'
    elif '@kakaomobility.com' in email:          → '용산'
    else:                                        → '용산' (기본값)
```

## 7. 로그인 방식

| 방식 | 대상 | 경로 | 검증 |
|------|------|------|------|
| ID/PW | 상담사, 관리자, 강사, LB | `/api/login` | 아이디 정규식 + 비밀번호 해시 |
| Google OAuth | 본사 직원 | `/auth/google` | 이메일 도메인 허용 목록 |

### 허용 도메인

```python
ALLOWED_EMAIL_DOMAINS = [
    'kakaomobility.com',
    'nomail.kakaocorp.com',
    'cs-kakaomobility.com'
]

ADMIN_ALLOWED_DOMAINS = [
    'kakaomobility.com',
    'cs-kakaomobility.com'
]
```

## 8. 상담사 세부 역할 (시험 모드용)

시험 출제 시 난이도 구분에 사용. 권한 체계와는 별도.

| ID | 이름 | 난이도 | 주관식 문항수 |
|----|------|--------|:----------:|
| `new` | 신입상담사 | 초급 | 0 |
| `regular` | 일반상담사 | 중급 | 1 |
| `manager` | 관리자 | 고급 | 2 |

```python
ROLES = [
    {'id': 'new',     'name': '신입상담사', 'level': '초급', 'essay_count': 0},
    {'id': 'regular', 'name': '일반상담사', 'level': '중급', 'essay_count': 1},
    {'id': 'manager', 'name': '관리자',    'level': '고급', 'essay_count': 2}
]
```

## 9. 서비스 그룹

상담사가 담당하는 서비스 분류.

| ID | 이름 | 카테고리 |
|----|------|---------|
| `taxi` | 택시 | 택시 (+네모라이드, K.ride, 서울자율차) |
| `daeri` | 대리 | 대리 |
| `delivery` | 배송 | 퀵 (+도보배송, 한차배송) |
| `bike-mas` | 바이크/마스 | 바이크, 버스-지하철, 광역콜버스, 시외버스, 렌터카, 카셰어링, 해외렌터카, 항공 |
| `parking-carowner` | 주차/카오너 | 주차, 전기차충전, 카오너, 발레 |
| `trucker` | 화물 | 트럭커, 로지노트, 화물 |

## 10. Google OAuth 로그인 구현

### 10.1 인증 흐름 (Authorization Code Flow)

```
사용자 ──[1]──▶ /auth/google (서버)
                   │
                   ▼ redirect
           Google 로그인 페이지
                   │
                   ▼ 인증 완료
           /auth/callback?code=xxx (서버)
                   │
            ┌──────┴──────┐
            ▼             ▼
     [2] code → token  [3] token → userinfo
            │             │
            ▼             ▼
     access_token    email, name
                   │
            ┌──────┴──────┐
            ▼             ▼
     [4] 도메인 검증  [5] DB 조회/생성
            │             │
            ▼             ▼
     허용 도메인?     기존 사용자?
     403 차단         UPDATE / INSERT
                   │
                   ▼
            [6] 세션 저장 → redirect /
```

### 10.2 필요한 환경변수

```bash
# .env 파일
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/callback

# Flask
SECRET_KEY=your-secret-key
```

### 10.3 Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/) → API 및 서비스 → 사용자 인증 정보
2. **OAuth 2.0 클라이언트 ID** 생성 (웹 애플리케이션)
3. **승인된 리디렉션 URI** 추가:
   - 운영: `https://your-domain.com/auth/callback`
   - 로컬: `http://localhost:5000/auth/callback`
4. **OAuth 동의 화면** 설정:
   - 사용자 유형: 내부 (조직 내) 또는 외부
   - 범위: `openid`, `email`, `profile`

### 10.4 Google OAuth 상수

```python
# OAuth 엔드포인트 (고정값, 변경 없음)
GOOGLE_AUTH_URL     = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL    = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
```

### 10.5 구현 코드

#### Step 1: 인증 시작 (`/auth/google`)

사용자를 Google 로그인 페이지로 리디렉트.

```python
@app.route('/auth/google')
def auth_google():
    params = {
        'client_id': GOOGLE_CLIENT_ID,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'scope': 'openid email profile',
        'response_type': 'code',
        'access_type': 'offline',   # refresh_token 발급 (선택)
        'prompt': 'consent'         # 매번 동의 화면 (선택)
    }
    return redirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")
```

#### Step 2: 콜백 처리 (`/auth/callback`)

Google이 authorization code를 전달하면, access_token으로 교환 후 사용자 정보 조회.

```python
@app.route('/auth/callback')
def auth_callback():
    code = request.args.get('code')
    if not code:
        return jsonify({'error': '인증 코드가 없습니다'}), 400

    # 1) Authorization Code → Access Token
    token_response = requests.post(GOOGLE_TOKEN_URL, data={
        'code': code,
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'redirect_uri': GOOGLE_REDIRECT_URI,
        'grant_type': 'authorization_code'
    })
    token_json = token_response.json()
    access_token = token_json.get('access_token')

    # 2) Access Token → 사용자 정보
    headers = {'Authorization': f'Bearer {access_token}'}
    userinfo = requests.get(GOOGLE_USERINFO_URL, headers=headers).json()
    email = userinfo.get('email')
    name = userinfo.get('name', email.split('@')[0])

    # 3) 이메일 도메인 검증 (허용 목록)
    if not any(email.endswith(f'@{d}') for d in ALLOWED_EMAIL_DOMAINS):
        return jsonify({'error': '접근 권한이 없습니다'}), 403

    # 4) 세션 저장
    session.permanent = True
    session['user_email'] = email
    session['user_name'] = name
    session['user_id'] = email.split('@')[0]
    session['login_method'] = 'google'

    # 5) DB에 사용자 기록 (UPSERT)
    # 기존 사용자 → last_login_at 업데이트
    # 신규 사용자 → INSERT
    upsert_user(email, name)

    return redirect('/')
```

#### Step 3: 프론트엔드 버튼

```html
<button onclick="window.location.href='/auth/google'"
        style="display: flex; align-items: center; gap: 10px;">
    <svg><!-- Google 로고 SVG --></svg>
    Google 계정으로 로그인
</button>
```

### 10.6 세션 설정

```python
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SESSION_COOKIE_SECURE'] = True     # HTTPS만 (로컬은 False)
app.config['SESSION_COOKIE_HTTPONLY'] = True    # JS 접근 차단
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # CSRF 보호
app.config['PERMANENT_SESSION_LIFETIME'] = 2592000  # 30일
```

### 10.7 세션에 저장되는 값

| 키 | 값 | 예시 |
|----|-----|------|
| `user_email` | 전체 이메일 | `may.08@kakaomobility.com` |
| `user_name` | Google 프로필 이름 | `홍길동` |
| `user_id` | 이메일 `@` 앞부분 | `may.08` |
| `user_center` | 센터 (DB 우선, 기본 `모빌리티크루`) | `모빌리티크루` |
| `login_method` | 로그인 방식 | `google` |

### 10.8 DB 연동 (UPSERT 패턴)

Google OAuth 콜백에서 사용자 DB를 UPSERT하는 패턴:

```python
# 기존 사용자 존재 확인
existing = db.query("SELECT * FROM users WHERE email = ?", email)

if existing:
    # UPDATE: 마지막 로그인 시간 갱신, DB 저장된 center/user_id를 세션에 반영
    db.execute("UPDATE users SET last_login_at = ? WHERE email = ?", now, email)
    session['user_id'] = existing.user_id       # DB 값 우선
    session['user_center'] = existing.center     # DB 값 우선
else:
    # INSERT: 신규 사용자 등록
    db.execute("""
        INSERT INTO users (email, name, user_id, center, created_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, email, name, email.split('@')[0], '모빌리티크루', now, now)
```

> 기존 사용자는 DB에 저장된 `user_id`, `center`를 세션에 반영하여,
> 다른 로그인 방식(ID/PW)으로 생성된 계정과 동일 사용자로 인식되도록 함.

### 10.9 보안 체크리스트

| 항목 | 설명 | 적용 |
|------|------|:----:|
| 이메일 도메인 검증 | 허용 목록 외 차단 | O |
| HTTPS 전용 쿠키 | `SESSION_COOKIE_SECURE = True` | O |
| HttpOnly 쿠키 | JS에서 세션 접근 불가 | O |
| SameSite=Lax | CSRF 방지 | O |
| REDIRECT_URI 고정 | 환경변수로 관리, 오픈 리디렉트 방지 | O |
| `prompt=consent` | 매번 동의 확인 (토큰 갱신 보장) | O |
| DB UPSERT | 중복 계정 방지 | O |

### 10.10 다른 프로젝트에서 구현 시 필요 작업

1. **Google Cloud Console**에서 OAuth 클라이언트 생성
2. **승인된 리디렉션 URI**에 콜백 URL 등록
3. `.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` 설정
4. `ALLOWED_EMAIL_DOMAINS`를 프로젝트에 맞게 수정
5. 세션 저장 시 `user_id` 생성 규칙 결정 (이메일 `@` 앞부분 등)
6. DB UPSERT 로직 구현 (기존 사용자 센터/역할 유지)

### 10.11 의존성

```
pip install flask requests
```

- `flask`: 웹 프레임워크 + 세션 관리
- `requests`: Google API 호출 (token, userinfo)
- 별도 OAuth 라이브러리 불필요 (직접 HTTP 호출 방식)

---

## 11. 다른 프로젝트에서 활용하기

### 최소 구현

```python
ROLE_HIERARCHY = {
    '마스터권한자': 6, '본사권한자': 5, 'LB': 4,
    '강사': 3, '관리자': 2, '상담사': 1
}

def has_role_at_least(user_role, min_role):
    return ROLE_HIERARCHY.get(user_role, 1) >= ROLE_HIERARCHY.get(min_role, 99)

def get_center_code(user_id):
    if user_id.endswith('.koc'): return '용산'
    if user_id.endswith('.itx'): return '광주'
    return None
```

### 필수 테이블

1. **users** — 전체 사용자 계정 (user_id, email, name, center)
2. **user_roles** — 관리자 이상 역할 (user_id, role, center, service, is_active)

### 역할 판별 우선순위

1. 하드코딩 마스터 목록 (장애 시에도 보장)
2. `user_roles` 테이블 (is_active=TRUE)
3. 이메일 도메인 폴백 (`@kakaomobility.com` → 본사권한자)
4. 기본값: 상담사
