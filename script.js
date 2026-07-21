
function extractDriveId(val) {
  if (!val) return '';
  let match = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = val.match(/id=([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  match = val.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return val.trim();
}
/**
 * ==================================================================================
 * ⚙️ [2027 과학고 관리 사이트] 프론트엔드 연동 스크립트 (script.js)
 * ==================================================================================
 */

// 🌐 구글 웹 앱 배포 완료 후 생성된 URL을 아래 변수에 입력하십시오.
// (로컬 브라우저에서 실행하더라도 이 주소를 통해 스프레드시트와 실시간 연동됩니다.)
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxfXEO6oqwcBVInseJmibcFwQmhMRbUObtBorZMwfg5LADt8tuTjrWF6O23t4BrA1rF/exec';


// 🔐 권한 상태
let CURRENT_ROLE = null; // '교사' | '관리자' | '학생'
let CURRENT_STUDENT_ID = null; // 학생 접속인 경우의 학생 번호/토큰
let ACTIVE_ADMIN_PASSWORD = ''; // 관리자 락 해제 요청 시 검증용 캐시 패스워드
let SETTINGS_CENTERS = []; // 센터명 캐시
let isEditMode = false; // 신규 학생 등록 및 수정 모달 상태 플래그
let ACTIVE_EDIT_STUDENT_LINK = ''; // 수정 모드 시 학생 고유링크 저장용
window.updateCenterDropdowns = function() {
  const regCenter = document.getElementById('reg-center');
  if (regCenter) {
    regCenter.innerHTML = '<option value="">센터 선택</option>';
    SETTINGS_CENTERS.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      regCenter.appendChild(opt);
    });
  }
};

const GlobalLoader = {
  interval: null,
  percent: 0,
  show() {
    const overlay = document.getElementById('global-loader-overlay');
    const textEl = document.getElementById('loader-percentage-text');
    if (!overlay || !textEl) return;
    overlay.classList.remove('hidden');
    this.percent = 0;
    textEl.innerText = '0%';
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (this.percent < 99) {
        this.percent += Math.floor(Math.random() * 5) + 1;
        if (this.percent > 99) this.percent = 99;
        textEl.innerText = this.percent + '%';
      }
    }, 150);
  },
  hide() {
    const overlay = document.getElementById('global-loader-overlay');
    const textEl = document.getElementById('loader-percentage-text');
    if (!overlay || !textEl) return;
    clearInterval(this.interval);
    this.percent = 100;
    textEl.innerText = '100%';
    setTimeout(async () => {
      overlay.classList.add('hidden');
    }, 300);
  }
};

// 🌐 전역 합불 통신 함수 신설
window.updatePassStatus = async function(studentLink, passType, passValue) {
  try {
    const result = await ApiClient.post('updatePassStatus', { studentId: studentLink, passType, passValue }, { hideLoader: true });
    if (!result.success) {
      alert('합불 상태 저장 실패: ' + result.error);
    }
  } catch (e) {
    alert('합불 통신 오류: ' + e.toString());
  }
};

// 🌐 통합 API Client 클래스 (로컬/배포 무결성 보장)
const ApiClient = {
  async post(action, payload = {}, options = {}) {
    const useLoader = !options.hideLoader;
    if (useLoader) GlobalLoader.show();
    try {
      const requestData = { action, ...payload };
      
      // 1. 구글 배포 URL이 없고, google.script.run도 없는 로컬 테스트 환경 차단
      if (!GAS_WEBAPP_URL && typeof google === 'undefined') {
        throw new Error('API 서버 URL이 설정되지 않았습니다. 관리자 계정으로 로그인 후 [환경설정]에서 GAS WebApp URL을 등록해주세요.');
      }
      
      // 2. google.script.run 사용 가능한 웹앱 환경 (GAS 빌트인 호출)
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        return await new Promise((resolve, reject) => {
          // google.script.run의 적절한 함수명을 동적으로 연결
          const funcName = action;
          if (typeof window[funcName] === 'function' || google.script.run[funcName]) {
            google.script.run
              .withSuccessHandler(res => resolve(res))
              .withFailureHandler(err => reject(err))[funcName](payload);
          } else {
            // doPost 프록시로 전달
            google.script.run
              .withSuccessHandler(res => resolve(JSON.parse(res)))
              .withFailureHandler(err => reject(err))
              .doPost({ postData: { contents: JSON.stringify(requestData) } });
          }
        });
      }
      
      // 3. 로컬 브라우저에서 실배포된 GAS WebApp URL로 fetch POST 연동
      const response = await fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(requestData)
      });
      const resJson = await response.json();
      if (!resJson.success) throw new Error(resJson.error || 'API 연동 에러');
      return resJson.data || resJson;
    } catch (e) {
      console.error('GAS API Fetch 실패:', e);
      throw new Error('GAS 통신에 실패했습니다: ' + e.message);
    } finally {
      if (useLoader) GlobalLoader.hide();
    }
  }
};

// 타임스탬프 포맷팅 헬퍼 함수

function parseMarkdownToHtml(text) {
  if (!text) return '';
  let html = text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^---$/gim, '<hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 20px 0;">')
    .replace(/^### (.*$)/gim, '<h4 style="color: var(--color-primary); margin: 16px 0 8px 0; font-size: 16px;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="color: var(--color-primary); margin: 24px 0 10px 0; font-size: 18px; padding-top: 12px;">$1</h3>')
    .replace(/^# (.*$)/gim, '<h2 style="color: #fff; margin: 24px 0 12px 0; font-size: 22px;">$1</h2>')
    .replace(/🗣️ 면접 질문:/gim, '<span style="color: var(--color-primary); font-weight: bold;">🗣️ 면접 질문:</span>')
    .replace(/🎯 출제 의도:/gim, '<span style="color: var(--color-primary); font-weight: bold;">🎯 출제 의도:</span>')
    .replace(/🔗 꼬리 질문:/gim, '<span style="color: var(--color-primary); font-weight: bold;">🔗 꼬리 질문:</span>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong style="color: #fff;">$1</strong>')
    .replace(/^\* (.*$)/gim, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>')
    .replace(/^- (.*$)/gim, '<li style="margin-left: 20px; list-style-type: circle; margin-bottom: 4px;">$1</li>')
    .replace(/^&gt;\s?(.*$)/gim, '<div style="border-left: 3px solid var(--color-primary); background: rgba(0,0,0,0.2); margin: 8px 0; padding: 12px; color: var(--text-muted); line-height: 1.5;">$1</div>');
    
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/(<\/h2>|<\/h3>|<\/h4>|<hr[^>]*>|<\/div>|<\/li>)<br>/g, '$1');
  return html;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  // 구글 시트에서 ISO 8601 문자열(예: 2026-07-16T22:21:00.000Z)로 반환될 경우의 처리
  const d = new Date(ts);
  if (!isNaN(d.getTime())) {
    const yy = String(d.getFullYear()).slice(-2);
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${yy}-${MM}-${dd} ${hh}:${mm}`;
  }
  return ts;
}

// 간단한 마크다운 파싱 헬퍼 함수
function parseMarkdown(text) {
  if (!text) return '';
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // XSS 방지
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--color-primary-light); font-weight:700;">$1</strong>'); // Bold
  html = html.replace(/^#### (.*)$/gim, '<h4 style="margin-top:20px; margin-bottom:8px; color:var(--color-primary); font-size:15px;">$1</h4>'); // H4
  html = html.replace(/^### (.*)$/gim, '<h3 style="margin-top:24px; margin-bottom:12px; color:var(--color-primary); font-size:17px; padding-top:12px;">$1</h3>'); // H3 (항목 선 완전히 제거)
  html = html.replace(/^## (.*)$/gim, '<h3 style="margin-top:24px; margin-bottom:12px; color:var(--color-primary); font-size:17px; padding-top:12px;">$1</h3>'); // H2 (예외처리)
  html = html.replace(/^# (.*)$/gim, '<h3 style="margin-top:24px; margin-bottom:12px; color:var(--color-primary); font-size:17px; padding-top:12px;">$1</h3>'); // H1 (예외처리)
  html = html.replace(/^[#\s]*===\s*(문항\s*\d+).*?===$/gim, '<h3 style="margin-top:36px; margin-bottom:12px; color:var(--color-primary); font-size:17px; border-top:1px solid rgba(255,255,255,0.2); padding-top:16px;">[$1]</h3>'); // === 문항 N === (AI 변칙 문자 포용)
  html = html.replace(/^\s*---\s*$/gim, ''); // 구분선(---) 제거
  html = html.replace(/^\* (.*)$/gim, '<div style="padding-left:16px; position:relative; margin-bottom:4px;"><span style="position:absolute; left:0; color:var(--color-primary);">•</span>$1</div>'); // List
  html = html.replace(/^> (.*)$/gim, '<div style="border-left: 3px solid var(--color-primary); margin: 12px 0; color: #bbb; background: rgba(0,0,0,0.15); padding: 10px 12px; border-radius: 4px;">$1</div>'); // Quote
  
  // 제목(h3, h4) 주변의 중복된 엔터(줄바꿈) 제거 (마진과 중첩되어 간격이 넓어지는 현상 방지)
  html = html.replace(/\n+(<h[34])/g, '$1');
  html = html.replace(/(<\/h[34]>)\n+/g, '$1');
  
  return html;
}

// 🚀 어플리케이션 상태 라이프사이클 초기화
document.addEventListener('DOMContentLoaded', async () => {
  // 세션 스토리지 역할 복원 (리팩토링 6)
  const savedRole = sessionStorage.getItem('user_role');
  const savedPw = sessionStorage.getItem('user_pw');
  if (savedRole) {
    CURRENT_ROLE = savedRole;
    if (savedRole === '관리자') {
      ACTIVE_ADMIN_PASSWORD = savedPw || '';
    }
    applyRoleUI(CURRENT_ROLE);
  }

  detectRoleFromUrl();
  
  // 최초 1회 설정을 무조건 로드하여 드롭다운 리스트 구축
  await loadSettingsForm();
  
  loadStudentsData();
  bindEventHandlers();
  
  if (CURRENT_ROLE === '학생') {
    // 이벤트 리스너 부착 완료 후 안전하게 자기소개서 메뉴 강제 클릭
    const psMenuBtn = document.querySelector('.menu-item[data-menu="ps"]');
    if (psMenuBtn) psMenuBtn.click();
  }
  
  // 들어가자마자 인증된 권한이 없다면 비번 입력 팝업 즉시 기동 및 화면 차단
  if (!CURRENT_ROLE) {
    applyRoleUI(CURRENT_ROLE);
    document.getElementById('modal-login').classList.add('open');
  }
});

/**
 * 권한 역할별 UI 동적 활성화 제어
 */
function applyRoleUI(role) {
  // 인증 완료 후 메인 레이아웃 표시 (FOUC 방지)
  const appLayout = document.getElementById('app-layout');
  if (appLayout) appLayout.style.visibility = 'visible';

  const regBtn = document.getElementById('sidebar-register-area');
  const settingsMenu = document.getElementById('menu-settings');
  const aiFeedbackTab = document.getElementById('tab-btn-ai-feedback');
  const headerActions = document.getElementById('main-header-actions');
  
  if (headerActions) {
    headerActions.innerHTML = '';
  }

  // AI 챗봇 토글 버튼 노출 제어
  const chatbotToggle = document.getElementById('btn-ai-chatbot-toggle');
  if (chatbotToggle) chatbotToggle.style.display = 'flex';
  
  const sBanner = document.getElementById('student-warning-banner');
  if (sBanner) sBanner.style.display = 'none';
  const mainContent = document.querySelector('main.dashboard-content');
  const sidebar = document.querySelector('nav.sidebar');

  if (!role) {
    if (mainContent) mainContent.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (chatbotToggle) chatbotToggle.style.display = 'none';
    return;
  } else {
    if (mainContent) mainContent.style.display = 'block';
    if (sidebar) sidebar.style.display = 'flex';
    if (chatbotToggle) chatbotToggle.style.display = 'flex';
  }
  
  if (role === '학생') {
    if (regBtn) regBtn.style.display = 'none';
    const menusToHideForStudent = ['menu-dashboard', 'menu-info', 'menu-record', 'menu-settings', 'menu-exam'];
    menusToHideForStudent.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.parentNode.style.display = 'none';
    });
    const btnUploadPdf = document.getElementById('btn-upload-pdf');
    if (btnUploadPdf) btnUploadPdf.style.display = 'none';
    
    if (aiFeedbackTab) aiFeedbackTab.style.display = 'none';
    document.getElementById('current-role-display').textContent = '학생 전용 작성';
    document.getElementById('current-user-status').textContent = '자기소개서 작성 권한';
    document.getElementById('btn-login-modal').style.display = 'none';
    if (sBanner) sBanner.style.display = 'block';
  } else if (role === '교사') {
    if (regBtn) regBtn.style.display = 'block';
    if (settingsMenu) settingsMenu.parentNode.style.display = 'none';
    const btnUploadPdf = document.getElementById('btn-upload-pdf');
    if (btnUploadPdf) btnUploadPdf.style.display = 'none';
    if (aiFeedbackTab) aiFeedbackTab.style.display = 'block';
    document.getElementById('current-role-display').textContent = '일반 교사 계정';
    document.getElementById('current-user-status').textContent = '조회 및 첨삭 권한 보유';
    
    const loginBtn = document.getElementById('btn-login-modal');
    loginBtn.style.display = 'block';
    loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> [로그아웃]';
    loginBtn.onclick = () => {
      sessionStorage.removeItem('user_role');
      sessionStorage.removeItem('user_pw');
      alert('로그아웃 되었습니다.');
      window.location.reload();
    };
  } else if (role === '관리자') {
    if (regBtn) regBtn.style.display = 'block';
    if (settingsMenu) settingsMenu.parentNode.style.display = 'block';
    const btnUploadPdf = document.getElementById('btn-upload-pdf');
    if (btnUploadPdf) btnUploadPdf.style.display = 'none'; // 관리자라도 업로드 버튼 숨김
    if (aiFeedbackTab) aiFeedbackTab.style.display = 'block';
    document.getElementById('current-role-display').textContent = '시스템 관리자';
    document.getElementById('current-user-status').textContent = 'AI 및 모든 환경 제어권 보유';
    
    const loginBtn = document.getElementById('btn-login-modal');
    loginBtn.style.display = 'block';
    loginBtn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> [로그아웃]';
    loginBtn.onclick = () => {
      sessionStorage.removeItem('user_role');
      sessionStorage.removeItem('user_pw');
      alert('로그아웃 되었습니다.');
      window.location.reload();
    };
    
    if (headerActions) {
      headerActions.innerHTML = '';
    }
  }
}

let PDF_TARGET_STUDENT = null;
window.triggerPdfUpload = function(studentLink) {
  PDF_TARGET_STUDENT = studentLink;
  const fileInput = document.getElementById('student-record-pdf-input');
  if (fileInput) {
    fileInput.value = ''; // 초기화
    fileInput.click();
  }
};

/**
 * URL 파라미터를 읽어 학생 권한 여부 확인 (보안 강화)
 */
function detectRoleFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const studentToken = urlParams.get('student') || urlParams.get('id');
  
  if (studentToken) {
    CURRENT_ROLE = '학생';
    CURRENT_STUDENT_ID = studentToken;
    
    // 학생 권한 UI 적용
    applyRoleUI('학생');
    
    // 학생인 경우 자기 자소서 에디터만 즉시 자동 로드하도록 구성
    setTimeout(async () => {
      openPersonalStatementModal(studentToken);
    }, 800);
  }
}

/**
 * 전체 학생 데이터 연동 로드
 */
let STUDENTS_LIST = [];
async function loadStudentsData() {
  try {
    STUDENTS_LIST = await ApiClient.post('getStudentsList');
  } catch (err) {
    console.error('학생 데이터 로드 실패:', err);
    STUDENTS_LIST = [];
  } finally {
    renderMainTable();
  }
}

// 🗂️ 사이드바 메뉴별 동적 컬럼 정보 매핑
const TABLE_COLUMNS = {
  dashboard: [
    { label: '센터명', key: 'center' },
    { label: '학생명', key: 'name' },
    { label: '현재 학교', key: 'school' },
    { label: '지원학교', key: 'targetSchool' },
    { label: '1차 합불', key: 'passRound1' },
    { label: '2차 합불', key: 'passRound2' },
    { label: '최종 합불', key: 'passFinal' },
    { label: '링크(배포)', key: 'studentLink' },
    { label: '문자(배포)', key: 'studentSms' },
    { label: '관리', key: 'manage' }
  ],
  info: [
    { label: '센터명', key: 'center' },
    { label: '학생명', key: 'name' },
    { label: '현재 학교', key: 'school' },
    { label: '지원학교', key: 'targetSchool' },
    { label: '수학 담당', key: 'mathTeacher' },
    { label: '과학 담당', key: 'sciTeacher' },
    { label: '학부모 연락처', key: 'parentPhone' },
    { label: '학생 연락처', key: 'studentPhone' }
  ],
  record: [
    { label: '센터명', key: 'center' },
    { label: '학생명', key: 'name' },
    { label: '현재 학교', key: 'school' },
    { label: '지원학교', key: 'targetSchool' },
    { label: '생기부 보기', key: 'recordView' },
    { label: '생기부 업로드', key: 'recordUpload' },
    { label: '생기부 점수', key: 'recordScoreOnly' },
    { label: '생기부 점수근거', key: 'recordBasis' },
    { label: 'AI 채점', key: 'recordEval' }
  ],
  ps: [
    { label: '센터명', key: 'center' },
    { label: '학생명', key: 'name' },
    { label: '현재 학교', key: 'school' },
    { label: '지원학교', key: 'targetSchool' },
    { label: '최종여부', key: 'psStatus' },
    { label: '자소서 피드백 확인', key: 'psFeedback' },
    { label: '관리', key: 'manage' }
  ],
  interview: [
    { label: '센터명', key: 'center' },
    { label: '학생명', key: 'name' },
    { label: '현재 학교', key: 'school' },
    { label: '지원학교', key: 'targetSchool' },
    { label: '수학 담당', key: 'mathTeacher' },
    { label: '과학 담당', key: 'sciTeacher' },
    { label: '생기부 기반 연습', key: 'interviewRecord' },
    { label: '자소서 기반 연습', key: 'interviewPs' }
  ]
};

let CURRENT_MENU = 'dashboard';
let currentSortCol = '';
let currentSortDir = 'asc'; // 'asc' or 'desc'

/**
 * 동적 컬럼 렌더링 테이블 구현 (가로 스크롤 차단)
 */
function copySmsTemplate(center, name, link) {
  const url = window.location.origin + window.location.pathname + '?student=' + link;
  const text = `[와이즈만 ${center}]

과학고 합격을 위한 개별 관리 링크를 보내드립니다.
이 링크를 통해 자소서 작성 및 예상질문 답변을 작성해 주세요.
* 모바일이 아닌 PC나 노트북 환경의 크롬 브라우저를 권장 드립니다.

${name} 학생의 링크

링크 주소 - ${url}
*개인 정보 및 합격 전략 노출을 방지하기 위해 링크를 외부 유출하지 말아주세요.`;

  navigator.clipboard.writeText(text).then(() => {
    alert('배포용 문자 내용과 링크가 복사되었습니다. 카카오톡이나 문자 앱에 붙여넣기 하세요.');
  }).catch(err => {
    alert('복사에 실패했습니다: ' + err);
  });
}

function renderMainTable() {
  const headerRow = document.getElementById('table-header-row');
  const tbody = document.getElementById('student-table-body');
  
  const tableControls = document.querySelector('.table-controls');
  if (tableControls) {
    if (CURRENT_ROLE === '학생' || CURRENT_MENU === 'guide' || CURRENT_MENU === 'exam' || CURRENT_MENU === 'settings' || CURRENT_MENU === 'user-guide') {
      tableControls.style.display = 'none';
    } else {
      tableControls.style.display = 'flex';
    }
  }
  
  // 메뉴별 필터 제어
  const filterSchool = document.getElementById('filter-target-school');
  if (filterSchool) filterSchool.style.display = (CURRENT_MENU === 'info' || CURRENT_MENU === 'record' || CURRENT_MENU === 'ps' || CURRENT_MENU === 'interview') ? 'inline-block' : 'none';
  
  headerRow.innerHTML = '';
  tbody.innerHTML = '';
  
  // 1. 헤더 생성
  let cols = TABLE_COLUMNS[CURRENT_MENU] || TABLE_COLUMNS.dashboard;
  
  // 관리자가 아닌 경우 AI 채점(recordEval) 열 숨김
  if (CURRENT_MENU === 'record' && CURRENT_ROLE !== '관리자') {
    cols = cols.filter(c => c.key !== 'recordEval');
  }
  
  // 학생인 경우 자소서 피드백(AI) 열 숨김
  if (CURRENT_MENU === 'ps' && CURRENT_ROLE === '학생') {
    cols = cols.filter(c => c.key !== 'psFeedback');
  }

  cols.forEach(col => {
    const th = document.createElement('th');
    th.style.textAlign = 'center';
    
    if (['center', 'name', 'school', 'targetSchool'].includes(col.key)) {
      th.style.cursor = 'pointer';
      
      // 기본 상태는 회색 아래쪽 삼각형
      let iconClass = 'fa-caret-down';
      let iconColor = '#777';
      
      // 현재 정렬 중인 컬럼이면 방향 및 녹색 적용
      if (currentSortCol === col.key) {
        iconClass = currentSortDir === 'asc' ? 'fa-caret-up' : 'fa-caret-down';
        iconColor = 'var(--color-primary)';
      }
      
      th.innerHTML = `${col.label} <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 14px; margin-left: 4px;"></i>`;
      
      th.onclick = () => {
        if (currentSortCol === col.key) {
          currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          currentSortCol = col.key;
          currentSortDir = 'asc';
        }
        renderMainTable();
      };
    } else {
      th.textContent = col.label;
    }
    headerRow.appendChild(th);
  });
  
  // 2. 바디 데이터 생성
  const searchVal = document.getElementById('search-student').value.toLowerCase();
  const targetSchoolVal = document.getElementById('filter-target-school') ? document.getElementById('filter-target-school').value : '전체';
  
  const filtered = STUDENTS_LIST.filter(s => {
    // 학생일 경우 자신의 데이터만 보이도록 강제 필터링
    if (CURRENT_ROLE === '학생' && s.studentPhone !== CURRENT_STUDENT_ID && s.studentLink !== CURRENT_STUDENT_ID) return false;
    
    const matchSearch = s.name.toLowerCase().includes(searchVal) || s.school.toLowerCase().includes(searchVal);
    const matchSchool = (targetSchoolVal === '전체') || (s.targetSchool === targetSchoolVal);
    return matchSearch && matchSchool;
  });

  // 선택된 컬럼 정렬 적용
  if (currentSortCol) {
    filtered.sort((a, b) => {
      let valA = a[currentSortCol] || '';
      let valB = b[currentSortCol] || '';
      if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = cols.length;
    td.className = 'text-muted';
    td.style.textAlign = 'center';
    td.textContent = '조회할 학생 데이터가 존재하지 않습니다.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  filtered.forEach(student => {
    const tr = document.createElement('tr');
    
    cols.forEach(col => {
      const td = document.createElement('td');
      td.style.textAlign = 'center';
      const val = student[col.key];
      
      // 특별 컬럼 가공
      if (col.key === 'recordView') {
        if (student.recordPdf) {
          td.innerHTML = `<a href="${student.recordPdf}" target="_blank" class="link-action"><i class="fa-solid fa-file-pdf"></i> 보기</a>`;
        } else {
          td.innerHTML = `<span class="text-muted">미업로드</span>`;
        }
      }
      else if (col.key === 'recordUpload') {
        if (CURRENT_ROLE === '교사' || CURRENT_ROLE === '관리자') {
          const btnText = student.recordPdf ? '재업로드' : '업로드';
          td.innerHTML = `<button class="btn-action" style="padding: 2px 6px; font-size: 14px; display: inline-flex;" onclick="triggerPdfUpload('${student.studentLink}')"><i class="fa-solid fa-upload"></i> ${btnText}</button>`;
        } else {
          td.innerHTML = `<span class="text-muted">-</span>`;
        }
      }
      else if (col.key === 'recordScoreOnly') {
        const val = student.recordScore;
        if (val) {
          td.innerHTML = `<strong>${val} 점</strong>`;
        } else {
          td.innerHTML = `<span class="text-muted">-</span>`;
        }
      }
      else if (col.key === 'recordBasis') {
        const val = student.recordScore;
        if (val && (CURRENT_ROLE === '교사' || CURRENT_ROLE === '관리자')) {
          td.innerHTML = `<button class="btn-action" style="padding: 2px 6px; font-size: 14px; background-color: var(--color-success); display: inline-flex;" onclick="openScoreDetailsModal('${student.studentLink}')"><i class="fa-solid fa-magnifying-glass"></i> 산정근거</button>`;
        } else {
          td.innerHTML = `<span class="text-muted">-</span>`;
        }
      }
      else if (col.key === 'recordEval') {
        if (CURRENT_ROLE === '관리자') {
          if (student.recordPdf) {
            const btnText = student.recordScore ? '재채점' : 'AI 채점';
            td.innerHTML = `<button class="btn-action" style="padding: 2px 6px; font-size: 14px; background-color: var(--color-primary); display: inline-flex;" onclick="runSingleAIEval('${student.studentLink}')"><i class="fa-solid fa-robot"></i> ${btnText}</button>`;
          } else {
            td.innerHTML = `<span class="text-muted">파일없음</span>`;
          }
        }
      } 
      else if (col.key === 'psStatus') {
        const isLocked = val === '최종제출';
        td.innerHTML = `<span class="badge ${isLocked ? 'success' : 'warning'}">
                          <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'}"></i> ${val}
                        </span>`;
      }
      else if (col.key === 'psFeedback') {
        let btnAiFeedback = '';
        if (CURRENT_ROLE === '관리자' && (student.psStatus === '작성중' || student.psStatus === '최종제출')) {
          btnAiFeedback = `<button class="btn-action" style="padding: 2px 6px; font-size: 14px; margin-left: 6px; background-color: var(--color-primary); display: inline-flex;" onclick="runSingleAIFeedback('${student.studentLink}')"><i class="fa-solid fa-robot"></i> 개별AI</button>`;
        }
        if (val && val !== '-' && val !== '미수행' && val !== '') {
          // '피드백완료' 또는 타임스탬프 (예: '26-07-17 07:05')
          const displayVal = val === '피드백완료' ? '완료' : formatTimestamp(val);
          td.innerHTML = `<span class="badge success" style="cursor: pointer;" onclick="openPersonalStatementModal('${student.studentLink}', 'ai')"><i class="fa-solid fa-check-double"></i> ${displayVal}</span>` + btnAiFeedback;
        } else {
          td.innerHTML = `<span class="text-muted">미수행</span>` + btnAiFeedback;
        }
      } 
      else if (col.key === 'studentAnswers' || col.key === 'questions') {
        let btnAiQuestions = '';
        if (CURRENT_ROLE === '관리자' && student.psStatus === '최종제출') {
          btnAiQuestions = `<button class="btn-action" style="padding: 2px 6px; font-size: 14px; margin-left: 6px; background-color: var(--color-primary); display: inline-flex;" onclick="runSingleAIQuestions('${student.studentLink}')"><i class="fa-solid fa-comments"></i> 개별생성</button>`;
        }
        if (student.studentAnswers || student.questions === '질문생성완료') {
          td.innerHTML = `<span class="badge success" onclick="openInterviewPractice('${student.studentLink}')" style="cursor:pointer;"><i class="fa-solid fa-comments"></i> 연습하기</span>` + btnAiQuestions;
        } else {
          td.innerHTML = `<span class="text-muted">미생성</span>` + btnAiQuestions;
        }
      } 
      else if (col.key === 'interviewRecord' || col.key === 'interviewPs') {
        const isRecord = col.key === 'interviewRecord';
        const typeStr = isRecord ? '생기부' : '자소서';
        const modeStr = isRecord ? 'record' : 'ps';
        const qStatus = String(student.questions || '');
        
        let hasQuestions = false;
        if (qStatus === '질문생성완료' || qStatus.includes(typeStr)) {
          hasQuestions = true;
        }

        let btnGen = '';
        if (CURRENT_ROLE === '관리자') {
          btnGen = `<button class="btn-action" style="padding: 2px 6px; font-size: 14px; margin-left: 6px; background-color: var(--color-primary); display: inline-flex;" onclick="runSingleAIQuestions('${student.studentLink}', '${typeStr}')"><i class="fa-solid fa-comments"></i> ${typeStr} 생성</button>`;
        }
        
        const actionBtnName = CURRENT_ROLE === '학생' ? '연습하기' : '답변 확인';
        const actionBtnIcon = CURRENT_ROLE === '학생' ? 'fa-microphone' : 'fa-eye';
        
        if (hasQuestions) {
          td.innerHTML = `<span class="badge success" onclick="openInterviewPractice('${student.studentLink}', '${modeStr}')" style="cursor:pointer;"><i class="fa-solid ${actionBtnIcon}"></i> ${actionBtnName}</span>` + btnGen;
        } else {
          td.innerHTML = `<span class="text-muted">미생성</span>` + btnGen;
        }
      }
      else if (['passRound1', 'passRound2', 'passFinal'].includes(col.key)) {
        if (CURRENT_ROLE === '학생') {
           let badgeClass = 'gray';
           if (val === '합') badgeClass = 'success';
           else if (val === '불') badgeClass = 'danger';
           td.innerHTML = `<span class="badge ${badgeClass}">${val}</span>`;
        } else {
           let isRound1Fail = (student.passRound1 === '불');
           let disabled = (isRound1Fail && col.key !== 'passRound1') ? 'disabled' : '';
           let forcedVal = (isRound1Fail && col.key !== 'passRound1') ? '불' : val;
           
           let statusColor = '#94a3b8';
           let statusIcon = 'fa-circle-dot';
           if (forcedVal === '합') { statusColor = '#10b981'; statusIcon = 'fa-circle-check'; }
           else if (forcedVal === '불') { statusColor = '#ef4444'; statusIcon = 'fa-circle-xmark'; }
           
           td.innerHTML = `
             <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
               <i class="fa-solid ${statusIcon}" id="icon-${student.studentLink}-${col.key}" style="color: ${statusColor}; font-size: 14px;"></i>
               <select class="form-control" style="width:auto; padding:2px 4px; font-size:14px; background:var(--bg-card); color:var(--text-main);" ${disabled} onchange="window.updatePassStatus('${student.studentLink}', '${col.key}', this.value); const icon = document.getElementById('icon-${student.studentLink}-${col.key}'); if (this.value === '합') { icon.className = 'fa-solid fa-circle-check'; icon.style.color = '#10b981'; } else if (this.value === '불') { icon.className = 'fa-solid fa-circle-xmark'; icon.style.color = '#ef4444'; } else { icon.className = 'fa-solid fa-circle-dot'; icon.style.color = '#94a3b8'; }">
                  <option value="대기" ${forcedVal === '대기' ? 'selected' : ''}>대기</option>
                  <option value="합" ${forcedVal === '합' ? 'selected' : ''}>합</option>
                  <option value="불" ${forcedVal === '불' ? 'selected' : ''}>불</option>
               </select>
             </div>
           `;
        }
      }
      else if (col.key === 'studentLink') {
        if (CURRENT_ROLE === '학생') {
           td.innerHTML = `<span class="text-muted">-</span>`;
        } else {
           td.innerHTML = `<button class="btn-action" style="padding: 4px 8px; background-color: var(--color-danger);" onclick="navigator.clipboard.writeText(window.location.origin + window.location.pathname + '?student=' + '${student.studentLink}'); alert('배포용 개별 링크가 복사되었습니다.')"><i class="fa-solid fa-link"></i> 링크</button>`;
        }
      }
      else if (col.key === 'studentSms') {
        if (CURRENT_ROLE === '학생') {
           td.innerHTML = `<span class="text-muted">-</span>`;
        } else {
           td.innerHTML = `<button class="btn-action" style="padding: 4px 8px; background-color: #f39c12;" onclick="copySmsTemplate('${student.center}', '${student.name}', '${student.studentLink}')"><i class="fa-solid fa-comment-sms"></i> 문자</button>`;
        }
      }
      else if (col.key === 'manage') {
        if (CURRENT_ROLE === '학생') {
          if (CURRENT_MENU === 'ps') {
             td.innerHTML = `<div style="display: flex; align-items: center; justify-content: center;"><button class="btn-action" style="padding: 4px 8px;" onclick="openPersonalStatementModal('${student.studentLink}')"><i class="fa-solid fa-pen"></i> 본인 자소서 쓰기</button></div>`;
          } else if (CURRENT_MENU === 'interview') {
             td.innerHTML = `<div style="display: flex; align-items: center; justify-content: center;"><button class="btn-action" style="padding: 4px 8px;" onclick="openInterviewPractice('${student.studentLink}')"><i class="fa-solid fa-microphone"></i> 본인 면접 답변하기</button></div>`;
          } else {
             td.innerHTML = `<div style="display: flex; align-items: center; justify-content: center;"><span class="text-muted">-</span></div>`;
          }
        } else {
          let buttons = '';
          if (CURRENT_MENU === 'dashboard') {
            buttons = `<button class="btn-action" style="padding: 4px 8px;" onclick="openEditStudent('${student.studentLink}')"><i class="fa-solid fa-gear"></i> 수정</button>`;
          } else if (CURRENT_MENU === 'ps') {
            buttons = `<button class="btn-action" style="padding: 4px 8px; background-color: var(--color-success);" onclick="openPersonalStatementModal('${student.studentLink}')"><i class="fa-solid fa-pen"></i> 자소서 첨삭</button>`;
          } else if (CURRENT_MENU === 'interview') {
            buttons = `<button class="btn-action" style="padding: 4px 8px; background-color: var(--color-secondary);" onclick="openInterviewPractice('${student.studentLink}')"><i class="fa-solid fa-eye"></i> 답변 확인</button>`;
          }
          td.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;">${buttons}</div>`;
        }
      }
      else {
        td.textContent = val || '-';
      }
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
}

/**
 * 테이블 내 행 관리 버튼 (수정 모달 강제 오픈)
 */
function openEditStudent(studentLink) {
  const student = STUDENTS_LIST.find(s => s.studentLink === studentLink);
  if (!student) return;
  
  isEditMode = true;
  ACTIVE_EDIT_STUDENT_LINK = studentLink;
  document.getElementById('register-modal-title').textContent = '학생 정보 수정';
  document.getElementById('btn-submit-register').textContent = '수정 완료';
  
  // 삭제 버튼 로직
  const deleteGroup = document.getElementById('delete-btn-group');
  const btnHardDelete = document.getElementById('btn-hard-delete-student');
  if (deleteGroup) {
    deleteGroup.style.display = 'flex';
    if (CURRENT_ROLE === '관리자') {
      btnHardDelete.style.display = 'block';
    } else {
      btnHardDelete.style.display = 'none';
    }
    
    document.getElementById('btn-archive-student').onclick = function() {
      if(confirm('이 학생을 명단에서 숨기시겠습니까? (파일과 데이터는 구글 시트에 보존됩니다.)')) {
        ApiClient.post('archiveStudent', { studentLink: student.studentLink }).then(res => {
          if(res.success) {
            alert('성공적으로 숨김 처리되었습니다.');
            document.getElementById('modal-register').style.display = 'none';
            STUDENTS_LIST = STUDENTS_LIST.filter(s => s.studentLink !== student.studentLink);
            renderMainTable();
          } else {
            alert('오류: ' + res.error);
          }
        });
      }
    };
    
    btnHardDelete.onclick = function() {
      if(confirm('정말 삭제하시겠습니까? 구글 드라이브의 자소서 파일, 생기부 PDF, 생기부 AI 산출근거, 메인 행까지 모두 완벽하게 영구 삭제됩니다.\n\n이 작업은 절대 되돌릴 수 없습니다!')) {
        ApiClient.post('hardDeleteStudent', { studentLink: student.studentLink }).then(res => {
          if(res.success) {
            alert('성공적으로 모든 DB와 파일이 영구 삭제되었습니다.');
            document.getElementById('modal-register').style.display = 'none';
            STUDENTS_LIST = STUDENTS_LIST.filter(s => s.studentLink !== student.studentLink);
            renderMainTable();
          } else {
            alert('오류: ' + res.error);
          }
        });
      }
    };
  }

  
  document.getElementById('reg-center').value = student.center || '';
  document.getElementById('reg-name').value = student.name || '';
  document.getElementById('reg-school').value = student.school || '';
  document.getElementById('reg-target-school').value = student.targetSchool || '인천';
  document.getElementById('reg-parent-phone').value = student.parentPhone || '';
  document.getElementById('reg-student-phone').value = student.studentPhone || '';
  // 수정 시 폰번호 변경 불가 (기본 키 역할을 하므로)
  document.getElementById('reg-student-phone').setAttribute('readonly', 'true');
  document.getElementById('reg-student-phone').style.backgroundColor = 'var(--bg-card)';
  
  document.getElementById('reg-math-teacher').value = student.mathTeacher || '';
  document.getElementById('reg-sci-teacher').value = student.sciTeacher || '';
  
  document.getElementById('modal-register').classList.add('open');
}

/**
 * 30가지 생기부 점수 상세 아코디언 토글 렌더러
 */
function toggleScoreAccordion(studentLink, totalScore) {
  if (CURRENT_ROLE === '학생' || CURRENT_ROLE === '게스트') {
    alert('상세 채점 내역 조회 권한이 없습니다. 교사나 관리자만 조회 가능합니다.');
    return;
  }
  openScoreDetailsModal(studentLink);
}

/**
 * 자소서 편집 모달 창 띄우기
 */
let ACTIVE_PS_STUDENT = null;
async function openPersonalStatementModal(studentLink, initialTab = 'manual') {
  ACTIVE_PS_STUDENT = studentLink;
  
  const student = STUDENTS_LIST.find(s => s.studentLink === studentLink);
  if (!student) return;
  
  document.getElementById('ps-modal-title').textContent = `${student.name} 학생의 자기소개서 편집 및 피드백`;
  
  // 락 잠금 여부에 따른 경고 및 버튼 비활성화
  const isLocked = student.psStatus === '최종제출';
  const alertBox = document.getElementById('ps-lock-warning-alert');
  const txtArea = document.getElementById('ps-content-textarea');
  const saveBtn = document.getElementById('btn-save-ps');
  const submitBtn = document.getElementById('btn-submit-ps-final');
  
  if (CURRENT_ROLE === '교사' || CURRENT_ROLE === '관리자') {
    txtArea.readOnly = true;
    saveBtn.style.display = 'inline-block'; // 피드백 일괄 저장 허용
    saveBtn.textContent = '피드백 저장';
    submitBtn.style.display = 'none';
    alertBox.style.display = 'none';
    
    // 관리자인 경우 락 해제(반려) 버튼 제공
    if (CURRENT_ROLE === '관리자' && isLocked) {
      let unlockBtn = document.getElementById('btn-unlock-ps-action');
      if (!unlockBtn) {
        unlockBtn = document.createElement('button');
        unlockBtn.className = 'btn-action';
        unlockBtn.id = 'btn-unlock-ps-action';
        unlockBtn.style.backgroundColor = 'var(--color-danger)';
        unlockBtn.textContent = '🔓 최종 제출 반려 및 락 해제';
        unlockBtn.onclick = async () => {
          if (confirm('최종 제출을 반려하고 수정을 허용하시겠습니까?')) {
            const inputPw = sessionStorage.getItem('user_pw') || '';
            try {
              const res = await ApiClient.post('unlockPersonalStatement', { studentId: studentLink, adminPassword: inputPw });
              if (res && res.success) {
                alert('락이 해제되었습니다. 모달을 다시 열어주십시오.');
                document.getElementById('modal-ps-editor').classList.remove('open');
                loadStudentsData();
              } else {
                alert('비밀번호가 일치하지 않거나 반려에 실패했습니다.');
              }
            } catch (e) {
              alert('반려 실패: ' + e.message);
            }
          }
        };
        document.getElementById('ps-modal-footer').insertBefore(unlockBtn, saveBtn);
      }
    } else {
      const unlockBtn = document.getElementById('btn-unlock-ps-action');
      if (unlockBtn) unlockBtn.remove();
    }
  } else {
    // For student
    if (isLocked) {
      alertBox.style.display = 'flex';
      txtArea.readOnly = true;
      saveBtn.style.display = 'none';
      submitBtn.style.display = 'none';
    } else {
      alertBox.style.display = 'none';
      txtArea.readOnly = false;
      saveBtn.style.display = 'block';
      submitBtn.style.display = 'block';
    }
  }
  
  // 8.1 학생 권한 진입 시 '선생님 수기 피드백 입력창' 강제 readOnly 설정
  const feedbackTextarea = document.getElementById('manual-feedback-textarea');
  if (CURRENT_ROLE === '학생') {
    feedbackTextarea.readOnly = true;
    feedbackTextarea.disabled = true;
    feedbackTextarea.placeholder = "🔒 선생님 문항별 피드백 조회 전용 영역입니다. 학생은 수정할 수 없습니다.";
    feedbackTextarea.style.background = "rgba(255, 255, 255, 0.02)";
  } else {
    feedbackTextarea.readOnly = false;
    feedbackTextarea.disabled = false;
    feedbackTextarea.placeholder = "학생을 위한 보완점 및 문항별 피드백을 기록하십시오...";
    feedbackTextarea.style.background = "rgba(0, 0, 0, 0.2)";
  }
  
  // 동적 질문 바인딩 (학교별 맞춤 문항 연동)
  const schoolMap = window.SCHOOL_QUESTIONS_MAP || [];
  const studentSchool = student.targetSchool || '';
  const matchedSchool = schoolMap.find(s => s.name === studentSchool);
  const questions = (matchedSchool && matchedSchool.questions && matchedSchool.questions.length > 0)
    ? matchedSchool.questions
    : [{ label: '문항 1', content: '자기소개서 문항이 설정되지 않았습니다.', limit: '' }];
    
  const psSelector = document.getElementById('ps-question-selector');
  if (psSelector) {
    psSelector.innerHTML = '';
    questions.forEach((q, idx) => {
      const opt = document.createElement('option');
      opt.value = idx + 1;
      
      // q.label이 "문항 1. 질문내용..." 처럼 긴 텍스트를 포함할 경우 강제 분리 처리
      let shortLabel = q.label;
      let fullQuestionText = q.label; 
      
      if (q.label.includes('.')) {
        const parts = q.label.split('.');
        shortLabel = parts[0].trim(); // "문항 1" 등 온점 앞부분만 추출
        fullQuestionText = q.label.substring(q.label.indexOf('.') + 1).trim(); // 온점 뒷부분 (실제 질문)
      } else if (q.label.length > 8) {
        // 온점이 없고 텍스트가 8자를 초과하면 임의로 라벨링 부여
        shortLabel = `문항 ${idx + 1}`;
        fullQuestionText = q.label;
      } else {
        // 일반적인 짧은 라벨
        shortLabel = q.label;
        fullQuestionText = "";
      }
      
      // 드롭다운에는 짧은 텍스트만 렌더링
      opt.textContent = shortLabel; 
      
      let textToShow = fullQuestionText;
      // 추가 content 데이터가 있다면 합치기
      if (q.content && q.content.trim() !== '') {
        textToShow = textToShow ? textToShow + " " + q.content : q.content;
      }
      if (q.limit) textToShow += ` (제한: ${q.limit}자)`;
      
      // 분리된 긴 질문 텍스트는 전용 단락용 dataset에 저장
      opt.dataset.qtext = textToShow;
      psSelector.appendChild(opt);
    });
  }
  
  try {
    const reqPw = sessionStorage.getItem('user_pw') || '';
    const historyData = await ApiClient.post('getPersonalStatementHistory', {
      studentId: studentLink,
      clientRole: CURRENT_ROLE,
      authPw: reqPw
    });
    
    // 글로벌에 데이터 홀드
    window.PS_CURRENT_HISTORY = historyData;
    window.PS_ORIGINAL_HISTORY_CURRENT = JSON.parse(JSON.stringify(historyData.current || []));
    
    // 문항 셀렉트 로드
    bindPersonalStatementToSelector(1);
    
  } catch (err) {
    console.error('이력 로드 실패:', err);
  }
  
  // 탭 강제 전환
  switchTab(initialTab);
  document.getElementById('modal-ps-editor').classList.add('open');
}

/**
 * 탭 스위칭 엔진
 */
function switchTab(tabId) {
  const manualBtn = document.getElementById('tab-btn-manual-feedback');
  const aiBtn = document.getElementById('tab-btn-ai-feedback');
  const manualContent = document.getElementById('tab-content-manual');
  const aiContent = document.getElementById('tab-content-ai');
  
  if (tabId === 'manual') {
    manualBtn.classList.add('active');
    aiBtn.classList.remove('active');
    manualContent.classList.add('active');
    aiContent.classList.remove('active');
  } else {
    // 보안 제어: 학생 권한인 경우 AI 탭 접근 불허
    if (CURRENT_ROLE === '학생') {
      alert('보안 규정 상 학생 계정은 AI 피드백 탭에 접근할 수 없습니다.');
      return;
    }
    aiBtn.classList.add('active');
    manualBtn.classList.remove('active');
    aiContent.classList.add('active');
    manualContent.classList.remove('active');
    
    // AI 피드백 바인드
    const aiContainer = document.getElementById('ai-feedback-container');
    const aiLog = window.PS_CURRENT_HISTORY.aiHistory || [];
    const genBtn = document.getElementById('btn-generate-ai-feedback');
    if (genBtn) genBtn.style.display = (CURRENT_ROLE === '관리자') ? 'inline-block' : 'none';
    if (aiLog.length > 0) {
      aiContainer.innerHTML = parseMarkdown(aiLog[aiLog.length - 1].feedback); // 최신 AI 피드백
    } else {
      aiContainer.innerHTML = `<div style="text-align:center; padding-top: 50px;">
                                 <p class="text-muted">아직 생성된 AI 피드백이 없습니다.</p>
                                 ${CURRENT_ROLE === '관리자' ? '<button class="btn-action" onclick="runAIFeedbackAction()" style="margin: 10px auto 0px auto;">🤖 AI 피드백 분석 실행</button>' : ''}
                               </div>`;
    }
  }
}

/**
 * 글자 수 계산 헬퍼 함수 (공백 포함 여부 옵션 지원)
 */
function getCharCount(text, schoolName) {
  if (!text) return 0;
  const schoolConf = window.SCHOOL_QUESTIONS_MAP && window.SCHOOL_QUESTIONS_MAP.find(s => s.name === schoolName);
  if (schoolConf && schoolConf.includeSpaces === false) {
    return text.replace(/\s+/g, '').length;
  }
  return text.length;
}

/**
 * 특정 문항을 선택했을 때 자소서 및 수기 피드백 내용을 바인드
 */
function bindPersonalStatementToSelector(qNum) {
  const hData = window.PS_CURRENT_HISTORY;
  if (!hData) return;
  
  // 최신 자소서 로드
  const curr = hData.current.find(c => c.qNum == qNum);
  const textVal = curr ? curr.text : '';
  const feedbackVal = curr ? curr.feedback : '';
  
  // 글자 수 헬퍼 함수
  const targetSchool = document.getElementById('ps-school-name').textContent.replace('지원 학교: ', '');
  
  // 질문 텍스트 표시
  const psSel = document.getElementById('ps-question-selector');
  if (psSel && psSel.options[psSel.selectedIndex]) {
    const qText = psSel.options[psSel.selectedIndex].dataset.qtext || '';
    const displayEl = document.getElementById('ps-question-display-text');
    if (displayEl) displayEl.textContent = qText;
  }
  
  document.getElementById('ps-content-textarea').value = textVal;
  document.getElementById('ps-char-count').textContent = getCharCount(textVal, targetSchool);
  document.getElementById('manual-feedback-textarea').value = feedbackVal;
  
  // 버전선택 드롭다운 초기화
  const verSelector = document.getElementById('ps-version-selector');
  verSelector.innerHTML = '<option value="current">⭐ 최신 작성 내용</option>';
  
  const fbVerSelector = document.getElementById('feedback-version-selector');
  fbVerSelector.innerHTML = '<option value="current">⭐ 최신 피드백</option>';
  
  const historyLogs = hData.history || [];
  historyLogs.forEach((log, idx) => {
    if (log.texts) {
      // 신규 포맷: 전체 문항 스냅샷
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${formatTimestamp(log.timestamp)}`;
      if (log.type === '자소서') verSelector.appendChild(opt);
      else fbVerSelector.appendChild(opt);
    } else if (log.qNum == qNum) {
      // 구 버전 호환성 (단일 문항)
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `[구버전] ${formatTimestamp(log.timestamp)}`;
      if (log.type === '자소서') verSelector.appendChild(opt);
      else fbVerSelector.appendChild(opt);
    }
  });
}

/**
 * 자소서 버전 롤백 복원
 */
function rollbackVersion(type, logIdx) {
  const hData = window.PS_CURRENT_HISTORY;
  if (!hData) return;
  
  const qNum = parseInt(document.getElementById('ps-question-selector').value);
  const targetSchool = document.getElementById('ps-school-name').textContent.replace('지원 학교: ', '');

  if (logIdx !== 'current') {
    if (!confirm('선택하신 과거 날짜의 내용으로 되돌리시겠습니까?\n\n🚨 주의: 현재 작성 중이던 내용 중 [저장하기]를 누르지 않은 내용은 유실될 수 있습니다.')) {
      if (type === '자소서') document.getElementById('ps-version-selector').value = 'current';
      else document.getElementById('feedback-version-selector').value = 'current';
      return;
    }
  }

  if (logIdx === 'current') {
    // 모든 문항을 원본(original)으로 되돌리기
    const origData = window.PS_ORIGINAL_HISTORY_CURRENT;
    if (origData) {
      const maxQNum = hData.current.length > 0 ? Math.max(...hData.current.map(x => x.qNum)) : 4;
      for (let i = 1; i <= maxQNum; i++) {
        const o = origData.find(x => x.qNum == i);
        const c = hData.current.find(x => x.qNum == i);
        if (c) {
          if (type === '자소서') c.text = (o ? o.text : '') || '';
          else c.feedback = (o ? o.feedback : '') || '';
        }
      }
    }
  } else {
    const log = hData.history[parseInt(logIdx)];
    if (!log) return;
    
    if (log.texts) {
      // 신규 포맷: 전체 문항 롤백
      for (let i = 1; i <= log.texts.length; i++) {
        const c = hData.current.find(x => x.qNum == i);
        if (c) {
          if (type === '자소서') c.text = log.texts[i - 1] || '';
          else c.feedback = log.texts[i - 1] || '';
        }
      }
      alert('선택하신 과거 이력의 상태로 전체 문항이 복원되었습니다. [저장하기]를 누르면 이 버전으로 최종 복구됩니다.');
    } else {
      // 구 버전 포맷: 단일 문항 롤백
      const c = hData.current.find(x => x.qNum == qNum);
      if (c) {
        if (type === '자소서') c.text = log.text || '';
        else c.feedback = log.text || '';
      }
      alert('선택하신 과거 이력의 ' + type + ' 내용으로 현재 문항 화면이 복원되었습니다. [저장하기]를 누르면 이 버전으로 최종 복구됩니다.');
    }
  }
  
  // 현재 보고 있는 화면(UI) 갱신
  const currActive = hData.current.find(c => c.qNum == qNum);
  if (currActive) {
    if (type === '자소서') {
      document.getElementById('ps-content-textarea').value = currActive.text;
      document.getElementById('ps-char-count').textContent = getCharCount(currActive.text, targetSchool);
    } else {
      document.getElementById('manual-feedback-textarea').value = currActive.feedback;
    }
  }
}

/**
 * 예상 질문 연습 창 모달 띄우기
 */
let ACTIVE_INTERVIEW_STUDENT = null;
let ACTIVE_INTERVIEW_MODE = "ps";
async function openInterviewPractice(studentLink, mode) {
  ACTIVE_INTERVIEW_STUDENT = studentLink;
  ACTIVE_INTERVIEW_MODE = mode || "ps";
  const student = STUDENTS_LIST.find(s => s.studentLink === studentLink);
  if (!student) return;
  
  const isPsMode = ACTIVE_INTERVIEW_MODE === "ps";
  document.getElementById('interview-modal-title').textContent = `${student.name} 학생 예상 면접 질문 연습 (${isPsMode ? '자소서' : '생기부'} 기반)`;
  
  // 권한에 따라 질문 생성 버튼 노출 및 Validation 적용
  const btnPs = document.getElementById('btn-generate-ai-questions-ps');
  const btnRecord = document.getElementById('btn-generate-ai-questions-record');
  
  btnPs.style.display = 'none';
  btnRecord.style.display = 'none';
  
  if (CURRENT_ROLE === '관리자') {
    if (isPsMode) {
      btnPs.style.display = 'inline-block';
      // Validation: 자소서 상태가 '최종제출'일 때만 버튼 활성화
      if (student.psStatus !== '최종제출') {
        btnPs.disabled = true;
        btnPs.title = "자소서가 '최종제출' 상태여야 생성할 수 있습니다.";
        btnPs.style.opacity = '0.5';
        btnPs.style.cursor = 'not-allowed';
      } else {
        btnPs.disabled = false;
        btnPs.title = "";
        btnPs.style.opacity = '1';
        btnPs.style.cursor = 'pointer';
      }
    } else {
      btnRecord.style.display = 'inline-block';
      // Validation: 생기부 파일이 있을 때만 버튼 활성화
      if (!student.recordPdf) {
        btnRecord.disabled = true;
        btnRecord.title = "생기부 파일이 업로드되어 있어야 생성할 수 있습니다.";
        btnRecord.style.opacity = '0.5';
        btnRecord.style.cursor = 'not-allowed';
      } else {
        btnRecord.disabled = false;
        btnRecord.title = "";
        btnRecord.style.opacity = '1';
        btnRecord.style.cursor = 'pointer';
      }
    }
  }
  
  const qList = document.getElementById('interview-question-list');
  qList.innerHTML = '<p class="text-muted" style="padding: 20px;">예상 질문을 서버에서 조회 중입니다...</p>';
  
  let questionsData = { psQuestions: '', recordQuestions: '' };
  try {
    questionsData = await ApiClient.post('getAIQuestions', { studentId: studentLink });
  } catch (e) {
    console.error('질문 조회 실패', e);
  }
  
  qList.innerHTML = '';
  
  // 모달 열 때 우측 질문/답변 영역 초기화 (이전 탭 잔여물 제거)
  document.getElementById('selected-question-label').textContent = '좌측에서 질문을 선택하십시오.';
  document.getElementById('modal-question-text').innerHTML = '';
  document.getElementById('interview-answer-textarea').value = '';
  document.getElementById('interview-answer-textarea').readOnly = true;
  document.getElementById('interview-answer-textarea').placeholder = '좌측 목록에서 답변할 질문을 먼저 선택해 주세요.';
  document.getElementById('btn-save-interview-answer').style.display = 'none';
  
  // 질문 텍스트를 세트 단위(### 기준)로 파싱하는 함수
  function parseQuestionSets(rawText) {
    if (!rawText) return [];
    const sets = [];
    const parts = rawText.split(/(?=^###\s)/m);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || !trimmed.startsWith('###')) continue;
      const firstNewline = trimmed.indexOf('\n');
      const title = firstNewline > 0 ? trimmed.substring(0, firstNewline).replace(/^###\s*/, '').trim() : trimmed.replace(/^###\s*/, '').trim();
      let body = firstNewline > 0 ? trimmed.substring(firstNewline + 1).trim() : '';
      // 섹션 구분선(---) 및 상위 제목(# 또는 ##)을 body에서 제거
      body = body.split('\n').filter(line => {
        const t = line.trim();
        if (t === '---' || t === '') return false;
        if (/^#{1,2}\s/.test(t)) return false;
        return true;
      }).join('\n');
      
      // AI가 생성하는 글머리기호나 이모지(ㅇ, -, *, 🎯, 🔗 등) 및 뒤에 붙는 찌꺼기(**, : 등)를 정규식으로 완벽히 캡처하여 고정 포맷으로 강제 통일
      body = body.replace(/^[^a-zA-Z0-9가-힣]*면접\s*질문[^a-zA-Z0-9가-힣]*/gmi, '🗣️ 면접 질문: ');
      body = body.replace(/^[^a-zA-Z0-9가-힣]*출제\s*의도[^a-zA-Z0-9가-힣]*/gmi, '🎯 출제 의도: ');
      body = body.replace(/^[^a-zA-Z0-9가-힣]*꼬리\s*질문[^a-zA-Z0-9가-힣]*/gmi, '🔗 꼬리 질문:\n');
      
      body = body.trim();
      
      if (!body) { sets.push({ title, body: '', raw: trimmed }); continue; }
      sets.push({ title, body, raw: trimmed });
    }
    return sets;
  }
  
  const rawText = isPsMode ? (questionsData.psQuestions || '') : (questionsData.recordQuestions || '');
  const questionSets = parseQuestionSets(rawText);
  
  if (questionSets.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-muted';
    p.style.padding = '20px';
    p.textContent = `아직 생성된 ${isPsMode ? '자소서' : '생기부'} 기반 예상 질문이 없습니다.`;
    qList.appendChild(p);
  } else {
    let answersObj = {};
    try {
      answersObj = JSON.parse(student.studentAnswers || '{}');
    } catch (e) {}
    
    let currentSelectedTitle = null;
    const textInput = document.getElementById('interview-answer-textarea');
    
    // 사용자가 입력할 때마다 메모리에 즉시 임시 저장 (탭 전환 시 날아감 방지)
    textInput.oninput = () => {
      if (currentSelectedTitle && CURRENT_ROLE === '학생') {
        answersObj[currentSelectedTitle] = textInput.value;
      }
    };

    questionSets.forEach((set, index) => {
      const btn = document.createElement('button');
      btn.className = 'btn-action btn-secondary';
      btn.style.textAlign = 'left';
      btn.style.justifyContent = 'flex-start';
      btn.style.whiteSpace = 'normal';
      btn.textContent = set.title;
      btn.onclick = () => {
        currentSelectedTitle = set.title;
        document.getElementById('selected-question-label').textContent = set.title;
        document.getElementById('modal-question-text').innerHTML = parseMarkdownToHtml(set.body);
        
        textInput.value = answersObj[set.title] || '';
        
        const saveBtn = document.getElementById('btn-save-interview-answer');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.replaceWith(newSaveBtn);
        
        if (CURRENT_ROLE !== '학생') {
          textInput.readOnly = true;
          textInput.placeholder = "학생이 작성한 답변 내용입니다.";
          newSaveBtn.style.display = 'none';
        } else {
          textInput.readOnly = false;
          textInput.placeholder = "해당 질문에 대한 면접 답변을 작성하십시오... (질문 탭을 이동해도 내용은 임시 유지되지만, 반드시 [답변 저장하기]를 눌러야 최종 서버에 저장됩니다.)";
          newSaveBtn.style.display = 'inline-block';
        }
        
        newSaveBtn.onclick = async () => {
          // 버튼 클릭 시 현재 텍스트박스 내용을 한번 더 확실히 메모리에 동기화
          answersObj[currentSelectedTitle] = textInput.value;
          
          try {
            await ApiClient.post('saveStudentAnswers', {
              studentId: studentLink,
              answersText: JSON.stringify(answersObj)
            });
            alert('작성하신 모든 답변 내용이 스프레드시트에 성공적으로 일괄 저장되었습니다.');
            student.studentAnswers = JSON.stringify(answersObj);
          } catch (e) {
            alert('답변 저장 실패: ' + e.toString());
          }
        };
      };
      qList.appendChild(btn);
    });
  }
  
  document.getElementById('modal-interview-practice').classList.add('open');
}

/**
 * AI 피드백 생성 실행 (관리자 권한 전용)
 */
async function runAIFeedbackAction() {
  if (!ACTIVE_PS_STUDENT) return;
  if (CURRENT_ROLE !== '관리자') {
    alert('AI 피드백 및 채점 분석 실행은 오직 관리자 계정만 요청할 수 있습니다.');
    return;
  }
  
  const container = document.getElementById('ai-feedback-container');
  container.textContent = '🚀 Gemini 1.5 Pro AI가 학생의 자소서 전체 초안과 성장 스토리 라인을 정밀 첨삭하는 중입니다. 대략 5~10초 정도 소요되니 잠시만 대기해 주십시오...';
  
  try {
    const res = await ApiClient.post('generateAIFeedback', { studentId: ACTIVE_PS_STUDENT });
    if (res.success) {
      container.textContent = res.feedback;
      alert('AI 피드백 생성이 성공적으로 완료되었습니다!');
      loadStudentsData();
    } else {
      throw new Error(res.error);
    }
  } catch (err) {
    container.textContent = '🚨 AI 분석 실행 에러 발생: ' + err.toString();
  }
}

/**
 * 8. 이벤트 핸들러 바인딩
 */
function bindEventHandlers() {
  // 검색 인풋 연동
  document.getElementById('search-student').addEventListener('input', renderMainTable);
  
  const filterSchool = document.getElementById('filter-target-school');
  if (filterSchool) {
    filterSchool.addEventListener('change', renderMainTable);
  }
  
  // 사이드바 메뉴 클릭 스위칭 연동
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      CURRENT_MENU = item.getAttribute('data-menu');
      
      const titleMap = {
        dashboard: '초기 화면 (대시보드)',
        info: '학생정보 관리',
        record: '생활기록부 채점 현황',
        ps: '자기소개서 첨삭 이력',
        interview: '예상 면접 질문 연습',
        guide: '입학요강',
        exam: '기출문제 (최근 3개년)',
        settings: '시스템 환경 설정',
        'user-guide': '시스템 사용 가이드'
      };
      const subMap = {
        dashboard: '2027 과학고 지원자 합격 현황 대시보드',
        info: '학원생 기본 인적사항 및 연락처 조회',
        record: '생활기록부 점수 400점 만점 대비 채점 상세',
        ps: '자기소개서 🚀최종제출 및 이력 롤백 복원 창',
        interview: 'AI 질문 생성 목록 및 학생 구술 답변 연습 관리',
        guide: '목표 과학고등학교 입학요강 열람',
        exam: '과거 과학고 기출문제 열람 (최근 3개년)',
        settings: '학교 관리, 비밀번호 변경 및 백엔드 연동 통제',
        'user-guide': '역할 및 권한별 시스템 상세 이용 매뉴얼'
      };
      
      document.getElementById('content-title').textContent = titleMap[CURRENT_MENU] || '초기 화면';
      document.getElementById('content-subtitle').textContent = subMap[CURRENT_MENU] || '';
      
      // UI 노출 통제 (설정 패널 활성화 관련)
      const tableContainer = document.querySelector('.table-container');
      const tableControls = document.querySelector('.table-controls');
      const scoreAccordion = document.getElementById('score-accordion');
      const settingsPanel = document.getElementById('settings-panel');
      const userGuidePanel = document.getElementById('user-guide-panel');
      const pdfLibraryPanel = document.getElementById('pdf-library-panel');
      
      if (CURRENT_MENU === 'settings') {
        if (tableContainer) tableContainer.style.display = 'none';
        if (tableControls) tableControls.style.display = 'none';
        if (scoreAccordion) scoreAccordion.classList.remove('open');
        if (userGuidePanel) userGuidePanel.style.display = 'none';
        if (pdfLibraryPanel) pdfLibraryPanel.style.display = 'none';
        if (settingsPanel) {
          settingsPanel.style.display = 'block';
          loadSettingsForm(); // 설정 데이터 로드하여 폼 채우기
        }
      } else if (CURRENT_MENU === 'user-guide') {
        if (tableContainer) tableContainer.style.display = 'none';
        if (tableControls) tableControls.style.display = 'none';
        if (scoreAccordion) scoreAccordion.classList.remove('open');
        if (settingsPanel) settingsPanel.style.display = 'none';
        if (pdfLibraryPanel) pdfLibraryPanel.style.display = 'none';
        if (userGuidePanel) {
          userGuidePanel.style.display = 'block';
          renderUserGuideContent(); // 사용안내 렌더링
        }
      } else if (CURRENT_MENU === 'guide' || CURRENT_MENU === 'exam') {
        if (tableContainer) tableContainer.style.display = 'none';
        if (tableControls) tableControls.style.display = 'none';
        if (scoreAccordion) scoreAccordion.classList.remove('open');
        if (settingsPanel) settingsPanel.style.display = 'none';
        if (userGuidePanel) userGuidePanel.style.display = 'none';
        if (pdfLibraryPanel) {
          pdfLibraryPanel.style.display = 'flex';
          loadPdfFiles(CURRENT_MENU); // PDF 파일 목록 불러오기
        }
      } else {
        if (tableContainer) tableContainer.style.display = 'block';
        if (tableControls) tableControls.style.display = 'flex';
        if (settingsPanel) settingsPanel.style.display = 'none';
        if (userGuidePanel) userGuidePanel.style.display = 'none';
        if (pdfLibraryPanel) pdfLibraryPanel.style.display = 'none';
        
        renderMainTable();
      }
      
      const mainHeaderActions = document.getElementById('main-header-actions');
      if (mainHeaderActions) {
        if (CURRENT_ROLE === '관리자') {
            if (CURRENT_MENU === 'ps') {
                mainHeaderActions.innerHTML = `<button class="btn-action" style="background-color: var(--color-primary);" onclick="runBulkAIFeedback()"><i class="fa-solid fa-robot"></i> 일괄 AI 피드백</button>`;
            } else if (CURRENT_MENU === 'interview') {
                mainHeaderActions.innerHTML = `<button class="btn-action" style="background-color: var(--color-primary);" onclick="runBulkAIQuestions('record')"><i class="fa-solid fa-comments"></i> 생기부 일괄 AI</button>
                                              <button class="btn-action" style="background-color: var(--color-primary); margin-left: 5px;" onclick="runBulkAIQuestions('ps')"><i class="fa-solid fa-comments"></i> 자소서 일괄 AI</button>`;
            } else if (CURRENT_MENU === 'record') {
                mainHeaderActions.innerHTML = `<button class="btn-action" style="background-color: var(--color-primary);" onclick="runBulkAIEval()"><i class="fa-solid fa-robot"></i> 생기부 점수 일괄 AI</button>`;
            } else {
                mainHeaderActions.innerHTML = '';
            }
        } else {
            mainHeaderActions.innerHTML = '';
        }
      }
    });
  });
  
  // 로그인 모달 오픈
  document.getElementById('btn-login-modal').onclick = () => {
    document.getElementById('login-error-msg').style.display = 'none';
    document.getElementById('login-password').value = '';
    document.getElementById('modal-login').classList.add('open');
  };
  // 로그인 패스워드 창 엔터키 연동
  const loginPwInput = document.getElementById('login-password');
  if (loginPwInput) {
    loginPwInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('btn-submit-login').click();
      }
    });
  }
  
  // 로그인 제출
  document.getElementById('btn-submit-login').onclick = async () => {
    const pw = document.getElementById('login-password').value;
    const errorMsgEl = document.getElementById('login-error-msg');
    errorMsgEl.style.display = 'none';

    // 🚨 시스템 부트스트랩 예외처리 (가짜 데이터 제거로 인한 데드락 방지)
    // GAS WebApp URL이 세팅되지 않은 극초기 상태에서, 관리자가 환경설정에 접근할 수 있도록 기본 비번 통과 허용
    if (!GAS_WEBAPP_URL && pw === 'w2027pass!@#') {
      CURRENT_ROLE = '관리자';
      sessionStorage.setItem('user_role', CURRENT_ROLE);
      sessionStorage.setItem('user_pw', pw);
      applyRoleUI(CURRENT_ROLE);
      ACTIVE_ADMIN_PASSWORD = pw;
      document.getElementById('modal-login').classList.remove('open');
      alert('[로컬 긴급모드] 관리자로 임시 진입했습니다.\n최우선적으로 우측 상단 [환경설정]에 들어가서 GAS WebApp URL을 등록하고 저장하세요!');
      return;
    }

    try {
      const authResult = await ApiClient.post('verifyPassword', { password: pw });
      if (authResult.success) {
        CURRENT_ROLE = authResult.role;
        sessionStorage.setItem('user_role', CURRENT_ROLE);
        sessionStorage.setItem('user_pw', pw);
        applyRoleUI(CURRENT_ROLE);
        if (CURRENT_ROLE === '관리자') {
          ACTIVE_ADMIN_PASSWORD = pw; // 관리자 잠금 해제용 패스워드 로컬 캐싱
        }
        document.getElementById('modal-login').classList.remove('open');
        alert(`${CURRENT_ROLE} 계정으로 성공적으로 인증되었습니다.`);
        loadStudentsData(); // 권한 변동에 따라 테이블 다시 렌더링
      } else {
        errorMsgEl.textContent = authResult.error || '비밀번호가 올바르지 않습니다.';
        errorMsgEl.style.display = 'block';
      }
    } catch (err) {
      // 🚨 GAS 통신 에러를 비밀번호 에러로 퉁치지 않고, 명확한 원인 표출
      errorMsgEl.innerHTML = err.message.replace(/\n/g, '<br>');
      errorMsgEl.style.display = 'block';
    }
  };
  
  // 신규 학생 등록 버튼 (사이드바) 로직
  isEditMode = false;
  document.getElementById('btn-open-register').onclick = () => {
    isEditMode = false;
    document.getElementById('register-modal-title').textContent = '신규 학생 등록';
    document.getElementById('btn-submit-register').textContent = '등록 완료';
  const deleteGroup = document.getElementById('delete-btn-group');
  if (deleteGroup) deleteGroup.style.display = 'none';

    
    // 초기화 및 readonly 해제
    ['center','name','school','target-school','parent-phone','student-phone','math-teacher','sci-teacher'].forEach(id => {
      document.getElementById('reg-' + id).value = '';
    });
    const phoneInput = document.getElementById('reg-student-phone');
    phoneInput.removeAttribute('readonly');
    phoneInput.style.backgroundColor = '';
    
    document.getElementById('modal-register').classList.add('open');
  };
  
  document.getElementById('btn-submit-register').onclick = async () => {
    const studentData = {
      center: document.getElementById('reg-center').value,
      name: document.getElementById('reg-name').value,
      school: document.getElementById('reg-school').value,
      targetSchool: document.getElementById('reg-target-school').value,
      parentPhone: document.getElementById('reg-parent-phone').value,
      studentPhone: document.getElementById('reg-student-phone').value,
      mathTeacher: document.getElementById('reg-math-teacher').value,
      sciTeacher: document.getElementById('reg-sci-teacher').value
    };
    
    if (!studentData.center || !studentData.name || !studentData.school || !studentData.targetSchool || !studentData.parentPhone) {
      alert('센터명, 학생명, 현재 학교, 지원 예정 과학고, 학부모 연락처는 필수 기재 사항입니다.');
      return;
    }
    
    try {
      if (isEditMode) {
        // 기존 학생 수정 로직 (mock/연동)
        await ApiClient.post('updateStudent', { studentData, originalLink: ACTIVE_EDIT_STUDENT_LINK });
        alert('학생 정보가 성공적으로 수정되었습니다.');
      } else {
        await ApiClient.post('registerStudent', { studentData });
        alert('신규 학생이 등록 완료되었으며 개별 자소서 구글 시트가 자동 생성되었습니다.');
      }
      document.getElementById('modal-register').classList.remove('open');
      loadStudentsData();
    } catch (err) {
      alert('저장 에러: ' + err.toString());
    }
  };
  
  // 모달 닫기 공통
  const overlays = document.querySelectorAll('.modal-overlay');
  overlays.forEach(overlay => {
    const container = overlay.querySelector('.modal-container');
    overlay.addEventListener('click', (e) => {
      // 미인증 상태(로그인 전)일 때는 로그인 모달 오버레이 클릭 시 닫힘 무시
      if (!CURRENT_ROLE && overlay.id === 'modal-login') return;
      
      // 바깥 클릭 시 닫히지 않도록 방지 (원장님 요청)
    });
  });
  
  
  document.getElementById('btn-close-register-modal').onclick = () => { if(confirm('저장하지 않은 내용은 모두 사라집니다. 정말 창을 닫으시겠습니까?')) { document.getElementById('modal-register').classList.remove('open'); } }
  document.getElementById('btn-cancel-register').onclick = () => { if(confirm('저장하지 않은 내용은 모두 사라집니다. 정말 창을 닫으시겠습니까?')) { document.getElementById('modal-register').classList.remove('open'); } }
  document.getElementById('btn-close-ps-modal').onclick = () => { if(confirm('저장하지 않은 내용은 모두 사라집니다. 정말 창을 닫으시겠습니까?')) { document.getElementById('modal-ps-editor').classList.remove('open'); } }
  document.getElementById('btn-close-ps-editor-modal').onclick = () => { if(confirm('저장하지 않은 내용은 모두 사라집니다. 정말 창을 닫으시겠습니까?')) { document.getElementById('modal-ps-editor').classList.remove('open'); } }
  document.getElementById('btn-close-interview-modal').onclick = () => { if(confirm('저장하지 않은 내용은 모두 사라집니다. 정말 창을 닫으시겠습니까?')) { document.getElementById('modal-interview-practice').classList.remove('open'); } }
  document.getElementById('btn-close-interview-practice-modal').onclick = () => { if(confirm('저장하지 않은 내용은 모두 사라집니다. 정말 창을 닫으시겠습니까?')) { document.getElementById('modal-interview-practice').classList.remove('open'); } }
  document.getElementById('btn-close-score-details-modal').onclick = () => { document.getElementById('modal-score-details').classList.remove('open'); }
  document.getElementById('btn-close-score-details-bottom').onclick = () => { document.getElementById('modal-score-details').classList.remove('open'); }
  
  // 자소서 문항 및 버전 드롭다운 연동
  document.getElementById('ps-question-selector').onchange = (e) => {
    bindPersonalStatementToSelector(e.target.value);
  };
  document.getElementById('ps-version-selector').onchange = (e) => {
    rollbackVersion('자소서', e.target.value);
  };
  document.getElementById('feedback-version-selector').onchange = (e) => {
    rollbackVersion('피드백', e.target.value);
  };
  
  // 자소서 모달 내 수기/AI 탭 전환
  document.getElementById('tab-btn-manual-feedback').onclick = () => switchTab('manual');
  document.getElementById('tab-btn-ai-feedback').onclick = () => switchTab('ai');
  
    // 글자 수 실시간 카운팅 및 로컬 자동 기억(백업)
  document.getElementById('ps-content-textarea').oninput = (e) => {
    const targetSchool = document.getElementById('ps-school-name').textContent.replace('지원 학교: ', '');
    document.getElementById('ps-char-count').textContent = getCharCount(e.target.value, targetSchool);
    
    // 로컬 자동 기억 (자소서)
    const qNum = parseInt(document.getElementById('ps-question-selector').value);
    const hData = window.PS_CURRENT_HISTORY;
    if (hData && hData.current) {
      const curr = hData.current.find(c => c.qNum == qNum);
      if (curr) curr.text = e.target.value;
    }
  };

  document.getElementById('manual-feedback-textarea').oninput = (e) => {
    // 로컬 자동 기억 (피드백)
    const qNum = parseInt(document.getElementById('ps-question-selector').value);
    const hData = window.PS_CURRENT_HISTORY;
    if (hData && hData.current) {
      const curr = hData.current.find(c => c.qNum == qNum);
      if (curr) curr.feedback = e.target.value;
    }
  };
  
    // 자소서 및 피드백 실시간 저장 버튼 연동 (Dirty Check 보완 및 일괄 저장)
  document.getElementById('btn-save-ps').onclick = async () => {
    if (!ACTIVE_PS_STUDENT) return;
    
    const hData = window.PS_CURRENT_HISTORY;
    const origData = window.PS_ORIGINAL_HISTORY_CURRENT;
    if (!hData || !hData.current || !origData) return;

    // 현재 포커스된 창의 최신 내용도 확실하게 한 번 더 hData에 동기화
    const qNum = parseInt(document.getElementById('ps-question-selector').value);
    const currActive = hData.current.find(c => c.qNum == qNum);
    if (currActive) {
      currActive.text = document.getElementById('ps-content-textarea').value;
      currActive.feedback = document.getElementById('manual-feedback-textarea').value;
    }
    
    const contents = [];
    
    // 모든 문항을 순회하며 원본과 달라진 부분만 추출 (일괄 저장)
    hData.current.forEach(curr => {
      const orig = origData.find(o => o.qNum === curr.qNum);
      const oldPs = orig ? orig.text : '';
      const oldFb = orig ? orig.feedback : '';
      
      if (curr.text !== oldPs && CURRENT_ROLE === '학생') {
        contents.push({ qNum: curr.qNum, text: curr.text, type: '자소서' });
      }
      if (curr.feedback !== oldFb && CURRENT_ROLE === '관리자') {
        contents.push({ qNum: curr.qNum, text: curr.feedback, type: '피드백' });
      }
    });
    
    if (contents.length === 0) {
      alert('변경된 내용이 없습니다. 저장할 필요가 없습니다. (Dirty Check 통과)');
      return;
    }
    
    const writerName = CURRENT_ROLE === '학생' ? '학생' : '선생님';
    
    try {
      await ApiClient.post('savePersonalStatement', {
        studentId: ACTIVE_PS_STUDENT,
        contents: contents,
        writer: writerName
      });
      alert('전체 문항의 저장이 성공적으로 완료되었습니다.');
      
      // 저장 성공 시, 현재 상태를 다시 원본으로 갱신
      window.PS_ORIGINAL_HISTORY_CURRENT = JSON.parse(JSON.stringify(hData.current));
      
      // 이력 갱신
      const reqPw = sessionStorage.getItem('user_pw') || '';
      const historyData = await ApiClient.post('getPersonalStatementHistory', {
        studentId: ACTIVE_PS_STUDENT,
        clientRole: CURRENT_ROLE,
        authPw: reqPw
      });
      window.PS_CURRENT_HISTORY = historyData;
      bindPersonalStatementToSelector(qNum);
      
    } catch (err) {
      alert('저장 실패: ' + err.toString());
    }
  };
  
  // PDF 업로드 파일 인풋 체인지 리스너 바인딩
  const pdfInput = document.getElementById('student-record-pdf-input');
  if (pdfInput) {
    pdfInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !PDF_TARGET_STUDENT) return;
      
      if (!validatePdfFile(file)) {
        e.target.value = ''; // 초기화
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        try {
          alert('생기부 PDF 업로드를 시작합니다. 잠시만 기다려주십시오...');
          const res = await ApiClient.post('uploadStudentRecordPdf', {
            studentId: PDF_TARGET_STUDENT,
            base64Data: base64Data,
            fileName: file.name
          });
          if (res.success) {
            alert('생기부 PDF가 성공적으로 구글 드라이브에 업로드 되었습니다. (수동으로 [AI 채점] 또는 [재채점] 버튼을 눌러야 분석이 시작됩니다)');
            loadStudentsData();
          } else {
            throw new Error(res.error);
          }
        } catch (err) {
          alert('PDF 업로드 실패: ' + err.toString());
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // AI 피드백 생성 버튼 연동
  const genAIFeedbackBtn = document.getElementById('btn-generate-ai-feedback');
  if (genAIFeedbackBtn) {
    genAIFeedbackBtn.onclick = async () => {
      await runAIFeedbackAction();
    };
  }

  // 자소서 기반 AI 예상 질문 생성 버튼 연동
  const genAIQuestionsPsBtn = document.getElementById('btn-generate-ai-questions-ps');
  if (genAIQuestionsPsBtn) {
    genAIQuestionsPsBtn.onclick = async () => {
      if (!ACTIVE_INTERVIEW_STUDENT) return;
      
      const student = STUDENTS_LIST.find(s => String(s.studentLink) === String(ACTIVE_INTERVIEW_STUDENT));
      if (student && student.studentAnswers) {
        try {
          const ans = JSON.parse(student.studentAnswers);
          if (Object.keys(ans).length > 0) {
            alert('학생 답변이 이미 작성되어 있어 새로운 예상 질문 생성이 불가합니다.');
            return;
          }
        } catch (e) {}
      }
      
      try {
        alert('자소서 기반 AI 예상 질문 생성을 시작합니다. (시간이 다소 소요됩니다)');
        const res = await ApiClient.post('generateAIQuestions', { studentId: ACTIVE_INTERVIEW_STUDENT, type: '자소서' });
        if (res.success) {
          alert('자소서 기반 예상 질문 생성이 완료되었습니다.');
          loadStudentsData();
          openInterviewPractice(ACTIVE_INTERVIEW_STUDENT);
        } else {
          throw new Error(res.error);
        }
      } catch (e) {
        alert('질문 생성 실패: ' + e.toString());
      }
    };
  }

  // 생기부 기반 AI 예상 질문 생성 버튼 연동
  const genAIQuestionsRecordBtn = document.getElementById('btn-generate-ai-questions-record');
  if (genAIQuestionsRecordBtn) {
    genAIQuestionsRecordBtn.onclick = async () => {
      if (!ACTIVE_INTERVIEW_STUDENT) return;
      
      const student = STUDENTS_LIST.find(s => String(s.studentLink) === String(ACTIVE_INTERVIEW_STUDENT));
      if (student && student.studentAnswers) {
        try {
          const ans = JSON.parse(student.studentAnswers);
          if (Object.keys(ans).length > 0) {
            alert('학생 답변이 이미 작성되어 있어 새로운 예상 질문 생성이 불가합니다.');
            return;
          }
        } catch (e) {}
      }
      
      try {
        alert('생기부 기반 AI 예상 질문 생성을 시작합니다. (시간이 다소 소요됩니다)');
        const res = await ApiClient.post('generateAIQuestions', { studentId: ACTIVE_INTERVIEW_STUDENT, type: '생기부' });
        if (res.success) {
          alert('생기부 기반 예상 질문 생성이 완료되었습니다.');
          loadStudentsData();
          openInterviewPractice(ACTIVE_INTERVIEW_STUDENT);
        } else {
          throw new Error(res.error);
        }
      } catch (e) {
        alert('질문 생성 실패: ' + e.toString());
      }
    };
  }

  // 설정 개별 저장 버튼 연동 (4개 구역 모두 동일하게 전체 DOM 상태를 저장)
  const executeSaveSettings = async () => {
    if (CURRENT_ROLE !== '관리자') {
      alert('설정 수정 권한은 오직 관리자에게만 있습니다.');
      return;
    }
      
      const basic = {
        '교사': document.getElementById('settings-pw-teacher').value,
        '관리자': document.getElementById('settings-pw-admin').value,
        'GeminiKey': document.getElementById('settings-gemini-key').value,
        'drivePersonal': document.getElementById('settings-drive-personal').value,
        'driveRecord': document.getElementById('settings-drive-record').value,
        'driveFeedback': document.getElementById('settings-drive-feedback').value,
        'driveGuide': document.getElementById('settings-drive-guide').value,
        'driveExam': document.getElementById('settings-drive-exam').value,
        'driveDb': document.getElementById('settings-drive-db').value,
        'driveBasis': document.getElementById('settings-drive-basis').value,
        'driveParsing': document.getElementById('settings-drive-parsing').value,
        'centers': document.getElementById('settings-centers-list').value
      };
      
      
      
      const schools = [];
      const schoolBlocks = document.querySelectorAll('.school-setting-block');
      schoolBlocks.forEach(block => {
        const sName = block.querySelector('.school-name-input').value.trim();
        const includeSpaces = block.querySelector('.school-include-spaces').checked;
        if (sName) {
          const qItems = block.querySelectorAll('.q-item');
          const questions = [];
          qItems.forEach(qItem => {
             const label = qItem.querySelector('.q-label').value.trim();
             const content = qItem.querySelector('.q-content').value.trim();
             const limit = qItem.querySelector('.q-limit').value.trim();
             if (label && content) {
               questions.push({ label, content, limit });
             }
          });
          schools.push({ name: sName, includeSpaces, questions });
        }
      });
      
      const settingsData = { basic, schools };
      
      try {
        const res = await ApiClient.post('saveSettings', { settingsData });
        if (res.success) {
          alert('시스템 설정이 스프레드시트에 성공적으로 저장되었습니다.');
          ACTIVE_ADMIN_PASSWORD = basic['관리자'];
          sessionStorage.setItem('user_pw', ACTIVE_ADMIN_PASSWORD);
          
          window.SCHOOL_QUESTIONS_MAP = schools;
          window.targetSchoolsList = schools.map(s => s.name);
          updateTargetSchoolDropdowns(window.targetSchoolsList);
          renderSettingsSchools();
        } else {
          alert('저장 실패: ' + res.error);
        }
      } catch (e) {
        alert('통신 오류: ' + e.toString());
      }
  };

  const btnPw = document.getElementById('btn-save-settings-pw');
  const btnApi = document.getElementById('btn-save-settings-api');
  const btnSchool = document.getElementById('btn-save-settings-school');
  const btnDrive = document.getElementById('btn-save-settings-drive');
  const btnCenters = document.getElementById('btn-save-settings-centers');
  if (btnPw) btnPw.onclick = executeSaveSettings;
  if (btnApi) btnApi.onclick = executeSaveSettings;
  if (btnSchool) btnSchool.onclick = executeSaveSettings;
  if (btnDrive) btnDrive.onclick = executeSaveSettings;
  if (btnCenters) btnCenters.onclick = executeSaveSettings;
  
  // 최종 제출하기 (Lock) 버튼 연동
  document.getElementById('btn-submit-ps-final').onclick = async () => {
    if (!ACTIVE_PS_STUDENT) return;
    
    // 💡 작성 안 된 문항 검증 로직 시작
    const student = STUDENTS_LIST.find(s => s.studentLink === ACTIVE_PS_STUDENT);
    const schoolMap = window.SCHOOL_QUESTIONS_MAP || [];
    const matchedSchool = schoolMap.find(s => s.name === (student.targetSchool || ''));
    const totalQuestionsCount = (matchedSchool && matchedSchool.questions) ? matchedSchool.questions.length : 1;
    
    const currentQNum = parseInt(document.getElementById('ps-question-selector').value || '1');
    const currentTextAreaVal = document.getElementById('ps-content-textarea').value.trim();
    
    const hData = window.PS_CURRENT_HISTORY || { current: [] };
    
    let unwrittenQuestionNum = -1;
    for (let i = 1; i <= totalQuestionsCount; i++) {
      let qText = '';
      if (i === currentQNum) {
        qText = currentTextAreaVal; // 현재 편집 중인 내용은 텍스트에리어 우선 참조
      } else {
        const savedData = hData.current.find(c => c.qNum == i);
        qText = savedData ? (savedData.text || '').trim() : '';
      }
      
      if (qText === '') {
        unwrittenQuestionNum = i;
        break;
      }
    }
    
    if (unwrittenQuestionNum !== -1) {
      alert(`🚨 제출 거부: 문항 ${unwrittenQuestionNum} 내용이 작성되지 않았습니다. 모든 문항을 작성해야 최종 제출이 가능합니다.`);
      return;
    }
    // 💡 작성 안 된 문항 검증 로직 끝

    const msg1 = "🚨 [1차 경고] 자소서의 '모든 문항'이 한 번에 최종본으로 제출됩니다. 제출 완료 후에는 어떤 항목도 더 이상 수정할 수 없으며, 영구적으로 잠깁니다. 진행하시겠습니까?";
    if (!confirm(msg1)) return;
    
    const msg2 = "🚨 [최종 경고] 정말로 자소서의 '모든 항목'을 작성 및 수정이 불가능한 '최종본'으로 일괄 제출하는 것이 확실합니까?";
    if (!confirm(msg2)) return;
    
    try {
      await ApiClient.post('submitPersonalStatement', { studentId: ACTIVE_PS_STUDENT });
      alert('성공적으로 최종 제출 처리되어 자기소개서 편집창이 잠겼습니다.');
      document.getElementById('modal-ps-editor').classList.remove('open');
      loadStudentsData();
    } catch (err) {
      alert('최종 제출 실패: ' + err.toString());
    }
  };

  // AI 챗봇 토글 이벤트
  const chatbotToggle = document.getElementById('btn-ai-chatbot-toggle');
  const chatbotDrawer = document.getElementById('ai-chatbot-drawer');
  const closeChatbot = document.getElementById('btn-close-chatbot');
  const sendChatbotBtn = document.getElementById('btn-send-chatbot-msg');
  const inputChatbot = document.getElementById('input-chatbot-msg');
  
  if (chatbotToggle && chatbotDrawer) {
    chatbotToggle.onclick = () => {
      chatbotDrawer.classList.toggle('open');
    };
  }
  if (closeChatbot && chatbotDrawer) {
    closeChatbot.onclick = () => {
      chatbotDrawer.classList.remove('open');
    };
  }
  if (sendChatbotBtn) {
    sendChatbotBtn.onclick = () => {
      sendChatbotMessage();
    };
  }
  if (inputChatbot) {
    inputChatbot.onkeydown = (e) => {
      if (e.key === 'Enter') {
        sendChatbotMessage();
      }
    };
  }
}

/**
 * 설정 화면 데이터 불러오기 및 바인딩
 */
async function loadSettingsForm() {
  try {
    const res = await ApiClient.post('getSettings');
    // ApiClient가 resJson.data를 자동으로 벗겨서 반환하므로, res는 { basic, schools } 객체임
    const basic = res.basic || {};
    const schools = res.schools || [];
    
    document.getElementById('settings-pw-teacher').value = basic['교사'] || '';
    document.getElementById('settings-pw-admin').value = basic['관리자'] || '';
    document.getElementById('settings-gemini-key').value = basic['GeminiKey'] || '';
    if(document.getElementById('settings-gas-url')) document.getElementById('settings-gas-url').value = GAS_WEBAPP_URL;
    
    document.getElementById('settings-centers-list').value = basic.centers || '';
    let centersArray = (basic.centers || '').split(',').map(s => s.trim()).filter(s => s);
    if (centersArray.length === 0) centersArray = ['대치본원', '서초본원'];
    SETTINGS_CENTERS = centersArray;
    updateCenterDropdowns();
    
    window.SCHOOL_QUESTIONS_MAP = schools;
    if (schools.length === 0) {
      window.SCHOOL_QUESTIONS_MAP = [
        { name: '경기북과학고', includeSpaces: true, questions: [{label:'문항 1', content:'수학/과학 탐구 활동을 기술하시오.', limit:'1500'}] },
        { name: '인천과학고', includeSpaces: true, questions: [{label:'문항 1', content:'자기주도학습 경험을 기술하시오.', limit:'1000'}] }
      ];
    }
    window.targetSchoolsList = window.SCHOOL_QUESTIONS_MAP.map(s => s.name);
    
    renderSettingsSchools();
    
    // 드라이브 폴더 ID 바인딩
    document.getElementById('settings-drive-personal').value = basic['drivePersonal'] || '';
    document.getElementById('settings-drive-record').value = basic['driveRecord'] || '';
    document.getElementById('settings-drive-feedback').value = basic['driveFeedback'] || '';
    document.getElementById('settings-drive-guide').value = basic['driveGuide'] || '';
    document.getElementById('settings-drive-exam').value = basic['driveExam'] || '';
    document.getElementById('settings-drive-db').value = basic['driveDb'] || '';
    document.getElementById('settings-drive-basis').value = basic['driveBasis'] || '';
    document.getElementById('settings-drive-parsing').value = basic['driveParsing'] || '';
    
    // 드롭다운 업데이트
    updateTargetSchoolDropdowns(window.targetSchoolsList);
  } catch (e) {
    console.error('설정 로드 실패', e);
    // 통신 실패 시 화면 렌더링 붕괴를 막기 위한 기본값 할당
    window.SCHOOL_QUESTIONS_MAP = [
      { name: '경기북과학고', questions: [{label:'문항 1', content:'수학/과학 탐구 활동을 기술하시오.', limit:'1500'}] },
      { name: '인천과학고', questions: [{label:'문항 1', content:'자기주도학습 경험을 기술하시오.', limit:'1000'}] }
    ];
    window.targetSchoolsList = window.SCHOOL_QUESTIONS_MAP.map(s => s.name);
    renderSettingsSchools();
    updateTargetSchoolDropdowns(window.targetSchoolsList);
  }
}

// 현재 화면의 폼 값을 메모리로 동기화 (텍스트 증발 차단용)
function syncSchoolInputs() {
  if (!window.SCHOOL_QUESTIONS_MAP) return;
  const blocks = document.querySelectorAll('.school-setting-block');
  if (blocks.length !== window.SCHOOL_QUESTIONS_MAP.length) return;
  
  blocks.forEach((block, sIndex) => {
    const nameInput = block.querySelector('.school-name-input');
    const includeSpacesCheck = block.querySelector('.school-include-spaces');
    if (nameInput) window.SCHOOL_QUESTIONS_MAP[sIndex].name = nameInput.value;
    if (includeSpacesCheck) window.SCHOOL_QUESTIONS_MAP[sIndex].includeSpaces = includeSpacesCheck.checked;
    
    const qItems = block.querySelectorAll('.q-item');
    qItems.forEach((qItem, qIndex) => {
      const labelIn = qItem.querySelector('.q-label');
      const contentIn = qItem.querySelector('.q-content');
      const limitIn = qItem.querySelector('.q-limit');
      if (labelIn) window.SCHOOL_QUESTIONS_MAP[sIndex].questions[qIndex].label = labelIn.value;
      if (contentIn) window.SCHOOL_QUESTIONS_MAP[sIndex].questions[qIndex].content = contentIn.value;
      if (limitIn) window.SCHOOL_QUESTIONS_MAP[sIndex].questions[qIndex].limit = limitIn.value;
    });
  });
}

// ⚙️ 동적 대상 과학고 렌더링 함수
function renderSettingsSchools() {
  const listEl = document.getElementById('settings-school-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  listEl.style.display = 'block'; // grid 대신 block
  
  window.SCHOOL_QUESTIONS_MAP.forEach((school, sIndex) => {
    const sBlock = document.createElement('div');
    sBlock.className = 'school-setting-block';
    sBlock.style.cssText = "border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 12px; background: rgba(0,0,0,0.1);";
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = "display: flex; gap: 10px; align-items: flex-end; margin-bottom: 10px;";
    header.innerHTML = `
      <div style="flex:1;">
        <label style="font-size: 14px; color:var(--text-muted);">과학고명</label>
        <input type="text" class="form-control school-name-input" value="${school.name}">
      </div>
      
      <div style="display:flex; align-items:center; margin-right: 15px;">
        <label style="font-size: 14px; color:#fff; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          <input type="checkbox" class="school-include-spaces" ${school.includeSpaces !== false ? 'checked' : ''}> 공백 포함 계산
        </label>
      </div>
      <button class="btn-action" style="padding: 6px 10px;" onclick="addSchoolQuestion(${sIndex})"><i class="fa-solid fa-plus"></i> 문항 추가</button>
      <button class="btn-action" style="background-color: var(--color-danger); padding: 6px 10px;" onclick="deleteSchool(${sIndex})"><i class="fa-solid fa-trash"></i> 삭제</button>
    `;
    sBlock.appendChild(header);
    
    // Questions
    school.questions.forEach((q, qIndex) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'q-item';
      qDiv.style.cssText = "display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; padding-left: 15px; border-left: 2px solid var(--color-primary);";
      
      qDiv.innerHTML = `
        <div style="width: 150px;">
          <input type="text" class="form-control q-label" value="${q.label}" placeholder="항목명">
        </div>
        <div style="flex: 1;">
          <input type="text" class="form-control q-content" value="${q.content}" placeholder="문항 내용">
        </div>
        <div style="width: 120px;">
          <input type="number" class="form-control q-limit" value="${q.limit}" placeholder="글자수">
        </div>
        <button class="btn-action" style="background-color: var(--color-danger); padding: 8px 12px;" onclick="deleteSchoolQuestion(${sIndex}, ${qIndex})"><i class="fa-solid fa-xmark"></i></button>
      `;
      sBlock.appendChild(qDiv);
    });
    
    listEl.appendChild(sBlock);
  });
}

window.addSchoolQuestion = function(sIndex) {
  syncSchoolInputs();
  window.SCHOOL_QUESTIONS_MAP[sIndex].questions.push({ label: '', content: '', limit: '' });
  renderSettingsSchools();
};
window.deleteSchoolQuestion = function(sIndex, qIndex) {
  syncSchoolInputs();
  window.SCHOOL_QUESTIONS_MAP[sIndex].questions.splice(qIndex, 1);
  renderSettingsSchools();
};
window.deleteSchool = function(sIndex) {
  syncSchoolInputs();
  window.SCHOOL_QUESTIONS_MAP.splice(sIndex, 1);
  renderSettingsSchools();
};

// ⚙️ 학교 추가 버튼 이벤트
const btnAddSchool = document.getElementById('btn-add-school');
if (btnAddSchool) {
  btnAddSchool.onclick = () => {
    syncSchoolInputs();
    if (!window.SCHOOL_QUESTIONS_MAP) window.SCHOOL_QUESTIONS_MAP = [];
    window.SCHOOL_QUESTIONS_MAP.push({ name: '', questions: [] });
    renderSettingsSchools();
  };
}

/**
 * 30가지 평가 항목 점수 산정근거 모달 열기
 */
async function openScoreDetailsModal(studentLink) {
  if (CURRENT_ROLE === '학생' || CURRENT_ROLE === '게스트') {
    alert('상세 채점 내역 조회 권한이 없습니다. 교사나 관리자만 조회 가능합니다.');
    return;
  }

  const modal = document.getElementById('modal-score-details');
  const summaryCard = document.getElementById('score-details-summary-card');
  const grid = document.getElementById('score-details-grid');
  
  const student = STUDENTS_LIST.find(s => String(s.studentLink) === String(studentLink));
  if (!student) return;
  
  summaryCard.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h4 style="margin: 0 0 5px 0; color: #fff;">${student.name} 학생 (${student.school} / 지원: ${student.targetSchool})</h4>
        <span style="font-size: 14px; color: var(--text-muted);">연락처: ${student.studentPhone}</span>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 20px; font-weight: bold; color: var(--color-primary);">${student.recordScore || 0}점</span>
        <span style="font-size: 14px; color: var(--text-muted); display: block;" id="score-basis-time">조회 중...</span>
      </div>
    </div>
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 14px; line-height: 1.6;" id="score-details-report-text">
      AI 리포트 데이터를 불러오는 중입니다...
    </div>
  `;
  grid.innerHTML = '<p class="text-muted" style="grid-column: span 2; padding: 20px 0; text-align: center;">데이터를 불러오는 중입니다...</p>';
  
  modal.classList.add('open');
  
  try {
    const reqPw = sessionStorage.getItem('user_pw') || '';
    const res = await ApiClient.post('getScoreDetailsBasis', { studentId: studentLink, clientRole: CURRENT_ROLE, authPw: reqPw });
    if (res.success) {
      document.getElementById('score-basis-time').textContent = `평가일시: ${formatTimestamp(res.timestamp) || '-'}`;
      let cleanReport = res.analysisReport || '분석 리포트가 존재하지 않습니다.';
      cleanReport = cleanReport.replace(/##.*SYSTEM_DATA[\s\S]*/, '').trim();

      const cardsForMath = res.scoreCards || [];
      let area1Math = 0; for(let i=0; i<12; i++) { if(cardsForMath[i]) area1Math += cardsForMath[i].score; }
      let area2Math = 0; for(let i=12; i<18; i++) { if(cardsForMath[i]) area2Math += cardsForMath[i].score; }
      let area3Math = 0; for(let i=18; i<30; i++) { if(cardsForMath[i]) area3Math += cardsForMath[i].score; }
      const finalScoreMath = res.totalScore || 0;

      // AI의 수학 연산 오류 강제 치환
      cleanReport = cleanReport.replace(/\*\*학업역량.*\*\*.*점/g, '**학업역량 (210점 만점)**: ' + area1Math + ' 점');
      cleanReport = cleanReport.replace(/\*\*진로적합성.*\*\*.*점/g, '**진로적합성 (75점 만점)**: ' + area2Math + ' 점');
      cleanReport = cleanReport.replace(/\*\*인성.*\*\*.*점/g, '**인성 (115점 만점)**: ' + area3Math + ' 점');
            cleanReport = cleanReport.replace(/\*\*🔥 종합 생기부 평가 점수\*\*:.*만점/g, '**🔥 종합 생기부 평가 점수**: ' + finalScoreMath + ' 점 / 400점 만점');

      // 교사용/관리자용 마크다운 가위질 처리 (ADMIN_ONLY 블록)
      if (CURRENT_ROLE === '교사') {
        cleanReport = cleanReport.replace(/<!-- ADMIN_ONLY_START -->[\s\S]*?<!-- ADMIN_ONLY_END -->/g, '');
      } else {
        cleanReport = cleanReport.replace(/<!-- ADMIN_ONLY_START -->/g, '').replace(/<!-- ADMIN_ONLY_END -->/g, '');
      }

      document.getElementById('score-details-report-text').innerHTML = `
        <strong style="display: block; margin-bottom: 8px; color: var(--color-primary);"><i class="fa-solid fa-robot"></i> AI 종합 평가 리포트</strong>
        <div style="background: rgba(0,0,0,0.2); padding: 16px; border-radius: 6px; line-height: 1.6;">${parseMarkdownToHtml(cleanReport)}</div>
      `;
      
      const details = res.scoreDetails || {};
      
      if (CURRENT_ROLE === '교사') {
        grid.innerHTML = '';
      } else {
        renderScoreBasisCards(res.scoreCards || []);
      }
    } else {
      throw new Error(res.error || '조회 실패');
    }
  } catch (err) {
    grid.innerHTML = `<p class="text-muted" style="grid-column: span 2; padding: 20px 0; text-align: center; color: var(--color-danger);">데이터 조회 실패: ${err.message}</p>`;
  }
}

/**
 * 30가지 평가 항목 산정근거 그리드 렌더러
 */
function renderScoreBasisCards(cards) {
  const grid = document.getElementById('score-details-grid');
  grid.innerHTML = '';
  
  cards.forEach(spec => {
    const card = document.createElement('div');
    card.className = 'score-details-card';
    card.innerHTML = `
      <div>
        <span class="score-badge">${spec.score} / ${spec.max} 점</span>
        <h4>${spec.title}</h4>
      </div>
      <p style="font-size: 14px; color: var(--text-muted); margin: 6px 0;">${spec.desc}</p>
      <div class="quote-box" style="margin-top: 8px; background: rgba(0,0,0,0.3); border-left: 3px solid var(--color-primary); padding: 8px; font-size: 14px; border-radius: 0 4px 4px 0;">
        <i class="fa-solid fa-quote-left" style="font-size: 14px; opacity: 0.5; margin-right: 4px;"></i>
        <span>${spec.quote}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * 대상 과학고 드롭다운 목록 동적 업데이트
 */
let SETTINGS_SCHOOLS = ['경기북과학고', '인천과학고', '인천진산과학고', '한성과학고', '세종과학고'];

function updateTargetSchoolDropdowns(schoolsList) {
  SETTINGS_SCHOOLS = schoolsList.filter(s => s.trim() !== '');
  
  const filterSelect = document.getElementById('filter-target-school');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="전체">모든 지원학교</option>';
    SETTINGS_SCHOOLS.forEach(school => {
      const opt = document.createElement('option');
      opt.value = school;
      opt.textContent = school;
      filterSelect.appendChild(opt);
    });
  }
  
  const regSelect = document.getElementById('reg-target-school');
  if (regSelect) {
    regSelect.innerHTML = '<option value="">과학고 선택</option>';
    SETTINGS_SCHOOLS.forEach(school => {
      const opt = document.createElement('option');
      opt.value = school;
      opt.textContent = school;
      regSelect.appendChild(opt);
    });
  }
}

/**
 * 일괄 처리 프로그레스바 생성 및 업데이트 유틸리티
 */
function showProgressBar(title, total) {
  let progressContainer = document.getElementById('bulk-progress-panel');
  if (!progressContainer) {
    progressContainer = document.createElement('div');
    progressContainer.id = 'bulk-progress-panel';
    progressContainer.style.cssText = `
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 16px;
    `;
    const tableControls = document.querySelector('.table-controls');
    tableControls.parentNode.insertBefore(progressContainer, tableControls);
  }
  
  progressContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
      <span style="font-size: 14px; font-weight: bold; color: var(--color-primary);">${title}</span>
      <span style="font-size: 14px; color: var(--text-muted);" id="bulk-progress-text">준비 중... (0/${total}명)</span>
    </div>
    <div style="background: rgba(255,255,255,0.05); border-radius: 5px; height: 10px; overflow: hidden; width: 100%;">
      <div id="bulk-progress-bar" style="background: linear-gradient(90deg, var(--color-primary), var(--color-success)); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
    </div>
  `;
}

function updateProgressBar(current, total, statusText) {
  const bar = document.getElementById('bulk-progress-bar');
  const text = document.getElementById('bulk-progress-text');
  if (bar && text) {
    const percent = Math.round((current / total) * 100);
    bar.style.width = `${percent}%`;
    text.textContent = `${statusText} (${current}/${total}명 완료)`;
  }
}

function hideProgressBar() {
  const panel = document.getElementById('bulk-progress-panel');
  if (panel) panel.remove();
}

/**
 * 일괄 생기부 점수 AI 채점 실행 (생기부 PDF가 업로드된 학생 대상)
 */
async function runBulkAIEval() {
  const targetStudents = STUDENTS_LIST.filter(s => s.recordPdf);
  if (targetStudents.length === 0) {
    alert('대상 학생이 없습니다. (생기부 PDF가 업로드된 학생 없음)');
    return;
  }
  
  if (!confirm(`대상 학생 ${targetStudents.length}명에 대해 일괄 생기부 AI 채점을 실행하시겠습니까?\n한 명당 약 15~30초가 소요됩니다.`)) return;
  
  showProgressBar('📊 일괄 생기부 AI 채점 중...', targetStudents.length);
  
  for (let i = 0; i < targetStudents.length; i++) {
    const student = targetStudents[i];
    updateProgressBar(i, targetStudents.length, `${student.name} 학생 생기부 분석 및 채점 중...`);
    try {
      await ApiClient.post('evaluateStudentRecord', { studentId: student.studentLink, recordText: null });
      await new Promise(r => setTimeout(r, 4000));
    } catch (e) {
      console.error(`${student.name} 학생 생기부 AI 채점 실패:`, e);
    }
  }
  
  updateProgressBar(targetStudents.length, targetStudents.length, '일괄 처리 완료!');
  alert('일괄 생기부 AI 채점 완료!');
  hideProgressBar();
  loadStudentsData();
}

/**
 * 일괄 AI 피드백 실행 (작성중 또는 최종제출인 모든 학생 대상)
 */
async function runBulkAIFeedback() {
  const targetStudents = STUDENTS_LIST.filter(s => s.psStatus === '작성중' || s.psStatus === '최종제출');
  if (targetStudents.length === 0) {
    alert('대상 학생이 없습니다. (자소서를 1글자라도 작성한 학생 없음)');
    return;
  }
  
  if (!confirm(`대상 학생 ${targetStudents.length}명에 대해 일괄 AI 피드백을 실행하시겠습니까?\n한 명당 약 5~10초 소요됩니다.`)) return;
  
  showProgressBar('🤖 일괄 AI 피드백 실행 중...', targetStudents.length);
  
  for (let i = 0; i < targetStudents.length; i++) {
    const student = targetStudents[i];
    updateProgressBar(i, targetStudents.length, `${student.name} 학생 분석 중...`);
    try {
      await ApiClient.post('generateAIFeedback', { studentId: student.studentLink });
      await new Promise(r => setTimeout(r, 3500));
    } catch (e) {
      console.error(`${student.name} 학생 AI 피드백 실패:`, e);
    }
  }
  
  updateProgressBar(targetStudents.length, targetStudents.length, '일괄 처리 완료!');
  alert('일괄 AI 피드백 완료!');
  hideProgressBar();
  loadStudentsData();
}

/**
 * 일괄 AI 예상질문 생성 (최종제출 및 미생성인 학생 대상)
 */
async function runBulkAIQuestions(mode) {
  const isPsMode = mode === 'ps';
  const targetStudents = STUDENTS_LIST.filter(s => {
      if (isPsMode) return s.psStatus === '최종제출';
      else return s.recordPdf;
  });
  if (targetStudents.length === 0) {
    alert('대상 학생이 없습니다.');
    return;
  }
  
  if (!confirm(`대상 학생 ${targetStudents.length}명에 대해 일괄 AI 예상질문 생성을 실행하시겠습니까?\n한 명당 약 5~10초 소요됩니다.`)) return;
  
  showProgressBar('📝 일괄 AI 예상질문 생성 중...', targetStudents.length);
  
  for (let i = 0; i < targetStudents.length; i++) {
    const student = targetStudents[i];
    updateProgressBar(i, targetStudents.length, `${student.name} 학생 질문 생성 중...`);
    try {
      await ApiClient.post('generateAIQuestions', { studentId: student.studentLink, type: isPsMode ? '자소서' : '생기부' });
      await new Promise(r => setTimeout(r, 3500));
    } catch (e) {
      console.error(`${student.name} 학생 AI 예상질문 생성 실패:`, e);
    }
  }
  
  updateProgressBar(targetStudents.length, targetStudents.length, '일괄 처리 완료!');
  alert('일괄 AI 예상질문 생성 완료!');
  hideProgressBar();
  loadStudentsData();
}

/**
 * 역할 및 권한별 사용안내 패널 렌더러
 */
function renderUserGuideContent() {
  const container = document.getElementById('user-guide-content');
  if (!container) return;
  
  let html = '';
  
  if (CURRENT_ROLE === '학생') {
    html = `
      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); padding: 25px; border-radius: 12px; font-size: 14px; line-height: 1.7;">
        <h4 style="color: var(--color-primary); font-size: 18px; margin-bottom: 20px;"><i class="fa-solid fa-graduation-cap"></i> 학생 시스템 이용 매뉴얼</h4>
        
        <div style="margin-bottom: 25px;">
          <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-pen-nib" style="color: var(--color-primary); margin-right: 8px;"></i> 1. 자기소개서 작성 및 관리</h5>
          <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border-left: 3px solid var(--color-primary);">
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-check" style="color: var(--color-primary); margin-right: 8px;"></i> <strong>맞춤형 문항 배정:</strong> 본인이 지원하는 학교에 맞춰 문항과 글자 수가 자동으로 설정됩니다.</li>
              <li style="margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-check" style="color: var(--color-primary); margin-right: 8px;"></i> <strong>글자 수 체크:</strong> 편집기 하단의 글자 수는 <strong>공백을 포함</strong>하여 실시간으로 계산됩니다.</li>
              <li style="margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-check" style="color: var(--color-primary); margin-right: 8px;"></i> <strong>수시 저장:</strong> 작성 중에는 반드시 <code>[저장하기]</code> 버튼을 눌러 내용을 안전하게 보관하세요.</li>
              <li style="font-size: 14px;"><i class="fa-solid fa-check" style="color: var(--color-primary); margin-right: 8px;"></i> <strong>최종 제출 주의:</strong> <code>[최종 제출하기]</code>를 누르면 더 이상 수정할 수 없습니다. 수정을 원하실 경우 담당 선생님께 잠금 해제를 요청해야 합니다.</li>
            </ul>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-comments" style="color: var(--color-primary); margin-right: 8px;"></i> 2. 면접 예상질문 직접 답변하기 (★중요)</h5>
          <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 10px; margin-left: 5px;">선생님과 AI가 만들어준 예상 질문에 본인만의 답변을 직접 작성하며 면접을 대비하세요.</p>
          <ul style="list-style: none; padding: 0; margin: 0; margin-left: 5px;">
            <li style="margin-bottom: 8px; font-size: 14px;">① 상단의 <strong>[면접 연습]</strong> 탭으로 이동합니다.</li>
            <li style="margin-bottom: 8px; font-size: 14px;">② 본인 이름 옆의 <code>[<i class="fa-solid fa-microphone"></i> 연습하기]</code> 버튼을 클릭합니다.</li>
            <li style="margin-bottom: 8px; font-size: 14px;">③ 각 번호 탭을 이동하며 편하게 답변을 작성하세요. 작성 중인 글은 <strong>자동으로 임시저장</strong>되므로 창을 닫기 전까지 날아가지 않습니다.</li>
            <li style="font-size: 14px;">④ 답변 작성을 모두 마친 후 마지막에 모달창 하단의 <code>[답변 저장하기]</code> 버튼을 딱 한 번 눌러 전체를 제출합니다.</li>
          </ul>
        </div>

        </div>
      </div>
    `;
  } else if (CURRENT_ROLE === '교사') {
    html = `
      <div style="display: flex; flex-direction: column; gap: 20px; font-size: 14px; line-height: 1.7;">
        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 25px; border-radius: 12px;">
          <h4 style="color: var(--color-success); font-size: 18px; margin-bottom: 20px;"><i class="fa-solid fa-chalkboard-user"></i> 강사 시스템 이용 매뉴얼</h4>
          
          <div style="margin-bottom: 25px;">
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-users" style="color: var(--color-success); margin-right: 8px;"></i> 1. 학생 상태 관리 및 생기부 열람</h5>
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border-left: 3px solid var(--color-success);">
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-check" style="color: var(--color-success); margin-right: 8px;"></i> <strong>합불 갱신:</strong> 대시보드의 '합불 상태' 열을 클릭해 학생의 전형 결과를 실시간으로 변경하세요.</li>
                <li style="margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-check" style="color: var(--color-success); margin-right: 8px;"></i> <strong>학생 수정:</strong> 목록 우측 끝의 <code>[수정]</code> 버튼을 눌러 연락처나 담당 강사를 배정할 수 있습니다.</li>
                <li style="margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-check" style="color: var(--color-success); margin-right: 8px;"></i> <strong>생기부 요약 열람:</strong> 학생의 <strong>생기부 점수</strong>를 클릭하면 AI가 요약한 핵심 3개 영역 분석창이 열립니다. (원본은 PDF 아이콘 클릭)</li>
                <li style="font-size: 14px; color: #ff9800;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i> <strong>생기부 업로드 관련 유의사항:</strong> &lt;반드시 3학년 1학기까지 완료된 생기부를 올리세요&gt;</li>
              </ul>
            </div>
          </div>

          <div style="margin-bottom: 25px;">
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-pen-to-square" style="color: var(--color-success); margin-right: 8px;"></i> 2. 자소서 수기 첨삭 지도</h5>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 10px; margin-left: 5px;">학생의 자기소개서를 읽고 직접 첨삭 의견을 남겨 지도할 수 있습니다.</p>
            <ul style="list-style: none; padding: 0; margin: 0; margin-left: 5px;">
              <li style="margin-bottom: 8px; font-size: 14px;">① <strong>[자기소개서]</strong> 탭에서 첨삭할 학생 우측의 <code>[<i class="fa-solid fa-pen"></i> 자소서 첨삭]</code>(녹색 버튼)을 클릭합니다.</li>
              <li style="margin-bottom: 8px; font-size: 14px;">② 우측 화면 상단의 <strong>'문항별 피드백'</strong> 탭이 선택되어 있는지 확인합니다.</li>
              <li style="font-size: 14px;">③ 지도 의견을 작성하고 화면 하단의 <code>[피드백 저장]</code> 버튼을 누르면 학생에게 즉시 연동됩니다.</li>
            </ul>
          </div>

          <div style="margin-bottom: 25px;">
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-microphone" style="color: var(--color-success); margin-right: 8px;"></i> 3. 면접 답변 확인 및 지도</h5>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 10px; margin-left: 5px;"><strong>[면접 연습]</strong> 탭에서 <code>[답변 확인]</code> 버튼을 누르면, 학생이 직접 작성한 예상질문 답변 내용을 열람하고 면접을 대비시킬 수 있습니다.</p>
          </div>

          <div>
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-paper-plane" style="color: var(--color-success); margin-right: 8px;"></i> 4. 원클릭 안내 문자 복사(배포)</h5>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 0; margin-left: 5px;">학생 대시보드(자소서/생기부 탭)에서 <strong>'학생별 문자(배포)'</strong> 열의 <code>[링크]</code> 버튼을 누르면, 해당 학생 고유 접속 주소가 포함된 안내 문자 양식이 통째로 복사됩니다. 그대로 카톡 등에 붙여넣기(Ctrl+V) 하여 전송하세요.</p>
          </div>
        </div>
      </div>
    `;
  } else if (CURRENT_ROLE === '관리자') {
    html = `
      <div style="display: flex; flex-direction: column; gap: 20px; font-size: 14px; line-height: 1.7;">
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 25px; border-radius: 12px;">
          <h4 style="color: var(--color-danger); font-size: 18px; margin-bottom: 20px;"><i class="fa-solid fa-crown"></i> 최고 관리자 시스템 매뉴얼</h4>
          
          <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 25px;">관리자는 강사가 수행하는 모든 기능(문항별 피드백, 합불 갱신 등)을 기본적으로 사용할 수 있으며, 아래와 같은 최고 권한 기능이 추가로 부여됩니다.</p>

          <div style="margin-bottom: 25px;">
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-chart-pie" style="color: var(--color-danger); margin-right: 8px;"></i> 1. 생기부 정밀 분석 (30개 항목) 열람</h5>
            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border-left: 3px solid var(--color-danger);">
              <p style="font-size: 14px; margin-bottom: 10px;">대시보드에서 <strong>생기부 점수</strong>를 클릭하면, 강사에게는 보이지 않는 <strong>30개 전체 평가 항목의 세부 점수와 AI 판단 근거</strong>가 기재된 정밀 모달창을 단독으로 열람할 수 있습니다.</p>
              <p style="font-size: 14px; margin-bottom: 0; color: #ff9800;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i> <strong>생기부 업로드 관련 유의사항:</strong> &lt;반드시 3학년 1학기까지 완료된 생기부를 올리세요&gt;</p>
            </div>
          </div>

          <div style="margin-bottom: 25px;">
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-bolt" style="color: var(--color-danger); margin-right: 8px;"></i> 2. 학생 일괄 AI 자동화 처리</h5>
            <ul style="list-style: none; padding: 0; margin: 0; margin-left: 5px;">
              <li style="margin-bottom: 10px; font-size: 14px;"><strong>자소서 일괄 첨삭:</strong> 자소서 탭 상단의 <code>[일괄 AI 피드백 생성]</code> 버튼을 통해 선택된 다수의 학생 자소서를 Gemini API가 일괄 자동 첨삭합니다.</li>
              <li style="font-size: 14px;"><strong>면접 일괄 생성:</strong> 면접 탭 상단의 <code>[일괄 AI 예상질문 생성]</code> 버튼을 통해 여러 학생의 자소서 기반 예상질문을 한 번에 추출합니다.</li>
            </ul>
          </div>

          <div style="margin-bottom: 25px;">
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-paper-plane" style="color: var(--color-danger); margin-right: 8px;"></i> 3. 원클릭 안내 문자 복사(배포)</h5>
            <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 0; margin-left: 5px;">학생 대시보드(자소서/생기부 탭)에서 <strong>'학생별 문자(배포)'</strong> 열의 <code>[링크]</code> 버튼을 누르면, 해당 학생 고유 접속 주소가 포함된 안내 문자 양식이 통째로 복사됩니다. 그대로 카톡 등에 붙여넣기(Ctrl+V) 하여 전송하세요.</p>
          </div>

          <div style="margin-bottom: 25px;">
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-unlock-keyhole" style="color: var(--color-danger); margin-right: 8px;"></i> 4. 학생 자소서 최종 제출 락 해제</h5>
            <ul style="list-style: none; padding: 0; margin: 0; margin-left: 5px;">
              <li style="margin-bottom: 0px; font-size: 14px;">학생이 자소서를 최종 제출하여 더 이상 수정할 수 없게 된 경우, 관리자만이 자소서 편집창 내부의 <code>[최종 제출 락 해제]</code> 버튼을 눌러 재수정을 허가할 수 있습니다.</li>
            </ul>
          </div>

          <div>
            <h5 style="color: #fff; font-size: 15px; margin-bottom: 10px;"><i class="fa-solid fa-sliders" style="color: var(--color-danger); margin-right: 8px;"></i> 5. 시스템 마스터 환경 설정</h5>
            <ul style="list-style: none; padding: 0; margin: 0; margin-left: 5px;">
              <li style="margin-bottom: 0px; font-size: 14px;">사이드바 하단의 <strong>[설정]</strong> 메뉴에 진입하여 시스템의 관리자/강사 비밀번호, API 키, 연동 드라이브 폴더, 각 학교별 문항 및 글자수 제한을 실시간으로 관리하십시오.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * AI 시스템 비서에게 질문 전송 및 답변 수신 렌더러
 */
async function sendChatbotMessage() {
  const input = document.getElementById('input-chatbot-msg');
  const area = document.getElementById('chatbot-message-area');
  if (!input || !area) return;
  
  const question = input.value.trim();
  if (!question) return;
  
  // 1. 사용자 말풍선 추가
  const userMsg = document.createElement('div');
  userMsg.className = 'msg user';
  userMsg.style.cssText = `
    background: rgba(6, 182, 212, 0.15);
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    border-radius: 8px;
    align-self: flex-end;
    max-width: 85%;
    color: #22d3ee;
  `;
  userMsg.textContent = question;
  area.appendChild(userMsg);
  
  // 스크롤 자동 이동
  area.scrollTop = area.scrollHeight;
  input.value = '';
  
  // 2. 로딩 말풍선 추가
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'msg system loading';
  loadingMsg.style.cssText = `
    background: rgba(255, 255, 255, 0.05);
    padding: 8px 12px;
    border-radius: 8px;
    align-self: flex-start;
    max-width: 85%;
    color: var(--text-muted);
  `;
  loadingMsg.textContent = '🤖 SION이 답변을 생성하는 중입니다...';
  area.appendChild(loadingMsg);
  area.scrollTop = area.scrollHeight;
  
  try {
    const res = await ApiClient.post('askProjectHelper', { question }, { hideLoader: true });
    loadingMsg.remove();
    
    const botMsg = document.createElement('div');
    botMsg.className = 'msg bot';
    botMsg.style.cssText = `
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 8px 12px;
      border-radius: 8px;
      align-self: flex-start;
      max-width: 85%;
      white-space: pre-wrap;
      color: var(--text-main);
    `;
    if (res.success) {
      botMsg.textContent = res.answer;
    } else {
      botMsg.textContent = '🚨 오류: ' + (res.error || '답변 생성에 실패했습니다.');
      botMsg.style.color = 'var(--color-danger)';
    }
    area.appendChild(botMsg);
  } catch (e) {
    loadingMsg.remove();
    const errorMsg = document.createElement('div');
    errorMsg.className = 'msg system error';
    errorMsg.style.cssText = `
      background: rgba(239, 68, 68, 0.1);
      padding: 8px 12px;
      border-radius: 8px;
      align-self: flex-start;
      max-width: 85%;
      color: var(--color-danger);
    `;
    errorMsg.textContent = '🚨 네트워크 오류로 답변을 받아오지 못했습니다.';
    area.appendChild(errorMsg);
  }
  
  area.scrollTop = area.scrollHeight;
}

/**
 * ==================================================================================
 * 📚 [Task 3] 입학요강 및 기출문제 뷰어 / PDF 검증 로직
 * ==================================================================================
 */

// 1. PDF 파일 20MB / 확장자 검증 공통 모듈
function validatePdfFile(file) {
  if (!file) return false;
  
  // 확장자 / MIME 타입 체크
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    alert('🚨 오류: PDF 파일만 업로드 가능합니다.');
    return false;
  }
  
  // 20MB (20 * 1024 * 1024 바이트) 체크
  const MAX_SIZE = 20 * 1024 * 1024; 
  if (file.size > MAX_SIZE) {
    alert('🚨 용량 초과: 파일 크기는 20MB 이하만 가능합니다. (현재 크기: ' + (file.size / 1024 / 1024).toFixed(2) + 'MB)');
    return false;
  }
  
  return true;
}

let CURRENT_PDF_LIST = [];
const SCIENCE_SCHOOLS = ['서울과고', '한성과고', '세종과고', '경기북과고', '인천과고', '인천진산과고', '대전동신과고', '대구일과고', '부산과고', '부산일과고', '경남과고', '창원과고', '울산과고', '경북과고', '경산과고', '전북과고', '전남과고', '제주과고', '충북과고', '충남과고', '강원과고'];

function renderPdfList() {
  const listEl = document.getElementById('pdf-file-list');
  const iframe = document.getElementById('pdf-main-iframe');
  const placeholder = document.getElementById('pdf-viewer-placeholder');
  
  const yearFilter = document.getElementById('pdf-year-filter')?.value || '전체';
  const schoolFilter = document.getElementById('pdf-school-filter')?.value || '전체';
  
  listEl.innerHTML = '';
  iframe.style.display = 'none';
  placeholder.style.display = 'block';
  
  let filtered = CURRENT_PDF_LIST;
  
  if (yearFilter !== '전체') {
    filtered = filtered.filter(f => {
      const match = f.name.match(/(20\d{2})/);
      return match && match[1] === yearFilter;
    });
  }
  
  if (schoolFilter !== '전체') {
    filtered = filtered.filter(f => {
      let extractedSchool = SCIENCE_SCHOOLS.find(s => f.name.includes(s)) || '기타';
      return extractedSchool === schoolFilter;
    });
  }
  
  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="text-muted" style="text-align:center; padding:20px;">조건에 맞는 파일이 없습니다.</div>';
    return;
  }
  
  filtered.forEach(file => {
    const btn = document.createElement('button');
    btn.className = 'btn-action';
    btn.style.cssText = 'width:100%; text-align:left; background: var(--bg-surface); padding: 10px; margin-bottom: 5px; color: var(--text-main); font-size: 14px;';
    btn.innerHTML = `<i class="fa-regular fa-file-pdf" style="color:var(--color-danger); margin-right:5px;"></i> ${file.name}`;
    
    btn.onclick = () => {
      Array.from(listEl.children).forEach(c => c.style.border = 'none');
      btn.style.border = '1px solid var(--color-primary)';
      placeholder.style.display = 'none';
      iframe.style.display = 'block';
      iframe.src = file.url; 
    };
    listEl.appendChild(btn);
  });
}

// 2. 패널 로딩 및 폴더 스캔 모방 (추후 GAS 연동)
async function loadPdfFiles(folderType) {
  const titleEl = document.getElementById('pdf-library-title');
  const listEl = document.getElementById('pdf-file-list');
  const iframe = document.getElementById('pdf-main-iframe');
  const placeholder = document.getElementById('pdf-viewer-placeholder');
  const filterContainer = document.getElementById('pdf-filter-container');
  const yearSelect = document.getElementById('pdf-year-filter');
  const schoolSelect = document.getElementById('pdf-school-filter');
  
  iframe.style.display = 'none';
  placeholder.style.display = 'block';
  
  let folderId = '';
  if (folderType === 'guide') {
    titleEl.textContent = '입학요강 목록';
    folderId = extractDriveId(document.getElementById('settings-drive-guide')?.value || '');
  } else if (folderType === 'exam') {
    titleEl.textContent = '기출문제 목록';
    folderId = extractDriveId(document.getElementById('settings-drive-exam')?.value || '');
  }
  
  listEl.innerHTML = `<div class="text-muted" style="text-align:center; padding:20px;">
    <i class="fa-solid fa-spinner fa-spin"></i> 드라이브 동기화 중...
  </div>`;
  
  if (filterContainer) filterContainer.style.display = 'none'; // 필터 무조건 숨김
  
  setTimeout(async () => {
    if (!folderId) {
      listEl.innerHTML = `<div class="text-muted" style="text-align:center; font-size: 14px;">
        설정 탭에서 구글 드라이브 폴더 ID를<br>먼저 연동해주세요.
      </div>`;
      return;
    }
    
    try {
      const response = await ApiClient.post('getFilesInFolder', { folderId }, { hideLoader: true });
      CURRENT_PDF_LIST = response.files || response || [];
      
      if (!CURRENT_PDF_LIST || CURRENT_PDF_LIST.length === 0) {
        listEl.innerHTML = '<div class="text-muted" style="text-align:center; padding:20px;">파일이 없습니다.</div>';
        return;
      }
      
      // 필터 옵션 추출
      const years = new Set();
      const schools = new Set();
      CURRENT_PDF_LIST.forEach(file => {
        const yearMatch = file.name.match(/(20\d{2})/);
        if (yearMatch) years.add(yearMatch[1]);
        
        let extractedSchool = SCIENCE_SCHOOLS.find(s => file.name.includes(s));
        if (extractedSchool) schools.add(extractedSchool);
        else schools.add('기타');
      });
      
      // 옵션 렌더링
      if (yearSelect && schoolSelect && filterContainer) {
        yearSelect.innerHTML = '<option value="전체">연도 전체</option>';
        [...years].sort().reverse().forEach(y => {
          yearSelect.innerHTML += `<option value="${y}">${y}년</option>`;
        });
        
        schoolSelect.innerHTML = '<option value="전체">학교 전체</option>';
        [...schools].sort().forEach(s => {
          schoolSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
        
        filterContainer.style.display = 'none'; // 데이터 로드 후에도 무조건 숨김
        yearSelect.onchange = renderPdfList;
        schoolSelect.onchange = renderPdfList;
      }
      
      renderPdfList();
      
    } catch (e) {
      listEl.innerHTML = `<div class="text-muted" style="text-align:center; padding:20px; color: var(--color-danger);">
        <i class="fa-solid fa-triangle-exclamation"></i> 동기화 실패<br><br>
        <span style="font-size:12px; color:var(--text-muted);">${e.message}</span>
      </div>`;
    }
  }, 600);
}

// 3. 업로드 버튼 바인딩
const uploadBtn = document.getElementById('btn-upload-pdf');
const uploadInput = document.getElementById('general-pdf-input');
if (uploadBtn && uploadInput) {
  uploadBtn.onclick = () => {
    if (CURRENT_ROLE === '학생' || CURRENT_ROLE === '게스트') {
      alert('업로드 권한이 없습니다.');
      return;
    }
    uploadInput.click();
  };
  
  uploadInput.onchange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const validFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf') && !file.type.startsWith('image/')) {
        alert(`🚨 오류: ${file.name}은(는) 올바른 파일 형식이 아닙니다.`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        alert(`🚨 용량 초과: ${file.name}의 크기가 20MB를 초과합니다.`);
        continue;
      }
      validFiles.push(file);
    }
    
    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    showGlobalLoader(`서버로 ${validFiles.length}개의 파일을 전송하는 중입니다...`);
    let successCount = 0;

    for (const file of validFiles) {
      try {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(file);
        });

        const folderType = CURRENT_MENU === 'guide' ? 'guide' : 'exam';
        let folderIdStr = '';
        if (folderType === 'guide') {
          folderIdStr = extractDriveId(document.getElementById('settings-drive-guide')?.value || '');
        } else {
          folderIdStr = extractDriveId(document.getElementById('settings-drive-exam')?.value || '');
        }
        
        if (!folderIdStr) {
          throw new Error('설정 탭에서 드라이브 폴더 링크를 먼저 입력해 주세요.');
        }

        const res = await ApiClient.post('uploadGeneralPdf', {
          fileName: file.name,
          mimeType: file.type,
          base64Data: base64Data,
          folderId: folderIdStr
        });
        
        if (res.success) {
          successCount++;
        } else {
          console.error(`${file.name} 업로드 실패:`, res.error);
        }
      } catch (err) {
        console.error(`${file.name} 업로드 에러:`, err);
      }
    }
    
    hideGlobalLoader();
    e.target.value = ''; // 초기화
    
    if (successCount > 0) {
      alert(`${successCount}개의 파일 업로드 완료!`);
      loadPdfFiles(CURRENT_MENU);
    } else {
      alert('업로드에 실패했습니다. 콘솔을 확인해주세요.');
    }
  };
}

// 개별 AI 실행 기능 추가
async function runSingleAIFeedback(studentId) {
  if (!confirm('해당 학생 1명에 대해 AI 피드백을 실행하시겠습니까?')) return;
  try {
    const res = await ApiClient.post('generateAIFeedback', { studentId });
    if (res.success) {
      
      alert('개별 AI 피드백 완료!');
      loadStudentsData();
    } else {
      throw new Error(res.error);
    }
  } catch(e) {
    alert('실행 중 오류 발생: ' + e.toString());
    
  }
}

async function runSingleAIQuestions(studentId, mode) {
  const isPsMode = mode === 'ps' || mode === '자소서';
  if (!confirm(`해당 학생에 대해 AI ${isPsMode ? '자소서' : '생기부'} 예상질문 생성을 실행하시겠습니까?`)) return;
  try {
    const res = await ApiClient.post('generateAIQuestions', { studentId, type: isPsMode ? '자소서' : '생기부' });
    if (res.success) {
      
      alert('개별 AI 예상질문 생성 완료!');
      loadStudentsData();
    } else {
      throw new Error(res.error);
    }
  } catch(e) {
    alert('실행 중 오류 발생: ' + e.toString());
    
  }
}

async function runSingleAIEval(studentId) {
  if (!confirm('해당 학생의 생기부를 바탕으로 AI 채점을 실행하시겠습니까?')) return;
  try {
    const res = await ApiClient.post('evaluateStudentRecord', { studentId, recordText: null });
    if (res.success) {
      alert('생기부 AI 수동 채점 완료!');
      loadStudentsData();
    } else {
      throw new Error(res.error);
    }
  } catch(e) {
    alert('실행 중 오류 발생: ' + e.toString());
    
  }
}
