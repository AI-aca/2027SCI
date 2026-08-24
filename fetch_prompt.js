const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkData() {
  console.log("=== 프롬프트 원본 조회 ===");
  const { data: promptData, error: promptError } = await supabase
    .from('settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['prompt_q_jasoso', 'prompt_q_senggibu']);
    
  if (promptError) console.error("프롬프트 에러:", promptError);
  else {
    promptData.forEach(p => {
      console.log(`[${p.setting_key}]`);
      console.log(p.setting_value.substring(0, 1000) + "... (생략)");
      console.log("------------------------");
    });
  }
}

checkData();
