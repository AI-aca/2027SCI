const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  let allData = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.from('ai_feedback_history').select('*').range(from, from + limit - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < limit) break;
    from += limit;
  }

  let fixCount = 0;
  for (const f of allData) {
    if (f.type && f.type.includes('|문항문항')) {
      const fixedType = f.type.replace('|문항문항', '|문항');
      const { error } = await supabase.from('ai_feedback_history').update({ type: fixedType }).eq('id', f.id);
      if (error) throw error;
      fixCount++;
    }
  }
  console.log(`AI 피드백 타입 오타(문항문항) 수정 완료: ${fixCount}건 처리됨`);
}
run();
