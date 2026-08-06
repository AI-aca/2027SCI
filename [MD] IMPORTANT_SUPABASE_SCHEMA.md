# 수파베이스(Supabase) 테이블 구조 및 컬럼 매핑 안내

이 프로젝트에서 구글 스프레드시트(로컬 엑셀) 데이터를 수파베이스 DB로 마이그레이션할 때 사용된 핵심 테이블들과, 각 테이블의 컬럼(첫 행) 매핑 구조를 정리한 내용입니다. 백엔드 통신 에러 해결이나 데이터 검증 시 참고할 수 있습니다.

## 1. `settings` (전역 설정 및 프롬프트 보관)
- **목적**: Gemini API 키, 각 학교별 문항 설정 정보, AI 프롬프트 원문 등을 저장
- **주요 컬럼**:
  - `setting_key`: 설정 항목 이름 (Key)
  - `setting_value`: 설정값 (텍스트 또는 JSON 형태)
- **🔑 필수 `setting_key` (AI 프롬프트 로직 및 중요 환경 변수 상세)**:
  1. `GeminiKey`: 구글 Gemini 유료 API 키 (AI 연동의 핵심)
  2. `schools` (또는 `TargetSchools`): 학교별 자소서 문항 설정 정보 (JSON 배열)
  3. `prompt_evaluate_common`: [생기부 채점] 3분할 파이프라인의 공통 시스템 지시사항 (가장 기본이 되는 베이스 프롬프트)
  4. `prompt_evaluate_area1`: [생기부 채점] 1영역(학업역량) 채점 전용 프롬프트 
  5. `prompt_evaluate_area2`: [생기부 채점] 2영역(진로적합성) 채점 전용 프롬프트
  6. `prompt_evaluate_area3`: [생기부 채점] 3영역(인성 및 감점항목) 채점 전용 프롬프트
  7. `prompt_feedback`: [자소서 멘토링] 자소서 내용 피드백 생성용 AI 프롬프트
  8. `prompt_pdf`: [생기부 파싱] Gemini 1.5 Flash를 이용한 PDF OCR 텍스트 파싱용 프롬프트
  9. `관리자`: 관리자 계정 로그인 비밀번호
  10. `교사`: 교사 계정 로그인 비밀번호

## 2. `students` (학생 기본 정보 및 상태 메타데이터)
- **목적**: 학생별 소속, 지원 학교, 연락처 및 각종 링크(PDF 등), 진행 상태 관리
- **주요 컬럼**:
  - `student_link`: 학생 고유 식별자 (모든 테이블의 기준이 되는 PK/FK 역할)
  - `student_name`, `center_name`, `school`, `target_school`: 이름 및 소속/지원 학교 정보
  - `record_link`, `cover_letter_link`: 생기부 PDF 및 자소서 PDF 접근 URL
  - `cover_letter_status`, `cover_letter_feedback_ai`, `record_score_ai`: 진행 상태 및 점수
  - `parent_contact`, `student_contact`, `math_teacher`, `science_teacher`: 연락 및 담당 정보
  - `student_memo`: 학생 메모장 (문항 공통 자유 메모 공간)

## 3. `record_basis` (생기부 AI 분석 결과 및 채점 근거)
- **목적**: "생기부 산정" 시 AI가 반환한 총평 텍스트와 산정 근거 JSON을 영구 저장
- **주요 컬럼**:
  - `student_link`: 매핑 학생 고유 링크
  - `target_school`: 지원 학교명
  - `total_score`: AI가 산출한 영역 1~3 합산 총점
  - `analysis_report`: AI 종합 총평 텍스트 원문 (`evaluateStudentRecord` 2단계 결과물)
  - `score_details_json`: 영역 1, 2, 3의 항목별 채점 근거가 담긴 원시 JSON 텍스트
  - `created_at`: 산정 시점

## 4. `parsed_records` (생기부 OCR 텍스트 캐시)
- **목적**: PDF에서 한 번 추출한 텍스트를 캐싱하여 AI 파싱 시 속도를 높이고 중복 추출 방지
- **주요 컬럼**:
  - `student_link`: 매핑 학생 고유 링크
  - `student_name`: 학생 이름
  - `parsed_content`: PDF에서 OCR로 추출해낸 생기부 원시 텍스트 (100자 이상)
  - `pdf_id`: 해당 PDF의 고유 ID (갱신 추적용)

## 5. `personal_statements` (자소서 작성 데이터)
- **목적**: 학생이 작성한 문항별 자소서 내용 및 교사 피드백 저장
- **주요 컬럼**:
  - `student_link`: 매핑 학생 고유 링크
  - `question_no`: 자소서 문항 번호 (1, 2, 3...)
  - `content`: 작성한 자소서 내용 텍스트
  - `teacher_feedback`: 담당 교사 코멘트
  - `version_label`: 버전(예: `최신버전`, `작성중` 등)

## 6. `ai_feedback_history` (자소서 AI 피드백 및 체크리스트 이력)
- **목적**: AI가 자소서를 읽고 제공한 멘토링 피드백 및 문항별 체크리스트 보관
- **주요 컬럼**:
  - `student_link`: 매핑 학생 고유 링크
  - `type`: 피드백 종류 (예: `통합` 또는 `문항1_체크리스트`, `문항2_체크리스트` 등)
  - `feedback`: AI가 생성한 텍스트 또는 JSON 체크리스트 원문
  - `created_at`: 피드백 생성 시점

## 7. `interview_practice` (AI 예상 질문 데이터)
- **목적**: 자소서 및 생기부 기반으로 추출한 개별화 면접 예상 질문 저장
- **주요 컬럼**:
  - `student_link`: 매핑 학생 고유 링크
  - `psQuestions`, `psVerText`: 자소서 기반 면접 질문 및 버전 메타
  - `recordQuestions`, `recordVerText`: 생기부 기반 면접 질문 및 버전 메타
  - `created_at`: 질문 생성 시점

## 8. `school_questions` (학교별 자소서 문항 설정)
- **목적**: 과학고/영재고 학교별 문항 양식 및 글자 수 제한 정보
- **주요 컬럼**:
  - `school_name`: 학교명 (예: 경기북과학고)
  - `item_no`: 문항 번호
  - `content`: 문항 질문 텍스트
  - `limit_chars`: 해당 문항 제한 글자 수 (바이트 또는 자수)
