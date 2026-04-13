# C7 AI — Smart Posture Intelligence

> React Native (Expo) + Firebase 기반 자세 교정 앱

---

## 개발 환경 설정

### 사전 준비

- Node.js 18 이상
- Android Studio (Android SDK, 에뮬레이터 또는 실기기)
- JDK 17
- Git

---

### 1. 프로젝트 클론 및 패키지 설치

```bash
git clone https://github.com/[팀 레포].git
cd C7AI
npm install
```

---

### 2. Firebase 설정

**`google-services.json` 파일 받기**

팀 채널(Slack/Notion 등)에서 `google-services.json` 파일을 받아서 아래 경로에 넣기:

```
android/app/google-services.json
```

> 이 파일은 보안상 Git에 올리지 않으므로 팀원에게 직접 받아야 함

---

### 3. Android 빌드 및 실행

실기기 또는 에뮬레이터를 연결한 후:

```bash
npx expo run:android
```

> 최초 실행 시 빌드에 수 분이 소요됨. 이후 실행부터는 빠름.

---

### 4. 개발 서버만 실행 (빌드 없이)

APK가 이미 기기에 설치된 경우:

```bash
npx expo start
```

---

## Firebase 콘솔 설정 (최초 1회)

Firebase 콘솔에서 아래 두 가지가 활성화되어 있어야 함:

| 항목 | 경로 |
|------|------|
| 이메일/비밀번호 로그인 | Authentication → Sign-in method → 이메일/비밀번호 |
| Firestore DB | Firestore Database → 데이터베이스 만들기 → 테스트 모드 |

---

## 프로젝트 구조

```
C7AI/
├── App.tsx                          # 진입점
├── android/                         # 네이티브 Android 빌드 파일
│   └── app/
│       └── google-services.json     # Firebase 설정 (Git 제외 - 직접 받을 것)
├── src/
│   ├── lib/
│   │   └── firebase.ts              # Firebase 초기화 (auth, db export)
│   ├── services/                    # Firebase API 연동 서비스 레이어
│   │   ├── authService.ts           # 로그인/회원가입/로그아웃
│   │   ├── userService.ts           # 유저 프로필 Firestore
│   │   ├── statsService.ts          # 통계 데이터 Firestore
│   │   └── notificationService.ts  # 알림 Firestore
│   ├── constants/
│   │   ├── theme.ts                 # 색상, 폰트, 간격, 그림자
│   │   └── types.ts                 # 전체 타입 정의
│   ├── store/
│   │   └── index.ts                 # Zustand 전역 상태
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Stack + BottomTab 네비게이션
│   ├── components/
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       ├── Toggle.tsx
│   │       ├── ConfirmModal.tsx
│   │       ├── Header.tsx
│   │       └── Badge.tsx
│   └── screens/
│       ├── auth/
│       │   ├── SplashScreen.tsx
│       │   ├── LoginScreen.tsx
│       │   ├── SignUpScreens.tsx
│       │   └── MqttConnectScreen.tsx
│       ├── main/
│       │   ├── HomeScreen.tsx
│       │   ├── StatsScreen.tsx
│       │   └── AIScreen.tsx
│       ├── device/
│       │   └── DeviceControlScreen.tsx
│       └── profile/
│           └── ProfileScreens.tsx
```

---

## 화면별 Firebase 연동 담당

| 담당 | 화면 | 서비스 파일 | 상태 |
|------|------|------------|------|
| 팀원 A | LoginScreen, SignUpScreens | authService.ts | ⬜ 미완 |
| 팀원 B | HomeScreen, StatsScreen | statsService.ts | ⬜ 미완 |
| 팀원 C | DeviceControlScreen, MqttConnect | deviceService.ts | ⬜ 미완 |
| 팀원 D | MyInfoScreen, ProfileScreens | userService.ts | ⬜ 미완 |

---

## Firestore 데이터 구조

```
users/{userId}
  ├── nickname, email, height, weight, isGuest
  └── settings: { postureAlertEnabled, reportAlertEnabled, targetScore }

users/{userId}/stats/{YYYY-MM-DD}
  └── score, badPostureCount, correctionMin, avgAngle, vibrationCount, goodPostureHours

users/{userId}/snapshots/{id}
  └── timestamp, score, angle, level, durationMin

users/{userId}/notifications/{id}
  └── category, title, body, timeAgo, read
```

---

## 주요 의존성

| 패키지 | 용도 |
|--------|------|
| `firebase` | Firebase JS SDK (Auth, Firestore) |
| `@react-navigation` | Stack + BottomTab 네비게이션 |
| `zustand` | 전역 상태 관리 |
| `react-native-svg` | 게이지, 차트 SVG |
| `react-native-reanimated` | 애니메이션 |
| `expo-notifications` | 자세 알림 |
| `@react-native-async-storage` | 로컬 저장 |

---

## 디자인 시스템

`src/constants/theme.ts` 참고:

- **Primary**: `#1DB38E` (민트그린)
- **Accent**: `#FF4B6E` (핑크레드)
- **Score 색상**: 우수(초록) → 주의(주황) → 위험(빨강) 그라디언트
- **다크 카드**: `#1A1E2E`

---

## 구현된 화면 목록

### 인증
- [x] 스플래시
- [x] 로그인 (이메일/비번 + 카카오 + 비회원)
- [x] 회원가입 Step1 (아이디 + 중복확인)
- [x] 회원가입 Step2 (비밀번호 + 강도 인디케이터)
- [x] 회원가입 Step3 (닉네임)
- [x] 회원가입 완료
- [x] MQTT Connect (ID 입력 → 연결 중 애니메이션 → 완료)

### 홈
- [x] 게이지 계기판 (SVG, 0~100 점수)
- [x] 현재 각도 + 상태
- [x] 전원 관리 카드
- [x] 알림 드로어
- [x] 목표 점수 설정 모달

### STATS
- [x] 오늘 요약 카드
- [x] 오늘 상세 분석 모달
- [x] 주간/월간 라인 차트
- [x] 주간 상세 분석 모달

### AI
- [x] 거북목 진단 결과
- [x] 단계별 솔루션 탭 (1~3단계 운동)
- [x] 주간 건강 리포트 카드

### CONFIG (디바이스)
- [x] C7 기기 SVG 일러스트
- [x] 배터리 (퍼센트, 절전모드)
- [x] 전원 관리 (on/off 토글)
- [x] 센서 설정
- [x] 진동 설정 (강도 슬라이더)
- [x] MQTT 연결 카드

### 내 정보
- [x] 프로필 카드
- [x] 신체 정보
- [x] 알림 설정 토글
- [x] 기록 초기화 모달
- [x] 로그아웃 모달
- [x] 비밀번호 변경
- [x] 회원 탈퇴
