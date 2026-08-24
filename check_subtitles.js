const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSubtitles() {
  const { data: qData, error: qError } = await supabase
    .from('interview_practice')
    .select('record_questions_json')
    .not('record_questions_json', 'is', null);

  if (qError) return console.error(qError);

  let totalQuestions = 0;
  let missingSubtitleCount = 0;
  
  qData.forEach((row) => {
    if (!row.record_questions_json) return;
    
    const parts = row.record_questions_json.split(/(?=^###\s)/m);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || !trimmed.startsWith('###')) continue;
      
      totalQuestions++;
      const firstNewline = trimmed.indexOf('\n');
      let rawTitle = firstNewline > 0 ? trimmed.substring(0, firstNewline).replace(/^###\s*/, '').trim() : trimmed.replace(/^###\s*/, '').trim();
      
      const catMatch = rawTitle.match(/\[(.*?)\]/);
      let subTitle = "";
      if (catMatch) {
        const idx = rawTitle.indexOf(']');
        subTitle = rawTitle.substring(idx + 1).trim();
        subTitle = subTitle.replace(/^\(/, '').replace(/\)$/, '').trim();
      } else {
        subTitle = rawTitle.replace(/(Q\d+)\.?/, '').replace(/📝/, '').trim(); 
      }
      
      if (!subTitle) {
        missingSubtitleCount++;
      }
    }
  });
  
  console.log(`[팩트 검증 결과]`);
  console.log(`총 문항 수: ${totalQuestions}개`);
  console.log(`소제목이 누락된 문항 수: ${missingSubtitleCount}개`);
}

checkSubtitles();
