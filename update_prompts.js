const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updatePrompts() {
  const planContent = fs.readFileSync('C:\\Users\\slrud\\.gemini\\antigravity\\brain\\a23163cd-ea24-4acf-bd9a-7fb31f5c5825\\prompt_update_plan.md', 'utf8');
  
  // After 마크다운에서 텍스트 추출 (야매 파싱)
  const jasosoAfterMatch = planContent.match(/## 🟢 After.*?\n```markdown\n([\s\S]*?)\n```/);
  const senggibuAfterMatch = planContent.match(/## 🟢 After.*?\n```markdown\n([\s\S]*?)\n```/g); // 두 번째 매치 추출
  
  if (!jasosoAfterMatch || senggibuAfterMatch.length < 2) {
    console.error("아티팩트에서 프롬프트를 추출하지 못했습니다.");
    return;
  }
  
  const jasosoPrompt = jasosoAfterMatch[1];
  const senggibuPrompt = senggibuAfterMatch[1].replace(/## 🟢 After.*?\n```markdown\n/, '').replace(/\n```$/, ''); // 정밀 파싱

  console.log("=== 수파베이스 업데이트 시작 ===");
  
  const { error: err1 } = await supabase
    .from('settings')
    .update({ setting_value: jasosoPrompt })
    .eq('setting_key', 'prompt_q_jasoso');
    
  if (err1) console.error("자소서 업데이트 실패:", err1);
  else console.log("✅ 자소서 프롬프트 업데이트 성공");

  const { error: err2 } = await supabase
    .from('settings')
    .update({ setting_value: senggibuPrompt })
    .eq('setting_key', 'prompt_q_senggibu');
    
  if (err2) console.error("생기부 업데이트 실패:", err2);
  else console.log("✅ 생기부 프롬프트 업데이트 성공");
}

updatePrompts();
