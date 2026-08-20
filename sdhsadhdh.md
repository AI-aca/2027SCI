# 자기소개서 작성률 게이지 바 UI 구현 계획서 (초정밀 보완판)

## 1. 개요 및 목표
관리자 및 학생이 전체 학생 목록을 확인하는 **'자기소개서' 탭의 데이터 테이블**에, 현재 작성 중인 자소서의 실시간 진척도를 직관적으로 보여주는 **'글자수 현황(Progress Bar)' 열**을 추가합니다.

- **핵심 요구사항:** N+1 쿼리 병목 방지, `[상세분할]` 태그 예외 처리, **공백 포함/제외 학교별 설정 완벽 대응**, **null 데이터 덮어쓰기 버그 방지**

---

## 2. 발생 가능한 크리티컬 이슈 및 해결 방안 (Architecture)

### 2.1. 학교별 '공백 포함 여부(includeSpaces)' 설정 누락 방지 (신규 발견 🚨)
**문제:** 어떤 과학고는 글자 수에서 공백을 제외(`includeSpaces === false`)하고 계산합니다. 기존 로직처럼 무조건 `.length`로 계산하면 공백이 포함되어 게이지 바가 100%로 뻥튀기되는 치명적인 오류가 발생합니다.
**해결:** 백엔드 함수(`getAllPsProgress`)에서 텍스트 전체를 보내는 대신, **'공백 포함 글자수(withSpace)'와 '공백 제외 글자수(noSpace)'를 모두 계산해서 프론트엔드로 전달**합니다. 이후 프론트엔드의 `SCHOOL_QUESTIONS_MAP` 설정에 따라 둘 중 올바른 값을 동적으로 선택해 게이지 바를 그립니다.

### 2.2. Null 데이터 덮어쓰기 방지 (신규 발견 🚨)
**문제:** 교사가 피드백만 남긴 경우, DB에 자소서 본문(`content`)이 `null`인 채로 업데이트 로그가 찍힙니다. 최신순으로 덮어쓸 때 `null` 값에 대한 방어 로직이 없으면, 멀쩡히 다 쓴 학생의 글자 수가 갑자기 0으로 초기화되어 버립니다.
**해결:** 백엔드에서 `if (row.content !== null && row.content !== undefined)` 방어문을 추가하여 실제 본문이 있는 경우에만 글자 수를 갱신(덮어쓰기)하도록 조치합니다.

### 2.3. [상세분할] 태그 및 N+1 쿼리 병목
**해결:** `.replace(/\[상세분할\]/g, '')` 적용 및 `Promise.all` 기반 단일 쿼리 통신으로 처리.

---

## 3. 파일별 상세 수정 계획

### [수정 1] 백엔드 데이터 집계 로직 추가 (`backend_logic.js`)
```javascript
async function getAllPsProgress() {
  const { data: statements } = await window.supabaseClient
    .from('personal_statements')
    .select('student_link, question_no, content, updated_at')
    .order('updated_at', { ascending: true }); // 과거 ➔ 최신순 덮어쓰기

  const progressMap = {};
  if (statements) {
    statements.forEach(row => {
      if (!progressMap[row.student_link]) progressMap[row.student_link] = {};
      
      // Null 방어: 실제 텍스트가 있을 때만 덮어쓰기 (교사 피드백 단독 업데이트 시 content가 null일 수 있음)
      if (row.content !== null && row.content !== undefined) {
        // [상세분할] 태그 제거
        const cleanText = row.content.replace(/\\[상세분할\\]/g, '');
        // 공백 제거 텍스트
        const noSpaceText = cleanText.replace(/\\s+/g, '');
        
        // 프론트엔드에서 학교 설정에 따라 골라 쓸 수 있도록 두 가지 버전 모두 제공
        progressMap[row.student_link][row.question_no] = {
          withSpace: cleanText.length,
          noSpace: noSpaceText.length
        };
      }
    });
  }
  return progressMap;
}
window.getAllPsProgress = getAllPsProgress;
```

### [수정 2] 클라이언트 데이터 병렬 적재 (`script.js`)
```javascript
let PS_PROGRESS_MAP = {}; 

async function loadStudentsData() {
  isStudentsDataLoading = true;
  renderMainTable(); 
  try {
    const [studentsRes, progressRes] = await Promise.all([
      ApiClient.post('getStudentsList'),
      window.getAllPsProgress()
    ]);
    STUDENTS_LIST = studentsRes;
    PS_PROGRESS_MAP = progressRes;
  } catch (err) {
    console.error('데이터 로드 실패:', err);
    STUDENTS_LIST = [];
    PS_PROGRESS_MAP = {};
  } finally {
    isStudentsDataLoading = false;
    renderMainTable(); 
  }
}
```

### [수정 3] 테이블 UI 렌더링 및 동적 계산 (`script.js`)
```javascript
else if (col.key === 'psProgress') {
  const targetSchoolName = student.targetSchool;
  const schoolConf = window.SCHOOL_QUESTIONS_MAP && window.SCHOOL_QUESTIONS_MAP.find(s => s.name === targetSchoolName);
  
  let totalLimit = 0;
  let totalWritten = 0;
  
  if (schoolConf && schoolConf.questions) {
    // 해당 학교가 공백을 포함하는지 판별 (기본값 true)
    const includeSpaces = schoolConf.includeSpaces !== false;
    
    schoolConf.questions.forEach(q => {
      const limit = parseInt(q.limit) || 0;
      totalLimit += limit;
      
      const qNum = String(q.label);
      let written = 0;
      if (PS_PROGRESS_MAP && PS_PROGRESS_MAP[student.studentLink] && PS_PROGRESS_MAP[student.studentLink][qNum]) {
        const counts = PS_PROGRESS_MAP[student.studentLink][qNum];
        // 학교 설정에 맞게 글자 수 선택
        written = includeSpaces ? counts.withSpace : counts.noSpace;
      }
      
      if (written > limit) written = limit;
      totalWritten += written;
    });
  }
  
  if (totalLimit === 0) {
    td.innerHTML = `<span class="text-muted">정보없음</span>`;
  } else {
    const percent = Math.round((totalWritten / totalLimit) * 100);
    const percentWidth = percent > 100 ? 100 : percent;
    
    td.innerHTML = `
      <div style="position: relative; width: 100%; min-width: 120px; height: 22px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
        <div style="width: ${percentWidth}%; height: 100%; background: linear-gradient(90deg, var(--color-primary-dark), var(--color-primary)); transition: width 0.5s ease;"></div>
        <span style="position: absolute; width: 100%; text-align: center; left: 0; top: 0; line-height: 22px; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0px 1px 2px rgba(0,0,0,0.8); letter-spacing: 0.5px;">
          ${totalWritten} / ${totalLimit}자 (${percent}%)
        </span>
      </div>
    `;
  }
}
```
