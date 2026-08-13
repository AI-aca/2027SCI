const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';

async function backupPrompts() {
  const url = `${SUPABASE_URL}/rest/v1/settings?select=setting_key,setting_value&setting_key=in.(prompt_evaluate_common,prompt_evaluate_area1,prompt_evaluate_area2,prompt_evaluate_area3)`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  const data = await response.json();
  let backupContent = '# 수파베이스 AI 프롬프트 백업 (복구용)\n\n';
  backupContent += `> 백업 일시: ${new Date().toLocaleString('ko-KR')}\n`;
  backupContent += `> 만약 새 프롬프트에 문제가 생기면 아래의 원문 내용으로 수파베이스 settings 테이블을 덮어씌워 롤백하십시오.\n\n`;
  backupContent += `---\n\n`;
  
  data.forEach(d => {
    backupContent += `## ${d.setting_key}\n\n\`\`\`text\n${d.setting_value}\n\`\`\`\n\n---\n\n`;
  });
  
  const backupPath = path.join(__dirname, '[MD] SUPABASE_PROMPT_BACKUP.md');
  fs.writeFileSync(backupPath, backupContent, 'utf8');
  console.log('백업 완료: ' + backupPath);
}
backupPrompts();
