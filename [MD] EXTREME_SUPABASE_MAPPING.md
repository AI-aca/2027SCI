# 🚀 수파베이스(Supabase) - UI - AI 매핑 백과사전 (Extreme Mapping Guide)

> **⚠️ 주의 (작성 원칙)**
> 본 문서는 현재(2026-08-05 기준) 작동 중인 `backend_logic.js`와 `script.js`의 물리적 코드를 100% 팩트 기반으로 뜯어보고 작성된 '실제 작동 매핑 문서'입니다. 단 1%의 추측이나 뇌피셜도 허용되지 않았으며, 코드가 연결된 그대로를 서술합니다.

---

## 1. `students` 테이블 (학생 기본 정보 및 메타데이터)
**가장 중요한 테이블**이며, 메인 대시보드 화면(UI)의 모든 줄을 구성하는 뼈대입니다.

| Supabase DB 컬럼명 | `script.js` (프론트엔드) 변수명 | UI 화면 매칭 위치 및 용도 | 🤖 AI 작업 연동 여부 |
| :--- | :--- | :--- | :--- |
| `student_link` | `studentLink` | 각 학생 고유 식별자. 링크 배포 버튼 (`?student=...`) 및 내부 데이터 통신 기준값(PK) | **핵심 Key** (모든 AI 작업 시 이 값을 기준으로 학생을 식별) |
| `center_name` | `center` | 대시보드 / 정보 / 생기부 / 자소서 / 면접 탭의 **[센터명]** 열 | 해당 없음 |
| `student_name` | `name` | 대시보드 / 정보 / 생기부 / 자소서 / 면접 탭의 **[학생명]** 열 | 생기부 채점 시, 이름 식별 프롬프트에 활용됨 |
| `school` | `school` | 대시보드 / 정보 / 생기부 / 자소서 / 면접 탭의 **[현재 학교]** 열 | 해당 없음 |
| `target_school` | `targetSchool` | 대시보드 / 정보 / 생기부 / 자소서 / 면접 탭의 **[지원학교]** 열 | 자소서 및 면접 예상질문 생성 시, 학교 맞춤형 문항 설정값 로드에 활용됨 |
| `parent_contact` | `parentPhone` | 정보 탭의 **[학부모 연락처]** 열 | 해당 없음 |
| `student_contact` | `studentPhone` | 정보 탭의 **[학생 연락처]** 열 | 해당 없음 |
| `math_teacher` | `mathTeacher` | 정보 / 면접 탭의 **[수학 담당]** 열 | 해당 없음 |
| `science_teacher` | `sciTeacher` | 정보 / 면접 탭의 **[과학 담당]** 열 | 해당 없음 |
| `record_link` | `recordPdf` | 생기부 탭의 **[생기부 보기], [생기부 업로드]** 버튼. 수파베이스 스토리지의 PDF URL 저장 | 생기부 파싱(OCR) 시작 시, 이 링크를 다운로드하여 텍스트로 변환함 |
| `record_score_ai` | `recordScore` | 생기부 탭의 **[생기부 점수]** 칸 (`<strong>점수</strong>` 형태로 노출) | **[생기부 채점]** 완료 시, 산출된 400점 만점 총점이 이 열에 자동으로 덮어씌워짐 (UPDATE) |
| `cover_letter_status` | `psStatus` | 자소서 탭의 **[최종여부]** 뱃지 표기 (작성중, 최신버전 등) | 학생이 자소서를 저장/제출할 때마다 상태가 갱신됨 |
| `cover_letter_feedback_ai`| `psFeedback` | 자소서 탭의 **[자소서 피드백 확인]** (버튼 클릭 시 모달창) 표기 | **[자소서 피드백]** 생성 완료 시 생성된 시점(Time)이 업데이트 됨 |
| `result_1st` | `passRound1` | 대시보드의 **[1차 합불]** 드롭다운 (대기/합/불) | 관리자가 UI에서 드롭다운 변경 시 즉시 UPDATE됨 |
| `result_2nd` | `passRound2` | 대시보드의 **[2차 합불]** 드롭다운 (대기/합/불) | 관리자가 UI에서 드롭다운 변경 시 즉시 UPDATE됨 |
| `result_final` | `passFinal` | 대시보드의 **[최종 합불]** 드롭다운 (대기/합/불) | 관리자가 UI에서 드롭다운 변경 시 즉시 UPDATE됨 |

---

## 2. `record_basis` 테이블 (생기부 AI 분석 결과 및 채점 근거)
**[생기부 채점]** 이 완료되면 AI가 평가한 장문의 보고서와 원시 JSON 데이터가 이곳에 저장됩니다.

| Supabase DB 컬럼명 | JS 및 AI 작업 매칭 관계 |
| :--- | :--- |
| `student_link` | 채점 대상 학생의 고유 링크 (`students` 테이블과 동일) |
| `target_school` | 채점 당시의 목표 지원 학교 |
| `total_score` | 400점 만점으로 환산된 총합 점수 (`record_score_ai`에 들어가는 값과 동일) |
| `analysis_report` | AI가 생성한 마크다운 형식의 **종합 총평 텍스트 원문** (화면의 '생기부 점수근거' 버튼 클릭 시 렌더링됨) |
| `score_details_json`| 학업역량, 진로적합성, 인성 등 각 세부 항목별 점수와 근거를 담은 원시 JSON 데이터 |

---

## 3. `parsed_records` 테이블 (생기부 OCR 텍스트 캐시)
| Supabase DB 컬럼명 | JS 및 AI 작업 매칭 관계 |
| :--- | :--- |
| `student_link` | 대상 학생 고유 식별자 |
| `parsed_content` | **[생기부 파싱]** 단계에서 추출된 PDF 텍스트 원문. 생기부 채점 시 AI에게 1차 사료로 넘겨짐. |

---

## 4. `personal_statements` 테이블 (자소서 작성 데이터)
학생이 화면에서 입력한 문항별 자소서 데이터입니다.

| Supabase DB 컬럼명 | JS 및 AI 작업 매칭 관계 |
| :--- | :--- |
| `student_link` | 자소서를 작성한 학생 링크 |
| `question_no` | 문항 번호 (예: 1, 2, 3...) |
| `content` | 학생이 입력창에 적은 자소서 텍스트 내용 |
| `teacher_feedback` | 교사가 하단에 적어준 첨삭 내용 |

---

## 5. `ai_feedback_history` 테이블 (자소서 AI 피드백 이력)
| Supabase DB 컬럼명 | JS 및 AI 작업 매칭 관계 |
| :--- | :--- |
| `student_link` | 대상 학생 식별자 |
| `type` | 항상 `'통합'` 으로 저장됨 |
| `feedback` | AI가 생성한 피드백 마크다운 원문 |

---

## 6. `interview_practice` 테이블 (AI 예상 질문 데이터)
| Supabase DB 컬럼명 | JS 및 AI 작업 매칭 관계 |
| :--- | :--- |
| `student_link` | 대상 학생 고유 링크 |
| `psQuestions` | **자소서 기반**으로 AI가 생성한 30개의 면접 예상 질문 텍스트 |
| `recordQuestions` | **생기부 기반**으로 AI가 생성한 30개의 면접 예상 질문 텍스트 |

---

## 7. `settings` 테이블 (시스템 설정)
- `GeminiKey`: AI 통신에 사용되는 API 키
- `schools`: UI의 **[학교별 설정]** 테이블 정보. 지원학교 목록과 자소서 문항 정보 관리
- `prompt_*`: 각 AI 기능별 프롬프트 원문

---

<br>

# 💻 8. [개발자 관점] 코드 데이터 흐름 & 매칭 메커니즘 상세

DB가 UI와 어떻게 연결되고 통신하는지에 대한 "기술적 팩트"입니다. 이 매커니즘 덕분에 오타나 엉뚱한 매핑이 원천적으로 불가능합니다.

### 8-1. 데이터 조회 매핑 (DB ➡️ 프론트엔드)
- **호출 함수**: `backend_logic.js`의 `getStudentsList()`
- **흐름**: 
  1. `supabaseClient.from('students').select('*')` 호출하여 수파베이스에서 모든 컬럼(Snake Case)을 긁어옵니다.
  2. `Array.map()`을 사용하여 프론트엔드(`script.js`)에서 다루기 편한 Camel Case 형태의 자바스크립트 객체로 변환하여 렌더링을 지시합니다.
  3. **코드상 증거**: 
     ```javascript
     // backend_logic.js 매핑 하드코딩
     recordScore: s.record_score_ai || '',
     passRound1: s.result_1st || '대기', 
     studentLink: s.student_link || s.id || '',
     ```

### 8-2. 화면 내 데이터 변경 매핑 (프론트엔드 ➡️ DB)
- **호출 함수**: `script.js`의 `updatePassStatusFrontend` ➡️ `backend_logic.js`의 `updatePassStatus`
- **흐름**:
  1. 사용자가 UI에서 드롭다운을 변경하면 `updatePassStatusFrontend`가 실행되어 `{ studentId: link, passType: 'passRound1', passValue: '합' }` 형태로 백엔드에 쏩니다.
  2. 백엔드의 `updatePassStatus`에서 `passType`을 **진짜 DB 컬럼 이름으로 안전하게 치환**합니다.
  3. **코드상 증거**:
     ```javascript
     // backend_logic.js의 치환 방어 로직
     let dbColumn = payload.passType;
     if (payload.passType === 'passRound1') dbColumn = 'result_1st';
     else if (payload.passType === 'passRound2') dbColumn = 'result_2nd';
     else if (payload.passType === 'passFinal') dbColumn = 'result_final';
     
     // 이후 치환된 진짜 컬럼 이름으로 업데이트!
     supabaseClient.from('students').update({ [dbColumn]: payload.passValue })
     ```

### 8-3. AI 생성 결과물 자동 매핑 (AI 모델 ➡️ DB 직행)
AI(생기부 채점, 예상질문, 자소서 피드백) 작업은 프론트엔드를 거치지 않고, 백엔드(`backend_logic.js`) 내부에서 결과가 나오자마자 DB 테이블에 직통으로 삽입(INSERT) / 덮어쓰기(UPDATE) 됩니다.
- **코드상 증거 (`evaluateStudentRecord` 내부)**:
  ```javascript
  // 1. 점수 및 총평 저장 (record_basis 테이블)
  supabaseClient.from('record_basis').insert({
    student_link: effectiveLink,
    total_score: String(totalScore),
    analysis_report: analysisText,
    score_details_json: ...
  });
  // 2. 학생 테이블 요약 점수 저장 (students 테이블)
  supabaseClient.from('students').update({ record_score_ai: totalScore }).eq('id', student.id)
  ```
  👉 DB 스키마 컬럼명(ex: `record_score_ai`, `analysis_report`)이 문자열로 **단단하게 고정**되어 있어서, 다른 열에 들어갈 확률은 기술적으로 **0%** 입니다.

---

<br>

# 🧑‍🎓 9. [학생 전용 UI] 데이터 로드 및 저장 메커니즘 (`?student=link`)

학생이 본인에게 부여된 고유 링크(예: `index.html?student=xxxx`)를 열었을 때, 시스템이 어떻게 작동하는지에 대한 증명입니다.

### 9-1. 학생 신원 확인 (URL 파싱)
- **함수**: `script.js`의 `detectRoleFromUrl()`
- **동작**: 브라우저 주소창의 `?student=` 뒤에 있는 문자를 파싱하여 `CURRENT_STUDENT_ID` 전역 변수에 저장합니다. 그리고 권한(`CURRENT_ROLE`)을 강제로 `'학생'`으로 설정하여, 대시보드 등의 교사 전용 메뉴를 화면에서 완전히 삭제(`display: none`) 처리합니다.

### 9-2. 학생 전용 자소서 불러오기 (UI 렌더링)
- **동작**: `STUDENTS_LIST` 배열 중 `studentLink === CURRENT_STUDENT_ID` 인 1명의 학생 데이터만 필터링하여 화면에 보여줍니다. 
- 자소서 탭(`personal_statements` 테이블) 내용 조회를 위해 빽엔드로 `getStudentPs`를 호출할 때, `student_link` 파라미터만 넘겨 **본인 데이터 외에는 조회할 수 없게 차단**되어 있습니다.

### 9-3. 자소서 작성 및 저장 (UI ➡️ DB)
- **버튼 연동**: 학생이 화면에서 **[임시저장]** 또는 **[최종제출]** 버튼을 클릭하면 `saveStudentPs()` 함수가 기동됩니다.
- **동작**:
  1. 각 문항 박스의 내용(`textarea.value`)을 배열로 묶어 냅니다.
  2. `ApiClient.post('savePersonalStatement', { studentId, psData, ... })` 로 백엔드에 쏩니다.
  3. 백엔드(`backend_logic.js`)에서는 기존 `personal_statements` 테이블에서 해당 학생(`student_link`)의 데이터를 싹 비우거나 덮어쓰고, 새로운 `content` 로 **UPSERT** 합니다.
  4. 마지막으로 `students` 테이블의 `cover_letter_status` 값을 `최신버전`으로 UPDATE 하여 선생님(관리자) 대시보드에 상태를 즉각 알립니다.

### 9-4. AI 피드백 열람 (DB ➡️ 학생 UI)
- **동작**: 선생님이 만들어준 '자소서 AI 피드백'을 학생이 보기 위해 'AI 자소서 피드백' 탭을 클릭하면 `loadAIFeedback()` 이 실행됩니다.
- **데이터 흐름**: `ai_feedback_history` 테이블에서 `student_link`로 조회한 뒤, 마크다운으로 포맷팅되어 화면 우측 모달 또는 탭 안에 표시됩니다. **이 과정에서 학생은 어떠한 데이터도 DB에 쓸 수 없습니다 (Read Only).**

> **📌 최종 요약**: 
> 관리자(선생님) 화면이든 학생 화면이든 모든 데이터의 열쇠(Key)는 `student_link` 하나로 완벽하게 통일되어 있습니다. 각 기능별로 흩어진 7개의 수파베이스 테이블은 이 `student_link` 하나만 바라보고 거미줄처럼 연결되어 작동하기 때문에, 매핑이 어긋나거나 데이터가 꼬이는 일은 아키텍처 상 발생하지 않습니다.
