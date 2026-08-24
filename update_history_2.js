const fs = require('fs');
const content = `
### 2026-08-23 자소서 히스토리 영구 보존 및 UI 정돈 패치
- index.html, script.js: 자소서 과거 이력 삭제(휴지통) 버튼 관련 HTML 요소 및 권한별 렌더링, 수파베이스 통신 로직 전면 영구 철거 (데이터 완전 보호)
- script.js: 드롭다운 내 불필요한 '[보호됨]' 텍스트 렌더링 제거 (최신 표기만 유지하여 UI 정돈)
`;
fs.appendFileSync('C:\\Users\\slrud\\OneDrive\\문서\\[안티그래비티]\\2027 과학고 수파베이스(로컬)\\[MD] HISTORY.md', content, 'utf8');
console.log('HISTORY.md appended');
