const fs = require('fs');
let js = fs.readFileSync('c:/Users/slrud/OneDrive/문서/[안티그래비티]/2027 과학고 관리/script.js', 'utf8');

// 1. Remove saving to localStorage inside saveSettings
js = js.replace(/const gasUrl = document\.getElementById\('settings-gas-url'\)\?\.value\.trim\(\) \|\| '';\s*localStorage\.setItem\('gas_webapp_url', gasUrl\);\s*GAS_WEBAPP_URL = gasUrl;/g, '');

// 2. Remove reading from localStorage inside loadSettingsForm
js = js.replace(/if\(document\.getElementById\('settings-gas-url'\)\) document\.getElementById\('settings-gas-url'\)\.value = localStorage\.getItem\('gas_webapp_url'\) \|\| '';/g, 
  "if(document.getElementById('settings-gas-url')) document.getElementById('settings-gas-url').value = GAS_WEBAPP_URL;");

fs.writeFileSync('c:/Users/slrud/OneDrive/문서/[안티그래비티]/2027 과학고 관리/script.js', js, 'utf8');
