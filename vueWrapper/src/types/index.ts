// CSV 파일 관련 타입
export interface CSVFile {
  filename: string;
  content: string;
}

export interface LoadedData {
  결제데이터: CSVFile[];
  누적결제데이터: CSVFile[];
  주문데이터: CSVFile[];
}

// 결제 데이터 타입 (일별)
export interface PaymentData {
  pg_yn: '선불' | '후불';
  shop_code: string;
  shop_name: string;
  count: number;
  total_price: number;
  sol_pay_amt: number;
  sol_pay_count: number;
  kakao_money_amt: number;
  kakao_money_count: number;
}

// 주문 데이터 타입
export interface OrderData {
  pg_yn: '선불' | '후불';
  shop_code: string;
  shop_name: string;
  pos_code: string;
  sol_pay_promotion_yn: 'O' | 'X';
  nice_pay_promotion_yn: 'O' | 'X';
  ins_datetime: string;
  formatted_date: string;
  company_name: string;
  prev_company_name: string;
  shop_status: '이용' | '이용대기' | '종료';
  formatted_date_2: string;  // 두번째 formatted_date
  device_count: number;
  table_count: number;
  total_count_all: number;
  order_count_all: number;
  total_count_no_pos: number;
  total_price_no_pos: number;
  order_count_no_pos: number;
  price_no_pos: number;
}

// 날짜별 파싱된 데이터
export interface ParsedDateData {
  date: string;
  결제: PaymentData[];
  누적결제: PaymentData[];
  주문: OrderData[];
}

// 매장 분석용 타입
export interface ShopAnalysis {
  shop_code: string;
  shop_name: string;
  pg_yn: '선불' | '후불';
  shop_status: '이용' | '이용대기' | '종료';
  ins_datetime: string;  // 최초 등록일

  // 활성화 여부 분석
  hasOrders: boolean;
  hasPayments: boolean;
  isActive: boolean;  // 이용 상태이면서 실제 주문/결제 있는지

  // 이용현황 (주문 데이터에서)
  totalOrderCount: number;      // 총 주문건수 (total_count_all)
  totalOrderCountNoPos: number; // POS 외 주문건수 (total_count_no_pos)
  deviceCount: number;          // 기기 수
  tableCount: number;           // 테이블 수

  // 결제 데이터
  totalPaymentCount: number;
  totalPaymentAmount: number;

  // 페이먼트 프로모션 관련
  sol_pay_promotion_yn: boolean;
  nice_pay_promotion_yn: boolean;
  solPayCount: number;
  solPayAmount: number;
  kakaoPayCount: number;
  kakaoPayAmount: number;
}

// KPI 지표 타입
export interface KPIMetrics {
  // 매장 수 현황
  totalShops: number;
  activeShops: number;        // 이용 상태
  pendingShops: number;       // 이용대기 상태
  terminatedShops: number;    // 종료 상태

  // 선불/후불 구분
  prepaidShops: number;       // 선불 (카드결제 가능)
  postpaidShops: number;      // 후불 (POS만)

  // 신규 매장 (기간 내)
  newShops: number;
  newShopsPrepaid: number;    // 신규 중 선불
  newShopsPostpaid: number;   // 신규 중 후불
  newToActiveShops: number;   // 신규 중 이용으로 전환된 매장

  // 리스크 매장 (이용 상태지만 활동 없음)
  riskShops: number;
  riskShopsPrepaid: number;   // 리스크 중 선불
  riskShopsPostpaid: number;  // 리스크 중 후불
  riskShopList: ShopAnalysis[];

  // 디바이스 현황
  totalDevices: number;       // 전체 디바이스 수
  devicesPrepaid: number;     // 선불 매장 디바이스
  devicesPostpaid: number;    // 후불 매장 디바이스
  avgDevicesPerShop: number;  // 매장당 평균 디바이스

  // 페이먼트 프로모션 효과
  solPayShops: number;
  solPayTotalAmount: number;
  solPayTotalCount: number;
  kakaoPayShops: number;
  kakaoPayTotalAmount: number;
  kakaoPayTotalCount: number;
}

// 기간별 비교 데이터
export interface PeriodComparison {
  date: string;
  totalShops: number;
  activeShops: number;
  pendingShops: number;
  newShops: number;
  riskShops: number;
  // 주별 데이터 (해당 주차만)
  weeklySolPayCount: number;
  weeklySolPayAmount: number;
  weeklyKakaoPayCount: number;
  weeklyKakaoPayAmount: number;
  weeklyPaymentCount: number;
  weeklyPaymentAmount: number;
  // 누적 데이터
  cumulativeSolPayCount: number;
  cumulativeSolPayAmount: number;
  cumulativeKakaoPayCount: number;
  cumulativeKakaoPayAmount: number;
  cumulativePaymentCount: number;
  cumulativePaymentAmount: number;
}

// 신규 매장 추적
export interface NewShopTracking {
  shop_code: string;
  shop_name: string;
  pg_yn: '선불' | '후불';
  ins_datetime: string;
  firstSeenDate: string;  // 처음 데이터에 나타난 날짜
  currentStatus: '이용' | '이용대기' | '종료';
  statusChangedToActive: boolean;  // 이용으로 변경됨
  hasActivity: boolean;  // 주문/결제 활동 있음
  daysToActivation: number | null;  // 이용 전환까지 걸린 일수
  // 활동 상세 정보
  totalOrderCount: number;      // 전체 주문건수
  totalOrderCountNoPos: number; // POS 미연동 주문건수
  totalPaymentCount: number;    // 누적 결제건수
  totalPaymentAmount: number;   // 누적 결제금액
}

// 카카오페이 매장 현황
export interface KakaoPayShopStats {
  // 선불
  prepaid: {
    pending: number;      // 이용대기
    active: number;       // 이용
  };
  // 후불
  postpaid: {
    pending: number;
    active: number;
  };
  total: number;
}

// 쏠페이 매장 현황
export interface SolPayShopStats {
  // 선불만 (쏠페이는 선불만 해당)
  prepaid: {
    pending: number;      // 이용대기
    active: number;       // 이용
  };
  total: number;
}

// 주간 비교 데이터
export interface WeeklyComparison {
  label: string;
  lastWeek: number;
  thisWeek: number;
  change: number;
  changeRate: string;
}

// 카카오페이 활성화 현황
export interface KakaoPayActivationStats {
  // 선불
  prepaid: {
    activatedShops: number;       // 결제 활성화 매장 수 (결제건 > 0)
    kakaoMoneyShops: number;      // 카카오머니 활성화 매장 수
    paymentCount: number;         // 결제 건수
    kakaoMoneyCount: number;      // 카카오머니 결제 건수
    paymentAmount: number;        // 결제 금액
    kakaoMoneyAmount: number;     // 카카오머니 결제 금액
  };
  // 후불
  postpaid: {
    activatedShops: number;
    paymentCount: number;         // 주문 건수
    orderAmount: number;          // 주문 금액
  };
  // 주간 비교
  weekly: {
    activatedShops: WeeklyComparison;
    kakaoMoneyShops: WeeklyComparison;
    paymentCount: WeeklyComparison;
    kakaoMoneyCount: WeeklyComparison;
    paymentAmount: WeeklyComparison;
    kakaoMoneyAmount: WeeklyComparison;
    postpaidShops: WeeklyComparison;
    postpaidOrderCount: WeeklyComparison;
    postpaidOrderAmount: WeeklyComparison;
  };
  // 누적
  cumulative: {
    activatedShops: number;
    kakaoMoneyShops: number;
    paymentCount: number;
    kakaoMoneyCount: number;
    paymentAmount: number;
    kakaoMoneyAmount: number;
    postpaidShops: number;
    postpaidOrderCount: number;
    postpaidOrderAmount: number;
  };
}

// 쏠페이 활성화 현황
export interface SolPayActivationStats {
  // 선불만
  prepaid: {
    activatedShops: number;       // 결제 활성화 매장 수
    solPayShops: number;          // 쏠페이 활성화 매장 수
    paymentCount: number;         // 결제 건수
    solPayCount: number;          // 쏠페이 결제 건수
    paymentAmount: number;        // 결제 금액
    solPayAmount: number;         // 쏠페이 결제 금액
  };
  // 주간 비교
  weekly: {
    activatedShops: WeeklyComparison;
    solPayShops: WeeklyComparison;
    paymentCount: WeeklyComparison;
    solPayCount: WeeklyComparison;
    paymentAmount: WeeklyComparison;
    solPayAmount: WeeklyComparison;
  };
  // 누적
  cumulative: {
    activatedShops: number;
    solPayShops: number;
    paymentCount: number;
    solPayCount: number;
    paymentAmount: number;
    solPayAmount: number;
  };
}

// 페이먼트 종합 현황
export interface PaymentSummaryStats {
  kakaoPayShops: KakaoPayShopStats;
  solPayShops: SolPayShopStats;
  kakaoPayActivation: KakaoPayActivationStats;
  solPayActivation: SolPayActivationStats;
  // 신규 유입 & 전환
  newInflow: {
    kakaoPayNew: number;
    kakaoPayConverted: number;
    solPayNew: number;
    solPayConverted: number;
  };
  // 이탈 & 리스크
  churnAndRisk: {
    churnedShops: number; // 전주 활성화 → 금주 비활성화
    churnedShopList: { shop_code: string; shop_name: string; pg_yn: string; promotion_type: string }[];
    promotionRiskShops: number; // 프로모션 대상 매장 중 리스크 매장
    promotionRiskShopList: ShopAnalysis[]; // 리스크 매장 상세 리스트
  };
}

// 대리점 실적 분석
export interface AgencyPerformance {
  agencyName: string;
  isDirect: boolean; // 직영업 여부
  totalShops: number;
  activeShops: number;
  pendingShops: number;
  prepaidShops: number;
  postpaidShops: number;
  activatedShops: number; // 활성화 매장 (order_count_no_pos >= 1)
  activationRate: number; // 활성화율
  riskShops: number;
  churnedShops: number; // 이탈 매장
  newShops: number; // 신규 매장
  totalDevices: number;
  avgOrderCount: number; // 평균 주문 수
  totalOrderAmount: number; // 총 주문 금액
  shopList: OrderData[]; // 매장 리스트
}

// Electron API 타입
declare global {
  interface Window {
    electronAPI: {
      selectDirectory: () => Promise<string | null>;
      loadData: (basePath: string) => Promise<LoadedData>;
      getDefaultPath: () => Promise<string>;
      checkDirectoryExists: (dirPath: string) => Promise<boolean>;
      listAvailableDates: (basePath: string) => Promise<string[]>;
    };
  }
}

export {};
