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

### 2.4. 소문항(details) 중첩 구조에 따른 총 글자 수 누락 방지 (신규 발견 🚨)
**문제:** 학교별 문항 설정에서 단일 문항이 아닌 소문항(예: 1-1, 1-2)으로 분할된 경우, 부모 문항의 `q.limit`는 비어있고 하위 `details` 배열에 각각 제한 글자 수가 존재합니다. 기존 로직은 부모 문항의 글자 수만 더하도록 되어 있어, 소문항을 사용하는 학교의 최대 글자 수(totalLimit)가 통째로 0으로 누락되고 덩달아 작성된 글자 수까지 0으로 깎이는 치명적 버그가 발생했습니다.
**해결:** `q.limit`가 비어있을 경우, `q.details` 배열을 순회하여 내부의 `d.limit` 값을 합산하도록 연산 로직을 이중 구조로 수정합니다.

---

## 3. 파일별 상세 수정 계획

### [수정 1] 백엔드 데이터 집계 로직 추가 (`backend_logic.js`)
```javascript
async function getAllPsProgress() {
  let allStatements = [];
  let from = 0;
  const pageSize = 1000;
  
  // 수파베이스 기본 1000건 제한(Pagination) 돌파 로직
  while (true) {
    const { data: statements, error } = await window.supabaseClient
      .from('personal_statements')
      .select('student_link, question_no, content, updated_at')
      .order('updated_at', { ascending: true })
      .range(from, from + pageSize - 1);
      
    if (error || !statements || statements.length === 0) break;
    allStatements = allStatements.concat(statements);
    if (statements.length < pageSize) break;
    from += pageSize;
  }

  const progressMap = {};
  allStatements.forEach(row => {
    if (!progressMap[row.student_link]) progressMap[row.student_link] = {};
    
    // Null 방어: 실제 텍스트가 있을 때만 덮어쓰기
    if (row.content !== null && row.content !== undefined) {
      // 타입 충돌 방지를 위해 강제 String 캐스팅 후 태그 제거
      const cleanText = String(row.content).replace(/\[상세분할\]/g, '');
      const noSpaceText = cleanText.replace(/\s+/g, '');
      
      progressMap[row.student_link][row.question_no] = {
        withSpace: cleanText.length,
        noSpace: noSpaceText.length
      };
    }
  });
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
    const includeSpaces = schoolConf.includeSpaces !== false;
    
    schoolConf.questions.forEach(q => {
      // 1. 단일 문항 limit 추출
      let qLimit = parseInt(q.limit);
      
      // 2. 소문항(details) 중첩 구조 처리: 단일 limit이 없는 경우 소문항 limit 모두 합산
      if (isNaN(qLimit) || qLimit <= 0) {
        if (q.details && q.details.length > 0) {
          qLimit = q.details.reduce((sum, d) => sum + (parseInt(d.limit) || 0), 0);
        } else {
          qLimit = 0;
        }
      }
      
      totalLimit += qLimit;
      
      const qNum = String(q.label).trim();
      let written = 0;
      if (PS_PROGRESS_MAP && PS_PROGRESS_MAP[student.studentLink] && PS_PROGRESS_MAP[student.studentLink][qNum]) {
        const counts = PS_PROGRESS_MAP[student.studentLink][qNum];
        written = includeSpaces ? counts.withSpace : counts.noSpace;
      }
      
      if (written > qLimit) written = qLimit;
      totalWritten += written;
    });
  }
  
  if (totalLimit === 0) {
    td.innerHTML = `<span class="text-muted" style="font-size:12px;">정보없음</span>`;
  } else {
    const percent = Math.round((totalWritten / totalLimit) * 100);
    const percentWidth = percent > 100 ? 100 : percent;
    
    // UI: 육안 검증을 위해 명확한 수치 표기 복구 및 정돈된 폭(width) 설정
    td.innerHTML = `
      <div style="position: relative; width: 100%; min-width: 125px; height: 22px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); margin: 0 auto;">
        <div style="width: ${percentWidth}%; height: 100%; background: linear-gradient(90deg, var(--color-primary-hover), var(--color-primary)); transition: width 0.5s ease;"></div>
        <span style="position: absolute; width: 100%; text-align: center; left: 0; top: 0; line-height: 22px; font-size: 11.5px; font-weight: 700; color: #ffffff; text-shadow: 0px 1px 2px rgba(0,0,0,0.8); letter-spacing: 0.5px;">
          ${totalWritten} / ${totalLimit}자 (${percent}%)
        </span>
      </div>
    `;
  }
}
```
