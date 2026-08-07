# 2027 과학고 시스템: Supabase 데이터 흐름 및 잠재적 위험 분석 보고서

본 보고서는 프로젝트의 프론트엔드 UI(사용자 입력 및 자소서 모달 창 등)와 백엔드(Supabase 데이터베이스 및 AI 작업) 간의 전반적인 데이터 저장(Save) - 불러오기(Load) - 렌더링(UI Rendering) 로직을 정밀하게 추적하고, 이상 유무 및 잠재적 문제 상황을 극한의 정교함으로 분석한 결과입니다.

---

## 1. 전반적인 데이터 흐름 아키텍처 (Supabase 전환 기준)

본 시스템은 더 이상 Google Apps Script(GAS)나 Google Drive에 의존하지 않는 완전 독립형 로컬/Supabase 전용 프로젝트로 선언되었습니다.

### 1.1 Supabase 클라이언트 초기화
- `backend_logic.js` 최상단에서 `supabase.createClient(SUPABASE_URL, SUPABASE_KEY)`를 통해 전역 클라이언트를 초기화합니다.
- 데이터베이스 테이블 구성: `students`, `settings`, `ai_feedback_history`, `personal_statements`, `parsed_records`, `interview_practice`, `record_basis` 등

---

## 2. 사용자 입력(UI) ↔ Supabase 연동 로직 분석

### 2.1 자소서 입력 및 저장 (UI → DB)
1. **이벤트 트리거**: 자소서 모달 창에서 사용자가 텍스트를 입력하면 `oninput` 이벤트를 통해 메모리에 자동 캐싱됩니다. 이후 모달을 닫거나 임시저장 버튼(`btn-save-ps`) 클릭 시 `savePersonalStatement` API(또는 Supabase 직접 연동 로직)가 호출됩니다.
2. **Dirty Check (최적화)**: 프론트엔드에서 원본(AS-IS)과 현재 입력값(TO-BE)을 비교하여 변경된 문항만 추출합니다.
3. **DB 저장**: `personal_statements` 테이블에 `student_link`, `question_no`, `content`, `updated_at` 형태로 Insert/Update(또는 Upsert) 됩니다.

### 2.2 자소서 불러오기 (DB → UI)
1. **DB 쿼리**: `loadStudentModal` 호출 시, `personal_statements` 테이블에서 `student_link`를 조건으로 데이터를 내림차순(`order('updated_at', { ascending: false })`)으로 불러옵니다.
2. **이력 드롭다운 바인딩**: 가져온 텍스트 데이터를 버전 관리 드롭다운(이력 셀렉터)에 바인딩하고, 최상단 최신본을 `textarea`에 렌더링합니다.

---

## 3. AI 작업 및 내용의 Supabase 연동 로직 분석

### 3.1 AI 자소서 피드백 (`generateAIFeedback`)
1. **프롬프트 및 데이터 로드**: `settings` 테이블에서 기밀 프롬프트를, `personal_statements` 테이블에서 학생 자소서 내용을, `students` 테이블에서 학생 정보를 로드합니다.
2. **AI 연산**: `callGeminiWithFallback` 함수를 통해 Gemini API에 전송 후 피드백 결과를 반환받습니다.
3. **DB 엑셀 인젝션 방어**: 피드백이 `=`, `+`, `-`, `@`로 시작할 경우 엑셀 수식 실행을 막기 위해 텍스트 앞에 단일 따옴표(`'`)를 강제 삽입합니다.
4. **DB 저장**: `ai_feedback_history` 테이블에 `type: '문항[X]_도움받기'` 형태로 삽입(Insert/Update)합니다. 
5. **상태 업데이트**: `students` 테이블의 `cover_letter_feedback_ai` 필드를 현재 시간으로 업데이트하여 UI에서 진행 상태를 인지하게 합니다.

### 3.2 AI 면접 예상 질문 생성 (`generateAIQuestions`)
1. **데이터 획득**: 자소서 모드일 경우 `personal_statements`에서 데이터를 긁어모아 텍스트로 병합하고, 생기부 모드일 경우 `parsed_records`에서 텍스트를 불러옵니다.
2. **DB 저장**: AI가 생성한 마크다운 형식의 질문/답변 데이터를 JSON 객체로 파싱 또는 변환하여 `interview_practice` 테이블의 `questions_json` 필드에 직렬화(`JSON.stringify`)하여 저장합니다.
3. **상태 업데이트**: `students` 테이블의 `expected_questions_ai` 필드를 갱신합니다.

---

## 4. 🚨 시스템 이상 유무 및 잠재적 문제(치명적 위험) 상황 분석

코드를 분석한 결과, 기능 자체는 논리적으로 연결되어 있으나, Supabase라는 **비동기 RDBMS** 환경의 특성상 발생할 수 있는 여러 치명적 문제점들이 발견되었습니다.

### ⚠️ 문제 상황 1: 경쟁 조건(Race Condition) 및 동시성 덮어쓰기 현상
- **상황**: 교사(첨삭)와 학생(작성)이 동시에 같은 자소서 문항을 열어놓고 작업하는 경우.
- **원인**: 현재 로직은 단순 Upsert(또는 Update) 방식을 취하고 있어, DB 락(Row-Level Lock)이나 낙관적 동시성 제어(Optimistic Concurrency Control, 버전/타임스탬프 기반 검증) 장치가 보이지 않습니다.
- **결과**: 나중에 저장 버튼을 누른 사람의 데이터가 이전 사람의 작업물을 완전히 덮어씌워버리는 'Lost Update' 참사가 발생할 수 있습니다. (특히 0.1초 자동 저장 로직이 활성화될 경우 더욱 치명적입니다.)

### ⚠️ 문제 상황 2: 엑셀 인젝션 방어 기호(')의 프론트엔드 노출 문제
- **상황**: AI 피드백 텍스트가 `-` (마크다운 불릿) 기호로 시작하는 경우가 매우 잦습니다. (프롬프트에서 불릿 사용을 강제하고 있음)
- **원인**: `backend_logic.js`의 `generateAIFeedback` 로직에서 `/^[=+\-@]/.test(safeFeedback)` 조건에 걸려 텍스트 맨 앞에 `'`를 덧붙여 DB에 저장합니다.
- **결과**: Supabase는 Google Sheets와 달리 엑셀 셀 수식 해석기가 아니므로 이 처리가 무의미합니다. 오히려 프론트엔드 UI(웹)에서 학생이나 교사가 피드백을 열었을 때 문장 맨 앞에 뜬금없이 `'` 가 노출되는 렌더링 버그(UX 저하)로 이어집니다.

### ⚠️ 문제 상황 3: 프론트엔드 내 Supabase Key 하드코딩 보안 취약점
- **상황**: `SUPABASE_KEY` (sb_publishable_...) 값이 프론트엔드로 로드되는 자바스크립트 파일에 평문으로 노출되어 있습니다.
- **원인**: 백엔드(서버리스 함수나 GAS) 없이 브라우저에서 직접 Supabase DB와 통신하는 구조입니다.
- **결과**: Supabase 프로젝트 대시보드에서 **Row Level Security (RLS) 정책**이 완벽하게 세팅되어 있지 않다면, 누구나 개발자 도구를 열어 토큰을 복사한 뒤 악의적으로 타 학생의 자소서 데이터를 쿼리(Select)하거나 삭제(Delete)할 수 있는 초대형 보안 붕괴(입시 정보 유출)가 발생합니다.

### ⚠️ 문제 상황 4: 대용량 데이터 로드 시의 네트워크 병목 및 메모리 누수
- **상황**: 모달 창을 열 때마다 `personal_statements`와 `ai_feedback_history` 등을 매번 쿼리합니다.
- **원인**: AI 피드백 전문과 자소서 이력 전체가 점점 누적될 경우 페이로드가 비대해집니다.
- **결과**: 페이지네이션이나 리미트(Limit) 설정이 누락되어 있다면(현재 `order`만 보임), 후반기 입시 시즌에 모달 창을 열 때마다 수 MB의 데이터가 로드되어 브라우저가 멈추는(Freezing) 현상이 올 수 있습니다.

### ⚠️ 문제 상황 5: JSON 파싱 에러 취약점
- **상황**: AI가 답변한 면접 예상 질문 데이터를 `interview_practice`에 저장/불러오기 할 때.
- **원인**: `generateAIQuestions` 내부에서 `JSON.parse(existingPract.questions_json)` 처리 시 `catch(e){}`로 무시하도록 설계되어 있으나, 새로운 데이터 구조로 병합 후 `JSON.stringify`하는 과정에서 데이터 구조가 오염될 경우, 향후 UI에서 이를 역직렬화하여 화면에 뿌릴 때 `TypeError`가 발생하여 화면 렌더링 자체가 완전히 뻗어버릴 위험성이 존재합니다.

---
**[결론 및 권고사항]**
UI와 DB 간의 파이프라인은 잘 구축되어 있으나, Supabase 전환에 따른 **1) RLS(보안) 설정 완비 여부**, **2) 동시성 제어(충돌 방지 로직) 추가**, **3) 불필요한 엑셀 인젝션 방어 코드 철거**가 가장 시급하게 보완되어야 합니다.
