# 🚀 구현 계획서 (Implementation Plan)

사용자님의 요구사항에 따라 6가지 수정 목표에 대한 물리적 팩트 분석을 마치고, 이를 바탕으로 한 구현 계획을 다음과 같이 수립하였습니다.

## 🛠 수정 대상 파일 목록
1. `script.js`
2. `backend_logic.js`

---

## 📝 상세 수정 계획 및 변경 논리

### 1. 'AI 도움받기' 버튼 클릭 시 confirm 알림창 및 Dirty Check Silent 처리
- **대상 파일**: `script.js`
- **수정 위치**: 
  1. `runAIFeedbackAction` 함수 내부 (약 1628번 줄)
  2. `btn-save-ps` 클릭 이벤트 리스너 내부 (약 2161번 줄)
- **변경 논리**:
  - `runAIFeedbackAction` 시작 부분에 `if (!confirm('현재 문항(문항' + qNum + '번)에 대한 AI 도움받기를 생성하시겠습니까?')) return;` 로직을 추가하여 사용자의 명시적 동의를 구합니다.
  - 저장 시 발생하는 '변경된 내용이 없습니다.'(Dirty Check) 경고창을 무음 처리하기 위해, `runAIFeedbackAction`에서 `btnSave.click()` 호출 직전에 전역 플래그 `window._isSilentSave = true;`를 부여하고 `setTimeout`으로 복구시킵니다.
  - `btn-save-ps` 이벤트 핸들러 하단에서는 `if (contents.length === 0)` 일 때, `if (!window._isSilentSave)` 조건이 참일 때만 `alert` 창을 띄우도록 수정하여 AI 도움받기 시에는 조용히 넘어갈 수 있도록 처리합니다.

### 2. 피드백 상단 제목 `[문항 문항1]` 중복 출력 버그 수정
- **대상 파일**: `backend_logic.js`
- **수정 위치**: `generateAIFeedback` 함수 내부의 프롬프트 구성 영역 (약 186번 줄)
- **변경 논리**: 
  - `qNum` 변수에 이미 '문항' 이라는 글자가 포함된 경우(예: '문항 1'), 템플릿 리터럴 `[문항 ${qNum}]`에 의해 `[문항 문항 1]`로 렌더링되는 문제를 해결합니다.
  - `const cleanQNum = String(qNum).replace(/^문항\s*/, '');` 처리 후 `### [문항 ${cleanQNum}]` 형태로 고정 주입하여 중복 텍스트를 원천 차단합니다.

### 3. 피드백 내용 첫 줄 상단 빈 여백 제거 및 `-` 항목 줄바꿈 로직
- **대상 파일**: `script.js`
- **수정 위치**: `parseMarkdown` 함수 내부 (약 188번 줄)
- **변경 논리**:
  - `html = html.replace(/^\s+/, '')` 혹은 `html = html.trim()`을 선행 적용하여 렌더링되는 첫 줄 상단의 쓸데없는 공백이나 개행을 완전히 제거합니다.
  - 현재 `^\* ` (별표) 리스트만 처리하는 정규식을 `^[\*\-]\s+(.*)$` 로 확장하여 `-` (하이픈) 기호도 인식하게 합니다.
  - 치환되는 HTML 블록 내부에 `<br>`을 추가하거나 하단 마진(`margin-bottom: 12px;`)을 명시하여 각 항목 사이의 줄바꿈이 시각적으로 확실하게 구분되도록 구조화합니다.

### 4. 📝 문항 총평 200자 제한
- **대상 파일**: `backend_logic.js`
- **수정 위치**: `generateAIFeedback` 내 `formatConstraint` 변수 선언부 (약 204번 줄)
- **변경 논리**: 
  - 기존 `(위의 3가지 항목과 달리 불릿 기호(-) 없이, 1개의 문단으로 길고 구체적으로 서술하세요.)` 문구를 삭제합니다.
  - `(위의 3가지 항목과 달리 불릿 기호(-) 없이, 1개의 문단으로 서술하되, 절대 200자를 초과하지 않도록 엄격히 제한합니다.)`로 변경하여 AI의 출력 길이를 강력히 통제합니다.

### 5. ⚠️ 치명적 단점 장점 혼입 방지 및 조건부 출력 강화
- **대상 파일**: `backend_logic.js`
- **수정 위치**: `generateAIFeedback` 내 `formatConstraint` 제약 사항 (약 207번 줄)
- **변경 논리**:
  - `🚨[제약 사항]` 하단에 3번 항목을 신설합니다.
  - "3. '치명적 단점' 항목에는 칭찬이나 장점을 절대 섞어 쓰지 마세요. 만약 학생의 글에 치명적인 단점이 없다면 억지로 만들지 말고 반드시 '치명적인 단점은 없습니다.'라는 단 한 문장만 출력하세요." 라는 규칙을 추가해 프롬프트 인젝션을 방어합니다.

### 6. DB 저장 로직 Delete-Insert 방식으로 교체
- **대상 파일**: `backend_logic.js`
- **수정 위치**: `generateAIFeedback` 함수의 DB 저장 영역 (약 243번 줄)
- **변경 논리**:
  - 기존의 `.maybeSingle()`을 통한 조회 후 `.update()` 또는 `.insert()`를 분기하는 코드를 전면 삭제합니다.
  - `await window.supabaseClient.from('ai_feedback_history').delete().eq('student_link', studentId).eq('type', targetType);`를 통해 동일 학생/유형의 기존 데이터를 무조건 먼저 안전하게 지웁니다.
  - 곧바로 `.insert(fbPayload)`를 수행함으로써, 중복 에러나 다중 레코드 문제를 물리적으로 방지하는 안전한 Delete-Insert 패턴으로 교체합니다.
