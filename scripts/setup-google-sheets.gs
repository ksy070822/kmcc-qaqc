/**
 * KMCC QC Dashboard - 협업 요구사항 & 온보딩 시트 (15-Sheet)
 *
 * 시트 구성:
 *  1. 메이-총괄           : PM 역할, 전체 프로젝트 관리
 *  2. 시스템아키텍처       : 기술 스택, 테이블, API, 컴포넌트 현황
 *  3. QC-메이             : QC 상담품질 도메인
 *  4. 직무테스트-메이      : Quiz 도메인
 *  5. Cobb-생산성요구사항    : 생산성 지표 요구사항 (Cobb 작성)
 *  6. Cobb-생산성코딩가이드  : 생산성 코드 수정 가이드 (Cobb 참고)
 *  7. Dean-SLA요구사항      : SLA 평가 요구사항 (Dean 작성)
 *  8. Dean-SLA코딩가이드    : SLA 코드 수정 가이드 (Dean 참고)
 *  9. 리샬-QACSAT요구사항 : QA+CSAT 요구사항 (리샬 작성)
 * 10. 리샬-QACSAT코딩가이드: QA+CSAT 코드 수정 가이드 (리샬 참고)
 * 11. 품질전체구조         : 통합 가중치, 코칭, 부진관리, 리포트
 * 12. 4View설계           : HQ/센터장/관리자/상담사 뷰 설계
 * 13. 온보딩-환경설정      : 개발 환경 셋업 (ONBOARDING.md)
 * 14. Git워크플로우        : Git 브랜치/커밋/PR (GIT_WORKFLOW.md)
 * 15. 도메인가이드         : 도메인별 파일/작업 (DOMAIN_GUIDE.md)
 *
 * 사용법: Apps Script 에디터에서 main() 실행
 */

// ─── 유틸리티 ────────────────────────────────────────

/** 기존 시트를 모두 삭제하고 초기화 */
function resetAllSheets(ss) {
  // 임시 시트 생성 (최소 1개 필요)
  var temp = ss.insertSheet('_temp_');
  // 기존 시트 역순으로 삭제 (정순 삭제 시 인덱스 꼬임 방지)
  var sheets = ss.getSheets();
  for (var i = sheets.length - 1; i >= 0; i--) {
    if (sheets[i].getName() !== '_temp_') {
      ss.deleteSheet(sheets[i]);
    }
  }
  SpreadsheetApp.flush(); // 삭제 완료 대기
  return temp;
}

function writeSection(sheet, row, title, bgColor) {
  bgColor = bgColor || '#1a73e8';
  sheet.getRange(row, 1, 1, 8).merge()
    .setValue(title)
    .setFontSize(13).setFontWeight('bold').setFontColor('white')
    .setBackground(bgColor).setHorizontalAlignment('center');
  return row + 1;
}

function writeSubSection(sheet, row, title) {
  sheet.getRange(row, 1, 1, 8).merge()
    .setValue(title)
    .setFontSize(11).setFontWeight('bold')
    .setBackground('#e8f0fe').setHorizontalAlignment('left');
  return row + 1;
}

function writeHeaders(sheet, row, headers) {
  headers.forEach(function(h, i) {
    sheet.getRange(row, i + 1).setValue(h)
      .setFontWeight('bold').setBackground('#f1f3f4');
  });
  return row + 1;
}

function writeRows(sheet, row, data) {
  data.forEach(function(rowData) {
    rowData.forEach(function(val, i) {
      var cell = sheet.getRange(row, i + 1).setValue(val);
      if (typeof val === 'string' && val.indexOf('[입력]') >= 0) {
        cell.setBackground('#fff9c4');
      }
    });
    row++;
  });
  return row;
}

function writeNote(sheet, row, text) {
  sheet.getRange(row, 1, 1, 8).merge()
    .setValue(text).setFontColor('#5f6368').setFontStyle('italic');
  return row + 1;
}

function fmt(sheet) {
  sheet.setColumnWidth(1, 180);
  for (var i = 2; i <= 8; i++) sheet.setColumnWidth(i, 150);
  sheet.setFrozenRows(0);
}

// ─── MAIN ────────────────────────────────────────────
function main() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) 기존 시트 전부 삭제
  var temp = resetAllSheets(ss);
  Logger.log('기존 시트 초기화 완료');

  // 2) 15개 시트 순서대로 생성
  var builders = [
    buildSheet01, buildSheet02, buildSheet03, buildSheet04,
    buildSheet05, buildSheet06, buildSheet07, buildSheet08,
    buildSheet09, buildSheet10, buildSheet11, buildSheet12,
    buildSheet13, buildSheet14, buildSheet15
  ];
  for (var i = 0; i < builders.length; i++) {
    builders[i](ss);
    Logger.log((i + 1) + '/15 완료');
  }

  // 3) 임시 시트 삭제
  ss.deleteSheet(temp);

  SpreadsheetApp.flush();
  Logger.log('15개 시트 생성 완료!');
}

// ═══════════════════════════════════════════════════════
// 1. 메이-총괄
// ═══════════════════════════════════════════════════════
function buildSheet01(ss) {
  var s = ss.insertSheet('1.메이-총괄');
  var r = 1;

  r = writeSection(s, r, '메이 - 프로젝트 총괄 (PM)');
  r = writeNote(s, r, '전체 품질관리 시스템의 총괄 PM. 아키텍처 설계, 통합 로직, 배포 관리.');
  r++;

  r = writeSubSection(s, r, '프로젝트 개요');
  r = writeHeaders(s, r, ['항목', '내용']);
  r = writeRows(s, r, [
    ['프로젝트명', 'KMCC QC 품질관리 통합 대시보드'],
    ['목표', '카카오모빌리티 고객센터 품질 실시간 모니터링 + 월말 예측'],
    ['센터', '용산, 광주 (2개 센터)'],
    ['사용자', 'HQ 관리자, 센터장(강사), 관리자, 상담사'],
    ['URL', 'https://qc-dashboard-wlof52lhea-du.a.run.app'],
    ['Git (원본)', 'may070822/kmcc-qc-dashbord'],
    ['Git (공유)', 'csopp/komi'],
    ['배포', 'GCP Cloud Run (asia-northeast3) + Cloud Build 자동 배포'],
  ]);
  r++;

  r = writeSubSection(s, r, '도메인별 담당자');
  r = writeHeaders(s, r, ['도메인', '담당자', '역할', '현재 상태']);
  r = writeRows(s, r, [
    ['QC 상담품질', '메이', '평가 항목, 오류율, 목표 관리', '구현 완료 (13 컴포넌트)'],
    ['직무테스트', '메이', 'Quiz 시스템 연동', '구현 완료 (5 컴포넌트)'],
    ['생산성', 'Cobb', '음성/채팅/게시판/외국어 지표', '뼈대 구현 (6 컴포넌트)'],
    ['SLA 평가', 'Dean', '생산성+품질 종합 등급', '뼈대 구현 (6 컴포넌트)'],
    ['QA 상담평점', '리샬', '22개 항목 평가, 등급', '구현 완료 (6 컴포넌트)'],
    ['CSAT 고객만족', '리샬', '리뷰 평점, 서비스별 분석', '구현 완료 (7 컴포넌트)'],
    ['통합분석', '메이', '코칭, 부진상담사, 위험도', '진행중'],
  ]);
  r++;

  r = writeSubSection(s, r, '메이 총괄 업무 범위');
  r = writeHeaders(s, r, ['업무', '설명', '관련 파일']);
  r = writeRows(s, r, [
    ['아키텍처 설계', '전체 시스템 구조, DB 스키마, API 설계', 'lib/*.ts, app/api/**'],
    ['통합 로직', 'QC+QA+CSAT+Quiz 가중치 통합, 위험도 산출', 'lib/constants.ts, lib/predictions.ts'],
    ['코칭 시스템', '8개 카테고리 매핑, 처방전 생성', 'components/qc/coaching/**'],
    ['부진상담사 관리', '4개 기준 판정, 개선계획, 리포트', 'components/qc/focus/**'],
    ['권한/인증', '역할 기반 4-View 접근 제어', 'lib/auth.ts, middleware.ts'],
    ['배포/운영', 'Cloud Build, Cloud Run, 모니터링', 'Dockerfile, cloudbuild.yaml'],
    ['협업 관리', '코드 리뷰, PR 머지, 브랜치 관리', 'Git workflow'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 2. 시스템 아키텍처
// ═══════════════════════════════════════════════════════
function buildSheet02(ss) {
  var s = ss.insertSheet('2.시스템아키텍처');
  var r = 1;

  r = writeSection(s, r, '시스템 아키텍처 현황');
  r++;

  r = writeSubSection(s, r, '기술 스택');
  r = writeHeaders(s, r, ['레이어', '기술', '버전/세부']);
  r = writeRows(s, r, [
    ['프레임워크', 'Next.js (App Router)', 'v16 + React 19'],
    ['언어', 'TypeScript', 'strict 모드'],
    ['스타일', 'Tailwind CSS + shadcn/ui', 'v4 + Radix UI'],
    ['차트', 'Recharts', ''],
    ['DB', 'Google BigQuery', 'csopp-25f2.KMCC_QC'],
    ['CSAT DB', 'BigQuery (cross-project)', 'dataanalytics-25f2.dw_review'],
    ['시트 연동', 'Google Sheets API', '평가 데이터 임포트'],
    ['배포', 'GCP Cloud Run', 'asia-northeast3'],
    ['AI', 'Vertex AI / Gemini', '상담사 분석 챗봇'],
  ]);
  r++;

  r = writeSubSection(s, r, 'BigQuery 테이블 현황');
  r = writeHeaders(s, r, ['테이블', '용도', '파티션', '상태']);
  r = writeRows(s, r, [
    ['evaluations', 'QC 평가 원천 데이터', 'evaluation_date', '운영중'],
    ['agents', '상담사 마스터', '-', '운영중'],
    ['metrics_daily', '일별 집계', 'metric_date', '운영중'],
    ['predictions', '월말 예측 결과', '-', '운영중'],
    ['watch_list', '집중관리 대상', '-', '운영중'],
    ['targets', '목표 설정', '-', '운영중'],
    ['qa_evaluations', 'QA 평가 데이터', '-', '스키마 완료'],
    ['productivity_daily', '생산성 일별 데이터', '-', '운영중'],
    ['sla_monthly', 'SLA 월별 평가', '-', '운영중'],
  ]);
  r++;

  r = writeSubSection(s, r, '도메인별 구현 현황');
  r = writeHeaders(s, r, ['도메인', '컴포넌트 수', 'BQ 함수 수', 'Hook 수', '상태']);
  r = writeRows(s, r, [
    ['QC 상담품질', '13개', '다수 (bigquery.ts)', '3+', '완료'],
    ['QA 상담평점', '6개', '8개 (bigquery-qa.ts)', '1', '완료'],
    ['CSAT 고객만족', '7개', '7개 (bigquery-csat.ts)', '1', '완료'],
    ['생산성', '6개', '8개 (bigquery-productivity.ts)', '1', '뼈대 완료'],
    ['SLA', '6개', '3개 (bigquery-sla.ts)', '1', '뼈대 완료'],
    ['직무테스트', '5개', '4개 (bigquery-quiz.ts)', '1', '완료'],
    ['통합분석', '4개', '-', '-', '진행중'],
    ['코칭', '6개', '-', '-', '진행중'],
    ['부진상담사', '10개', '-', '-', '진행중'],
    ['마이페이지', '10+개', '-', '-', '진행중'],
  ]);
  r++;

  r = writeSubSection(s, r, 'API 엔드포인트 주요 목록');
  r = writeHeaders(s, r, ['경로', '용도', '도메인']);
  r = writeRows(s, r, [
    ['/api/bigquery-sync', 'QC 데이터 동기화', 'QC'],
    ['/api/predictions', '월말 예측', 'QC'],
    ['/api/qa-dashboard', 'QA 대시보드 데이터', 'QA'],
    ['/api/csat-dashboard', 'CSAT 대시보드 데이터', 'CSAT'],
    ['/api/productivity', '생산성 데이터', '생산성'],
    ['/api/sla', 'SLA 스코어카드', 'SLA'],
    ['/api/quiz-dashboard', '직무테스트 데이터', 'Quiz'],
    ['/api/import-qa', 'QA Sheets 임포트', 'QA'],
    ['/api/sync-sheets', 'QC Sheets 동기화', 'QC'],
    ['외 24개', '코칭, 부진관리, 인증 등', '통합'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 3. QC-메이
// ═══════════════════════════════════════════════════════
function buildSheet03(ss) {
  var s = ss.insertSheet('3.QC-메이');
  var r = 1;

  r = writeSection(s, r, 'QC 상담품질 (메이 담당)');
  r = writeNote(s, r, '16개 평가항목으로 상담 품질 모니터링. 태도 5항목 + 오상담 11항목.');
  r++;

  r = writeSubSection(s, r, '오류율 계산 공식');
  r = writeHeaders(s, r, ['유형', '공식', '항목수']);
  r = writeRows(s, r, [
    ['상담태도 오류율', '태도오류건수 / (검수건수 x 5) x 100', '5개'],
    ['오상담 오류율', '오상담오류건수 / (검수건수 x 11) x 100', '11개'],
  ]);
  r++;

  r = writeSubSection(s, r, '센터 목표 (2026)');
  r = writeHeaders(s, r, ['센터', '태도 목표', '오상담 목표']);
  r = writeRows(s, r, [
    ['용산', '3.3%', '3.9%'],
    ['광주', '2.7%', '1.7%'],
    ['전체', '3.0%', '3.0%'],
  ]);
  r++;

  r = writeSubSection(s, r, 'QC 컴포넌트 (13개) - 구현 완료');
  r = writeHeaders(s, r, ['컴포넌트', '역할']);
  r = writeRows(s, r, [
    ['overview-section.tsx', '전체 요약 KPI 카드'],
    ['error-trend-chart.tsx', '오류율 추이 차트'],
    ['goal-status-board.tsx', '목표 달성 현황'],
    ['center-comparison.tsx', '센터별 비교'],
    ['item-analysis.tsx', '항목별 분석'],
    ['item-heatmap.tsx', '항목별 히트맵'],
    ['daily-error-table.tsx', '일별 오류 테이블'],
    ['weekly-error-table.tsx', '주별 오류 테이블'],
    ['service-weekly-table.tsx', '서비스별 주간 테이블'],
    ['tenure-error-table.tsx', '재직기간별 오류'],
    ['watchlist-preview.tsx', '주의 대상 미리보기'],
    ['dashboard-filters.tsx', '필터 컴포넌트'],
    ['index.tsx', '메인 래퍼'],
  ]);
  r++;

  r = writeSubSection(s, r, '주간 기준');
  r = writeNote(s, r, '목요일 ~ 수요일 (getThursdayWeek 함수). 매주 목요일 리셋.');

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 4. 직무테스트-메이
// ═══════════════════════════════════════════════════════
function buildSheet04(ss) {
  var s = ss.insertSheet('4.직무테스트-메이');
  var r = 1;

  r = writeSection(s, r, '직무테스트 / Quiz (메이 담당)');
  r = writeNote(s, r, 'KMCC Quiz 시스템 연동. 상담사 직무 지식 평가 점수를 대시보드에 표시.');
  r++;

  r = writeSubSection(s, r, '시스템 연동');
  r = writeHeaders(s, r, ['항목', '내용']);
  r = writeRows(s, r, [
    ['Quiz 시스템', 'https://kmcc-quiz.onkm.co.kr (Flask + BigQuery)'],
    ['데이터소스', 'BigQuery quiz_results 데이터셋'],
    ['통합 가중치', '15% (QA 30% + QC 30% + CSAT 25% + Quiz 15%)'],
    ['용도', '상담사 직무지식 수준 파악, 교육 필요도 산출'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Quiz 컴포넌트 (5개) - 구현 완료');
  r = writeHeaders(s, r, ['컴포넌트', '역할']);
  r = writeRows(s, r, [
    ['quiz-overview-section.tsx', '전체 요약 (평균점수, 응시율 등)'],
    ['quiz-agent-table.tsx', '상담사별 점수 테이블'],
    ['quiz-score-trend-chart.tsx', '점수 추이 차트'],
    ['quiz-service-trend.tsx', '서비스별 추이'],
    ['index.tsx', '메인 래퍼'],
  ]);
  r++;

  r = writeSubSection(s, r, 'BQ 함수 (4개) - 구현 완료');
  r = writeHeaders(s, r, ['함수명', '역할']);
  r = writeRows(s, r, [
    ['getQuizDashboardStats()', '전체 통계'],
    ['getQuizScoreTrend()', '점수 추이 조회'],
    ['getQuizAgentStats()', '상담사별 점수'],
    ['getQuizServiceTrend()', '서비스별 추이'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 5. Cobb-생산성 요구사항
// ═══════════════════════════════════════════════════════
function buildSheet05(ss) {
  var s = ss.insertSheet('5.Cobb-생산성요구사항');
  var r = 1;

  r = writeSection(s, r, '생산성 지표 요구사항 (Cobb 작성)', '#0d652d');
  r = writeNote(s, r, '노란색 셀([입력])을 채워주세요. 모르는 항목은 "미정"으로 적어도 됩니다.');
  r++;

  r = writeSubSection(s, r, '이미 구현된 뼈대 (참고용)');
  r = writeNote(s, r, '아래 항목들은 코드에 이미 뼈대가 있습니다. 계산식/목표만 확인해주세요.');
  r = writeHeaders(s, r, ['채널', '구현된 함수', '컴포넌트', '상태']);
  r = writeRows(s, r, [
    ['음성', 'getVoiceProductivity(), getVoiceHandlingTime(), getVoiceDailyTrend()', 'voice-detail.tsx', '뼈대 완료'],
    ['채팅', 'getChatProductivity(), getChatDailyTrend()', 'chat-detail.tsx', '뼈대 완료'],
    ['게시판', 'getBoardProductivity()', 'board-detail.tsx', '뼈대 완료'],
    ['주간요약', 'getWeeklySummary()', 'weekly-summary.tsx', '뼈대 완료'],
    ['외국어', 'getForeignLanguageProductivity()', 'foreign-language.tsx', '뼈대 완료'],
    ['전체', '-', 'overview.tsx + index.tsx', '뼈대 완료'],
  ]);
  r++;

  r = writeSubSection(s, r, 'A. 음성 (Voice) 생산성 지표');
  r = writeHeaders(s, r, ['지표', '현재 계산식', '맞나요?', '수정할 내용', '목표(용산)', '목표(광주)']);
  r = writeRows(s, r, [
    ['응대율', '응대건수/총인입건수 x 100', '[확인]', '[입력]', '[입력]', '[입력]'],
    ['CPH', '처리건수/근무시간', '[확인]', '[입력]', '[입력]', '[입력]'],
    ['CPD', '일일 처리건수', '[확인]', '[입력]', '[입력]', '[입력]'],
    ['ATT (평균통화시간)', '총통화시간/통화건수', '[확인]', '[입력]', '[입력]', '[입력]'],
    ['ACW (후처리시간)', '총후처리시간/처리건수', '[확인]', '[입력]', '[입력]', '[입력]'],
    ['Hold Time', '총대기시간/대기건수', '[확인]', '[입력]', '[입력]', '[입력]'],
  ]);
  r++;

  r = writeSubSection(s, r, 'B. 채팅 (Chat) 생산성 지표');
  r = writeHeaders(s, r, ['지표', '계산식', '목표(용산)', '목표(광주)', '비고']);
  r = writeRows(s, r, [
    ['동시 처리건수', '[입력]', '[입력]', '[입력]', ''],
    ['응답시간', '[입력]', '[입력]', '[입력]', ''],
    ['처리시간', '[입력]', '[입력]', '[입력]', ''],
    ['일일 처리건수', '[입력]', '[입력]', '[입력]', ''],
    ['[추가 지표]', '[입력]', '[입력]', '[입력]', ''],
  ]);
  r++;

  r = writeSubSection(s, r, 'C. 게시판 (Board) 생산성 지표');
  r = writeHeaders(s, r, ['지표', '계산식', '목표(용산)', '목표(광주)', '비고']);
  r = writeRows(s, r, [
    ['일일 처리건수', '[입력]', '[입력]', '[입력]', ''],
    ['평균 처리시간', '[입력]', '[입력]', '[입력]', ''],
    ['[추가 지표]', '[입력]', '[입력]', '[입력]', ''],
  ]);
  r++;

  r = writeSubSection(s, r, 'D. 외국어 생산성 지표');
  r = writeHeaders(s, r, ['지표', '계산식', '목표', '비고']);
  r = writeRows(s, r, [
    ['일일 처리건수', '[입력]', '[입력]', ''],
    ['지원 언어 목록', '[입력]', '-', '예: 영어, 중국어, 일본어'],
    ['[추가 지표]', '[입력]', '[입력]', ''],
  ]);
  r++;

  r = writeSubSection(s, r, 'E. SLA 연계 (Dean과 협의 필요)');
  r = writeHeaders(s, r, ['항목', '내용']);
  r = writeRows(s, r, [
    ['SLA 생산성 점수 배점', '현재 60점 (맞나요?): [확인]'],
    ['생산성->SLA 반영 항목', '[입력] 어떤 지표가 SLA에 반영되나요?'],
    ['가중치', '[입력] 각 지표별 가중치?'],
  ]);
  r++;

  r = writeSubSection(s, r, 'F. 데이터 소스');
  r = writeHeaders(s, r, ['항목', '내용']);
  r = writeRows(s, r, [
    ['데이터 출처', '[입력] CTI? ACD? 어떤 시스템에서?'],
    ['갱신 주기', '[입력] 실시간? 일 1회? 주 1회?'],
    ['현재 BigQuery 테이블', 'productivity_daily (이미 존재)'],
    ['추가 필요 테이블', '[입력]'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 6. Cobb-생산성 코딩가이드
// ═══════════════════════════════════════════════════════
function buildSheet06(ss) {
  var s = ss.insertSheet('6.Cobb-생산성코딩가이드');
  var r = 1;

  r = writeSection(s, r, '생산성 코드 수정 가이드 (Cobb)', '#0d652d');
  r = writeNote(s, r, 'Gemini CLI로 코드를 직접 수정할 때 참고하세요.');
  r++;

  r = writeSubSection(s, r, '수정 가능한 파일 (자유롭게 수정 OK)');
  r = writeHeaders(s, r, ['파일', '역할', '수정 빈도', '구현 상태']);
  r = writeRows(s, r, [
    ['lib/constants.ts', '생산성 관련 상수 (목표, 기준값)', '자주', '뼈대 있음'],
    ['lib/bigquery-productivity.ts', '생산성 BQ 쿼리 (8개 함수)', '가끔', '8개 함수 구현됨'],
    ['components/qc/productivity-dashboard/overview.tsx', '전체 요약 UI', '가끔', '뼈대 있음'],
    ['components/qc/productivity-dashboard/voice-detail.tsx', '음성 상세', '가끔', '뼈대 있음'],
    ['components/qc/productivity-dashboard/chat-detail.tsx', '채팅 상세', '가끔', '뼈대 있음'],
    ['components/qc/productivity-dashboard/board-detail.tsx', '게시판 상세', '가끔', '뼈대 있음'],
    ['components/qc/productivity-dashboard/weekly-summary.tsx', '주간 요약', '가끔', '뼈대 있음'],
    ['components/qc/productivity-dashboard/foreign-language.tsx', '외국어', '드물게', '뼈대 있음'],
    ['hooks/use-productivity-data.ts', '데이터 페칭 hook', '드물게', '구현됨'],
  ]);
  r++;

  r = writeSubSection(s, r, '건드리면 안 되는 파일 (메이 관리)');
  r = writeHeaders(s, r, ['파일', '이유']);
  r = writeRows(s, r, [
    ['lib/bigquery.ts', 'BigQuery 연결 공통 모듈 (전체 공유)'],
    ['lib/types.ts', '전체 타입 정의 (수정 시 메이와 상의)'],
    ['lib/predictions.ts', '예측 알고리즘 (메이 전용)'],
    ['app/page.tsx', '메인 페이지 라우팅'],
    ['components/ui/*', 'shadcn/ui 공통 컴포넌트'],
    ['.env.local', '환경변수 (절대 커밋 금지!)'],
    ['lib/bigquery-qa.ts', '리샬 담당 영역'],
    ['lib/bigquery-csat.ts', '리샬 담당 영역'],
    ['lib/bigquery-sla.ts', 'Dean 담당 영역'],
  ]);
  r++;

  r = writeSubSection(s, r, '구현된 BQ 함수 목록 (bigquery-productivity.ts)');
  r = writeHeaders(s, r, ['함수명', '라인', '역할']);
  r = writeRows(s, r, [
    ['getVoiceProductivity()', ':94', '음성 생산성 조회'],
    ['getVoiceHandlingTime()', ':199', '음성 처리시간'],
    ['getVoiceDailyTrend()', ':334', '음성 일별 추이'],
    ['getChatProductivity()', ':398', '채팅 생산성'],
    ['getChatDailyTrend()', ':554', '채팅 일별 추이'],
    ['getBoardProductivity()', ':642', '게시판 생산성'],
    ['getWeeklySummary()', ':735', '주간 요약'],
    ['getForeignLanguageProductivity()', ':906', '외국어'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Gemini 프롬프트 예시');
  r = writeNote(s, r, '"lib/constants.ts에서 PRODUCTIVITY_TARGETS를 찾아서 CPH 목표를 12에서 15로 변경해줘. 다른 건 건드리지 마."');
  r = writeNote(s, r, '"lib/bigquery-productivity.ts의 getVoiceProductivity() 쿼리에 service_type 필터를 추가해줘."');
  r++;

  r = writeSubSection(s, r, '빌드 & 커밋');
  r = writeNote(s, r, '1. npm run build -- --webpack  2. npm run dev  3. git add [파일] && git commit  4. git push');

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 7. Dean-SLA 요구사항
// ═══════════════════════════════════════════════════════
function buildSheet07(ss) {
  var s = ss.insertSheet('7.Dean-SLA요구사항');
  var r = 1;

  r = writeSection(s, r, 'SLA 평가 지표 요구사항 (Dean 작성)', '#c5221f');
  r = writeNote(s, r, '노란색 셀([입력])을 채워주세요. 모르는 항목은 "미정"으로 적어도 됩니다.');
  r++;

  r = writeSubSection(s, r, '이미 구현된 뼈대 (참고용)');
  r = writeHeaders(s, r, ['구현된 함수', '컴포넌트', '역할', '상태']);
  r = writeRows(s, r, [
    ['getSLAScorecard()', 'scorecard.tsx', '종합 스코어카드', '뼈대 완료'],
    ['getSLAMonthlyTrend()', 'monthly-trend.tsx', '월별 추이', '뼈대 완료'],
    ['getSLADailyTracking()', 'daily-tracking.tsx', '일별 트래킹', '뼈대 완료'],
    ['-', 'overview.tsx', '전체 개요', '뼈대 완료'],
    ['-', 'grade-distribution.tsx', '등급 분포', '뼈대 완료'],
    ['-', 'config.tsx + index.tsx', '설정/래퍼', '뼈대 완료'],
  ]);
  r++;

  r = writeSubSection(s, r, 'A. SLA 종합 점수 구조');
  r = writeHeaders(s, r, ['영역', '현재 배점', '맞나요?', '수정할 배점', '비고']);
  r = writeRows(s, r, [
    ['생산성 점수', '60점', '[확인]', '[입력]', ''],
    ['품질 점수', '40점', '[확인]', '[입력]', ''],
    ['인력관리 가/감점', '별도', '[확인]', '[입력]', ''],
    ['기타 가/감점', '별도', '[확인]', '[입력]', ''],
    ['합계', '100점 + 가감', '-', '-', ''],
  ]);
  r++;

  r = writeSubSection(s, r, 'B. 등급 기준');
  r = writeHeaders(s, r, ['등급', '기준점수', '인센티브/패널티']);
  r = writeRows(s, r, [
    ['S', '[입력]', '[입력]'], ['A', '[입력]', '[입력]'],
    ['B', '[입력]', '[입력]'], ['C', '[입력]', '[입력]'],
    ['D', '[입력]', '[입력]'], ['E', '[입력]', '[입력]'],
  ]);
  r++;

  r = writeSubSection(s, r, 'C. 생산성 항목 상세 (60점 내)');
  r = writeHeaders(s, r, ['세부 항목', '배점', '계산식', '데이터 출처']);
  r = writeRows(s, r, [
    ['[항목1]', '[입력]', '[입력]', '[입력]'],
    ['[항목2]', '[입력]', '[입력]', '[입력]'],
    ['[항목3]', '[입력]', '[입력]', '[입력]'],
    ['[항목4]', '[입력]', '[입력]', '[입력]'],
    ['[항목5]', '[입력]', '[입력]', '[입력]'],
  ]);
  r++;

  r = writeSubSection(s, r, 'D. 품질 항목 상세 (40점 내)');
  r = writeHeaders(s, r, ['세부 항목', '배점', '계산식', '데이터 출처']);
  r = writeRows(s, r, [
    ['QC 오류율', '[입력]', '[입력]', 'BigQuery evaluations'],
    ['QA 평균점수', '[입력]', '[입력]', 'BigQuery qa_evaluations'],
    ['CSAT 평점', '[입력]', '[입력]', 'BigQuery dw_review'],
    ['[추가 항목]', '[입력]', '[입력]', '[입력]'],
  ]);
  r++;

  r = writeSubSection(s, r, 'E. 평가 주기 및 대상');
  r = writeHeaders(s, r, ['항목', '내용']);
  r = writeRows(s, r, [
    ['평가 주기', '[입력] 월별? 분기별?'],
    ['평가 대상', '[입력] 개인? 팀? 센터?'],
    ['결과 공개 시점', '[입력]'],
    ['이의 제기 절차', '[입력]'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 8. Dean-SLA 코딩가이드
// ═══════════════════════════════════════════════════════
function buildSheet08(ss) {
  var s = ss.insertSheet('8.Dean-SLA코딩가이드');
  var r = 1;

  r = writeSection(s, r, 'SLA 코드 수정 가이드 (Dean)', '#c5221f');
  r = writeNote(s, r, 'Gemini CLI로 코드를 직접 수정할 때 참고하세요.');
  r++;

  r = writeSubSection(s, r, '수정 가능한 파일 (자유롭게 수정 OK)');
  r = writeHeaders(s, r, ['파일', '역할', '수정 빈도', '구현 상태']);
  r = writeRows(s, r, [
    ['lib/constants.ts', 'SLA 관련 상수 (등급기준, 배점)', '자주', '뼈대 있음'],
    ['lib/bigquery-sla.ts', 'SLA BQ 쿼리 (3개 함수)', '가끔', '3개 함수 구현됨'],
    ['components/qc/sla-dashboard/overview.tsx', '전체 개요', '가끔', '뼈대 있음'],
    ['components/qc/sla-dashboard/scorecard.tsx', '스코어카드', '가끔', '뼈대 있음'],
    ['components/qc/sla-dashboard/monthly-trend.tsx', '월별 추이', '가끔', '뼈대 있음'],
    ['components/qc/sla-dashboard/daily-tracking.tsx', '일별 트래킹', '가끔', '뼈대 있음'],
    ['components/qc/sla-dashboard/grade-distribution.tsx', '등급 분포', '드물게', '뼈대 있음'],
    ['components/qc/sla-dashboard/config.tsx', 'SLA 설정', '드물게', '뼈대 있음'],
    ['hooks/use-sla-data.ts', '데이터 페칭 hook', '드물게', '구현됨'],
  ]);
  r++;

  r = writeSubSection(s, r, '건드리면 안 되는 파일 (메이 관리)');
  r = writeHeaders(s, r, ['파일', '이유']);
  r = writeRows(s, r, [
    ['lib/bigquery.ts', 'BigQuery 연결 공통 모듈'],
    ['lib/types.ts', '전체 타입 정의 (수정 시 메이와 상의)'],
    ['lib/predictions.ts', '예측 알고리즘'],
    ['app/page.tsx', '메인 페이지 라우팅'],
    ['components/ui/*', 'shadcn/ui 공통 컴포넌트'],
    ['.env.local', '환경변수 (절대 커밋 금지!)'],
    ['lib/bigquery-productivity.ts', 'Cobb 담당 영역'],
    ['lib/bigquery-qa.ts', '리샬 담당 영역'],
  ]);
  r++;

  r = writeSubSection(s, r, '구현된 BQ 함수 (bigquery-sla.ts)');
  r = writeHeaders(s, r, ['함수명', '라인', '역할']);
  r = writeRows(s, r, [
    ['getSLAScorecard()', ':31', '종합 스코어카드 조회'],
    ['getSLAMonthlyTrend()', ':153', '월별 추이 조회'],
    ['getSLADailyTracking()', ':198', '일별 트래킹 조회'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Gemini 프롬프트 예시');
  r = writeNote(s, r, '"lib/constants.ts에서 SLA_GRADES를 찾아서 S등급 기준을 95점에서 97점으로 변경해줘."');
  r = writeNote(s, r, '"lib/bigquery-sla.ts에서 getSLAScorecard()의 생산성 배점을 60에서 55로 변경해줘."');
  r++;

  r = writeSubSection(s, r, '빌드 & 커밋');
  r = writeNote(s, r, '1. npm run build -- --webpack  2. npm run dev  3. git add [파일] && git commit  4. git push');

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 9. 리샬-QA+CSAT 요구사항
// ═══════════════════════════════════════════════════════
function buildSheet09(ss) {
  var s = ss.insertSheet('9.리샬-QACSAT요구사항');
  var r = 1;

  r = writeSection(s, r, 'QA 상담평점 + CSAT 고객만족 요구사항 (리샬 작성)', '#7b1fa2');
  r = writeNote(s, r, '노란색 셀을 채워주세요. 구현 완료 항목은 확인만 해주세요.');
  r++;

  r = writeSubSection(s, r, 'Part A. QA 상담평점 (구현완료: 6컴포넌트 + 8 BQ함수)');
  r++;
  r = writeHeaders(s, r, ['항목(key)', '항목명', '만점', '채널', '맞나요?', '수정할 내용']);
  var qaItems = [
    ['greeting', '인사', 10, 'voice'], ['speakingSpeed', '말속도', 5, 'voice'],
    ['endGreeting', '종료인사', 5, 'voice'], ['speakingTone', '말투/표현', 5, 'voice'],
    ['listening', '경청', 5, 'voice'], ['empathy', '공감표현', 5, 'voice'],
    ['holdNotice', '보류안내', 5, 'voice'], ['scriptCompliance', '스크립트 준수', 10, 'common'],
    ['businessKnowledge', '업무지식', 15, 'common'], ['counselAccuracy', '상담정확도', 10, 'common'],
    ['chatGreeting', '채팅인사', 10, 'chat'], ['chatEndGreeting', '채팅 종료인사', 5, 'chat'],
    ['chatExpression', '채팅 표현', 5, 'chat'], ['responseSpeed', '응답속도', 10, 'chat'],
    ['chatListening', '채팅 경청', 5, 'chat'], ['chatEmpathy', '채팅 공감표현', 5, 'chat'],
    ['chatHoldNotice', '채팅 보류안내', 5, 'chat'],
    ['wrongService', '오서비스안내', '-', 'common'], ['wrongProcess', '오프로세스안내', '-', 'common'],
    ['wrongFee', '오요금안내', '-', 'common'], ['wrongPolicy', '오정책안내', '-', 'common'],
    ['wrongOther', '기타 오안내', '-', 'common'],
  ];
  qaItems.forEach(function(item) {
    r = writeRows(s, r, [[item[0], item[1], item[2], item[3], '[확인]', '[입력]']]);
  });
  r++;

  r = writeSubSection(s, r, 'QA 등급 기준');
  r = writeHeaders(s, r, ['등급', '현재 최소점', '맞나요?', '수정']);
  r = writeRows(s, r, [
    ['탁월', 97, '[확인]', '[입력]'], ['우수', 92, '[확인]', '[입력]'],
    ['양호', 85, '[확인]', '[입력]'], ['보통', 70, '[확인]', '[입력]'],
    ['미흡', 0, '[확인]', '[입력]'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Part B. CSAT 고객만족 (구현완료: 7컴포넌트 + 7 BQ함수)');
  r++;
  r = writeHeaders(s, r, ['항목', '현재 설정', '맞나요?', '수정할 내용']);
  r = writeRows(s, r, [
    ['목표 평점', '4.5점', '[확인]', '[입력]'],
    ['저점 기준', '3.0점 이하', '[확인]', '[입력]'],
    ['저점 주간 임계', '주 3건 이상', '[확인]', '[입력]'],
    ['저점 월간 임계', '월 12건 이상', '[확인]', '[입력]'],
    ['데이터 소스', 'dataanalytics-25f2.dw_review.review', '[확인]', ''],
  ]);
  r++;

  r = writeSubSection(s, r, 'CSAT 서비스 매핑 (13개)');
  r = writeHeaders(s, r, ['incoming_path', '현재 매핑', '맞나요?', '수정']);
  r = writeRows(s, r, [
    ['c2_kakaot', '택시', '[확인]', '[입력]'],
    ['c2_kakaopark', '주차', '[확인]', '[입력]'],
    ['c2_kakaobus', '버스/지하철', '[확인]', '[입력]'],
    ['c2_kakaobike', '바이크', '[확인]', '[입력]'],
    ['c2_kakaonavi', '내비', '[확인]', '[입력]'],
    ['c2_kakaotrain', '기차', '[확인]', '[입력]'],
    ['c2_kakaodrive', '대리', '[확인]', '[입력]'],
    ['c2_kakaobill', '결제', '[확인]', '[입력]'],
    ['c2_kakaomobility', '모빌리티(기타)', '[확인]', '[입력]'],
    ['[미매핑: c2_kakaot_app 등]', '[입력] 어디에 매핑?', '-', '376K건 존재'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Part C. 통합 우선순위');
  r = writeHeaders(s, r, ['우선순위', '내용', '상태']);
  r = writeRows(s, r, [
    ['1', 'QA 항목/등급/배점 확인 및 확정', '[입력]'],
    ['2', 'CSAT 서비스 매핑 확정 (미매핑 처리)', '[입력]'],
    ['3', 'CSAT 저점 기준 확정', '[입력]'],
    ['4', 'QA+CSAT 통합 가중치 (현재 QA30%+CSAT25%)', '[입력]'],
    ['5', '신입 상담사 별도 기준 필요 여부', '[입력]'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 10. 리샬-QA+CSAT 코딩가이드
// ═══════════════════════════════════════════════════════
function buildSheet10(ss) {
  var s = ss.insertSheet('10.리샬-QACSAT코딩가이드');
  var r = 1;

  r = writeSection(s, r, 'QA+CSAT 코드 수정 가이드 (리샬)', '#7b1fa2');
  r = writeNote(s, r, '상세 가이드: docs/onboarding-kit/requirements/coding-guide-리샬.md');
  r++;

  r = writeSubSection(s, r, '수정 가능한 파일 (자유롭게 수정 OK)');
  r = writeHeaders(s, r, ['파일', '역할', '구현 상태']);
  r = writeRows(s, r, [
    ['lib/constants.ts', 'QA 항목, 등급, CSAT 목표, 가중치', '구현 완료'],
    ['lib/bigquery-qa.ts', 'QA BQ 쿼리 (8개 함수, 471줄)', '구현 완료'],
    ['lib/bigquery-csat.ts', 'CSAT BQ 쿼리 (7개 함수)', '구현 완료'],
    ['components/qc/qa-dashboard/* (6개)', 'QA 대시보드 UI', '구현 완료'],
    ['components/qc/csat-dashboard/* (7개)', 'CSAT 대시보드 UI', '구현 완료'],
    ['hooks/use-qa-dashboard-data.ts', 'QA 데이터 hook', '구현 완료'],
    ['lib/qa-sheets.ts', 'QA Sheets 파서', '구현 완료'],
  ]);
  r++;

  r = writeSubSection(s, r, '건드리면 안 되는 파일 (메이 관리)');
  r = writeHeaders(s, r, ['파일', '이유']);
  r = writeRows(s, r, [
    ['lib/bigquery.ts', 'BigQuery 연결 공통 모듈'],
    ['lib/types.ts', '전체 타입 정의 (수정 시 메이와 상의)'],
    ['lib/predictions.ts', '예측 알고리즘'],
    ['app/page.tsx', '메인 페이지 라우팅'],
    ['components/ui/*', 'shadcn/ui 공통 컴포넌트'],
    ['.env.local', '환경변수 (절대 커밋 금지!)'],
    ['lib/bigquery-productivity.ts', 'Cobb 담당 영역'],
    ['lib/bigquery-sla.ts', 'Dean 담당 영역'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Gemini 프롬프트 예시');
  r = writeHeaders(s, r, ['작업', '프롬프트']);
  r = writeRows(s, r, [
    ['QA 배점 변경', '"lib/constants.ts QA_EVALUATION_ITEMS의 businessKnowledge maxScore를 15->20으로"'],
    ['QA 등급 변경', '"lib/constants.ts QA_SCORE_GRADES의 우수 min을 92->95로"'],
    ['CSAT 목표 변경', '"lib/constants.ts CSAT_TARGET_SCORE를 4.5->4.7로"'],
    ['서비스 매핑 추가', '"lib/bigquery-csat.ts SERVICE_PATH_SQL에 c2_kakaot_app->택시 추가"'],
    ['저점 기준 변경', '"lib/constants.ts UNDERPERFORMING_CRITERIA csat_low_score threshold 3->5로"'],
    ['가중치 변경', '"lib/constants.ts RISK_WEIGHTS qa 0.30->0.35, csat 0.25->0.20으로"'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 11. 품질 전체 구조
// ═══════════════════════════════════════════════════════
function buildSheet11(ss) {
  var s = ss.insertSheet('11.품질전체구조');
  var r = 1;

  r = writeSection(s, r, '품질관리 통합 구조', '#e65100');
  r++;

  r = writeSubSection(s, r, 'A. 통합 위험도 가중치');
  r = writeHeaders(s, r, ['유형', 'QA', 'QC', 'CSAT', 'Quiz', '합계']);
  r = writeRows(s, r, [
    ['기본 가중치', '30%', '30%', '25%', '15%', '100%'],
    ['음성 채널', '25%', '35%', '25%', '15%', '100%'],
    ['채팅 채널', '30%', '30%', '30%', '10%', '100%'],
    ['신입 (3개월 이하)', '20%', '40%', '15%', '25%', '100%'],
  ]);
  r++;

  r = writeSubSection(s, r, 'B. 위험도 (Risk) 등급');
  r = writeHeaders(s, r, ['등급', '점수 범위', '의미', '조치']);
  r = writeRows(s, r, [
    ['자립', '0 ~ 30', '자율 관리 가능', '모니터링만'],
    ['관찰', '30 ~ 50', '경미한 주의 필요', '주간 확인'],
    ['집중', '50 ~ 70', '적극적 개입 필요', '주 2회 코칭'],
    ['긴급', '70 ~ 100', '즉각 대응 필요', '매일 코칭 + 관리자 보고'],
  ]);
  r++;

  r = writeSubSection(s, r, 'C. QC 오류율 계산');
  r = writeHeaders(s, r, ['유형', '공식', '분모 설명']);
  r = writeRows(s, r, [
    ['태도 오류율', '태도오류건수 / (검수건수 x 5) x 100', '검수 1건 = 5개 태도 항목'],
    ['오상담 오류율', '오상담오류건수 / (검수건수 x 11) x 100', '검수 1건 = 11개 오상담 항목'],
    ['보정(소표본)', 'Bayesian Shrinkage 적용', '표본 < 30건 시 전체평균으로 축소'],
  ]);
  r++;

  r = writeSubSection(s, r, 'D. 코칭 카테고리 (8개)');
  r = writeHeaders(s, r, ['카테고리', 'QC 항목', 'QA 항목', '설명']);
  r = writeRows(s, r, [
    ['인사/응대', 'attitude_greeting', 'greeting, endGreeting', '인사말'],
    ['말투/표현', 'attitude_speaking', 'speakingTone, speakingSpeed', '말하기 품질'],
    ['경청/공감', 'attitude_empathy', 'listening, empathy', '공감 능력'],
    ['보류/대기', 'attitude_hold', 'holdNotice', '보류 안내'],
    ['업무지식', 'wrong_service, wrong_process', 'businessKnowledge', '정확성'],
    ['요금안내', 'wrong_fee', '-', '요금 오안내'],
    ['정책안내', 'wrong_policy', '-', '정책 오안내'],
    ['스크립트', '-', 'scriptCompliance', '스크립트 준수'],
  ]);
  r++;

  r = writeSubSection(s, r, 'E. 부진상담사 판정 (4가지)');
  r = writeHeaders(s, r, ['기준', '판정 조건', '해제 조건']);
  r = writeRows(s, r, [
    ['QC 오류율 연속', '3주 연속 목표 초과', '2주 연속 목표 이내'],
    ['QA 점수 하위', '하위 10% (2주 연속)', '상위 30% 회복'],
    ['CSAT 저점', '주 3건 이상 저점 리뷰', '주 3건 미만'],
    ['Quiz 저조', '60점 미만 (2회 연속)', '70점 이상 달성'],
  ]);
  r = writeNote(s, r, '동시 3개 기준 해당 OR 3주 연속 해당 -> "저품질 상담사" 지정');
  r++;

  r = writeSubSection(s, r, 'F. 주간 리포트 사이클 (목~수 기준)');
  r = writeHeaders(s, r, ['단계', '시점', '내용']);
  r = writeRows(s, r, [
    ['1단계 (월초)', '매월 1주차', '전월 결산, 이달 목표, 전월 부진자'],
    ['2단계 (2주차)', '매월 2주차', '1주 실적, 조기경보, 코칭 시작'],
    ['3단계 (3주차)', '매월 3주차', '누적 추이, Gap 분석, 월말 예측'],
    ['4단계 (월말)', '매월 4주차', '최종 결산, 등급 확정, 다음달 계획'],
  ]);
  r++;

  r = writeSubSection(s, r, 'G. 신입 상담사 관리');
  r = writeHeaders(s, r, ['항목', '내용']);
  r = writeRows(s, r, [
    ['정의', '입사 3개월 이하'],
    ['별도 가중치', 'QA20% + QC40% + CSAT15% + Quiz25%'],
    ['목표 완화', '일반 목표의 120% (20% 완화)'],
    ['판정 유예', '부진 판정 1개월 유예'],
    ['코칭 주기', '주 1회 필수'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 12. 4-View 설계
// ═══════════════════════════════════════════════════════
function buildSheet12(ss) {
  var s = ss.insertSheet('12.4View설계');
  var r = 1;

  r = writeSection(s, r, '4-View 권한별 대시보드 설계', '#006064');
  r = writeNote(s, r, '각 사용자 역할별로 볼 수 있는 화면과 데이터 범위를 설계합니다.');
  r++;

  r = writeSubSection(s, r, 'View 1. HQ 관리자 (메인) - /');
  r = writeHeaders(s, r, ['탭/영역', '내용', '데이터 범위', '상태']);
  r = writeRows(s, r, [
    ['QC 상담품질', '오류율 추이, 목표달성, 센터비교, 항목분석', '전체 센터', '완료'],
    ['QA 상담평점', 'QA점수, 등급분포, 항목별, 상담사 성과', '전체 센터', '완료'],
    ['CSAT 고객만족', '평점추이, 서비스별, 저점상세, 태그분석', '전체 센터', '완료'],
    ['생산성', '음성/채팅/게시판 지표, 외국어', '전체 센터', '뼈대'],
    ['SLA 평가', '스코어카드, 등급분포, 추이', '전체 센터', '뼈대'],
    ['직무테스트', '평균점수, 응시율, 상담사별', '전체 센터', '완료'],
    ['통합분석', '위험도, 코칭, 부진자 종합', '전체 센터', '진행중'],
  ]);
  r = writeNote(s, r, '권한: 모든 데이터 조회 + 수정 + 설정 변경');
  r++;

  r = writeSubSection(s, r, 'View 2. 센터장/강사 - /instructor');
  r = writeHeaders(s, r, ['탭/영역', '내용', '범위', '상태']);
  r = writeRows(s, r, [
    ['센터 요약', '담당 센터 KPI (QC+QA+CSAT+생산성)', '담당 센터', '[입력]'],
    ['상담사 현황', '담당 상담사 성과 목록', '담당 센터', '[입력]'],
    ['코칭 관리', '코칭 계획 작성/확인, 이력', '담당 센터', '[입력]'],
    ['부진상담사', '부진자 목록 + 개선 진행률', '담당 센터', '[입력]'],
    ['주간 리포트', '센터 주간 분석 리포트', '담당 센터', '[입력]'],
    ['SLA', '센터 SLA 등급/점수', '담당 센터', '[입력]'],
  ]);
  r = writeNote(s, r, '권한: 담당 센터 데이터 조회 + 코칭 입력. 타 센터 접근 불가.');
  r++;

  r = writeSubSection(s, r, 'View 3. 관리자 - /manager');
  r = writeHeaders(s, r, ['탭/영역', '내용', '범위', '상태']);
  r = writeRows(s, r, [
    ['팀 요약', '담당 팀 KPI 요약', '담당 팀', '[입력]'],
    ['상담사 목록', '팀원 성과 비교 테이블', '담당 팀', '[입력]'],
    ['QC 상세', '팀 QC 오류율 + 항목별', '담당 팀', '[입력]'],
    ['코칭 기록', '팀원 코칭 기록 작성/조회', '담당 팀', '[입력]'],
    ['부진 관리', '팀 부진자 + 일일 체크리스트', '담당 팀', '[입력]'],
  ]);
  r = writeNote(s, r, '권한: 담당 팀 조회 + 코칭 기록 입력. 센터 전체 접근 불가.');
  r++;

  r = writeSubSection(s, r, 'View 4. 상담사 - /mypage');
  r = writeHeaders(s, r, ['탭/영역', '내용', '범위', '상태']);
  r = writeRows(s, r, [
    ['내 성과 요약', 'QC+QA+CSAT+Quiz 종합 점수', '본인', '진행중'],
    ['QC 상세', '내 오류율 추이, 항목별 내역', '본인', '진행중'],
    ['QA 상세', '내 QA 점수, 등급, 항목별', '본인', '진행중'],
    ['CSAT 상세', '내 평점, 리뷰 내역, 저점', '본인', '진행중'],
    ['직무테스트', '내 Quiz 점수, 응시 이력', '본인', '진행중'],
    ['코칭 내역', '받은 코칭 이력 확인', '본인', '진행중'],
    ['개선 계획', '개인 목표 + 진행률', '본인', '진행중'],
    ['위험도', '내 위험도 등급 + 추이', '본인', '진행중'],
  ]);
  r = writeNote(s, r, '권한: 본인 데이터만 조회. 수정/설정 불가.');
  r++;

  r = writeSubSection(s, r, '권한 매트릭스');
  r = writeHeaders(s, r, ['기능', 'HQ관리자', '센터장', '관리자', '상담사']);
  r = writeRows(s, r, [
    ['전체 센터 데이터', 'O', 'X', 'X', 'X'],
    ['담당 센터 데이터', 'O', 'O', 'X', 'X'],
    ['담당 팀 데이터', 'O', 'O', 'O', 'X'],
    ['본인 데이터', 'O', 'O', 'O', 'O'],
    ['목표 설정', 'O', 'X', 'X', 'X'],
    ['코칭 입력', 'O', 'O', 'O', 'X'],
    ['부진자 판정', 'O', 'O (확인)', 'X', 'X'],
    ['시스템 설정', 'O', 'X', 'X', 'X'],
    ['데이터 내보내기', 'O', 'O', 'X', 'X'],
  ]);
  r++;

  r = writeSubSection(s, r, '설계 결정 필요 사항');
  r = writeHeaders(s, r, ['#', '질문', '결정']);
  r = writeRows(s, r, [
    [1, '센터장이 다른 센터 데이터 비교 가능?', '[입력]'],
    [2, '관리자가 센터 전체 요약 볼 수 있게 할지?', '[입력]'],
    [3, '상담사 마이페이지에 팀 내 순위 노출?', '[입력]'],
    [4, '코칭 기록을 상담사가 볼 수 있는 범위?', '[입력]'],
    [5, '부진 판정 결과를 본인에게 공개?', '[입력]'],
    [6, '인증 방식: 사내 SSO? Firebase? 별도?', '[입력]'],
    [7, '모바일 반응형 필요 범위?', '[입력]'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 13. 온보딩 - 환경설정 가이드
// ═══════════════════════════════════════════════════════
function buildSheet13(ss) {
  var s = ss.insertSheet('13.온보딩-환경설정');
  var r = 1;

  r = writeSection(s, r, '온보딩 - 개발 환경 설정 가이드', '#00695c');
  r = writeNote(s, r, '처음 프로젝트에 참여하는 동료를 위한 단계별 환경설정. 원본: docs/onboarding-kit/ONBOARDING.md');
  r++;

  r = writeSubSection(s, r, '1. 사전 준비물');
  r = writeHeaders(s, r, ['도구', '버전', '설치 방법']);
  r = writeRows(s, r, [
    ['Node.js', '18 이상', 'https://nodejs.org/ → LTS 버전'],
    ['Git', '최신', 'Mac: xcode-select --install / Windows: git-scm.com'],
    ['Google Cloud CLI', '최신', 'https://cloud.google.com/sdk/docs/install'],
    ['VS Code (권장)', '최신', 'https://code.visualstudio.com/'],
  ]);
  r++;

  r = writeSubSection(s, r, '설치 확인 명령어');
  r = writeHeaders(s, r, ['명령어', '기대 결과']);
  r = writeRows(s, r, [
    ['node -v', 'v18.x.x 이상'],
    ['npm -v', '9.x.x 이상'],
    ['git --version', '설치 확인'],
    ['gcloud --version', '설치 확인'],
  ]);
  r++;

  r = writeSubSection(s, r, '2. 코드 받기 (Git Clone)');
  r = writeHeaders(s, r, ['단계', '명령어', '설명']);
  r = writeRows(s, r, [
    ['1', 'cd ~/Desktop', '원하는 폴더로 이동'],
    ['2', 'git clone https://github.kakaocorp.com/csopp/komi.git', '코드 다운로드'],
    ['3', 'cd komi', '프로젝트 폴더 이동'],
  ]);
  r = writeNote(s, r, 'GitHub 접근 권한이 없으면 메이에게 GitHub 아이디를 알려주세요. Collaborator 초대.');
  r++;

  r = writeSubSection(s, r, '3. Google Cloud 인증');
  r = writeHeaders(s, r, ['단계', '명령어', '설명']);
  r = writeRows(s, r, [
    ['3-1. 로그인', 'gcloud auth login', '브라우저에서 회사 Google 계정으로 로그인'],
    ['3-2. 프로젝트', 'gcloud config set project csopp-25f2', 'GCP 프로젝트 설정'],
    ['3-3. ADC', 'gcloud auth application-default login', 'BigQuery 접근용 인증'],
  ]);
  r++;

  r = writeSubSection(s, r, '필요한 GCP 권한 (메이가 부여)');
  r = writeHeaders(s, r, ['권한', '역할', '용도']);
  r = writeRows(s, r, [
    ['BigQuery 데이터 뷰어', 'roles/bigquery.dataViewer', '테이블 조회'],
    ['BigQuery 작업 사용자', 'roles/bigquery.jobUser', '쿼리 실행'],
    ['BigQuery 데이터 편집자', 'roles/bigquery.dataEditor', '뷰 생성, 데이터 수정 (필요 시)'],
  ]);
  r++;

  r = writeSubSection(s, r, '4. 환경변수 설정');
  r = writeHeaders(s, r, ['단계', '명령어/내용']);
  r = writeRows(s, r, [
    ['템플릿 복사', 'cp .env.template .env.local'],
    ['Sheets ID', 'GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o'],
    ['주의', '.env.local 파일은 절대 Git에 커밋하지 마세요!'],
  ]);
  r++;

  r = writeSubSection(s, r, '5. 패키지 설치 및 실행');
  r = writeHeaders(s, r, ['명령어', '설명']);
  r = writeRows(s, r, [
    ['npm install', '패키지 설치 (최초 1회, 1-2분 소요)'],
    ['npm run dev', '로컬 개발 서버 → http://localhost:3000'],
    ['npm run build', '프로덕션 빌드 (배포 전 테스트)'],
    ['npm run lint', '코드 문법 검사'],
  ]);
  r++;

  r = writeSubSection(s, r, '6. 자동 셋업 스크립트 (선택)');
  r = writeHeaders(s, r, ['명령어', '설명']);
  r = writeRows(s, r, [
    ['chmod +x scripts/setup-dev.sh', '실행 권한 부여'],
    ['./scripts/setup-dev.sh', 'Node.js, gcloud, ADC, .env.local, npm 일괄 확인'],
  ]);
  r++;

  r = writeSubSection(s, r, '7. 자주 묻는 질문 (FAQ)');
  r = writeHeaders(s, r, ['증상', '원인', '해결']);
  r = writeRows(s, r, [
    ['Could not load the default credentials', 'GCP 인증 만료', 'gcloud auth application-default login 재실행'],
    ['Port 3000 is already in use', '포트 충돌', 'npm run dev -- --port 3001'],
    ['bigquery.jobs.create 권한 없음', 'GCP 권한 부족', '메이에게 BigQuery Job User 역할 요청'],
    ['komi.git denied', 'GitHub 권한 없음', '메이에게 Collaborator 초대 요청'],
    ['merge conflict', '코드 충돌', 'GIT_WORKFLOW.md 충돌 해결 섹션 참고'],
  ]);
  r++;

  r = writeSubSection(s, r, '다음 단계');
  r = writeHeaders(s, r, ['순서', '문서', '내용']);
  r = writeRows(s, r, [
    ['1', '도메인가이드 (시트15)', '내가 담당하는 영역과 수정할 파일 확인'],
    ['2', 'Git워크플로우 (시트14)', '브랜치 만들기, 커밋, PR 올리는 방법'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 14. Git 워크플로우
// ═══════════════════════════════════════════════════════
function buildSheet14(ss) {
  var s = ss.insertSheet('14.Git워크플로우');
  var r = 1;

  r = writeSection(s, r, 'Git 워크플로우 가이드', '#4a148c');
  r = writeNote(s, r, 'Git을 처음 사용하거나 익숙하지 않은 분을 위한 가이드. 원본: docs/onboarding-kit/GIT_WORKFLOW.md');
  r++;

  r = writeSubSection(s, r, '핵심 원칙 3가지');
  r = writeHeaders(s, r, ['#', '원칙', '설명']);
  r = writeRows(s, r, [
    [1, 'main에 직접 push 하지 않는다', 'PR(Pull Request)로만 머지'],
    [2, '내 브랜치에서만 작업한다', '다른 사람 브랜치 건드리지 않기'],
    [3, '작업 전에 항상 최신 코드를 받는다', 'git pull origin main 습관화'],
  ]);
  r++;

  r = writeSubSection(s, r, '1. 최초 설정 (1회만)');
  r = writeHeaders(s, r, ['담당자', '브랜치명', '명령어']);
  r = writeRows(s, r, [
    ['Cobb', 'feature/productivity-cobb', 'git checkout -b feature/productivity-cobb'],
    ['Dean', 'feature/sla-dean', 'git checkout -b feature/sla-dean'],
    ['리샬', 'feature/qa-rishal', 'git checkout -b feature/qa-rishal'],
    ['메이', 'feature/qc-may', 'git checkout -b feature/qc-may'],
  ]);
  r = writeNote(s, r, 'Git 사용자 설정: git config user.name "이름" && git config user.email "이메일"');
  r++;

  r = writeSubSection(s, r, '2. 매일 작업 시작할 때');
  r = writeHeaders(s, r, ['단계', '명령어', '설명']);
  r = writeRows(s, r, [
    [1, 'git checkout feature/내브랜치', '내 브랜치로 이동'],
    [2, 'git pull origin main', 'main의 최신 변경사항 반영'],
  ]);
  r = writeNote(s, r, '빼먹으면 나중에 충돌 날 수 있습니다. 매일 작업 시작 전에 꼭 실행하세요.');
  r++;

  r = writeSubSection(s, r, '3. 작업 내용 저장하기 (커밋)');
  r = writeHeaders(s, r, ['단계', '명령어', '설명']);
  r = writeRows(s, r, [
    ['상태 확인', 'git status', '수정된 파일 보기 (빨간색=미저장)'],
    ['파일 추가', 'git add lib/bigquery-sla.ts', '특정 파일만 추가 (권장)'],
    ['커밋', 'git commit -m "SLA 대시보드 구조 생성"', '변경 설명 메시지'],
  ]);
  r++;

  r = writeSubSection(s, r, '커밋 메시지 예시');
  r = writeHeaders(s, r, ['좋은 예', '나쁜 예']);
  r = writeRows(s, r, [
    ['SLA 응답률 차트 추가', '수정'],
    ['QA 점수 계산 기준 75점으로 변경', '작업중'],
    ['생산성 BigQuery 쿼리 작성', 'ㅇㅇ'],
  ]);
  r++;

  r = writeSubSection(s, r, '4. 코드 올리기 (Push)');
  r = writeHeaders(s, r, ['상황', '명령어']);
  r = writeRows(s, r, [
    ['일반 push', 'git push origin feature/내브랜치'],
    ['처음 push', 'git push -u origin feature/내브랜치'],
  ]);
  r++;

  r = writeSubSection(s, r, '5. PR(Pull Request) 만들기');
  r = writeHeaders(s, r, ['방법', '절차']);
  r = writeRows(s, r, [
    ['GitHub 웹', '1. github.kakaocorp.com/csopp/komi → 2. Compare & pull request → 3. 제목/설명 → 4. Create'],
    ['CLI', 'gh pr create --title "SLA 대시보드 v1" --body "변경 내용"'],
  ]);
  r = writeNote(s, r, '메이가 확인 후 승인 → main에 머지 → Cloud Run 자동 배포');
  r++;

  r = writeSubSection(s, r, '6. 충돌이 났을 때');
  r = writeHeaders(s, r, ['단계', '내용']);
  r = writeRows(s, r, [
    ['1. 충돌 확인', '<<<<<<< HEAD / ======= / >>>>>>> origin/main 비교'],
    ['2. 수동 합치기', '필요한 내용 남기고 충돌 표시 삭제'],
    ['3. 저장 후 커밋', 'git add 충돌파일 && git commit -m "conflict 해결"'],
    ['복잡하면', 'git merge --abort 로 취소 후 메이에게 연락'],
  ]);
  r++;

  r = writeSubSection(s, r, '충돌 예방법');
  r = writeHeaders(s, r, ['방법', '설명']);
  r = writeRows(s, r, [
    ['내 도메인 파일만 수정', '가장 중요! 다른 사람 영역 건드리지 않기'],
    ['공통 파일은 요청', 'constants.ts, types.ts는 메이에게 요청'],
    ['매일 pull', 'git pull origin main으로 최신 상태 유지'],
  ]);
  r++;

  r = writeSubSection(s, r, '7. 자주 쓰는 명령어 모음');
  r = writeHeaders(s, r, ['분류', '명령어', '설명']);
  r = writeRows(s, r, [
    ['시작', 'git checkout feature/내브랜치', '내 브랜치 이동'],
    ['시작', 'git pull origin main', '최신 코드 받기'],
    ['저장', 'git add 파일명', '파일 스테이징'],
    ['저장', 'git commit -m "설명"', '커밋'],
    ['업로드', 'git push origin feature/내브랜치', '원격 push'],
    ['상태', 'git status', '수정된 파일'],
    ['상태', 'git log --oneline -5', '최근 커밋 5개'],
    ['상태', 'git branch', '현재 브랜치'],
    ['상태', 'git diff', '수정 내용'],
    ['복구', 'git checkout -- 파일명', '수정 되돌리기'],
    ['복구', 'git reset --soft HEAD~1', '커밋 취소'],
  ]);
  r++;

  r = writeSubSection(s, r, '전체 흐름 요약');
  r = writeHeaders(s, r, ['단계', '내용']);
  r = writeRows(s, r, [
    ['1', '내 브랜치에서 작업'],
    ['2', 'git add + git commit (저장)'],
    ['3', 'git push (원격에 올리기)'],
    ['4', 'GitHub에서 PR 만들기'],
    ['5', '메이가 리뷰 후 승인'],
    ['6', 'main에 머지 → Cloud Run 자동 배포'],
  ]);

  fmt(s);
}

// ═══════════════════════════════════════════════════════
// 15. 도메인별 작업 가이드
// ═══════════════════════════════════════════════════════
function buildSheet15(ss) {
  var s = ss.insertSheet('15.도메인가이드');
  var r = 1;

  r = writeSection(s, r, '도메인별 작업 가이드', '#bf360c');
  r = writeNote(s, r, '각 담당자가 자기 영역에서 어떤 파일을 수정하면 되는지 안내. 원본: docs/onboarding-kit/DOMAIN_GUIDE.md');
  r++;

  r = writeSubSection(s, r, '담당자 & 도메인 매핑');
  r = writeHeaders(s, r, ['담당자', '도메인', '상태', '브랜치']);
  r = writeRows(s, r, [
    ['Cobb', '생산성 (Productivity)', '신규 개발', 'feature/productivity-cobb'],
    ['Dean', 'SLA 평가', '신규 개발', 'feature/sla-dean'],
    ['리샬', 'QA 상담평점', '기존 코드 있음', 'feature/qa-rishal'],
    ['메이', 'QC + 직무테스트', '기존 코드 있음', 'feature/qc-may'],
  ]);
  r++;

  r = writeSubSection(s, r, '프로젝트 구조');
  r = writeHeaders(s, r, ['경로', '역할', '담당']);
  r = writeRows(s, r, [
    ['app/api/', 'API 엔드포인트 (서버 로직)', '각 도메인'],
    ['app/page.tsx', '메인 페이지', '메이 (수정 금지)'],
    ['lib/bigquery.ts', 'BigQuery 기본 클라이언트', '공통 (수정 금지)'],
    ['lib/bigquery-qa.ts', 'QA 쿼리', '리샬'],
    ['lib/bigquery-csat.ts', 'CSAT 쿼리', '리샬'],
    ['lib/bigquery-quiz.ts', '퀴즈 쿼리', '메이'],
    ['lib/bigquery-productivity.ts', '생산성 쿼리', 'Cobb'],
    ['lib/bigquery-sla.ts', 'SLA 쿼리', 'Dean'],
    ['lib/constants.ts', '설정값 모음', '공통 (수정 시 메이에게)'],
    ['lib/types.ts', '타입 정의', '공통 (수정 시 메이에게)'],
    ['components/qc/dashboard/', 'QC 메인 대시보드', '메이'],
    ['components/qc/qa-dashboard/', 'QA 대시보드 (6개)', '리샬'],
    ['components/qc/csat-dashboard/', 'CSAT 대시보드 (7개)', '리샬'],
    ['components/qc/quiz-dashboard/', '퀴즈 대시보드 (5개)', '메이'],
    ['components/qc/productivity-dashboard/', '생산성 대시보드 (6개)', 'Cobb'],
    ['components/qc/sla-dashboard/', 'SLA 대시보드 (6개)', 'Dean'],
    ['components/qc/quality-dashboard/', '품질 종합 (탭 래퍼)', '메이'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Cobb - 생산성: 작업 파일');
  r = writeHeaders(s, r, ['파일', '역할', '참고 패턴']);
  r = writeRows(s, r, [
    ['lib/bigquery-productivity.ts', 'BigQuery 쿼리', 'bigquery-qa.ts 참고'],
    ['productivity-dashboard/index.tsx', '대시보드 컨테이너', 'qa-dashboard/index.tsx'],
    ['productivity-dashboard/overview.tsx', 'KPI 카드', 'qa-overview-section.tsx'],
    ['productivity-dashboard/trend.tsx', '추이 차트', 'qa-score-trend-chart.tsx'],
    ['productivity-dashboard/table.tsx', '상세 테이블', 'qa-monthly-table.tsx'],
    ['app/api/productivity/route.ts', 'API 엔드포인트', 'api/data/route.ts'],
  ]);
  r++;

  r = writeSubSection(s, r, 'Dean - SLA: 작업 파일');
  r = writeHeaders(s, r, ['파일', '역할', '참고 패턴']);
  r = writeRows(s, r, [
    ['lib/bigquery-sla.ts', 'BigQuery 쿼리', 'bigquery-qa.ts 참고'],
    ['sla-dashboard/index.tsx', '대시보드 컨테이너', 'qa-dashboard/index.tsx'],
    ['sla-dashboard/overview.tsx', 'KPI 카드', 'qa-overview-section.tsx'],
    ['sla-dashboard/trend.tsx', '추이 차트', 'qa-score-trend-chart.tsx'],
    ['sla-dashboard/service-table.tsx', '서비스별 SLA', 'qa-monthly-table.tsx'],
    ['app/api/sla/route.ts', 'API 엔드포인트', 'api/data/route.ts'],
  ]);
  r++;

  r = writeSubSection(s, r, '리샬 - QA: 이미 있는 파일 (수정 대상)');
  r = writeHeaders(s, r, ['파일', '역할']);
  r = writeRows(s, r, [
    ['lib/bigquery-qa.ts', 'QA BigQuery 쿼리 (471줄)'],
    ['lib/qa-sheets.ts', 'QA Google Sheets 파서'],
    ['qa-dashboard/index.tsx', 'QA 대시보드 컨테이너'],
    ['qa-dashboard/qa-overview-section.tsx', 'QA KPI 카드'],
    ['qa-dashboard/qa-score-trend-chart.tsx', 'QA 추이 차트'],
    ['qa-dashboard/qa-agent-analysis.tsx', '상담사별 점수'],
    ['qa-dashboard/qa-center-comparison.tsx', '센터 비교'],
    ['qa-dashboard/qa-item-analysis-v2.tsx', '항목별 분석'],
    ['qa-dashboard/qa-monthly-table.tsx', '월별 테이블'],
    ['hooks/use-qa-dashboard-data.ts', 'QA 데이터 hook'],
    ['app/api/import-qa/route.ts', 'QA 임포트 API'],
  ]);
  r++;

  r = writeSubSection(s, r, 'AI(Gemini) 프롬프트 - 공통 패턴');
  r = writeHeaders(s, r, ['단계', '설명', '프롬프트 핵심']);
  r = writeRows(s, r, [
    ['1', 'BQ 쿼리 만들기', '"bigquery-qa.ts 참고해서 bigquery-{도메인}.ts 만들어줘"'],
    ['2', 'API 만들기', '"api/data/route.ts 패턴으로 api/{도메인}/route.ts 만들어줘"'],
    ['3', 'UI 만들기', '"qa-dashboard/index.tsx 구조로 {도메인}-dashboard 만들어줘"'],
    ['4', '차트/테이블', '"qa-monthly-table.tsx 참고해서 테이블 추가해줘"'],
    ['에러', '에러 해결', '"이 에러 원인 알려줘: [에러 붙여넣기]"'],
  ]);
  r++;

  r = writeSubSection(s, r, '혼자 수정 금지 파일');
  r = writeHeaders(s, r, ['파일', '이유', '수정하고 싶을 때']);
  r = writeRows(s, r, [
    ['lib/constants.ts', '모든 도메인 설정', '메이에게 알리고 같이 수정'],
    ['lib/types.ts', '공통 타입 정의', '본인 파일에 먼저 정의, 나중에 통합'],
    ['app/page.tsx', '메인 라우팅', '메이가 관리'],
    ['quality-dashboard/index.tsx', '탭 래퍼', '새 탭 추가 시 메이에게 요청'],
  ]);
  r++;

  r = writeSubSection(s, r, '코드 스타일');
  r = writeHeaders(s, r, ['항목', '규칙', '예시']);
  r = writeRows(s, r, [
    ['UI 라벨', '한국어', '상담사, 오류율'],
    ['변수명', '영어 camelCase', 'agentName, errorRate'],
    ['BQ 테이블', '풀네임', 'csopp-25f2.KMCC_QC.테이블명'],
    ['차트', 'Recharts', '-'],
    ['UI', 'shadcn/ui', 'components/ui/ 참고'],
    ['클라이언트', '"use client"', '파일 최상단 필수'],
    ['import', '절대경로 @/', '@/lib/types'],
  ]);
  r++;

  r = writeSubSection(s, r, 'BigQuery 테이블 현황');
  r = writeHeaders(s, r, ['테이블', '용도', '담당', '상태']);
  r = writeRows(s, r, [
    ['evaluations', 'QC 평가 원천', '메이', '운영중'],
    ['agents', '상담사 마스터', '공통', '운영중'],
    ['targets', '센터 목표', '메이', '운영중'],
    ['qa_evaluations', 'QA 평가', '리샬', '스키마 완료'],
    ['productivity_daily', '생산성 일별', 'Cobb', '운영중'],
    ['sla_monthly', 'SLA 월별', 'Dean', '운영중'],
  ]);
  r = writeNote(s, r, '새 테이블 필요 시 메이에게 요청 → DDL 만들어서 BigQuery에 생성');
  r++;

  r = writeSubSection(s, r, '품질 종합 탭 구성');
  r = writeHeaders(s, r, ['현재', '추가 후']);
  r = writeRows(s, r, [
    ['QC | QA | CSAT | 직무테스트', 'QC | QA | CSAT | 직무테스트 | 생산성 | SLA'],
  ]);
  r = writeNote(s, r, '도메인 대시보드 완성 후 메이에게 요청 → quality-dashboard/index.tsx에 탭 추가');

  fmt(s);
}
