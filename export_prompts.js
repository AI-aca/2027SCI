const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function exportPrompts() {
  const { data: promptData, error } = await supabase
    .from('settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['prompt_q_jasoso', 'prompt_q_senggibu']);
    
  if (error) {
    console.error("에러:", error);
    return;
  }
  
  let output = "";
  promptData.forEach(p => {
    output += `\n# [${p.setting_key}]\n`;
    output += p.setting_value + "\n";
  });
  
  fs.writeFileSync('prompt_before.md', output, 'utf8');
  console.log("프롬프트 원문 저장 완료");
}

exportPrompts();
