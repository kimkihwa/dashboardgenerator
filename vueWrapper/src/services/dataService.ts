import type {
  CSVFile,
  LoadedData,
  PaymentData,
  OrderData,
  ParsedDateData,
  ShopAnalysis,
  KPIMetrics,
  PeriodComparison,
  NewShopTracking,
  PaymentSummaryStats,
  WeeklyComparison,
  AgencyPerformance
} from '../types';

// CSV 라인 파싱 (쉼표 내 따옴표 처리)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// 안전한 값 접근 함수
function safeGet(arr: string[], index: number, defaultValue: string = ''): string {
  return arr[index] ?? defaultValue;
}

function safeParseInt(value: string | undefined): number {
  // 쉼표 제거 후 파싱 (예: "209,300" -> 209300)
  const cleaned = (value ?? '0').replace(/,/g, '');
  return parseInt(cleaned) || 0;
}

// 결제 데이터 파싱
function parsePaymentData(csvFiles: CSVFile[]): Map<string, PaymentData[]> {
  const dataMap = new Map<string, PaymentData[]>();

  for (const file of csvFiles) {
    const date = file.filename.replace('.csv', '');
    const lines = file.content.trim().split('\n');

    if (lines.length === 0) continue;

    // 헤더 확인
    const firstLine = lines[0] ?? '';
    const hasHeader = firstLine.includes('pg_yn') || firstLine.includes('shop_code');

    const parsed: PaymentData[] = [];
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const values = parseCSVLine(line);
      if (values.length < 9) continue;

      parsed.push({
        pg_yn: safeGet(values, 0) as '선불' | '후불',
        shop_code: safeGet(values, 1),
        shop_name: safeGet(values, 2),
        count: safeParseInt(values[3]),
        total_price: safeParseInt(values[4]),
        sol_pay_amt: safeParseInt(values[5]),
        sol_pay_count: safeParseInt(values[6]),
        kakao_money_amt: safeParseInt(values[7]),
        kakao_money_count: safeParseInt(values[8])
      });
    }

    dataMap.set(date, parsed);
  }

  return dataMap;
}

// 주문 데이터 파싱
function parseOrderData(csvFiles: CSVFile[]): Map<string, OrderData[]> {
  const dataMap = new Map<string, OrderData[]>();

  for (const file of csvFiles) {
    const date = file.filename.replace('.csv', '');
    const lines = file.content.trim().split('\n');

    if (lines.length === 0) continue;

    const firstLine = lines[0] ?? '';
    const hasHeader = firstLine.includes('pg_yn') || firstLine.includes('shop_code');
    const startIndex = hasHeader ? 1 : 0;

    const parsed: OrderData[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const values = parseCSVLine(line);
      if (values.length < 20) continue;

      parsed.push({
        pg_yn: safeGet(values, 0) as '선불' | '후불',
        shop_code: safeGet(values, 1),
        shop_name: safeGet(values, 2),
        pos_code: safeGet(values, 3),
        sol_pay_promotion_yn: safeGet(values, 4) as 'O' | 'X',
        nice_pay_promotion_yn: safeGet(values, 5) as 'O' | 'X',
        ins_datetime: safeGet(values, 6),
        formatted_date: safeGet(values, 7),
        company_name: safeGet(values, 8),
        prev_company_name: safeGet(values, 9),
        shop_status: safeGet(values, 10) as '이용' | '이용대기' | '종료',
        formatted_date_2: safeGet(values, 11),
        device_count: safeParseInt(values[12]),
        table_count: safeParseInt(values[13]),
        total_count_all: safeParseInt(values[14]),
        order_count_all: safeParseInt(values[15]),
        total_count_no_pos: safeParseInt(values[16]),
        total_price_no_pos: safeParseInt(values[17]),
        order_count_no_pos: safeParseInt(values[18]),
        price_no_pos: safeParseInt(values[19])
      });
    }

    dataMap.set(date, parsed);
  }

  return dataMap;
}

export class DataService {
  private 결제데이터: Map<string, PaymentData[]> = new Map();
  private 누적결제데이터: Map<string, PaymentData[]> = new Map();
  private 주문데이터: Map<string, OrderData[]> = new Map();
  private availableDates: string[] = [];

  // 데이터 로드
  loadData(data: LoadedData): void {
    this.결제데이터 = parsePaymentData(data.결제데이터);
    this.누적결제데이터 = parsePaymentData(data.누적결제데이터);
    this.주문데이터 = parseOrderData(data.주문데이터);

    // 가용 날짜 정렬
    this.availableDates = Array.from(this.주문데이터.keys()).sort();
  }

  getAvailableDates(): string[] {
    return this.availableDates;
  }

  // 특정 날짜 데이터 가져오기
  getDateData(date: string): ParsedDateData | null {
    const 결제 = this.결제데이터.get(date);
    const 누적결제 = this.누적결제데이터.get(date);
    const 주문 = this.주문데이터.get(date);

    if (!주문) return null;

    return {
      date,
      결제: 결제 || [],
      누적결제: 누적결제 || [],
      주문
    };
  }

  // 특정 날짜의 주문 데이터만 가져오기
  getOrderData(date: string): OrderData[] {
    return this.주문데이터.get(date) || [];
  }

  // 날짜 간 신규 매장 찾기
  findNewShops(prevDate: string, currentDate: string): OrderData[] {
    const prevShops = this.주문데이터.get(prevDate) || [];
    const currentShops = this.주문데이터.get(currentDate) || [];

    const prevShopCodes = new Set(prevShops.map(s => s.shop_code));

    return currentShops.filter(shop => !prevShopCodes.has(shop.shop_code));
  }

  // 특정 날짜 기준 신규 매장 (ins_datetime 기준으로 최근 N일 이내, 이용 상태만)
  findRecentlyAddedShops(date: string, daysBack: number = 30): OrderData[] {
    const shops = this.주문데이터.get(date) || [];
    const targetDate = this.parseDate(date);
    if (!targetDate) return [];

    const cutoffDate = new Date(targetDate);
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    return shops.filter(shop => {
      const insDate = this.parseInsDatetime(shop.ins_datetime);
      return insDate && insDate >= cutoffDate && shop.shop_status === '이용';
    });
  }

  // 이용 상태로 변경된 신규 매장
  findNewActiveShops(date: string, daysBack: number = 30): OrderData[] {
    const recentShops = this.findRecentlyAddedShops(date, daysBack);
    return recentShops.filter(shop => shop.shop_status === '이용');
  }

  // 리스크 매장 (이용 상태지만 최근 한달간 주문/결제 각각 10건 미만)
  findRiskShops(date: string): ShopAnalysis[] {
    const orders = this.주문데이터.get(date) || [];
    const currentPayments = this.누적결제데이터.get(date) || [];

    // 현재 날짜 인덱스 찾기
    const currentIndex = this.availableDates.indexOf(date);

    // 최근 한달(4주) 날짜 목록 (현재 포함)
    const recentDates: string[] = [];
    for (let i = 0; i < 4 && currentIndex - i >= 0; i++) {
      const d = this.availableDates[currentIndex - i];
      if (d) recentDates.push(d);
    }

    // 매장별 최근 한달 일별 주문/결제 합산
    const shopOrderSum = new Map<string, number>();
    const shopPaymentSum = new Map<string, number>();

    for (const d of recentDates) {
      // 일별 결제 데이터 합산
      const dailyPayments = this.결제데이터.get(d) || [];
      for (const p of dailyPayments) {
        shopPaymentSum.set(p.shop_code, (shopPaymentSum.get(p.shop_code) || 0) + p.count);
      }

      // 주문 데이터 합산 (total_count_all 사용)
      const dailyOrders = this.주문데이터.get(d) || [];
      for (const o of dailyOrders) {
        shopOrderSum.set(o.shop_code, (shopOrderSum.get(o.shop_code) || 0) + o.total_count_all);
      }
    }

    // 현재 누적 결제 맵 (표시용)
    const paymentMap = new Map<string, PaymentData>();
    for (const p of currentPayments) {
      paymentMap.set(p.shop_code, p);
    }

    const riskShops: ShopAnalysis[] = [];
    const THRESHOLD = 10;

    for (const order of orders) {
      // 이용 상태인 매장만
      if (order.shop_status !== '이용') continue;

      const recentMonthOrders = shopOrderSum.get(order.shop_code) || 0;
      const recentMonthPayments = shopPaymentSum.get(order.shop_code) || 0;
      const payment = paymentMap.get(order.shop_code);

      // 최근 한달간 주문 10건 미만 AND 결제 10건 미만
      if (recentMonthOrders < THRESHOLD && recentMonthPayments < THRESHOLD) {
        riskShops.push({
          shop_code: order.shop_code,
          shop_name: order.shop_name,
          pg_yn: order.pg_yn,
          shop_status: order.shop_status,
          ins_datetime: order.ins_datetime,
          hasOrders: recentMonthOrders > 0,
          hasPayments: recentMonthPayments > 0,
          isActive: false,
          // 최근 한달 합산 (주문/결제)
          totalOrderCount: recentMonthOrders,
          totalOrderCountNoPos: 0,
          deviceCount: order.device_count,
          tableCount: order.table_count,
          // 누적 결제 데이터 (표시용)
          totalPaymentCount: recentMonthPayments,
          totalPaymentAmount: payment?.total_price || 0,
          sol_pay_promotion_yn: order.sol_pay_promotion_yn === 'O',
          nice_pay_promotion_yn: order.nice_pay_promotion_yn === 'O',
          solPayCount: payment?.sol_pay_count || 0,
          solPayAmount: payment?.sol_pay_amt || 0,
          kakaoPayCount: payment?.kakao_money_count || 0,
          kakaoPayAmount: payment?.kakao_money_amt || 0
        });
      }
    }

    return riskShops;
  }

  // KPI 계산
  calculateKPIMetrics(date: string): KPIMetrics {
    const allOrders = this.주문데이터.get(date) || [];
    const payments = this.누적결제데이터.get(date) || [];

    // 종료 매장 제외
    const orders = allOrders.filter(o => o.shop_status !== '종료');

    const paymentMap = new Map<string, PaymentData>();
    for (const p of payments) {
      paymentMap.set(p.shop_code, p);
    }

    // 기본 카운트 (종료 제외)
    const totalShops = orders.length;
    const activeShops = orders.filter(o => o.shop_status === '이용').length;
    const pendingShops = orders.filter(o => o.shop_status === '이용대기').length;
    const terminatedShops = allOrders.filter(o => o.shop_status === '종료').length;

    const prepaidShops = orders.filter(o => o.pg_yn === '선불').length;
    const postpaidShops = orders.filter(o => o.pg_yn === '후불').length;

    // 신규 매장 (최근 7일)
    const newShopsList = this.findRecentlyAddedShops(date, 7);
    const newShops = newShopsList.length;
    const newShopsPrepaid = newShopsList.filter(s => s.pg_yn === '선불').length;
    const newShopsPostpaid = newShopsList.filter(s => s.pg_yn === '후불').length;
    const newToActiveShops = newShopsList.filter(s => s.shop_status === '이용').length;

    // 리스크 매장
    const riskShopList = this.findRiskShops(date);
    const riskShops = riskShopList.length;
    const riskShopsPrepaid = riskShopList.filter(s => s.pg_yn === '선불').length;
    const riskShopsPostpaid = riskShopList.filter(s => s.pg_yn === '후불').length;

    // 디바이스 현황
    const totalDevices = orders.reduce((sum, o) => sum + o.device_count, 0);
    const devicesPrepaid = orders.filter(o => o.pg_yn === '선불').reduce((sum, o) => sum + o.device_count, 0);
    const devicesPostpaid = orders.filter(o => o.pg_yn === '후불').reduce((sum, o) => sum + o.device_count, 0);
    const avgDevicesPerShop = totalShops > 0 ? totalDevices / totalShops : 0;

    // 페이먼트 프로모션 효과
    let solPayShops = 0;
    let solPayTotalAmount = 0;
    let solPayTotalCount = 0;
    let kakaoPayShops = 0;
    let kakaoPayTotalAmount = 0;
    let kakaoPayTotalCount = 0;

    for (const payment of payments) {
      if (payment.sol_pay_count > 0) {
        solPayShops++;
        solPayTotalAmount += payment.sol_pay_amt;
        solPayTotalCount += payment.sol_pay_count;
      }
      if (payment.kakao_money_count > 0) {
        kakaoPayShops++;
        kakaoPayTotalAmount += payment.kakao_money_amt;
        kakaoPayTotalCount += payment.kakao_money_count;
      }
    }

    return {
      totalShops,
      activeShops,
      pendingShops,
      terminatedShops,
      prepaidShops,
      postpaidShops,
      newShops,
      newShopsPrepaid,
      newShopsPostpaid,
      newToActiveShops,
      riskShops,
      riskShopsPrepaid,
      riskShopsPostpaid,
      riskShopList,
      totalDevices,
      devicesPrepaid,
      devicesPostpaid,
      avgDevicesPerShop,
      solPayShops,
      solPayTotalAmount,
      solPayTotalCount,
      kakaoPayShops,
      kakaoPayTotalAmount,
      kakaoPayTotalCount
    };
  }

  // 기간별 비교 데이터 생성
  getPeriodComparison(): PeriodComparison[] {
    const comparisons: PeriodComparison[] = [];

    for (const date of this.availableDates) {
      const allOrders = this.주문데이터.get(date) || [];
      // 종료 매장 제외
      const orders = allOrders.filter(o => o.shop_status !== '종료');

      const dailyPayments = this.결제데이터.get(date) || [];
      const cumulativePayments = this.누적결제데이터.get(date) || [];

      const riskShops = this.findRiskShops(date);

      // 신규 매장 (등록일 기준 7일 이내)
      const newShops = this.findRecentlyAddedShops(date, 7).length;

      // 주별 결제 집계 (해당 주차만)
      let weeklyPaymentCount = 0;
      let weeklyPaymentAmount = 0;
      let weeklySolPayCount = 0;
      let weeklySolPayAmount = 0;
      let weeklyKakaoPayCount = 0;
      let weeklyKakaoPayAmount = 0;

      for (const p of dailyPayments) {
        weeklyPaymentCount += p.count;
        weeklyPaymentAmount += p.total_price;
        weeklySolPayCount += p.sol_pay_count;
        weeklySolPayAmount += p.sol_pay_amt;
        weeklyKakaoPayCount += p.kakao_money_count;
        weeklyKakaoPayAmount += p.kakao_money_amt;
      }

      // 누적 결제 집계
      let cumulativePaymentCount = 0;
      let cumulativePaymentAmount = 0;
      let cumulativeSolPayCount = 0;
      let cumulativeSolPayAmount = 0;
      let cumulativeKakaoPayCount = 0;
      let cumulativeKakaoPayAmount = 0;

      for (const p of cumulativePayments) {
        cumulativePaymentCount += p.count;
        cumulativePaymentAmount += p.total_price;
        cumulativeSolPayCount += p.sol_pay_count;
        cumulativeSolPayAmount += p.sol_pay_amt;
        cumulativeKakaoPayCount += p.kakao_money_count;
        cumulativeKakaoPayAmount += p.kakao_money_amt;
      }

      comparisons.push({
        date,
        totalShops: orders.length,
        activeShops: orders.filter(o => o.shop_status === '이용').length,
        pendingShops: orders.filter(o => o.shop_status === '이용대기').length,
        newShops,
        riskShops: riskShops.length,
        // 주별 (해당 주차만)
        weeklySolPayCount,
        weeklySolPayAmount,
        weeklyKakaoPayCount,
        weeklyKakaoPayAmount,
        weeklyPaymentCount,
        weeklyPaymentAmount,
        // 누적
        cumulativeSolPayCount,
        cumulativeSolPayAmount,
        cumulativeKakaoPayCount,
        cumulativeKakaoPayAmount,
        cumulativePaymentCount,
        cumulativePaymentAmount
      });
    }

    return comparisons;
  }

  // 신규 매장 전환 추적 (기준날짜에서 등록일이 7일 이내인 매장)
  trackNewShops(baseDate: string): NewShopTracking[] {
    if (!baseDate) return [];

    const targetDate = this.parseDate(baseDate);
    if (!targetDate) return [];

    const cutoffDate = new Date(targetDate);
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const shops = this.주문데이터.get(baseDate) || [];
    const payments = this.누적결제데이터.get(baseDate) || [];
    const paymentMap = new Map(payments.map(p => [p.shop_code, p]));

    const tracking: NewShopTracking[] = [];

    for (const shop of shops) {
      const insDate = this.parseInsDatetime(shop.ins_datetime);
      // 등록일이 기준날짜 - 7일 이후인 매장만 (즉, 7일 이내 등록)
      if (!insDate || insDate < cutoffDate) continue;

      const payment = paymentMap.get(shop.shop_code);

      const totalOrderCount = Number(shop.total_count_all) || 0;
      const totalOrderCountNoPos = Number(shop.total_count_no_pos) || 0;
      const totalPaymentCount = Number(payment?.count) || 0;
      const totalPaymentAmount = Number(payment?.total_price) || 0;

      const hasActivity = totalOrderCount > 0 || totalOrderCountNoPos > 0 || totalPaymentCount > 0;

      tracking.push({
        shop_code: shop.shop_code,
        shop_name: shop.shop_name,
        pg_yn: shop.pg_yn,
        ins_datetime: shop.ins_datetime,
        firstSeenDate: baseDate,
        currentStatus: shop.shop_status,
        statusChangedToActive: shop.shop_status === '이용',
        hasActivity,
        daysToActivation: null,
        totalOrderCount,
        totalOrderCountNoPos,
        totalPaymentCount,
        totalPaymentAmount
      });
    }

    return tracking;
  }

  // 페이먼트사별 이용 현황
  getPaymentProviderStats(date: string) {
    const orders = this.주문데이터.get(date) || [];
    const payments = this.누적결제데이터.get(date) || [];

    const paymentMap = new Map<string, PaymentData>();
    for (const p of payments) {
      paymentMap.set(p.shop_code, p);
    }

    const solPayPromoShops = orders.filter(o => o.sol_pay_promotion_yn === 'O');
    const nicePayPromoShops = orders.filter(o => o.nice_pay_promotion_yn === 'O');

    // 쏠페이 프로모션 매장 중 실제 쏠페이 사용
    const solPayActiveShops = solPayPromoShops.filter(shop => {
      const payment = paymentMap.get(shop.shop_code);
      return payment && payment.sol_pay_count > 0;
    });

    // 카카오페이 사용 매장
    const kakaoPayActiveShops = orders.filter(shop => {
      const payment = paymentMap.get(shop.shop_code);
      return payment && payment.kakao_money_count > 0;
    });

    return {
      solPayPromoShops: solPayPromoShops.length,
      solPayActiveShops: solPayActiveShops.length,
      solPayActivationRate: solPayPromoShops.length > 0
        ? (solPayActiveShops.length / solPayPromoShops.length * 100).toFixed(1)
        : '0',
      nicePayPromoShops: nicePayPromoShops.length,
      kakaoPayActiveShops: kakaoPayActiveShops.length
    };
  }

  // 유틸리티: 날짜 파싱
  parseDate(dateStr: string): Date | null {
    // YYYYMMDD 형식
    if (dateStr.length === 8) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    }
    return null;
  }

  // 이전 날짜 가져오기
  getPreviousDate(date: string): string | null {
    const currentIndex = this.availableDates.indexOf(date);
    if (currentIndex <= 0) return null;
    return this.availableDates[currentIndex - 1] || null;
  }

  parseInsDatetime(datetime: string): Date | null {
    // YYYY-MM-DD HH:mm:ss 형식
    if (!datetime || datetime === '-') return null;
    const datePart = datetime.split(' ')[0];
    if (!datePart) return null;
    const parts = datePart.split('-');
    if (parts.length !== 3) return null;
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (!year || !month || !day) return null;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // 날짜 포맷팅
  formatDate(dateStr: string): string {
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
  }

  // 금액 포맷팅
  formatCurrency(amount: number): string {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('ko-KR').format(num) + '원';
  }

  // 숫자 포맷팅
  formatNumber(num: number): string {
    const n = Number(num) || 0;
    return new Intl.NumberFormat('ko-KR').format(n);
  }

  // 현재 로드된 raw 데이터 반환 (export용)
  getRawData(): LoadedData | null {
    if (this.availableDates.length === 0) return null;

    const 결제데이터: CSVFile[] = [];
    const 누적결제데이터: CSVFile[] = [];
    const 주문데이터: CSVFile[] = [];

    // Map을 다시 CSV 형태로 변환
    for (const [date, data] of this.결제데이터) {
      결제데이터.push({
        filename: `${date}.csv`,
        content: this.paymentDataToCSV(data)
      });
    }

    for (const [date, data] of this.누적결제데이터) {
      누적결제데이터.push({
        filename: `${date}.csv`,
        content: this.paymentDataToCSV(data)
      });
    }

    for (const [date, data] of this.주문데이터) {
      주문데이터.push({
        filename: `${date}.csv`,
        content: this.orderDataToCSV(data)
      });
    }

    return { 결제데이터, 누적결제데이터, 주문데이터 };
  }

  private paymentDataToCSV(data: PaymentData[]): string {
    const header = 'pg_yn,shop_code,shop_name,count,total_price,sol_pay_amt,sol_pay_count,kakao_money_amt,kakao_money_count';
    const rows = data.map(d =>
      `${d.pg_yn},${d.shop_code},"${d.shop_name}",${d.count},${d.total_price},${d.sol_pay_amt},${d.sol_pay_count},${d.kakao_money_amt},${d.kakao_money_count}`
    );
    return [header, ...rows].join('\n');
  }

  private orderDataToCSV(data: OrderData[]): string {
    const header = 'pg_yn,shop_code,shop_name,pos_code,sol_pay_promotion_yn,nice_pay_promotion_yn,ins_datetime,formatted_date,company_name,prev_company_name,shop_status,formatted_date_2,device_count,table_count,total_count_all,order_count_all,total_count_no_pos,total_price_no_pos,order_count_no_pos,price_no_pos';
    const rows = data.map(d =>
      `${d.pg_yn},${d.shop_code},"${d.shop_name}",${d.pos_code},${d.sol_pay_promotion_yn},${d.nice_pay_promotion_yn},${d.ins_datetime},${d.formatted_date},"${d.company_name}","${d.prev_company_name}",${d.shop_status},${d.formatted_date_2},${d.device_count},${d.table_count},${d.total_count_all},${d.order_count_all},${d.total_count_no_pos},${d.total_price_no_pos},${d.order_count_no_pos},${d.price_no_pos}`
    );
    return [header, ...rows].join('\n');
  }

  // 페이먼트 종합 현황 계산
  calculatePaymentSummary(currentDate: string, prevDate: string): PaymentSummaryStats {
    const currentOrders = this.주문데이터.get(currentDate) || [];
    const prevOrders = this.주문데이터.get(prevDate) || [];
    // 결제 활성 매장은 결제데이터 (주간) 기준으로 계산
    const currentPayments = this.결제데이터.get(currentDate) || [];
    const prevPayments = this.결제데이터.get(prevDate) || [];
    // 누적 통계는 누적결제데이터 사용
    const currentCumulativePayments = this.누적결제데이터.get(currentDate) || [];
    const prevCumulativePayments = this.누적결제데이터.get(prevDate) || [];

    // 카카오페이 프로모션 매장 = nice_pay_promotion_yn === 'O' (주문데이터 기준)
    const kakaoPayPromoShops = currentOrders.filter(o => o.nice_pay_promotion_yn === 'O');
    const kakaoPayShopCodes = new Set(kakaoPayPromoShops.map(o => o.shop_code));

    const kakaoPayShops = {
      prepaid: {
        pending: kakaoPayPromoShops.filter(o => o.pg_yn === '선불' && o.shop_status === '이용대기').length,
        active: kakaoPayPromoShops.filter(o => o.pg_yn === '선불' && o.shop_status === '이용').length,
      },
      postpaid: {
        pending: kakaoPayPromoShops.filter(o => o.pg_yn === '후불' && o.shop_status === '이용대기').length,
        active: kakaoPayPromoShops.filter(o => o.pg_yn === '후불' && o.shop_status === '이용').length,
      },
      total: kakaoPayPromoShops.length
    };

    // 쏠페이 매장 현황 (쏠페이 프로모션 매장)
    const solPayPromoShops = currentOrders.filter(o => o.sol_pay_promotion_yn === 'O');
    const solPayShopCodes = new Set(solPayPromoShops.map(o => o.shop_code));
    const solPayShops = {
      prepaid: {
        pending: solPayPromoShops.filter(o => o.shop_status === '이용대기').length,
        active: solPayPromoShops.filter(o => o.shop_status === '이용').length,
      },
      total: solPayPromoShops.length
    };

    // 이전 주 카카오페이 프로모션 매장 코드
    const prevKakaoPayShopCodes = new Set(prevOrders.filter(o => o.nice_pay_promotion_yn === 'O').map(o => o.shop_code));

    // 카카오페이 결제 활성화 현황 (결제 데이터에서 카카오페이 프로모션 매장만 필터)
    const currentKakaoPayPayments = currentPayments.filter(p => kakaoPayShopCodes.has(p.shop_code));
    const prevKakaoPayPayments = prevPayments.filter(p => prevKakaoPayShopCodes.has(p.shop_code));

    // 누적 카카오페이 결제
    const currentCumulativeKakaoPay = currentCumulativePayments.filter(p => kakaoPayShopCodes.has(p.shop_code));

    // 현재 주간 카카오페이 활성화
    const currentKakaoMoneyActivated = currentKakaoPayPayments.filter(p => p.kakao_money_count > 0);
    const prevKakaoMoneyActivated = prevKakaoPayPayments.filter(p => p.kakao_money_count > 0);

    // 누적 활성화
    const cumulativeActivatedKakaoPay = currentCumulativeKakaoPay.filter(p => p.count > 0);
    const cumulativeKakaoMoneyActivated = currentCumulativeKakaoPay.filter(p => p.kakao_money_count > 0);

    // 카카오페이 선불 매장 (주문데이터 기준: 선불 + 카카오프로모션 + 이용)
    const currentKakaoPayPrepaidOrders = kakaoPayPromoShops.filter(o => o.pg_yn === '선불' && o.shop_status === '이용');
    const prevKakaoPayPrepaidOrders = prevOrders.filter(o => o.nice_pay_promotion_yn === 'O' && o.pg_yn === '선불' && o.shop_status === '이용');

    // 매장별 그룹핑 (주문데이터는 매장당 여러 행 가능, 엑셀처럼 매장별 합산 필요)
    const groupByShop = (orders: OrderData[]) => {
      const shopMap = new Map<string, { orderCount: number; amount: number }>();
      orders.forEach(o => {
        const existing = shopMap.get(o.shop_code) || { orderCount: 0, amount: 0 };
        existing.orderCount += o.order_count_no_pos;
        existing.amount += o.price_no_pos;
        shopMap.set(o.shop_code, existing);
      });
      return shopMap;
    };

    const currentKakaoPayShopMap = groupByShop(currentKakaoPayPrepaidOrders);
    const prevKakaoPayShopMap = groupByShop(prevKakaoPayPrepaidOrders);

    console.log('[카카오페이 선불] 필터된 주문 행:', currentKakaoPayPrepaidOrders.length);
    console.log('[카카오페이 선불] 그룹핑 후 매장 수:', currentKakaoPayShopMap.size);
    console.log('[카카오페이 선불] 매장별 상세:', Array.from(currentKakaoPayShopMap.entries()).map(([code, data]) => `${code}: ${data.orderCount}건, ${data.amount}원`));

    // 주간 카카오페이 집계 (매장별 합산 후 계산 - 엑셀과 동일)
    const currentKakaoPayStats = {
      activatedShops: Array.from(currentKakaoPayShopMap.values()).filter(s => s.orderCount >= 1).length,
      kakaoMoneyShops: currentKakaoMoneyActivated.length,
      paymentCount: Array.from(currentKakaoPayShopMap.values()).reduce((sum, s) => sum + s.orderCount, 0),
      kakaoMoneyCount: currentKakaoPayPayments.reduce((sum, p) => sum + p.kakao_money_count, 0),
      paymentAmount: Array.from(currentKakaoPayShopMap.values()).filter(s => s.orderCount >= 1).reduce((sum, s) => sum + s.amount, 0),
      kakaoMoneyAmount: currentKakaoPayPayments.reduce((sum, p) => sum + p.kakao_money_amt, 0),
    };

    console.log('[카카오페이 선불] 최종 결과 - 활성화:', currentKakaoPayStats.activatedShops, '결제금액:', currentKakaoPayStats.paymentAmount);

    const prevKakaoPayStats = {
      activatedShops: Array.from(prevKakaoPayShopMap.values()).filter(s => s.orderCount >= 1).length,
      kakaoMoneyShops: prevKakaoMoneyActivated.length,
      paymentCount: Array.from(prevKakaoPayShopMap.values()).reduce((sum, s) => sum + s.orderCount, 0),
      kakaoMoneyCount: prevKakaoPayPayments.reduce((sum, p) => sum + p.kakao_money_count, 0),
      paymentAmount: Array.from(prevKakaoPayShopMap.values()).filter(s => s.orderCount >= 1).reduce((sum, s) => sum + s.amount, 0),
      kakaoMoneyAmount: prevKakaoPayPayments.reduce((sum, p) => sum + p.kakao_money_amt, 0),
    };

    // 누적 카카오페이 집계 (누적결제데이터 기준)
    const cumulativeKakaoPayStats = {
      activatedShops: cumulativeActivatedKakaoPay.length,
      kakaoMoneyShops: cumulativeKakaoMoneyActivated.length,
      paymentCount: currentCumulativeKakaoPay.reduce((sum, p) => sum + p.count, 0),
      kakaoMoneyCount: currentCumulativeKakaoPay.reduce((sum, p) => sum + p.kakao_money_count, 0),
      paymentAmount: currentCumulativeKakaoPay.reduce((sum, p) => sum + p.total_price, 0),
      kakaoMoneyAmount: currentCumulativeKakaoPay.reduce((sum, p) => sum + p.kakao_money_amt, 0),
    };

    // 후불 집계 (카카오페이 프로모션 중 후불 매장, 주문 데이터 기준)
    const currentKakaoPayPostpaid = kakaoPayPromoShops.filter(o => o.pg_yn === '후불' && o.shop_status === '이용');
    const prevKakaoPayPostpaidOrders = prevOrders.filter(o => o.nice_pay_promotion_yn === 'O' && o.pg_yn === '후불' && o.shop_status === '이용');

    const currentPostpaidShopMap = groupByShop(currentKakaoPayPostpaid);
    const prevPostpaidShopMap = groupByShop(prevKakaoPayPostpaidOrders);

    // 후불 활성화: order_count_no_pos >= 1 (주간 주문 발생)
    const currentPostpaidStats = {
      activatedShops: Array.from(currentPostpaidShopMap.values()).filter(s => s.orderCount >= 1).length,
      orderCount: Array.from(currentPostpaidShopMap.values()).reduce((sum, s) => sum + s.orderCount, 0),
      orderAmount: Array.from(currentPostpaidShopMap.values()).filter(s => s.orderCount >= 1).reduce((sum, s) => sum + s.amount, 0),
    };

    const prevPostpaidStats = {
      activatedShops: Array.from(prevPostpaidShopMap.values()).filter(s => s.orderCount >= 1).length,
      orderCount: Array.from(prevPostpaidShopMap.values()).reduce((sum, s) => sum + s.orderCount, 0),
      orderAmount: Array.from(prevPostpaidShopMap.values()).filter(s => s.orderCount >= 1).reduce((sum, s) => sum + s.amount, 0),
    };

    // 주간 비교 헬퍼 함수
    const makeWeeklyComparison = (label: string, last: number, current: number): WeeklyComparison => ({
      label,
      lastWeek: last,
      thisWeek: current,
      change: current - last,
      changeRate: last > 0 ? ((current - last) / last * 100).toFixed(0) + '%' : '-'
    });

    // 카카오페이 활성화 현황
    const kakaoPayActivation = {
      prepaid: {
        activatedShops: currentKakaoPayStats.activatedShops,
        kakaoMoneyShops: currentKakaoPayStats.kakaoMoneyShops,
        paymentCount: currentKakaoPayStats.paymentCount,
        kakaoMoneyCount: currentKakaoPayStats.kakaoMoneyCount,
        paymentAmount: currentKakaoPayStats.paymentAmount,
        kakaoMoneyAmount: currentKakaoPayStats.kakaoMoneyAmount,
      },
      postpaid: {
        activatedShops: currentPostpaidStats.activatedShops,
        paymentCount: currentPostpaidStats.orderCount,
        orderAmount: currentPostpaidStats.orderAmount,
      },
      // 선불+후불 합계
      total: {
        activatedShops: currentKakaoPayStats.activatedShops + currentPostpaidStats.activatedShops,
        paymentCount: currentKakaoPayStats.paymentCount + currentPostpaidStats.orderCount,
        paymentAmount: currentKakaoPayStats.paymentAmount + currentPostpaidStats.orderAmount,
      },
      weekly: {
        activatedShops: makeWeeklyComparison('결제 활성화 매장 수', prevKakaoPayStats.activatedShops, currentKakaoPayStats.activatedShops),
        kakaoMoneyShops: makeWeeklyComparison('카카오머니 활성화 매장 수', prevKakaoPayStats.kakaoMoneyShops, currentKakaoPayStats.kakaoMoneyShops),
        paymentCount: makeWeeklyComparison('결제 건수', prevKakaoPayStats.paymentCount, currentKakaoPayStats.paymentCount),
        kakaoMoneyCount: makeWeeklyComparison('카카오머니 결제 건수', prevKakaoPayStats.kakaoMoneyCount, currentKakaoPayStats.kakaoMoneyCount),
        paymentAmount: makeWeeklyComparison('결제 금액', prevKakaoPayStats.paymentAmount, currentKakaoPayStats.paymentAmount),
        kakaoMoneyAmount: makeWeeklyComparison('카카오머니 결제 금액', prevKakaoPayStats.kakaoMoneyAmount, currentKakaoPayStats.kakaoMoneyAmount),
        postpaidShops: makeWeeklyComparison('후불 활성화 매장 수', prevPostpaidStats.activatedShops, currentPostpaidStats.activatedShops),
        postpaidOrderCount: makeWeeklyComparison('후불 주문 건수', prevPostpaidStats.orderCount, currentPostpaidStats.orderCount),
        postpaidOrderAmount: makeWeeklyComparison('후불 주문 금액', prevPostpaidStats.orderAmount, currentPostpaidStats.orderAmount),
        totalActivatedShops: makeWeeklyComparison('전체 활성화 매장 수',
          prevKakaoPayStats.activatedShops + prevPostpaidStats.activatedShops,
          currentKakaoPayStats.activatedShops + currentPostpaidStats.activatedShops),
        totalPaymentCount: makeWeeklyComparison('전체 결제 건수',
          prevKakaoPayStats.paymentCount + prevPostpaidStats.orderCount,
          currentKakaoPayStats.paymentCount + currentPostpaidStats.orderCount),
        totalPaymentAmount: makeWeeklyComparison('전체 결제 금액',
          prevKakaoPayStats.paymentAmount + prevPostpaidStats.orderAmount,
          currentKakaoPayStats.paymentAmount + currentPostpaidStats.orderAmount),
      },
      cumulative: {
        activatedShops: cumulativeKakaoPayStats.activatedShops,
        kakaoMoneyShops: cumulativeKakaoPayStats.kakaoMoneyShops,
        paymentCount: cumulativeKakaoPayStats.paymentCount,
        kakaoMoneyCount: cumulativeKakaoPayStats.kakaoMoneyCount,
        paymentAmount: cumulativeKakaoPayStats.paymentAmount,
        kakaoMoneyAmount: cumulativeKakaoPayStats.kakaoMoneyAmount,
        postpaidShops: currentPostpaidStats.activatedShops,
        postpaidOrderCount: currentPostpaidStats.orderCount,
        postpaidOrderAmount: currentPostpaidStats.orderAmount,
      }
    };

    // 쏠페이 활성화 현황 (결제 데이터에서 쏠페이 프로모션 매장만 필터)
    const prevSolPayShopCodes = new Set(prevOrders.filter(o => o.sol_pay_promotion_yn === 'O').map(o => o.shop_code));

    const currentSolPayPayments = currentPayments.filter(p => solPayShopCodes.has(p.shop_code));
    const prevSolPayPayments = prevPayments.filter(p => prevSolPayShopCodes.has(p.shop_code));
    const currentCumulativeSolPay = currentCumulativePayments.filter(p => solPayShopCodes.has(p.shop_code));

    const currentSolPayActivated = currentSolPayPayments.filter(p => p.sol_pay_count > 0);
    const prevSolPayActivated = prevSolPayPayments.filter(p => p.sol_pay_count > 0);
    const cumulativeSolPayActivated = currentCumulativeSolPay.filter(p => p.sol_pay_count > 0);

    // 쏠페이 선불 매장 (주문데이터 기준: 선불 + 쏠페이프로모션 + 이용)
    const currentSolPayPrepaidOrders = solPayPromoShops.filter(o => o.pg_yn === '선불' && o.shop_status === '이용');
    const prevSolPayPrepaidOrders = prevOrders.filter(o => o.sol_pay_promotion_yn === 'O' && o.pg_yn === '선불' && o.shop_status === '이용');

    const currentSolPayShopMap = groupByShop(currentSolPayPrepaidOrders);
    const prevSolPayShopMap = groupByShop(prevSolPayPrepaidOrders);

    // 주간 쏠페이 집계 (매장별 합산 - 엑셀과 동일)
    const currentSolPayStats = {
      activatedShops: Array.from(currentSolPayShopMap.values()).filter(s => s.orderCount >= 1).length,
      solPayShops: currentSolPayActivated.length,
      paymentCount: Array.from(currentSolPayShopMap.values()).reduce((sum, s) => sum + s.orderCount, 0),
      solPayCount: currentSolPayPayments.reduce((sum, p) => sum + p.sol_pay_count, 0),
      paymentAmount: Array.from(currentSolPayShopMap.values()).filter(s => s.orderCount >= 1).reduce((sum, s) => sum + s.amount, 0),
      solPayAmount: currentSolPayPayments.reduce((sum, p) => sum + p.sol_pay_amt, 0),
    };

    const prevSolPayStats = {
      activatedShops: Array.from(prevSolPayShopMap.values()).filter(s => s.orderCount >= 1).length,
      solPayShops: prevSolPayActivated.length,
      paymentCount: Array.from(prevSolPayShopMap.values()).reduce((sum, s) => sum + s.orderCount, 0),
      solPayCount: prevSolPayPayments.reduce((sum, p) => sum + p.sol_pay_count, 0),
      paymentAmount: Array.from(prevSolPayShopMap.values()).filter(s => s.orderCount >= 1).reduce((sum, s) => sum + s.amount, 0),
      solPayAmount: prevSolPayPayments.reduce((sum, p) => sum + p.sol_pay_amt, 0),
    };

    // 누적 쏠페이 집계 (누적결제데이터 기준)
    const cumulativeSolPayStats = {
      activatedShops: currentCumulativeSolPay.filter(p => p.count > 0).length,
      solPayShops: cumulativeSolPayActivated.length,
      paymentCount: currentCumulativeSolPay.reduce((sum, p) => sum + p.count, 0),
      solPayCount: currentCumulativeSolPay.reduce((sum, p) => sum + p.sol_pay_count, 0),
      paymentAmount: currentCumulativeSolPay.reduce((sum, p) => sum + p.total_price, 0),
      solPayAmount: currentCumulativeSolPay.reduce((sum, p) => sum + p.sol_pay_amt, 0),
    };

    const solPayActivation = {
      prepaid: {
        activatedShops: currentSolPayStats.activatedShops,
        solPayShops: currentSolPayStats.solPayShops,
        paymentCount: currentSolPayStats.paymentCount,
        solPayCount: currentSolPayStats.solPayCount,
        paymentAmount: currentSolPayStats.paymentAmount,
        solPayAmount: currentSolPayStats.solPayAmount,
      },
      weekly: {
        activatedShops: makeWeeklyComparison('결제 활성화 매장 수', prevSolPayStats.activatedShops, currentSolPayStats.activatedShops),
        solPayShops: makeWeeklyComparison('쏠페이 활성화 매장 수', prevSolPayStats.solPayShops, currentSolPayStats.solPayShops),
        paymentCount: makeWeeklyComparison('결제 건수', prevSolPayStats.paymentCount, currentSolPayStats.paymentCount),
        solPayCount: makeWeeklyComparison('쏠페이 결제 건수', prevSolPayStats.solPayCount, currentSolPayStats.solPayCount),
        paymentAmount: makeWeeklyComparison('결제 금액', prevSolPayStats.paymentAmount, currentSolPayStats.paymentAmount),
        solPayAmount: makeWeeklyComparison('쏠페이 결제 금액', prevSolPayStats.solPayAmount, currentSolPayStats.solPayAmount),
      },
      cumulative: {
        activatedShops: cumulativeSolPayStats.activatedShops,
        solPayShops: cumulativeSolPayStats.solPayShops,
        paymentCount: cumulativeSolPayStats.paymentCount,
        solPayCount: cumulativeSolPayStats.solPayCount,
        paymentAmount: cumulativeSolPayStats.paymentAmount,
        solPayAmount: cumulativeSolPayStats.solPayAmount,
      }
    };

    // 신규 유입 & 전환 (매장 등록일 기준)
    // currentDate 기준 7일 전부터 currentDate까지 등록된 매장
    const currentDateObj = new Date(currentDate);
    const weekStartDate = new Date(currentDateObj);
    weekStartDate.setDate(weekStartDate.getDate() - 6); // 7일 전 (당일 포함 7일)

    const formatDateForComparison = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const weekStart = formatDateForComparison(weekStartDate);
    const weekEnd = formatDateForComparison(currentDateObj);

    console.log('[신규유입] 기준 기간:', weekStart, '~', weekEnd);

    // 해당 주간에 등록된 매장 (등록일이 주간 범위 내)
    const newShopsThisWeek = currentOrders.filter(o => {
      const regDatetime = o.ins_datetime; // "2023-04-18 13:20:32" 형식
      if (!regDatetime) return false;
      const regDate = regDatetime.split(' ')[0]; // "2023-04-18"만 추출
      return regDate && regDate >= weekStart && regDate <= weekEnd;
    });

    console.log('[신규유입] 전체 신규 매장:', newShopsThisWeek.length);
    console.log('[신규유입] 카카오페이 프로모션:', newShopsThisWeek.filter(o => o.nice_pay_promotion_yn === 'O').length);
    console.log('[신규유입] 쏠페이 프로모션:', newShopsThisWeek.filter(o => o.sol_pay_promotion_yn === 'O').length);

    // 전환: 이전에 이용대기였다가 현재 이용으로 변경된 매장
    const prevPendingCodes = new Set(prevOrders.filter(o => o.shop_status === '이용대기').map(o => o.shop_code));
    const convertedToActive = currentOrders.filter(o =>
      o.shop_status === '이용' && prevPendingCodes.has(o.shop_code)
    );

    const newInflow = {
      kakaoPayNew: newShopsThisWeek.filter(o => o.nice_pay_promotion_yn === 'O').length,
      kakaoPayConverted: convertedToActive.filter(o => o.nice_pay_promotion_yn === 'O').length,
      solPayNew: newShopsThisWeek.filter(o => o.sol_pay_promotion_yn === 'O').length,
      solPayConverted: convertedToActive.filter(o => o.sol_pay_promotion_yn === 'O').length,
    };

    // 이탈 매장 계산 (전주 활성화 → 금주 비활성화)
    const prevActivatedShopCodes = new Set<string>();

    // 전주 카카오페이 활성화 매장
    Array.from(prevKakaoPayShopMap.entries()).forEach(([code, data]) => {
      if (data.orderCount >= 1) prevActivatedShopCodes.add(code);
    });
    Array.from(prevPostpaidShopMap.entries()).forEach(([code, data]) => {
      if (data.orderCount >= 1) prevActivatedShopCodes.add(code);
    });
    // 전주 쏠페이 활성화 매장
    Array.from(prevSolPayShopMap.entries()).forEach(([code, data]) => {
      if (data.orderCount >= 1) prevActivatedShopCodes.add(code);
    });

    const currentActivatedShopCodes = new Set<string>();

    // 금주 카카오페이 활성화 매장
    Array.from(currentKakaoPayShopMap.entries()).forEach(([code, data]) => {
      if (data.orderCount >= 1) currentActivatedShopCodes.add(code);
    });
    Array.from(currentPostpaidShopMap.entries()).forEach(([code, data]) => {
      if (data.orderCount >= 1) currentActivatedShopCodes.add(code);
    });
    // 금주 쏠페이 활성화 매장
    Array.from(currentSolPayShopMap.entries()).forEach(([code, data]) => {
      if (data.orderCount >= 1) currentActivatedShopCodes.add(code);
    });

    // 이탈 매장: 전주에는 있었지만 금주에는 없는 매장
    const churnedShopCodes = Array.from(prevActivatedShopCodes).filter(
      code => !currentActivatedShopCodes.has(code)
    );

    const churnedShopList = churnedShopCodes.map(code => {
      const orderInfo = currentOrders.find(o => o.shop_code === code) || prevOrders.find(o => o.shop_code === code);
      const promotionType = orderInfo?.nice_pay_promotion_yn === 'O' ? '카카오페이' :
                           orderInfo?.sol_pay_promotion_yn === 'O' ? '쏠페이' : '기타';
      return {
        shop_code: code,
        shop_name: orderInfo?.shop_name || '',
        pg_yn: orderInfo?.pg_yn || '',
        promotion_type: promotionType
      };
    });

    // 프로모션 리스크 매장 (리스크 매장 중 카카오페이 또는 쏠페이 프로모션 대상)
    const riskShopList = this.findRiskShops(currentDate);
    const promotionRiskShopList = riskShopList.filter(
      shop => shop.nice_pay_promotion_yn || shop.sol_pay_promotion_yn
    );

    console.log('[이탈 매장] 전주 활성화:', prevActivatedShopCodes.size);
    console.log('[이탈 매장] 금주 활성화:', currentActivatedShopCodes.size);
    console.log('[이탈 매장] 이탈 수:', churnedShopCodes.length);
    console.log('[프로모션 리스크] 전체 리스크:', riskShopList.length);
    console.log('[프로모션 리스크] 프로모션 리스크:', promotionRiskShopList.length);

    const churnAndRisk = {
      churnedShops: churnedShopCodes.length,
      churnedShopList,
      promotionRiskShops: promotionRiskShopList.length,
      promotionRiskShopList
    };

    return {
      kakaoPayShops,
      solPayShops,
      kakaoPayActivation,
      solPayActivation,
      newInflow,
      churnAndRisk
    };
  }

  // 대리점별 실적 분석
  calculateAgencyPerformance(date: string): AgencyPerformance[] {
    const allOrders = this.주문데이터.get(date) || [];
    // 종료 매장 제외
    const orders = allOrders.filter(o => o.shop_status !== '종료');

    // 대리점별로 그룹화
    const agencyMap = new Map<string, OrderData[]>();

    for (const order of orders) {
      const agencyName = order.prev_company_name && order.prev_company_name !== '-' && order.prev_company_name.trim() !== ''
        ? order.prev_company_name.trim()
        : '직영업';

      if (!agencyMap.has(agencyName)) {
        agencyMap.set(agencyName, []);
      }
      agencyMap.get(agencyName)!.push(order);
    }

    // 리스크 매장 및 이탈 매장 미리 계산
    const riskShopList = this.findRiskShops(date);
    const riskShopCodes = new Set(riskShopList.map(s => s.shop_code));

    // 이탈 매장 계산 (전주 활성화 → 금주 비활성화)
    const prevDate = this.getPreviousDate(date);
    const churnedShopCodes = new Set<string>();
    if (prevDate) {
      const prevOrders = (this.주문데이터.get(prevDate) || []).filter(o => o.shop_status !== '종료');
      const currentOrders = orders;

      const prevActivated = new Set(
        prevOrders.filter(o => o.order_count_no_pos >= 1).map(o => o.shop_code)
      );
      const currentActivated = new Set(
        currentOrders.filter(o => o.order_count_no_pos >= 1).map(o => o.shop_code)
      );

      for (const shopCode of prevActivated) {
        if (!currentActivated.has(shopCode)) {
          churnedShopCodes.add(shopCode);
        }
      }
    }

    // 신규 매장 (7일 이내)
    const newShopsList = this.findRecentlyAddedShops(date, 7);
    const newShopCodes = new Set(newShopsList.map(s => s.shop_code));

    // 대리점별 분석
    const performances: AgencyPerformance[] = [];

    for (const [agencyName, shopList] of agencyMap) {
      const totalShops = shopList.length;
      const activeShops = shopList.filter(s => s.shop_status === '이용').length;
      const pendingShops = shopList.filter(s => s.shop_status === '이용대기').length;
      const prepaidShops = shopList.filter(s => s.pg_yn === '선불').length;
      const postpaidShops = shopList.filter(s => s.pg_yn === '후불').length;

      // 활성화 매장 (주문이 있는 매장)
      const activatedShops = shopList.filter(s => s.order_count_no_pos >= 1).length;
      const activationRate = activeShops > 0 ? (activatedShops / activeShops) * 100 : 0;

      // 리스크, 이탈, 신규 매장 수
      const shopCodes = new Set(shopList.map(s => s.shop_code));
      const riskShops = shopList.filter(s => riskShopCodes.has(s.shop_code)).length;
      const churnedShops = shopList.filter(s => churnedShopCodes.has(s.shop_code)).length;
      const newShops = shopList.filter(s => newShopCodes.has(s.shop_code)).length;

      // 디바이스 및 주문 통계
      const totalDevices = shopList.reduce((sum, s) => sum + s.device_count, 0);
      const totalOrderCount = shopList.reduce((sum, s) => sum + s.order_count_no_pos, 0);
      const avgOrderCount = totalShops > 0 ? totalOrderCount / totalShops : 0;
      const totalOrderAmount = shopList.reduce((sum, s) => sum + s.price_no_pos, 0);

      performances.push({
        agencyName,
        isDirect: agencyName === '직영업',
        totalShops,
        activeShops,
        pendingShops,
        prepaidShops,
        postpaidShops,
        activatedShops,
        activationRate,
        riskShops,
        churnedShops,
        newShops,
        totalDevices,
        avgOrderCount,
        totalOrderAmount,
        shopList
      });
    }

    // 활성화율 기준 내림차순 정렬 (직영업은 항상 맨 위)
    return performances.sort((a, b) => {
      if (a.isDirect) return -1;
      if (b.isDirect) return 1;
      return b.activationRate - a.activationRate;
    });
  }
}

// 싱글톤 인스턴스
export const dataService = new DataService();
