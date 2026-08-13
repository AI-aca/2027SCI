const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';

async function checkArea1Full() {
  const url = `${SUPABASE_URL}/rest/v1/settings?select=setting_key,setting_value&setting_key=eq.prompt_evaluate_area1`;
  const response = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  const data = await response.json();
  const text = data[0].setting_value;
  console.log(text.slice(-800)); // Show the JSON part
}
checkArea1Full();
