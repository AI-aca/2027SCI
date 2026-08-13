const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';

async function verifyPrompts() {
  const url = `${SUPABASE_URL}/rest/v1/settings?select=setting_key,setting_value&setting_key=in.(prompt_evaluate_area1,prompt_evaluate_area2,prompt_evaluate_area3)`;
  
  const response = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  
  const data = await response.json();
  data.forEach(d => {
    // We only care about the last 150 characters to see the JSON format string
    const endStr = d.setting_value.slice(-250);
    console.log(`=== ${d.setting_key} ===\n${endStr}\n`);
  });
}
verifyPrompts();
