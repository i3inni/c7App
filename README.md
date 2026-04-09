# C7 AI — React Native 앱 (껍데기 만들기)

> Smart Posture Intelligence · Firebase 연동 전 UI 전체 구현본

---

## 프로젝트 구조

```
C7AI/
├── App.tsx                          # 진입점
├── src/
│   ├── constants/
│   │   ├── theme.ts                 # 색상, 폰트, 간격, 그림자
│   │   └── types.ts                 # 전체 타입 정의
│   ├── store/
│   │   └── index.ts                 # Zustand 전역 상태 (mock 데이터 포함)
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Stack + BottomTab 네비게이션
│   ├── components/
│   │   └── common/
│   │       ├── Button.tsx           # 버튼 (primary/secondary/danger/kakao/dark)
│   │       ├── Input.tsx            # 텍스트 입력
│   │       ├── Card.tsx             # 카드 래퍼
│   │       ├── Toggle.tsx           # 애니메이션 토글
│   │       ├── ConfirmModal.tsx     # 확인/취소 모달
│   │       ├── Header.tsx           # 공통 헤더
│   │       └── Badge.tsx            # 상태 뱃지
│   └── screens/
│       ├── auth/
│       │   ├── SplashScreen.tsx     # 스플래시 (2초 후 로그인으로)
│       │   ├── LoginScreen.tsx      # 로그인 (아이디/비번 + 카카오 + 비회원)
│       │   ├── SignUpScreens.tsx    # 회원가입 3단계 + 완료
│       │   └── MqttConnectScreen.tsx # 기기 ID 입력 → 연결 중 → 완료
│       ├── main/
│       │   ├── HomeScreen.tsx       # 게이지, 점수, 상태, 알림, 목표점수 모달
│       │   ├── StatsScreen.tsx      # 활동기록, 오늘요약, 주간/월간 그래프
│       │   └── AIScreen.tsx         # 거북목 진단사, 단계별 운동, 주간 리포트
│       ├── device/
│       │   └── DeviceControlScreen.tsx  # 배터리/전원/센서/진동 + MQTT 카드
│       └── profile/
│           └── ProfileScreens.tsx   # 내정보/신체정보/보안/비밀번호변경/회원탈퇴
```

---

## 실행

```bash
npm install
npx expo start
```

---

## Firebase 연동 포인트

파일 내 주석 `// Firebase XXX 자리` 위치에 연동:

| 위치                                    | 할 일                                      |
| --------------------------------------- | ------------------------------------------ |
| `LoginScreen.tsx`                       | `signInWithEmailAndPassword`               |
| `SignUpScreens.tsx → SignUpStep3`       | `createUserWithEmailAndPassword`           |
| `SignUpScreens.tsx → Step1 handleCheck` | Firestore 아이디 중복 확인                 |
| `ProfileScreens.tsx → ChangePassword`   | `updatePassword`                           |
| `ProfileScreens.tsx → Withdraw`         | `deleteUser`                               |
| `MqttConnectScreen.tsx`                 | MQTT broker 실 연결 (mqtt.js / paho)       |
| `store/index.ts`                        | mock 데이터 → Firestore 실시간 리스너 교체 |

---

## 주요 의존성

| 패키지                        | 용도                         |
| ----------------------------- | ---------------------------- |
| `@react-navigation`           | Stack + BottomTab 네비게이션 |
| `zustand`                     | 전역 상태 관리               |
| `react-native-svg`            | 게이지, 차트 SVG             |
| `react-native-reanimated`     | Toggle 애니메이션            |
| `expo-notifications`          | 자세 알림                    |
| `@react-native-async-storage` | 로컬 저장                    |

---

## 디자인 시스템

`src/constants/theme.ts` 참고:

- **Primary**: `#1DB38E` (민트그린)
- **Accent**: `#FF4B6E` (핑크레드)
- **Score 색상**: 우수(초록) → 주의(주황) → 위험(빨강) 그라디언트
- **다크 카드**: `#1A1E2E` (MQTT/전원 카드)

---

## 구현된 화면 목록 (43개 기준)

### 인증

- [x] 스플래시
- [x] 로그인 (아이디/비번 + 카카오 + 비회원)
- [x] 회원가입 Step1 (아이디 + 중복확인)
- [x] 회원가입 Step2 (비밀번호 + 강도 인디케이터)
- [x] 회원가입 Step3 (닉네임)
- [x] 회원가입 완료
- [x] MQTT Connect (ID 입력 → 연결 중 애니메이션 → 완료)

### 홈

- [x] 게이지 계기판 (SVG, 0~100 점수)
- [x] 현재 각도 + 상태
- [x] 전원 관리 카드
- [x] 알림 드로어 (있을 때 / 없을 때)
- [x] 목표 점수 설정 모달

### STATS

- [x] 오늘 요약 카드 (점수, 불량자세, 교정시간)
- [x] 오늘 상세 분석 모달 (시간대별, 불량자세 기록, 활동요약)
- [x] 주간/월간 라인 차트
- [x] 주간 상세 분석 모달 (요일별, 주간통계)

### AI

- [x] 거북목 진단 결과 (각도, 정상범위, 개선율)
- [x] 단계별 솔루션 탭 (1~3단계 운동)
- [x] 주간 건강 리포트 카드

### CONFIG (디바이스)

- [x] C7 기기 SVG 일러스트 (탭별 부위 하이라이트)
- [x] 배터리 (퍼센트, 절전모드)
- [x] 전원 관리 (on/off 토글)
- [x] 센서 설정 (감지각도, 캘리브레이션)
- [x] 진동 설정 (강도 슬라이더, 약/중/강)
- [x] MQTT 연결 카드 + 연결 해제 모달

### 내 정보

- [x] 프로필 카드
- [x] 신체 정보 (키/체중 바텀시트)
- [x] 알림 설정 토글
- [x] 기록 초기화 모달
- [x] 로그아웃 모달
- [x] 로그인 및 보안 (이메일, 비밀번호 변경)
- [x] 비밀번호 변경
- [x] 회원 탈퇴
