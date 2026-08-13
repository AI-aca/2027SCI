const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';

async function forceUpdatePrompts() {
  const url = `${SUPABASE_URL}/rest/v1/settings?select=setting_key,setting_value&setting_key=in.(prompt_evaluate_area1,prompt_evaluate_area2,prompt_evaluate_area3)`;
  
  const getRes = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const data = await getRes.json();
  
  const updatePromises = data.map(async (row) => {
    let originalText = row.setting_value;
    
    // Find the last opening brace '{'
    const lastBraceIndex = originalText.lastIndexOf('{');
    
    if (lastBraceIndex !== -1 && !originalText.includes('_think_scratchpad')) {
      const beforeBrace = originalText.substring(0, lastBraceIndex);
      const afterBrace = originalText.substring(lastBraceIndex + 1);
      
      // Replace the instruction right before the brace if it exists
      let modifiedBeforeBrace = beforeBrace.replace(
        /반드시 아래 JSON 포맷을 유지하여 순수 JSON만 반환하십시오\./g,
        '반드시 아래 JSON 포맷을 유지하여 순수 JSON만 반환하십시오. (🚨단, 정답 배열에 값을 넣기 전에 "_think_scratchpad" 항목에 제공된 생기부 문서 전체를 훑으며 발견한 모든 영역별 증거 문장들을 먼저 자유롭게 메모하며 빠진 것이 없는지 뇌를 워밍업할 것)'
      );
      
      let newText = modifiedBeforeBrace + '{\n  "_think_scratchpad": "여기에 제공된 문서 전체를 스캔하며 발견한 관련 증거 문장들을 먼저 자유롭게 메모할 것",' + afterBrace;
      
      const patchUrl = `${SUPABASE_URL}/rest/v1/settings?setting_key=eq.${row.setting_key}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ setting_value: newText })
      });
      
      if (patchRes.ok) {
        console.log(`[성공] ${row.setting_key} 하드 업데이트 완료`);
      } else {
        console.error(`[실패] ${row.setting_key} 업데이트 에러:`, await patchRes.text());
      }
    } else {
      console.log(`[스킵] ${row.setting_key} (중괄호 못 찾음 또는 이미 반영됨)`);
    }
  });

  await Promise.all(updatePromises);
}

forceUpdatePrompts();
