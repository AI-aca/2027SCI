const fs = require('fs');
let md = fs.readFileSync('c:/Users/slrud/OneDrive/문서/[안티그래비티]/2027 과학고 관리/[MD] HISTORY.md', 'utf8');
const entry = '## [2026-07-17] 40차 - GAS WebApp URL 하드코딩 (브라우저 스토리지 초기화 대응)\n' +
'- **원인**: 이전까지 프론트엔드(`script.js`)의 유연성을 위해 구글 앱 스크립트 통신 주소(GAS_WEBAPP_URL)를 브라우저 로컬 저장소(`localStorage`)에 저장하고 불러오는 방식을 사용했습니다. 그러나, 이 방식은 사용자가 로컬 서버(Live Server)를 껐다 켜거나 브라우저 캐시를 지울 경우 주소를 분실하여 화면이 백지화되는 심각한 단점이 있었습니다.\n' +
'- **조치 사항**: 타 표준 프로젝트들과 동일하게, 프론트엔드 `script.js` 소스코드 최상단에 통신 주소(URL)를 상수(`const`)로 영구적으로 박아두는 하드코딩 방식을 채택했습니다. 이로 인해 브라우저 환경이 변하거나 로컬 캐시가 날아가도 절대 통신 에러가 발생하지 않도록 근본적인 원인을 제거했습니다.\n\n';
md = entry + md;
fs.writeFileSync('c:/Users/slrud/OneDrive/문서/[안티그래비티]/2027 과학고 관리/[MD] HISTORY.md', md, 'utf8');
