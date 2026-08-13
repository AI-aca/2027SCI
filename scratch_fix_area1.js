const SUPABASE_URL = 'https://bwohwhsrwasaykydjhkh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Ci19OL6BolLQ-pmsxJsRcA_XtTlIFRb';

async function fixArea1JsonStructure() {
  const url = `${SUPABASE_URL}/rest/v1/settings?select=setting_key,setting_value&setting_key=eq.prompt_evaluate_area1`;
  const response = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  const data = await response.json();
  
  if (data.length > 0) {
    let text = data[0].setting_value;
    // Replace the wrong JSON structure with the correct one based on JS code
    let newText = text.replace(
      /"gradeDropsExtracted":\s*\{\s*"korEng":\s*\[\],\s*"mathSciSoc":\s*\[\]\s*\}/,
      '"gradeDropsExtracted": { "korEng": [], "socHisInfo": [], "moralTech": [] }'
    );
    
    if (newText !== text) {
      const patchUrl = `${SUPABASE_URL}/rest/v1/settings?setting_key=eq.prompt_evaluate_area1`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_value: newText })
      });
      if (patchRes.ok) console.log("Area 1 gradeDropsExtracted structure FIXED in Supabase.");
      else console.error("Failed to patch Supabase.", await patchRes.text());
    } else {
      console.log("No mismatch found or regex failed.");
    }
  }
}
fixArea1JsonStructure();
