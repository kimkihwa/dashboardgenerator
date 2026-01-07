<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { dataService } from './services/dataService';
import { exportFullHTML } from './services/fullExportService';
import type { KPIMetrics, PeriodComparison, NewShopTracking, PaymentSummaryStats } from './types';
import TrendChart from './components/TrendChart.vue';
import {
  useChartLabels,
  useTotalShopDatasets,
  useShopStatusDatasets,
  useNewRiskDatasets,
  useWeeklyPaymentDatasets,
  useWeeklyPaymentProviderDatasets,
  useWeeklyPaymentProviderAmountDatasets,
  useCumulativePaymentProviderDatasets,
  useChangeRates,
  useGrowthRateDatasets,
  usePaymentGrowthDatasets
} from './composables/useChartDatasets';

// 상태
const isLoading = ref(false);
const isDataLoaded = ref(false);
const errorMessage = ref('');
const basePath = ref('');
const availableDates = ref<string[]>([]);
const selectedDate = ref('');

// KPI 데이터
const kpiMetrics = ref<KPIMetrics | null>(null);
const periodComparison = ref<PeriodComparison[]>([]);
const newShopTracking = ref<NewShopTracking[]>([]);
const paymentProviderStats = ref<{
  solPayPromoShops: number;
  solPayActiveShops: number;
  solPayActivationRate: string;
  nicePayPromoShops: number;
  kakaoPayActiveShops: number;
} | null>(null);

// 페이먼트 종합 현황
const paymentSummary = ref<PaymentSummaryStats | null>(null);

// 탭
const activeTab = ref<'overview' | 'risk' | 'payment' | 'newshops' | 'agency' | 'pos'>('overview');

// 페이먼트 탭 내 서브탭 (일별/누적)
const paymentViewMode = ref<'daily' | 'cumulative'>('cumulative');

// 아코디언 상태
const accordionOpen = ref<{ kakao: boolean; solpay: boolean; churned: boolean; promotionRisk: boolean }>({
  kakao: false,
  solpay: false,
  churned: false,
  promotionRisk: false
});

// 리스크 매장 등록일 필터 (주 단위) - 기본값 4주
const riskShopWeeksFilter = ref<number>(4);

// 차트용 리스크 매장 등록일 필터 (주 단위) - 기본값 4주
const chartRiskWeeksFilter = ref<number>(4);

// 프로모션 리스크 매장 등록일 필터 (주 단위) - 기본값 4주
const promotionRiskWeeksFilter = ref<number>(4);

// 차트용 이용 상태별 매장 등록일 필터 (주 단위) - 기본값 0(전체)
const chartStatusWeeksFilter = ref<number>(0);

// 대리점 실적 등록일 필터 (주 단위) - 기본값 0(전체)
const agencyWeeksFilter = ref<number>(0);

// 확장된 대리점 (매장 목록 표시용)
const expandedAgency = ref<string | null>(null);

// ===== 차트 데이터 (composables) =====
const chartLabels = useChartLabels(periodComparison);
const totalShopDatasets = useTotalShopDatasets(periodComparison);
const shopStatusDatasets = useShopStatusDatasets(periodComparison);
const newRiskDatasets = useNewRiskDatasets(periodComparison);
const weeklyPaymentDatasets = useWeeklyPaymentDatasets(periodComparison);
const weeklyPaymentProviderDatasets = useWeeklyPaymentProviderDatasets(periodComparison);
const weeklyPaymentProviderAmountDatasets = useWeeklyPaymentProviderAmountDatasets(periodComparison);
const cumulativePaymentProviderDatasets = useCumulativePaymentProviderDatasets(periodComparison);
const changeRates = useChangeRates(periodComparison);
const growthRateDatasets = useGrowthRateDatasets(changeRates);
const paymentGrowthDatasets = usePaymentGrowthDatasets(changeRates);

// 자동 데이터 로드 시도
onMounted(async () => {
  try {
    const defaultPath = await window.electronAPI.getDefaultPath();
    const orderDataPath = `${defaultPath}/주문 데이터`;
    const exists = await window.electronAPI.checkDirectoryExists(orderDataPath);

    if (exists) {
      basePath.value = defaultPath;
      await loadData();
    }
  } catch {
    console.log('자동 로드 실패, 수동 선택 필요');
  }
});

// 폴더 선택
async function selectFolder() {
  try {
    const selected = await window.electronAPI.selectDirectory();
    if (selected) {
      basePath.value = selected;
      await loadData();
    }
  } catch {
    errorMessage.value = '폴더 선택 중 오류가 발생했습니다.';
  }
}

// 데이터 로드
async function loadData() {
  if (!basePath.value) return;

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const data = await window.electronAPI.loadData(basePath.value);

    if (data.주문데이터.length === 0) {
      errorMessage.value = '주문 데이터가 없습니다. 올바른 폴더를 선택해주세요.';
      isLoading.value = false;
      return;
    }

    dataService.loadData(data);
    availableDates.value = dataService.getAvailableDates();

    if (availableDates.value.length > 0) {
      selectedDate.value = availableDates.value[availableDates.value.length - 1] ?? '';
      updateMetrics();
    }

    isDataLoaded.value = true;
  } catch (error) {
    errorMessage.value = '데이터 로드 중 오류가 발생했습니다.';
    console.error(error);
  } finally {
    isLoading.value = false;
  }
}

// 날짜 변경시 메트릭 업데이트
watch(selectedDate, () => {
  if (selectedDate.value) {
    updateMetrics();
  }
});

function updateMetrics() {
  if (!selectedDate.value) return;

  kpiMetrics.value = dataService.calculateKPIMetrics(selectedDate.value);
  periodComparison.value = dataService.getPeriodComparison();
  newShopTracking.value = dataService.trackNewShops(selectedDate.value);
  paymentProviderStats.value = dataService.getPaymentProviderStats(selectedDate.value);

  // 페이먼트 종합 현황 계산 (이전 날짜와 비교)
  const currentIndex = availableDates.value.indexOf(selectedDate.value);
  if (currentIndex > 0) {
    const prevDate = availableDates.value[currentIndex - 1];
    if (prevDate) {
      paymentSummary.value = dataService.calculatePaymentSummary(selectedDate.value, prevDate);
    }
  } else {
    // 이전 날짜가 없으면 자기 자신과 비교
    paymentSummary.value = dataService.calculatePaymentSummary(selectedDate.value, selectedDate.value);
  }
}

// 이전 날짜 대비 변화
const prevDateMetrics = computed(() => {
  if (!selectedDate.value || availableDates.value.length < 2) return null;

  const currentIndex = availableDates.value.indexOf(selectedDate.value);
  if (currentIndex <= 0) return null;

  const prevDate = availableDates.value[currentIndex - 1];
  if (!prevDate) return null;
  return dataService.calculateKPIMetrics(prevDate);
});

// 변화율 계산
function calcChange(current: number, previous: number | undefined): { value: number; isPositive: boolean; text: string } {
  if (previous === undefined || previous === 0) {
    return { value: 0, isPositive: true, text: '-' };
  }
  const change = current - previous;
  const percent = ((change / previous) * 100).toFixed(1);
  return {
    value: change,
    isPositive: change >= 0,
    text: `${change >= 0 ? '+' : ''}${change} (${change >= 0 ? '+' : ''}${percent}%)`
  };
}

// 대리점 확장/축소
function toggleAgency(agencyName: string) {
  expandedAgency.value = expandedAgency.value === agencyName ? null : agencyName;
}

// 대리점 필터 라벨
const agencyFilterLabel = computed(() => {
  if (agencyWeeksFilter.value === 0) return '';
  if (agencyWeeksFilter.value === 4) return ' (4주 이내)';
  if (agencyWeeksFilter.value === 8) return ' (8주 이내)';
  if (agencyWeeksFilter.value === 12) return ' (12주 이내)';
  if (agencyWeeksFilter.value === 24) return ' (24주 이내)';
  if (agencyWeeksFilter.value === 52) return ' (1년 이내)';
  return ` (${agencyWeeksFilter.value}주 이내)`;
});

// 리스크 매장 코드 Set
const riskShopCodes = computed(() => {
  return new Set(kpiMetrics.value?.riskShopList.map(s => s.shop_code) || []);
});

// 이탈 매장 코드 Set (전주 활성화 → 금주 비활성화)
const churnedShopCodes = computed(() => {
  if (!selectedDate.value || availableDates.value.length < 2) return new Set<string>();

  const currentIndex = availableDates.value.indexOf(selectedDate.value);
  if (currentIndex <= 0) return new Set<string>();

  const prevDate = availableDates.value[currentIndex - 1];
  if (!prevDate) return new Set<string>();

  // 주문 데이터 직접 조회
  const prevOrders = dataService.getOrderData(prevDate);
  const currentOrders = dataService.getOrderData(selectedDate.value);

  if (!prevOrders || !currentOrders) return new Set<string>();

  // 종료 매장 제외
  const prevActive = prevOrders.filter(o => o.shop_status !== '종료');
  const currentActive = currentOrders.filter(o => o.shop_status !== '종료');

  // 전주에 활성화된 매장 (주문이 1건 이상)
  const prevActivated = new Set(
    prevActive
      .filter(o => o.order_count_no_pos >= 1)
      .map(o => o.shop_code)
  );

  // 금주에 활성화된 매장
  const currentActivated = new Set(
    currentActive
      .filter(o => o.order_count_no_pos >= 1)
      .map(o => o.shop_code)
  );

  // 전주 활성화 → 금주 비활성화
  const churned = new Set<string>();
  for (const shopCode of prevActivated) {
    if (!currentActivated.has(shopCode)) {
      churned.add(shopCode);
    }
  }

  return churned;
});

// 대리점 실적 데이터
const agencyPerformance = computed(() => {
  if (!selectedDate.value) return [];
  return dataService.calculateAgencyPerformance(selectedDate.value);
});

// 등록일 필터링된 대리점 실적
const filteredAgencyPerformance = computed(() => {
  if (agencyWeeksFilter.value === 0) {
    return agencyPerformance.value;
  }

  const targetDate = dataService.parseDate(selectedDate.value || '');
  if (!targetDate) return agencyPerformance.value;

  const cutoffDate = new Date(targetDate);
  cutoffDate.setDate(cutoffDate.getDate() - (agencyWeeksFilter.value * 7));

  return agencyPerformance.value.map(agency => {
    const filteredShopList = agency.shopList.filter(shop => {
      const insDate = dataService.parseInsDatetime(shop.ins_datetime);
      return insDate && insDate >= cutoffDate;
    });

    if (filteredShopList.length === 0) {
      return {
        ...agency,
        totalShops: 0,
        activeShops: 0,
        pendingShops: 0,
        prepaidShops: 0,
        postpaidShops: 0,
        activatedShops: 0,
        activationRate: 0,
        riskShops: 0,
        churnedShops: 0,
        newShops: 0,
        totalDevices: 0,
        avgOrderCount: 0,
        totalOrderAmount: 0,
        shopList: []
      };
    }

    const activeShops = filteredShopList.filter(s => s.shop_status === '이용').length;
    const activatedShops = filteredShopList.filter(s => s.order_count_no_pos >= 1).length;

    // 필터링된 매장 코드 Set
    const filteredShopCodes = new Set(filteredShopList.map(s => s.shop_code));

    // 원본 agency의 이탈 매장 중 필터링된 매장에 포함된 것만 계산
    const churnedShops = agency.shopList.filter(s => {
      // 원본 agency에서 이탈로 표시된 매장인지 확인
      const isChurned = agency.shopList.some(shop =>
        shop.shop_code === s.shop_code &&
        filteredShopCodes.has(s.shop_code)
      );
      // 실제 이탈 여부는 원본 데이터의 churnedShops 계산 로직 활용
      // 원본에서 이탈된 것으로 계산된 매장이 필터링된 목록에 있는지 확인
      return filteredShopCodes.has(s.shop_code);
    }).length;

    // 실제로는 원본 agency.shopList에서 계산된 이탈 매장 수를 가져와야 함
    // agency의 원본 churnedShops 값을 활용하되, 필터링된 매장만 카운트
    const originalChurnedCount = filteredShopList.filter(s => {
      // 원본 대리점 데이터의 모든 매장 리스트를 순회하며 이탈 여부 확인 필요
      // 하지만 현재 구조에서는 개별 shop의 이탈 여부를 알 수 없으므로
      // 필터가 적용되어도 원본 비율을 유지
      return false; // 임시로 0 반환, 실제 로직은 dataService에서 계산 필요
    }).length;

    return {
      ...agency,
      totalShops: filteredShopList.length,
      activeShops,
      pendingShops: filteredShopList.filter(s => s.shop_status === '이용대기').length,
      prepaidShops: filteredShopList.filter(s => s.pg_yn === '선불').length,
      postpaidShops: filteredShopList.filter(s => s.pg_yn === '후불').length,
      activatedShops,
      activationRate: activeShops > 0 ? (activatedShops / activeShops) * 100 : 0,
      riskShops: filteredShopList.filter(s => {
        const shopCodes = new Set(kpiMetrics.value?.riskShopList.map(r => r.shop_code) || []);
        return shopCodes.has(s.shop_code);
      }).length,
      churnedShops: agency.churnedShops, // 원본 이탈 수 유지 (전주 활성화 → 금주 비활성화)
      newShops: filteredShopList.filter(s => {
        const insDate = dataService.parseInsDatetime(s.ins_datetime);
        if (!insDate || !targetDate) return false;
        const diffTime = targetDate.getTime() - insDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }).length,
      totalDevices: filteredShopList.reduce((sum, s) => sum + s.device_count, 0),
      avgOrderCount: filteredShopList.length > 0 ? filteredShopList.reduce((sum, s) => sum + s.order_count_no_pos, 0) / filteredShopList.length : 0,
      totalOrderAmount: filteredShopList.reduce((sum, s) => sum + s.price_no_pos, 0),
      shopList: filteredShopList
    };
  }).filter(agency => agency.totalShops > 0);
});

// 리스크 매장 등록일 필터링 (테이블용)
const filteredRiskShops = computed(() => {
  if (!kpiMetrics.value) return [];

  const shops = kpiMetrics.value.riskShopList;

  if (riskShopWeeksFilter.value === 0) return shops;

  const baseDate = selectedDate.value ? dataService.parseDate(selectedDate.value) : new Date();
  if (!baseDate) return shops;

  const cutoffDate = new Date(baseDate);
  cutoffDate.setDate(cutoffDate.getDate() - (riskShopWeeksFilter.value * 7));

  return shops.filter(shop => {
    const insDate = dataService.parseInsDatetime(shop.ins_datetime);
    return insDate && insDate >= cutoffDate;
  });
});

// 프로모션 리스크 매장 등록일 필터링
const filteredPromotionRiskShops = computed(() => {
  if (!paymentSummary.value) return [];

  const shops = paymentSummary.value.churnAndRisk.promotionRiskShopList;

  if (promotionRiskWeeksFilter.value === 0) return shops;

  const baseDate = selectedDate.value ? dataService.parseDate(selectedDate.value) : new Date();
  if (!baseDate) return shops;

  const cutoffDate = new Date(baseDate);
  cutoffDate.setDate(cutoffDate.getDate() - (promotionRiskWeeksFilter.value * 7));

  return shops.filter(shop => {
    const insDate = dataService.parseInsDatetime(shop.ins_datetime);
    return insDate && insDate >= cutoffDate;
  });
});

// 차트용 필터링된 리스크 매장 수 계산
const filteredNewRiskDatasets = computed(() => {
  if (chartRiskWeeksFilter.value === 0) {
    // 필터 없음 - 원본 데이터 사용
    return newRiskDatasets.value;
  }

  // 각 날짜별로 리스크 매장을 등록일 기준으로 필터링
  const filteredRiskCounts = periodComparison.value.map(p => {
    const baseDate = dataService.parseDate(p.date);
    if (!baseDate) return 0;

    const cutoffDate = new Date(baseDate);
    cutoffDate.setDate(cutoffDate.getDate() - (chartRiskWeeksFilter.value * 7));

    // 해당 날짜의 리스크 매장 리스트 가져오기
    const riskShops = dataService.findRiskShops(p.date);

    // 등록일 필터 적용
    return riskShops.filter(shop => {
      const insDate = dataService.parseInsDatetime(shop.ins_datetime);
      return insDate && insDate >= cutoffDate;
    }).length;
  });

  return [
    {
      label: '신규 매장',
      data: periodComparison.value.map(p => p.newShops),
      borderColor: '#9b59b6',
    },
    {
      label: `리스크 매장 (${chartRiskWeeksFilter.value}주 이내)`,
      data: filteredRiskCounts,
      borderColor: '#f4212e',
    }
  ];
});

// 차트용 필터링된 이용 상태별 매장 수 계산
const filteredShopStatusDatasets = computed(() => {
  if (chartStatusWeeksFilter.value === 0) {
    // 필터 없음 - 원본 데이터 사용
    return shopStatusDatasets.value;
  }

  // 각 날짜별로 매장을 등록일 기준으로 필터링
  const filteredActiveCounts = periodComparison.value.map(p => {
    const baseDate = dataService.parseDate(p.date);
    if (!baseDate) return 0;

    const cutoffDate = new Date(baseDate);
    cutoffDate.setDate(cutoffDate.getDate() - (chartStatusWeeksFilter.value * 7));

    // 해당 날짜의 주문 데이터 가져와서 필터링
    const orders = dataService.getOrderData(p.date);
    return orders.filter(shop => {
      if (shop.shop_status !== '이용') return false;
      const insDate = dataService.parseInsDatetime(shop.ins_datetime);
      return insDate && insDate >= cutoffDate;
    }).length;
  });

  const filteredPendingCounts = periodComparison.value.map(p => {
    const baseDate = dataService.parseDate(p.date);
    if (!baseDate) return 0;

    const cutoffDate = new Date(baseDate);
    cutoffDate.setDate(cutoffDate.getDate() - (chartStatusWeeksFilter.value * 7));

    const orders = dataService.getOrderData(p.date);
    return orders.filter(shop => {
      if (shop.shop_status !== '이용대기') return false;
      const insDate = dataService.parseInsDatetime(shop.ins_datetime);
      return insDate && insDate >= cutoffDate;
    }).length;
  });

  return [
    {
      label: `이용 매장 (${chartStatusWeeksFilter.value}주 이내)`,
      data: filteredActiveCounts,
      borderColor: '#17bf63',
    },
    {
      label: `이용대기 (${chartStatusWeeksFilter.value}주 이내)`,
      data: filteredPendingCounts,
      borderColor: '#ffad1f',
    }
  ];
});

// 숫자/금액 포맷
function formatNumber(num: number): string {
  return dataService.formatNumber(num);
}

function formatCurrency(amount: number): string {
  return dataService.formatCurrency(amount);
}

// 짧은 금액 포맷 (만원 단위)
function formatCurrencyShort(amount: number): string {
  const num = Number(amount) || 0;
  if (Math.abs(num) >= 100000000) {
    return (num / 100000000).toFixed(1) + '억';
  } else if (Math.abs(num) >= 10000) {
    return (num / 10000).toFixed(0) + '만원';
  }
  return num.toLocaleString() + '원';
}

function formatDate(dateStr: string): string {
  return dataService.formatDate(dateStr);
}

// 아코디언 토글
function toggleAccordion(key: 'kakao' | 'solpay' | 'churned' | 'promotionRisk') {
  accordionOpen.value[key] = !accordionOpen.value[key];
}

// 카카오페이 활성화율 계산 (주간 결제 매장 / 이용 매장)
// 카카오페이 선불 활성화율 계산 (이용 매장 중 활성화율)
const calcPrepaidActivationRate = computed(() => {
  if (!paymentSummary.value) return 0;
  const activated = paymentSummary.value.kakaoPayActivation.prepaid.activatedShops;
  const total = paymentSummary.value.kakaoPayShops.prepaid.active; // 이용 매장만
  if (total === 0) return 0;
  return ((activated / total) * 100).toFixed(1);
});

// 카카오페이 후불 활성화율 계산 (이용 매장 중 활성화율)
const calcPostpaidActivationRate = computed(() => {
  if (!paymentSummary.value) return 0;
  const activated = paymentSummary.value.kakaoPayActivation.postpaid.activatedShops;
  const total = paymentSummary.value.kakaoPayShops.postpaid.active; // 이용 매장만
  if (total === 0) return 0;
  return ((activated / total) * 100).toFixed(1);
});

// 카카오페이 합계 (선불+후불)
const kakaoPayTotalActivatedShops = computed(() => {
  if (!paymentSummary.value) return 0;
  return paymentSummary.value.kakaoPayActivation.prepaid.activatedShops +
         paymentSummary.value.kakaoPayActivation.postpaid.activatedShops;
});

const kakaoPayTotalPaymentCount = computed(() => {
  if (!paymentSummary.value) return 0;
  return paymentSummary.value.kakaoPayActivation.prepaid.paymentCount +
         paymentSummary.value.kakaoPayActivation.postpaid.paymentCount;
});

const kakaoPayWeeklyActivatedShopsChange = computed(() => {
  if (!paymentSummary.value) return { change: 0, changeRate: '0%' };
  const prepaidChange = paymentSummary.value.kakaoPayActivation.weekly.activatedShops.change;
  const postpaidChange = paymentSummary.value.kakaoPayActivation.weekly.postpaidShops.change;
  const totalChange = prepaidChange + postpaidChange;

  const prepaidLast = paymentSummary.value.kakaoPayActivation.weekly.activatedShops.lastWeek;
  const postpaidLast = paymentSummary.value.kakaoPayActivation.weekly.postpaidShops.lastWeek;
  const totalLast = prepaidLast + postpaidLast;

  const changeRate = totalLast > 0 ? ((totalChange / totalLast) * 100).toFixed(0) + '%' : '-';

  return { change: totalChange, changeRate };
});

const kakaoPayWeeklyPaymentCountChange = computed(() => {
  if (!paymentSummary.value) return { change: 0, changeRate: '0%' };
  const prepaidChange = paymentSummary.value.kakaoPayActivation.weekly.paymentCount.change;
  const postpaidChange = paymentSummary.value.kakaoPayActivation.weekly.postpaidOrderCount.change;
  const totalChange = prepaidChange + postpaidChange;

  const prepaidLast = paymentSummary.value.kakaoPayActivation.weekly.paymentCount.lastWeek;
  const postpaidLast = paymentSummary.value.kakaoPayActivation.weekly.postpaidOrderCount.lastWeek;
  const totalLast = prepaidLast + postpaidLast;

  const changeRate = totalLast > 0 ? ((totalChange / totalLast) * 100).toFixed(0) + '%' : '-';

  return { change: totalChange, changeRate };
});

// 레거시 호환성 (기존 코드에서 사용 중일 수 있음)
const calcActivationRate = computed(() => calcPrepaidActivationRate.value);

// 쏠페이 활성화율 계산 (주간 쏠페이 결제 매장 / 이용 매장)
const calcSolPayActivationRate = computed(() => {
  if (!paymentSummary.value) return 0;
  const activated = paymentSummary.value.solPayActivation.prepaid.solPayShops;
  const total = paymentSummary.value.solPayShops.prepaid.active; // 이용 매장만
  if (total === 0) return 0;
  return ((activated / total) * 100).toFixed(1);
});

// HTML 내보내기 핸들러 (Full Export 방식)
async function handleExportHTML() {
  if (!kpiMetrics.value || !selectedDate.value) return;
  await exportFullHTML();
}
</script>

<template>
  <div class="dashboard">
    <!-- 헤더 -->
    <header class="header">
      <div class="header-content">
        <h1>📊 매장 운영 대시보드</h1>
        <p class="subtitle">메뉴판 서비스 KPI 모니터링</p>
      </div>
      <div class="header-actions">
        <button @click="selectFolder" class="btn btn-primary">
          📁 데이터 폴더 선택
        </button>
        <button v-if="isDataLoaded" @click="loadData" class="btn btn-secondary">
          🔄 새로고침
        </button>
        <button v-if="isDataLoaded" @click="handleExportHTML" class="btn btn-export" data-export-button>
          📥 HTML 보고서 다운로드
        </button>
      </div>
    </header>

    <!-- 로딩 -->
    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>데이터 로딩 중...</p>
    </div>

    <!-- 에러 -->
    <div v-else-if="errorMessage" class="error-message">
      <p>⚠️ {{ errorMessage }}</p>
      <button @click="selectFolder" class="btn btn-primary">폴더 다시 선택</button>
    </div>

    <!-- 데이터 미선택 -->
    <div v-else-if="!isDataLoaded" class="no-data">
      <div class="no-data-content">
        <h2>👋 환영합니다</h2>
        <p>CSV 데이터가 있는 폴더를 선택해주세요.</p>
        <p class="hint">폴더 내에 "결제 데이터", "누적 결제 데이터", "주문 데이터" 폴더가 있어야 합니다.</p>
        <button @click="selectFolder" class="btn btn-primary btn-large">
          📁 폴더 선택하기
        </button>
      </div>
    </div>

    <!-- 메인 대시보드 -->
    <main v-else class="main-content">
      <!-- 날짜 선택 -->
      <div class="date-selector">
        <label>기준 날짜:</label>
        <select v-model="selectedDate">
          <option v-for="date in availableDates" :key="date" :value="date">
            {{ formatDate(date) }}
          </option>
        </select>
        <span class="date-info">
          (총 {{ availableDates.length }}개 데이터)
        </span>
      </div>

      <!-- 지표 기준 범례 -->
      <div class="legend-box">
        <div class="legend-title">📌 지표 기준</div>
        <div class="legend-items">
          <div class="legend-item">
            <span class="legend-label">매장 활성화:</span>
            <span class="legend-value">해당 주간 핸드오더 주문 1건 이상</span>
          </div>
          <div class="legend-item">
            <span class="legend-label">이탈 매장:</span>
            <span class="legend-value">전주 활성화 → 금주 비활성화된 매장</span>
          </div>
          <div class="legend-item">
            <span class="legend-label">리스크 매장:</span>
            <span class="legend-value">이용 상태이지만 최근 한달간 주문/결제 각 10건 미만</span>
          </div>
          <div class="legend-item">
            <span class="legend-label">신규 유입:</span>
            <span class="legend-value">해당 주간(7일) 내 등록된 매장</span>
          </div>
        </div>
      </div>

      <!-- 탭 네비게이션 -->
      <nav class="tabs">
        <button
          :class="['tab', { active: activeTab === 'overview' }]"
          @click="activeTab = 'overview'"
          data-tab="overview"
        >
          📈 현황 개요
        </button>
        <button
          :class="['tab', { active: activeTab === 'risk' }]"
          @click="activeTab = 'risk'"
          data-tab="risk"
        >
          ⚠️ 리스크 매장
          <span v-if="filteredRiskShops" class="badge danger">{{ filteredRiskShops.length }}</span>
        </button>
        <button
          :class="['tab', { active: activeTab === 'payment' }]"
          @click="activeTab = 'payment'"
          data-tab="payment"
        >
          💳 페이먼트 분석
        </button>
        <button
          :class="['tab', { active: activeTab === 'newshops' }]"
          @click="activeTab = 'newshops'"
          data-tab="newshops"
        >
          🆕 신규 매장 추적
        </button>
        <button
          :class="['tab', { active: activeTab === 'agency' }]"
          @click="activeTab = 'agency'"
          data-tab="agency"
        >
          🏢 대리점 실적
        </button>
        <button
          :class="['tab', { active: activeTab === 'pos' }]"
          @click="activeTab = 'pos'"
          data-tab="pos"
        >
          📟 POS 분석
        </button>
      </nav>

      <!-- 현황 개요 탭 -->
      <div v-if="activeTab === 'overview' && kpiMetrics" class="tab-content" data-tab-content="overview">
        <!-- KPI 카드 그리드 -->
        <div class="kpi-grid">
          <!-- 전체 매장 -->
          <div class="kpi-card">
            <div class="kpi-icon">🏪</div>
            <div class="kpi-info">
              <span class="kpi-label">전체 매장</span>
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span class="kpi-value">{{ formatNumber(kpiMetrics.totalShops) }}</span>
                <span
                  v-if="prevDateMetrics"
                  :class="['kpi-change', calcChange(kpiMetrics.totalShops, prevDateMetrics.totalShops).isPositive ? 'positive' : 'negative']"
                >
                  {{ calcChange(kpiMetrics.totalShops, prevDateMetrics.totalShops).text }}
                </span>
              </div>
              <div style="margin-top: 8px; font-size: 13px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>선불 <strong>{{ formatNumber(kpiMetrics.prepaidShops) }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.prepaidShops, prevDateMetrics.prepaidShops).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.prepaidShops, prevDateMetrics.prepaidShops).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.prepaidShops - prevDateMetrics.prepaidShops) }}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                  <span>후불 <strong>{{ formatNumber(kpiMetrics.postpaidShops) }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.postpaidShops, prevDateMetrics.postpaidShops).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.postpaidShops, prevDateMetrics.postpaidShops).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.postpaidShops - prevDateMetrics.postpaidShops) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 이용 중 매장 -->
          <div class="kpi-card accent-green">
            <div class="kpi-icon">✅</div>
            <div class="kpi-info">
              <span class="kpi-label">이용 중</span>
              <span class="kpi-value">{{ formatNumber(kpiMetrics.activeShops) }}</span>
              <span
                v-if="prevDateMetrics"
                :class="['kpi-change', calcChange(kpiMetrics.activeShops, prevDateMetrics.activeShops).isPositive ? 'positive' : 'negative']"
              >
                {{ calcChange(kpiMetrics.activeShops, prevDateMetrics.activeShops).text }}
              </span>
            </div>
          </div>

          <!-- 이용대기 매장 -->
          <div class="kpi-card accent-yellow">
            <div class="kpi-icon">⏳</div>
            <div class="kpi-info">
              <span class="kpi-label">이용대기</span>
              <span class="kpi-value">{{ formatNumber(kpiMetrics.pendingShops) }}</span>
              <span
                v-if="prevDateMetrics"
                :class="['kpi-change', calcChange(kpiMetrics.pendingShops, prevDateMetrics.pendingShops).isPositive ? 'positive' : 'negative']"
              >
                {{ calcChange(kpiMetrics.pendingShops, prevDateMetrics.pendingShops).text }}
              </span>
            </div>
          </div>

          <!-- 신규 매장 -->
          <div class="kpi-card accent-purple">
            <div class="kpi-icon">🆕</div>
            <div class="kpi-info">
              <span class="kpi-label">신규 매장 (7일)</span>
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span class="kpi-value">{{ formatNumber(kpiMetrics.newShops) }}</span>
                <span
                  v-if="prevDateMetrics"
                  :class="['kpi-change', calcChange(kpiMetrics.newShops, prevDateMetrics.newShops).isPositive ? 'positive' : 'negative']"
                >
                  {{ calcChange(kpiMetrics.newShops, prevDateMetrics.newShops).text }}
                </span>
              </div>
              <div style="margin-top: 8px; font-size: 13px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>선불 <strong>{{ kpiMetrics.newShopsPrepaid }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.newShopsPrepaid, prevDateMetrics.newShopsPrepaid).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.newShopsPrepaid, prevDateMetrics.newShopsPrepaid).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.newShopsPrepaid - prevDateMetrics.newShopsPrepaid) }}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                  <span>후불 <strong>{{ kpiMetrics.newShopsPostpaid }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.newShopsPostpaid, prevDateMetrics.newShopsPostpaid).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.newShopsPostpaid, prevDateMetrics.newShopsPostpaid).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.newShopsPostpaid - prevDateMetrics.newShopsPostpaid) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 리스크 매장 -->
          <div class="kpi-card accent-red">
            <div class="kpi-icon">⚠️</div>
            <div class="kpi-info">
              <span class="kpi-label">리스크 매장</span>
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span class="kpi-value">{{ formatNumber(kpiMetrics.riskShops) }}</span>
                <span
                  v-if="prevDateMetrics"
                  :class="['kpi-change', calcChange(kpiMetrics.riskShops, prevDateMetrics.riskShops).isPositive ? 'positive' : 'negative']"
                >
                  {{ calcChange(kpiMetrics.riskShops, prevDateMetrics.riskShops).text }}
                </span>
              </div>
              <div style="margin-top: 8px; font-size: 13px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>선불 <strong>{{ kpiMetrics.riskShopsPrepaid }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.riskShopsPrepaid, prevDateMetrics.riskShopsPrepaid).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.riskShopsPrepaid, prevDateMetrics.riskShopsPrepaid).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.riskShopsPrepaid - prevDateMetrics.riskShopsPrepaid) }}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                  <span>후불 <strong>{{ kpiMetrics.riskShopsPostpaid }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.riskShopsPostpaid, prevDateMetrics.riskShopsPostpaid).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.riskShopsPostpaid, prevDateMetrics.riskShopsPostpaid).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.riskShopsPostpaid - prevDateMetrics.riskShopsPostpaid) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 디바이스 현황 -->
          <div class="kpi-card accent-teal">
            <div class="kpi-icon">📱</div>
            <div class="kpi-info">
              <span class="kpi-label">디바이스</span>
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span class="kpi-value">{{ formatNumber(kpiMetrics.totalDevices) }}</span>
                <span
                  v-if="prevDateMetrics"
                  :class="['kpi-change', calcChange(kpiMetrics.totalDevices, prevDateMetrics.totalDevices).isPositive ? 'positive' : 'negative']"
                >
                  {{ calcChange(kpiMetrics.totalDevices, prevDateMetrics.totalDevices).text }}
                </span>
              </div>
              <div style="margin-top: 8px; font-size: 13px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>선불 <strong>{{ formatNumber(kpiMetrics.devicesPrepaid) }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.devicesPrepaid, prevDateMetrics.devicesPrepaid).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.devicesPrepaid, prevDateMetrics.devicesPrepaid).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.devicesPrepaid - prevDateMetrics.devicesPrepaid) }}
                  </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                  <span>후불 <strong>{{ formatNumber(kpiMetrics.devicesPostpaid) }}</strong></span>
                  <span v-if="prevDateMetrics" :style="{ color: calcChange(kpiMetrics.devicesPostpaid, prevDateMetrics.devicesPostpaid).isPositive ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '11px', fontWeight: '600' }">
                    {{ calcChange(kpiMetrics.devicesPostpaid, prevDateMetrics.devicesPostpaid).isPositive ? '↑' : '↓' }}{{ Math.abs(kpiMetrics.devicesPostpaid - prevDateMetrics.devicesPostpaid) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 차트 섹션 -->
        <div class="charts-grid" v-if="periodComparison.length > 1">
          <div class="chart-section">
            <h3>� 전체 매장 수 추이</h3>
            <TrendChart
              :labels="chartLabels"
              :datasets="totalShopDatasets"
              chartTitle="전체 매장 현황"
            />
          </div>

          <div class="chart-section">
            <div class="chart-header">
              <h3>📈 이용 상태별 매장 추이</h3>
              <select v-model="chartStatusWeeksFilter" class="chart-filter">
                <option :value="0">등록일: 전체</option>
                <option :value="4">등록일: 4주 이내</option>
                <option :value="8">등록일: 8주 이내</option>
                <option :value="12">등록일: 12주 이내</option>
                <option :value="24">등록일: 24주 이내</option>
                <option :value="52">등록일: 1년 이내</option>
              </select>
            </div>
            <TrendChart
              :labels="chartLabels"
              :datasets="filteredShopStatusDatasets"
              chartTitle="이용/이용대기 매장 현황"
            />
          </div>

          <div class="chart-section">
            <div class="chart-header">
              <h3>🆕 신규 & 리스크 매장</h3>
              <select v-model="chartRiskWeeksFilter" class="chart-filter">
                <option :value="0">등록일: 전체</option>
                <option :value="4">등록일: 4주 이내</option>
                <option :value="8">등록일: 8주 이내</option>
                <option :value="12">등록일: 12주 이내</option>
                <option :value="24">등록일: 24주 이내</option>
                <option :value="52">등록일: 1년 이내</option>
              </select>
            </div>
            <TrendChart
              :labels="chartLabels"
              :datasets="filteredNewRiskDatasets"
              chartTitle="신규 매장 및 리스크 매장 현황"
            />
          </div>

          <div class="chart-section">
            <h3>📊 변동률 (전 기간 대비)</h3>
            <TrendChart
              :labels="chartLabels"
              :datasets="growthRateDatasets"
              chartTitle="매장/이용매장 증가율 (%)"
              yAxisSuffix="%"
            />
          </div>

          <div class="chart-section">
            <h3>💳 주차별 결제 건수</h3>
            <TrendChart
              :labels="chartLabels"
              :datasets="weeklyPaymentDatasets"
              chartTitle="주차별 결제 건수"
            />
          </div>
        </div>

        <!-- 기간별 추이 테이블 -->
        <div class="section">
          <h2>📋 기간별 현황 요약</h2>
          <p class="section-desc">매장 수는 해당 날짜 기준, 신규/리스크는 변동분</p>
          <div class="table-container">
            <table class="compact-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>전체</th>
                  <th>이용</th>
                  <th>대기</th>
                  <th>신규</th>
                  <th>리스크</th>
                  <th>주차 결제건</th>
                  <th>주차 결제액</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in periodComparison" :key="row.date" :class="{ 'current-row': row.date === selectedDate }">
                  <td>{{ formatDate(row.date) }}</td>
                  <td>{{ formatNumber(row.totalShops) }}</td>
                  <td class="text-green">{{ formatNumber(row.activeShops) }}</td>
                  <td class="text-yellow">{{ formatNumber(row.pendingShops) }}</td>
                  <td class="text-purple">{{ formatNumber(row.newShops) }}</td>
                  <td class="text-red">{{ formatNumber(row.riskShops) }}</td>
                  <td>{{ formatNumber(row.weeklyPaymentCount) }}</td>
                  <td>{{ formatCurrency(row.weeklyPaymentAmount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 리스크 매장 탭 -->
      <div v-if="activeTab === 'risk' && kpiMetrics" class="tab-content" data-tab-content="risk">
        <div class="section">
          <div class="section-header">
            <h2>⚠️ 리스크 매장 목록</h2>
            <p class="section-desc">
              '이용' 상태이지만 최근 한달간 주문/결제가 각각 10건 미만인 매장입니다. 점검이 필요합니다.
            </p>
          </div>

          <!-- 등록일 필터 -->
          <div class="filter-bar">
            <label>등록일 필터:</label>
            <select v-model="riskShopWeeksFilter">
              <option :value="0">전체 ({{ kpiMetrics.riskShopList.length }}개)</option>
              <option :value="4">최근 4주 내 등록</option>
              <option :value="8">최근 8주 내 등록</option>
              <option :value="12">최근 12주 내 등록</option>
              <option :value="24">최근 24주 내 등록</option>
              <option :value="52">최근 1년 내 등록</option>
            </select>
            <span class="filter-result">필터 결과: {{ filteredRiskShops.length }}개</span>
          </div>

          <div v-if="filteredRiskShops.length === 0" class="empty-state">
            <p>🎉 해당 기간에 리스크 매장이 없습니다.</p>
          </div>

          <div v-else class="table-container">
            <table>
              <thead>
                <tr>
                  <th>매장코드</th>
                  <th>매장명</th>
                  <th>유형</th>
                  <th>등록일</th>
                  <th>한달 주문</th>
                  <th>한달 결제</th>
                  <th>쏠페이</th>
                  <th>카카오페이</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="shop in filteredRiskShops" :key="shop.shop_code">
                  <td><code>{{ shop.shop_code }}</code></td>
                  <td>{{ shop.shop_name }}</td>
                  <td>
                    <span :class="['badge', shop.pg_yn === '선불' ? 'badge-blue' : 'badge-gray']">
                      {{ shop.pg_yn }}
                    </span>
                  </td>
                  <td>{{ shop.ins_datetime.split(' ')[0] }}</td>
                  <td>
                    <span :class="shop.totalOrderCount < 10 ? 'text-red' : 'text-green'">{{ formatNumber(shop.totalOrderCount) }}건</span>
                  </td>
                  <td>
                    <span :class="shop.totalPaymentCount < 10 ? 'text-red' : 'text-green'">{{ formatNumber(shop.totalPaymentCount) }}건</span>
                  </td>
                  <td>
                    <span :class="shop.sol_pay_promotion_yn ? 'text-green' : 'text-gray'">
                      {{ shop.sol_pay_promotion_yn ? '참여' : '-' }}
                    </span>
                  </td>
                  <td>
                    <span :class="shop.nice_pay_promotion_yn ? 'text-green' : 'text-gray'">
                      {{ shop.nice_pay_promotion_yn ? '참여' : '-' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 페이먼트 분석 탭 - Executive Dashboard Style -->
      <div v-if="activeTab === 'payment' && kpiMetrics && paymentSummary" class="tab-content" data-tab-content="payment">

        <!-- ========== HERO METRICS (핵심 성과 지표) ========== -->
        <div class="hero-metrics">
          <!-- 카카오페이 활성화 매장 (선불+후불) -->
          <div class="hero-card hero-kakao">
            <div class="hero-icon">🟡</div>
            <div class="hero-content">
              <span class="hero-label">카카오페이 활성화 매장</span>
              <span class="hero-value">{{ kakaoPayTotalActivatedShops }}개</span>
              <div class="hero-breakdown">
                <span class="breakdown-item">선불 {{ paymentSummary.kakaoPayActivation.prepaid.activatedShops }}</span>
                <span class="breakdown-divider">/</span>
                <span class="breakdown-item">후불 {{ paymentSummary.kakaoPayActivation.postpaid.activatedShops }}</span>
              </div>
              <div class="hero-change" :class="kakaoPayWeeklyActivatedShopsChange.change >= 0 ? 'positive' : 'negative'">
                <span class="change-arrow">{{ kakaoPayWeeklyActivatedShopsChange.change >= 0 ? '↑' : '↓' }}</span>
                <span class="change-value">{{ Math.abs(kakaoPayWeeklyActivatedShopsChange.change) }}</span>
                <span class="change-rate">({{ kakaoPayWeeklyActivatedShopsChange.changeRate }})</span>
              </div>
            </div>
          </div>

          <!-- 카카오페이 결제 건수 (선불+후불) -->
          <div class="hero-card hero-kakao">
            <div class="hero-icon">📊</div>
            <div class="hero-content">
              <span class="hero-label">카카오페이 결제 건수</span>
              <span class="hero-value">{{ kakaoPayTotalPaymentCount.toLocaleString() }}건</span>
              <div class="hero-breakdown">
                <span class="breakdown-item">선불 {{ paymentSummary.kakaoPayActivation.prepaid.paymentCount.toLocaleString() }}</span>
                <span class="breakdown-divider">/</span>
                <span class="breakdown-item">후불 {{ paymentSummary.kakaoPayActivation.postpaid.paymentCount.toLocaleString() }}</span>
              </div>
              <div class="hero-change" :class="kakaoPayWeeklyPaymentCountChange.change >= 0 ? 'positive' : 'negative'">
                <span class="change-arrow">{{ kakaoPayWeeklyPaymentCountChange.change >= 0 ? '↑' : '↓' }}</span>
                <span class="change-value">{{ Math.abs(kakaoPayWeeklyPaymentCountChange.change).toLocaleString() }}</span>
                <span class="change-rate">({{ kakaoPayWeeklyPaymentCountChange.changeRate }})</span>
              </div>
            </div>
          </div>

          <!-- 카카오페이 활성화율 (선불/후불 각각) -->
          <div class="hero-card hero-kakao">
            <div class="hero-icon">📈</div>
            <div class="hero-content">
              <span class="hero-label">카카오페이 활성화율 <span style="font-size: 11px; opacity: 0.5;">(이용 매장 중)</span></span>
              <div style="display: flex; gap: 20px; margin-top: 8px;">
                <div style="flex: 1;">
                  <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px;">선불</div>
                  <div style="font-size: 24px; font-weight: 600;">{{ calcPrepaidActivationRate }}%</div>
                  <div style="font-size: 12px; opacity: 0.7; margin-top: 2px;">{{ paymentSummary.kakaoPayActivation.prepaid.activatedShops }}/{{ paymentSummary.kakaoPayShops.prepaid.active }}</div>
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 11px; opacity: 0.6; margin-bottom: 4px;">후불</div>
                  <div style="font-size: 24px; font-weight: 600;">{{ calcPostpaidActivationRate }}%</div>
                  <div style="font-size: 12px; opacity: 0.7; margin-top: 2px;">{{ paymentSummary.kakaoPayActivation.postpaid.activatedShops }}/{{ paymentSummary.kakaoPayShops.postpaid.active }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 쏠페이 활성화 매장 -->
          <div class="hero-card hero-solpay">
            <div class="hero-icon">🔶</div>
            <div class="hero-content">
              <span class="hero-label">쏠페이 활성화 매장</span>
              <span class="hero-value">{{ paymentSummary.solPayActivation.prepaid.solPayShops }}개</span>
              <div class="hero-change" :class="paymentSummary.solPayActivation.weekly.solPayShops.change >= 0 ? 'positive' : 'negative'">
                <span class="change-arrow">{{ paymentSummary.solPayActivation.weekly.solPayShops.change >= 0 ? '↑' : '↓' }}</span>
                <span class="change-value">{{ Math.abs(paymentSummary.solPayActivation.weekly.solPayShops.change) }}</span>
                <span class="change-rate">({{ paymentSummary.solPayActivation.weekly.solPayShops.changeRate }})</span>
              </div>
            </div>
          </div>

          <!-- 쏠페이 결제 건수 -->
          <div class="hero-card hero-solpay">
            <div class="hero-icon">📊</div>
            <div class="hero-content">
              <span class="hero-label">쏠페이 결제 건수</span>
              <span class="hero-value">{{ paymentSummary.solPayActivation.prepaid.solPayCount.toLocaleString() }}건</span>
              <div class="hero-change" :class="paymentSummary.solPayActivation.weekly.solPayCount.change >= 0 ? 'positive' : 'negative'">
                <span class="change-arrow">{{ paymentSummary.solPayActivation.weekly.solPayCount.change >= 0 ? '↑' : '↓' }}</span>
                <span class="change-value">{{ Math.abs(paymentSummary.solPayActivation.weekly.solPayCount.change).toLocaleString() }}</span>
                <span class="change-rate">({{ paymentSummary.solPayActivation.weekly.solPayCount.changeRate }})</span>
              </div>
            </div>
          </div>

          <!-- 쏠페이 활성화율 -->
          <div class="hero-card hero-solpay">
            <div class="hero-icon">📈</div>
            <div class="hero-content">
              <span class="hero-label">쏠페이 활성화율 <span style="font-size: 11px; opacity: 0.5;">(이용 매장 중)</span></span>
              <span class="hero-value">{{ calcSolPayActivationRate }}%</span>
              <div class="hero-change neutral">
                <span class="change-value">{{ paymentSummary.solPayActivation.prepaid.solPayShops }} / {{ paymentSummary.solPayShops.prepaid.active }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== WHAT CHANGED (이번 주 주요 변동) ========== -->
        <div class="change-summary">
          <h3 class="change-summary-title">🔄 이번 주 주요 변동</h3>
          <div class="change-cards">
            <!-- 신규 유입 -->
            <div class="change-card">
              <div class="change-card-header">
                <span class="change-card-icon">🆕</span>
                <span class="change-card-label">신규 유입</span>
              </div>
              <div class="change-card-value">{{ paymentSummary.newInflow.kakaoPayNew + paymentSummary.newInflow.solPayNew }}개</div>
              <div class="change-card-breakdown">
                <span class="breakdown-item kakao">카카오 {{ paymentSummary.newInflow.kakaoPayNew }}</span>
                <span class="breakdown-divider">/</span>
                <span class="breakdown-item solpay">쏠페이 {{ paymentSummary.newInflow.solPayNew }}</span>
              </div>
            </div>

            <!-- 이용 전환 -->
            <div class="change-card">
              <div class="change-card-header">
                <span class="change-card-icon">✅</span>
                <span class="change-card-label">이용 전환</span>
              </div>
              <div class="change-card-value">{{ paymentSummary.newInflow.kakaoPayConverted + paymentSummary.newInflow.solPayConverted }}개</div>
              <div class="change-card-breakdown">
                <span class="breakdown-item kakao">카카오 {{ paymentSummary.newInflow.kakaoPayConverted }}</span>
                <span class="breakdown-divider">/</span>
                <span class="breakdown-item solpay">쏠페이 {{ paymentSummary.newInflow.solPayConverted }}</span>
              </div>
            </div>

            <!-- 이탈 매장 수 -->
            <div class="change-card">
              <div class="change-card-header">
                <span class="change-card-icon">⚠️</span>
                <span class="change-card-label">이탈 매장</span>
              </div>
              <div class="change-card-value" :class="paymentSummary.churnAndRisk.churnedShops > 0 ? 'negative' : 'neutral'">{{ paymentSummary.churnAndRisk.churnedShops }}개</div>
              <div class="change-card-breakdown">
                <span>전주 활성화 → 금주 비활성화</span>
              </div>
            </div>

            <!-- 프로모션 리스크 매장 -->
            <div class="change-card">
              <div class="change-card-header">
                <span class="change-card-icon">🚨</span>
                <span class="change-card-label">리스크 매장</span>
              </div>
              <div class="change-card-value" :class="paymentSummary.churnAndRisk.promotionRiskShops > 0 ? 'warning' : 'neutral'">{{ paymentSummary.churnAndRisk.promotionRiskShops }}개</div>
              <div class="change-card-breakdown">
                <span>프로모션 대상 중 저활동</span>
              </div>
            </div>

            <!-- 결제 금액 변동 -->
            <div class="change-card">
              <div class="change-card-header">
                <span class="change-card-icon">💵</span>
                <span class="change-card-label">결제 금액</span>
              </div>
              <div class="change-card-value" :class="paymentSummary.kakaoPayActivation.weekly.paymentAmount.change >= 0 ? 'positive' : 'negative'">
                {{ paymentSummary.kakaoPayActivation.weekly.paymentAmount.change >= 0 ? '+' : '-' }}{{ formatCurrencyShort(Math.abs(paymentSummary.kakaoPayActivation.weekly.paymentAmount.change)) }}
              </div>
              <div class="change-card-breakdown" style="font-size: 0.75rem; line-height: 1.2;">
                <div>선불 {{ paymentSummary.kakaoPayActivation.weekly.paymentAmount.change >= 0 ? '+' : '-' }}{{ formatCurrencyShort(Math.abs(paymentSummary.kakaoPayActivation.weekly.paymentAmount.change)) }}</div>
                <div>후불 {{ paymentSummary.kakaoPayActivation.weekly.postpaidOrderAmount.change >= 0 ? '+' : '-' }}{{ formatCurrencyShort(Math.abs(paymentSummary.kakaoPayActivation.weekly.postpaidOrderAmount.change)) }}</div>
                <div>쏠페이 {{ paymentSummary.solPayActivation.weekly.paymentAmount.change >= 0 ? '+' : '-' }}{{ formatCurrencyShort(Math.abs(paymentSummary.solPayActivation.weekly.paymentAmount.change)) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== TREND CHARTS (트렌드 차트) ========== -->
        <div class="charts-grid compact" v-if="periodComparison.length > 1">
          <div class="chart-section">
            <h3>� 페이먼트 결제 건수 추이</h3>
            <TrendChart
              :labels="chartLabels"
              :datasets="weeklyPaymentProviderDatasets"
              chartTitle="주별 쏠페이/카카오페이 결제 건수 (해당 주차만)"
            />
          </div>
          <div class="chart-section">
            <h3>💰 페이먼트 결제 금액 추이</h3>
            <TrendChart
              :labels="chartLabels"
              :datasets="weeklyPaymentProviderAmountDatasets"
              chartTitle="주별 쏠페이/카카오페이 결제 금액 (해당 주차만)"
            />
          </div>
        </div>

        <!-- ========== DETAIL ACCORDION (상세 보기) ========== -->
        <div class="detail-accordion">
          <h3 class="accordion-section-title">📋 상세 현황</h3>

          <!-- 카카오페이 상세 -->
          <div class="accordion-item">
            <button class="accordion-header" @click="toggleAccordion('kakao')">
              <span class="accordion-icon">🟡</span>
              <span class="accordion-title">카카오페이 상세</span>
              <span class="accordion-arrow" :class="{ open: accordionOpen.kakao }">▼</span>
            </button>
            <div class="accordion-content" v-show="accordionOpen.kakao">
              <!-- 매장 현황 -->
              <div class="detail-group">
                <h4 class="detail-group-title">매장 현황</h4>
                <div class="detail-stats">
                  <div class="detail-stat">
                    <span class="stat-label">선불 이용</span>
                    <span class="stat-value">{{ paymentSummary.kakaoPayShops.prepaid.active }}개</span>
                  </div>
                  <div class="detail-stat">
                    <span class="stat-label">선불 대기</span>
                    <span class="stat-value">{{ paymentSummary.kakaoPayShops.prepaid.pending }}개</span>
                  </div>
                  <div class="detail-stat">
                    <span class="stat-label">후불 이용</span>
                    <span class="stat-value">{{ paymentSummary.kakaoPayShops.postpaid.active }}개</span>
                  </div>
                  <div class="detail-stat">
                    <span class="stat-label">후불 대기</span>
                    <span class="stat-value">{{ paymentSummary.kakaoPayShops.postpaid.pending }}개</span>
                  </div>
                </div>
              </div>

              <!-- 선불 활성화 현황 -->
              <div class="detail-group">
                <h4 class="detail-group-title">선불 활성화 현황</h4>
                <table class="detail-table">
                  <thead>
                    <tr>
                      <th>항목</th>
                      <th>지난주</th>
                      <th>금주</th>
                      <th>증감</th>
                      <th>누적</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>활성화 매장</td>
                      <td>{{ paymentSummary.kakaoPayActivation.weekly.activatedShops.lastWeek }}</td>
                      <td>{{ paymentSummary.kakaoPayActivation.weekly.activatedShops.thisWeek }}</td>
                      <td :class="paymentSummary.kakaoPayActivation.weekly.activatedShops.change >= 0 ? 'text-green' : 'text-red'">
                        {{ paymentSummary.kakaoPayActivation.weekly.activatedShops.change >= 0 ? '+' : '' }}{{ paymentSummary.kakaoPayActivation.weekly.activatedShops.change }}
                      </td>
                      <td>{{ paymentSummary.kakaoPayActivation.cumulative.activatedShops }}</td>
                    </tr>
                    <tr>
                      <td>카카오머니 매장</td>
                      <td>{{ paymentSummary.kakaoPayActivation.weekly.kakaoMoneyShops.lastWeek }}</td>
                      <td>{{ paymentSummary.kakaoPayActivation.weekly.kakaoMoneyShops.thisWeek }}</td>
                      <td :class="paymentSummary.kakaoPayActivation.weekly.kakaoMoneyShops.change >= 0 ? 'text-green' : 'text-red'">
                        {{ paymentSummary.kakaoPayActivation.weekly.kakaoMoneyShops.change >= 0 ? '+' : '' }}{{ paymentSummary.kakaoPayActivation.weekly.kakaoMoneyShops.change }}
                      </td>
                      <td>{{ paymentSummary.kakaoPayActivation.cumulative.kakaoMoneyShops }}</td>
                    </tr>
                    <tr>
                      <td>결제 건수</td>
                      <td>{{ formatNumber(paymentSummary.kakaoPayActivation.weekly.paymentCount.lastWeek) }}</td>
                      <td>{{ formatNumber(paymentSummary.kakaoPayActivation.weekly.paymentCount.thisWeek) }}</td>
                      <td :class="paymentSummary.kakaoPayActivation.weekly.paymentCount.change >= 0 ? 'text-green' : 'text-red'">
                        {{ paymentSummary.kakaoPayActivation.weekly.paymentCount.change >= 0 ? '+' : '' }}{{ formatNumber(paymentSummary.kakaoPayActivation.weekly.paymentCount.change) }}
                      </td>
                      <td>{{ formatNumber(paymentSummary.kakaoPayActivation.cumulative.paymentCount) }}</td>
                    </tr>
                    <tr>
                      <td>결제 금액</td>
                      <td>{{ formatCurrencyShort(paymentSummary.kakaoPayActivation.weekly.paymentAmount.lastWeek) }}</td>
                      <td>{{ formatCurrencyShort(paymentSummary.kakaoPayActivation.weekly.paymentAmount.thisWeek) }}</td>
                      <td :class="paymentSummary.kakaoPayActivation.weekly.paymentAmount.change >= 0 ? 'text-green' : 'text-red'">
                        {{ paymentSummary.kakaoPayActivation.weekly.paymentAmount.change >= 0 ? '+' : '-' }}{{ formatCurrencyShort(Math.abs(paymentSummary.kakaoPayActivation.weekly.paymentAmount.change)) }}
                      </td>
                      <td>{{ formatCurrencyShort(paymentSummary.kakaoPayActivation.cumulative.paymentAmount) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 쏠페이 상세 -->
          <div class="accordion-item">
            <button class="accordion-header" @click="toggleAccordion('solpay')">
              <span class="accordion-icon">🔶</span>
              <span class="accordion-title">쏠페이 상세</span>
              <span class="accordion-arrow" :class="{ open: accordionOpen.solpay }">▼</span>
            </button>
            <div class="accordion-content" v-show="accordionOpen.solpay">
              <!-- 매장 현황 -->
              <div class="detail-group">
                <h4 class="detail-group-title">매장 현황</h4>
                <div class="detail-stats">
                  <div class="detail-stat">
                    <span class="stat-label">선불 이용</span>
                    <span class="stat-value">{{ paymentSummary.solPayShops.prepaid.active }}개</span>
                  </div>
                  <div class="detail-stat">
                    <span class="stat-label">선불 대기</span>
                    <span class="stat-value">{{ paymentSummary.solPayShops.prepaid.pending }}개</span>
                  </div>
                  <div class="detail-stat">
                    <span class="stat-label">프로모션 총</span>
                    <span class="stat-value">{{ paymentSummary.solPayShops.total }}개</span>
                  </div>
                </div>
              </div>

              <!-- 활성화 현황 -->
              <div class="detail-group">
                <h4 class="detail-group-title">활성화 현황</h4>
                <table class="detail-table">
                  <thead>
                    <tr>
                      <th>항목</th>
                      <th>지난주</th>
                      <th>금주</th>
                      <th>증감</th>
                      <th>누적</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>쏠페이 매장</td>
                      <td>{{ paymentSummary.solPayActivation.weekly.solPayShops.lastWeek }}</td>
                      <td>{{ paymentSummary.solPayActivation.weekly.solPayShops.thisWeek }}</td>
                      <td :class="paymentSummary.solPayActivation.weekly.solPayShops.change >= 0 ? 'text-green' : 'text-red'">
                        {{ paymentSummary.solPayActivation.weekly.solPayShops.change >= 0 ? '+' : '' }}{{ paymentSummary.solPayActivation.weekly.solPayShops.change }}
                      </td>
                      <td>{{ paymentSummary.solPayActivation.cumulative.solPayShops }}</td>
                    </tr>
                    <tr>
                      <td>쏠페이 건수</td>
                      <td>{{ formatNumber(paymentSummary.solPayActivation.weekly.solPayCount.lastWeek) }}</td>
                      <td>{{ formatNumber(paymentSummary.solPayActivation.weekly.solPayCount.thisWeek) }}</td>
                      <td :class="paymentSummary.solPayActivation.weekly.solPayCount.change >= 0 ? 'text-green' : 'text-red'">
                        {{ paymentSummary.solPayActivation.weekly.solPayCount.change >= 0 ? '+' : '' }}{{ formatNumber(paymentSummary.solPayActivation.weekly.solPayCount.change) }}
                      </td>
                      <td>{{ formatNumber(paymentSummary.solPayActivation.cumulative.solPayCount) }}</td>
                    </tr>
                    <tr>
                      <td>쏠페이 금액</td>
                      <td>{{ formatCurrencyShort(paymentSummary.solPayActivation.weekly.solPayAmount.lastWeek) }}</td>
                      <td>{{ formatCurrencyShort(paymentSummary.solPayActivation.weekly.solPayAmount.thisWeek) }}</td>
                      <td :class="paymentSummary.solPayActivation.weekly.solPayAmount.change >= 0 ? 'text-green' : 'text-red'">
                        {{ paymentSummary.solPayActivation.weekly.solPayAmount.change >= 0 ? '+' : '-' }}{{ formatCurrencyShort(Math.abs(paymentSummary.solPayActivation.weekly.solPayAmount.change)) }}
                      </td>
                      <td>{{ formatCurrencyShort(paymentSummary.solPayActivation.cumulative.solPayAmount) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 이탈 매장 상세 -->
          <div class="accordion-item">
            <button class="accordion-header" @click="toggleAccordion('churned')">
              <span class="accordion-icon">⚠️</span>
              <span class="accordion-title">이탈 매장 ({{ paymentSummary.churnAndRisk.churnedShops }}개)</span>
              <span class="accordion-arrow" :class="{ open: accordionOpen.churned }">▼</span>
            </button>
            <div class="accordion-content" v-show="accordionOpen.churned">
              <div class="detail-group">
                <h4 class="detail-group-title">전주 활성화 → 금주 비활성화 매장</h4>
                <div v-if="paymentSummary.churnAndRisk.churnedShopList.length === 0" class="empty-state">
                  <p>이탈 매장이 없습니다.</p>
                </div>
                <div v-else class="table-container">
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th>매장코드</th>
                        <th>매장명</th>
                        <th>선후불</th>
                        <th>프로모션</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="shop in paymentSummary.churnAndRisk.churnedShopList" :key="shop.shop_code">
                        <td><code>{{ shop.shop_code }}</code></td>
                        <td>{{ shop.shop_name }}</td>
                        <td>
                          <span :class="['badge', shop.pg_yn === '선불' ? 'badge-blue' : 'badge-gray']">
                            {{ shop.pg_yn }}
                          </span>
                        </td>
                        <td>{{ shop.promotion_type }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- 프로모션 리스크 매장 상세 -->
          <div class="accordion-item">
            <button class="accordion-header" @click="toggleAccordion('promotionRisk')">
              <span class="accordion-icon">🚨</span>
              <span class="accordion-title">프로모션 리스크 매장 ({{ paymentSummary.churnAndRisk.promotionRiskShops }}개)</span>
              <span class="accordion-arrow" :class="{ open: accordionOpen.promotionRisk }">▼</span>
            </button>
            <div class="accordion-content" v-show="accordionOpen.promotionRisk">
              <div class="detail-group">
                <h4 class="detail-group-title">프로모션 대상 중 저활동 매장 (최근 한달 주문/결제 각 10건 미만)</h4>

                <!-- 등록일 필터 -->
                <div class="filter-bar">
                  <label>등록일 필터:</label>
                  <select v-model="promotionRiskWeeksFilter">
                    <option :value="0">전체 ({{ paymentSummary.churnAndRisk.promotionRiskShopList.length }}개)</option>
                    <option :value="4">최근 4주 내 등록</option>
                    <option :value="8">최근 8주 내 등록</option>
                    <option :value="12">최근 12주 내 등록</option>
                    <option :value="24">최근 24주 내 등록</option>
                    <option :value="52">최근 1년 내 등록</option>
                  </select>
                  <span class="filter-result">필터 결과: {{ filteredPromotionRiskShops.length }}개</span>
                </div>

                <div v-if="filteredPromotionRiskShops.length === 0" class="empty-state">
                  <p>프로모션 리스크 매장이 없습니다.</p>
                </div>
                <div v-else class="table-container">
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th>매장코드</th>
                        <th>매장명</th>
                        <th>선후불</th>
                        <th>프로모션</th>
                        <th>등록일</th>
                        <th>한달 주문</th>
                        <th>한달 결제</th>
                        <th>디바이스</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="shop in filteredPromotionRiskShops" :key="shop.shop_code">
                        <td><code>{{ shop.shop_code }}</code></td>
                        <td>{{ shop.shop_name }}</td>
                        <td>
                          <span :class="['badge', shop.pg_yn === '선불' ? 'badge-blue' : 'badge-gray']">
                            {{ shop.pg_yn }}
                          </span>
                        </td>
                        <td>
                          <span v-if="shop.nice_pay_promotion_yn" class="badge badge-yellow">카카오페이</span>
                          <span v-if="shop.sol_pay_promotion_yn" class="badge badge-orange">쏠페이</span>
                        </td>
                        <td>{{ shop.ins_datetime.split(' ')[0] }}</td>
                        <td>{{ shop.totalOrderCount }}건</td>
                        <td>{{ shop.totalPaymentCount }}건</td>
                        <td>{{ shop.deviceCount }}대</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 신규 매장 추적 탭 -->
      <div v-if="activeTab === 'newshops'" class="tab-content" data-tab-content="newshops">
        <div class="section">
          <div class="section-header">
            <h2>🆕 신규 매장 전환 추적</h2>
            <p class="section-desc">
              기준 날짜 상 7일 이내에 추가된 매장들의 이용 전환 현황입니다.
            </p>
          </div>

          <div v-if="newShopTracking.length === 0" class="empty-state">
            <p>신규 매장 데이터가 없습니다.</p>
          </div>

          <div v-else class="table-container">
            <table>
              <thead>
                <tr>
                  <th>매장코드</th>
                  <th>매장명</th>
                  <th>유형</th>
                  <th>등록일</th>
                  <th>현재 상태</th>
                  <th>주문건수</th>
                  <th>결제건수</th>
                  <th>결제금액</th>
                  <th>활동 여부</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="shop in newShopTracking" :key="shop.shop_code"
                    :class="{ 'warning-row': shop.currentStatus === '이용' && !shop.hasActivity }">
                  <td><code>{{ shop.shop_code }}</code></td>
                  <td>{{ shop.shop_name }}</td>
                  <td>
                    <span :class="['badge', shop.pg_yn === '선불' ? 'badge-blue' : 'badge-gray']">
                      {{ shop.pg_yn }}
                    </span>
                  </td>
                  <td>{{ shop.ins_datetime.split(' ')[0] }}</td>
                  <td>
                    <span :class="['badge', {
                      'badge-green': shop.currentStatus === '이용',
                      'badge-yellow': shop.currentStatus === '이용대기',
                      'badge-gray': shop.currentStatus === '종료'
                    }]">
                      {{ shop.currentStatus }}
                    </span>
                  </td>
                  <td>{{ formatNumber(shop.totalOrderCount) }}</td>
                  <td>{{ formatNumber(shop.totalPaymentCount) }}</td>
                  <td>{{ formatCurrency(shop.totalPaymentAmount) }}</td>
                  <td>
                    <span :class="shop.hasActivity ? 'text-green' : 'text-red'">
                      {{ shop.hasActivity ? '✓ 활동' : '✗ 없음' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 대리점 실적 탭 -->
      <div v-if="activeTab === 'agency'" class="tab-content" data-tab-content="agency">
        <div class="section">
          <div class="section-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2>🏢 대리점별 실적 현황</h2>
              <p class="section-desc">
                대리점별로 매장 활성화율, 리스크 매장, 이탈 매장을 파악하여 실적을 관리합니다.
              </p>
            </div>
            <select v-model.number="agencyWeeksFilter" class="chart-filter">
              <option :value="0">등록일: 전체</option>
              <option :value="4">등록일: 4주 이내</option>
              <option :value="8">등록일: 8주 이내</option>
              <option :value="12">등록일: 12주 이내</option>
              <option :value="24">등록일: 24주 이내</option>
              <option :value="52">등록일: 1년 이내</option>
            </select>
          </div>

          <!-- 요약 카드 -->
          <div class="kpi-grid" style="margin-bottom: 24px;">
            <div class="kpi-card">
              <div class="kpi-icon">🏢</div>
              <div class="kpi-info">
                <span class="kpi-label">총 대리점 수</span>
                <span class="kpi-value">{{ filteredAgencyPerformance.filter(a => !a.isDirect).length }}</span>
              </div>
            </div>
            <div class="kpi-card accent-green">
              <div class="kpi-icon">📈</div>
              <div class="kpi-info">
                <span class="kpi-label">평균 활성화율</span>
                <span class="kpi-value">
                  {{ (filteredAgencyPerformance.reduce((sum, a) => sum + a.activationRate, 0) / filteredAgencyPerformance.length || 0).toFixed(1) }}%
                </span>
              </div>
            </div>
            <div class="kpi-card accent-blue">
              <div class="kpi-icon">🏪</div>
              <div class="kpi-info">
                <span class="kpi-label">직영업 매장</span>
                <span class="kpi-value">{{ filteredAgencyPerformance.find(a => a.isDirect)?.totalShops || 0 }}</span>
              </div>
            </div>
            <div class="kpi-card accent-red">
              <div class="kpi-icon">⚠️</div>
              <div class="kpi-info">
                <span class="kpi-label">리스크 매장 총계</span>
                <span class="kpi-value">{{ filteredAgencyPerformance.reduce((sum, a) => sum + a.riskShops, 0) }}</span>
              </div>
            </div>
          </div>

          <!-- 대리점별 실적 테이블 -->
          <div v-if="filteredAgencyPerformance.length === 0" class="empty-state">
            <p>대리점 데이터가 없습니다.</p>
          </div>

          <div v-else class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="position: sticky; left: 0; background: var(--bg-secondary); z-index: 2;">대리점명</th>
                  <th>전체 매장<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th>이용<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th>대기<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th>선불/후불<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th>활성화 매장<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th style="background: var(--accent-green); color: white;">활성화율<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th style="background: var(--accent-purple); color: white;">신규<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th style="background: var(--accent-red); color: white;">리스크<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th style="background: var(--accent-orange); color: white;">이탈<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th>디바이스<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th>평균 주문수<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                  <th>총 주문액<span style="font-size: 11px; display: block; font-weight: normal; opacity: 0.8;">{{ agencyFilterLabel }}</span></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="agency in filteredAgencyPerformance" :key="agency.agencyName">
                  <tr :class="{ 'highlight-row': agency.isDirect, 'clickable-row': true }"
                      @click="toggleAgency(agency.agencyName)"
                      style="cursor: pointer;">
                    <td style="position: sticky; left: 0; background: var(--bg-card); z-index: 1;">
                      <strong :style="{ color: agency.isDirect ? 'var(--accent-blue)' : 'inherit' }">
                        {{ agency.agencyName }}
                      </strong>
                      <span v-if="agency.isDirect" class="badge badge-blue" style="margin-left: 8px;">직영</span>
                    </td>
                  <td><strong>{{ agency.totalShops }}</strong></td>
                  <td class="text-green">{{ agency.activeShops }}</td>
                  <td class="text-yellow">{{ agency.pendingShops }}</td>
                  <td style="font-size: 12px;">{{ agency.prepaidShops }}/{{ agency.postpaidShops }}</td>
                  <td><strong style="color: var(--accent-green);">{{ agency.activatedShops }}</strong></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <strong :style="{
                        color: agency.activationRate >= 70 ? 'var(--accent-green)' :
                               agency.activationRate >= 50 ? 'var(--accent-yellow)' :
                               'var(--accent-red)',
                        fontSize: '16px'
                      }">
                        {{ agency.activationRate.toFixed(1) }}%
                      </strong>
                      <div style="flex: 1; height: 8px; background: var(--bg-secondary); border-radius: 4px; overflow: hidden;">
                        <div :style="{
                          width: agency.activationRate + '%',
                          height: '100%',
                          background: agency.activationRate >= 70 ? 'var(--accent-green)' :
                                     agency.activationRate >= 50 ? 'var(--accent-yellow)' :
                                     'var(--accent-red)',
                          transition: 'width 0.3s ease'
                        }"></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span v-if="agency.newShops > 0" class="badge badge-purple">{{ agency.newShops }}</span>
                    <span v-else style="opacity: 0.3;">-</span>
                  </td>
                  <td>
                    <span v-if="agency.riskShops > 0" class="badge danger">{{ agency.riskShops }}</span>
                    <span v-else style="opacity: 0.3;">-</span>
                  </td>
                  <td>
                    <span v-if="agency.churnedShops > 0" class="badge badge-orange">{{ agency.churnedShops }}</span>
                    <span v-else style="opacity: 0.3;">-</span>
                  </td>
                  <td>{{ formatNumber(agency.totalDevices) }}</td>
                  <td>{{ agency.avgOrderCount.toFixed(1) }}</td>
                  <td>{{ formatCurrency(agency.totalOrderAmount) }}</td>
                </tr>

                <!-- 확장된 매장 목록 -->
                <tr v-if="expandedAgency === agency.agencyName" class="expanded-row">
                  <td colspan="13" style="padding: 0; background: var(--bg-secondary);">
                    <div style="padding: 16px; max-height: 400px; overflow-y: auto;">
                      <h4 style="margin-bottom: 12px; color: var(--text-primary);">{{ agency.agencyName }} - 매장 목록 ({{ agency.shopList.length }}개)</h4>
                      <table style="width: 100%; font-size: 13px;">
                        <thead>
                          <tr style="background: var(--bg-card);">
                            <th style="padding: 8px; text-align: left;">매장코드</th>
                            <th style="padding: 8px; text-align: left;">매장명</th>
                            <th style="padding: 8px; text-align: center;">상태</th>
                            <th style="padding: 8px; text-align: center;">결제</th>
                            <th style="padding: 8px; text-align: center;">활성화</th>
                            <th style="padding: 8px; text-align: right;">메뉴판앱<br>주문수</th>
                            <th style="padding: 8px; text-align: right;">디바이스</th>
                            <th style="padding: 8px; text-align: right;">주차별<br>주문액</th>
                            <th style="padding: 8px; text-align: left;">등록일</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="shop in agency.shopList" :key="shop.shop_code"
                              :class="{
                                'shop-risk': riskShopCodes.has(shop.shop_code),
                                'shop-churned': churnedShopCodes.has(shop.shop_code)
                              }"
                              style="border-bottom: 1px solid var(--border-light);">
                            <td style="padding: 8px;">{{ shop.shop_code }}</td>
                            <td style="padding: 8px;">{{ shop.shop_name }}</td>
                            <td style="padding: 8px; text-align: center;">
                              <span class="badge" :class="{
                                'badge-green': shop.shop_status === '이용',
                                'badge-yellow': shop.shop_status === '이용대기',
                                'danger': shop.shop_status === '종료'
                              }">{{ shop.shop_status }}</span>
                            </td>
                            <td style="padding: 8px; text-align: center;">
                              <span class="badge" :class="{
                                'badge-blue': shop.payment_type === '선불',
                                'badge-purple': shop.payment_type === '후불'
                              }">{{ shop.payment_type }}</span>
                            </td>
                            <td style="padding: 8px; text-align: center;">
                              <span v-if="shop.order_count_no_pos >= 1" style="color: var(--accent-green);">✓</span>
                              <span v-else style="opacity: 0.3;">-</span>
                            </td>
                            <td style="padding: 8px; text-align: right;">{{ formatNumber(shop.order_count_no_pos) }}</td>
                            <td style="padding: 8px; text-align: right;">{{ formatNumber(shop.device_count) }}</td>
                            <td style="padding: 8px; text-align: right;">{{ formatCurrency(shop.weekly_order_amount) }}</td>
                            <td style="padding: 8px;">{{ shop.ins_datetime?.split(' ')[0] || '-' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- POS 분석 탭 -->
      <div v-if="activeTab === 'pos'" class="tab-content" data-tab-content="pos">
        <div class="section">
          <div class="section-header">
            <h2>📟 POS 분석</h2>
            <p class="section-desc">
              POS 시스템별 매장 현황 및 활성화 분석입니다.
            </p>
          </div>
          <div class="empty-state">
            <p>🚧 준비 중입니다...</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-primary: #0f1419;
  --bg-secondary: #1a1f2e;
  --bg-card: #242b3d;
  --bg-hover: #2d3548;
  --text-primary: #e1e8ed;
  --text-secondary: #8899a6;
  --text-muted: #657786;
  --accent-blue: #1da1f2;
  --accent-green: #17bf63;
  --accent-red: #f4212e;
  --accent-yellow: #ffad1f;
  --accent-purple: #9b59b6;
  --accent-orange: #e67e22;
  --border-color: #38444d;
  --border-light: #2f3b47;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
}

.dashboard {
  min-height: 100vh;
  padding: 20px;
}

/* 헤더 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  padding: 24px 32px;
  border-radius: 16px;
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
}

.header h1 {
  font-size: 1.8rem;
  color: var(--accent-blue);
  margin-bottom: 4px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* 버튼 */
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--accent-blue);
  color: white;
}

.btn-primary:hover {
  background: #1991db;
}

.btn-secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.btn-export {
  background: var(--accent-green);
  color: white;
}

.btn-export:hover {
  background: #14a355;
}

.btn-large {
  padding: 16px 32px;
  font-size: 1.1rem;
}

/* 로딩 */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-color);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 에러 & 빈 상태 */
.error-message, .no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.no-data-content {
  background: var(--bg-secondary);
  padding: 48px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
}

.no-data h2 {
  font-size: 1.8rem;
  margin-bottom: 12px;
}

.hint {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin: 16px 0 24px;
}

/* 날짜 선택 */
.date-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  padding: 16px 24px;
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
}

.date-selector label {
  font-weight: 600;
  color: var(--text-secondary);
}

.date-selector select {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.date-info {
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* 범례 박스 */
.legend-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 24px;
}

.legend-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 0.9rem;
}

.legend-label {
  color: var(--text-secondary);
  font-weight: 600;
  min-width: 100px;
}

.legend-value {
  color: var(--text-muted);
  flex: 1;
}

/* 탭 */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: var(--bg-secondary);
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.tab {
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab.active {
  background: var(--accent-blue);
  color: white;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge.danger {
  background: var(--accent-red);
  color: white;
}

/* KPI 그리드 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.kpi-card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: flex-start;
  gap: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.kpi-icon {
  font-size: 2rem;
  line-height: 1;
}

.kpi-info {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.2;
}

.kpi-sub {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-top: 4px;
}

.kpi-change {
  font-size: 0.85rem;
  margin-top: 4px;
}

.kpi-change.positive { color: var(--accent-green); }
.kpi-change.negative { color: var(--accent-red); }

/* 카드 색상 */
.kpi-card.accent-green { border-left: 4px solid var(--accent-green); }
.kpi-card.accent-yellow { border-left: 4px solid var(--accent-yellow); }
.kpi-card.accent-red { border-left: 4px solid var(--accent-red); }
.kpi-card.accent-blue { border-left: 4px solid var(--accent-blue); }
.kpi-card.accent-purple { border-left: 4px solid var(--accent-purple); }
.kpi-card.accent-orange { border-left: 4px solid var(--accent-orange); }
.kpi-card.accent-gray { border-left: 4px solid var(--text-muted); }
.kpi-card.accent-teal { border-left: 4px solid #14b8a6; }

/* 섹션 */
.section {
  background: var(--bg-card);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 24px;
}

.section h2 {
  color: var(--accent-blue);
  margin-bottom: 16px;
  font-size: 1.2rem;
}

.section-header {
  margin-bottom: 20px;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* 테이블 */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

thead {
  background: var(--bg-secondary);
}

th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
}

tr:hover {
  background: var(--bg-hover);
}

tr.current-row {
  background: rgba(29, 161, 242, 0.1);
}

code {
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85rem;
}

/* 텍스트 색상 */
.text-green { color: var(--accent-green); }
.text-yellow { color: var(--accent-yellow); }
.text-red { color: var(--accent-red); }
.text-purple { color: var(--accent-purple); }
.text-orange { color: var(--accent-orange); }
.text-gray { color: var(--text-muted); }

/* 배지 색상 */
.badge-blue { background: rgba(29, 161, 242, 0.2); color: var(--accent-blue); }
.badge-green { background: rgba(23, 191, 99, 0.2); color: var(--accent-green); }
.badge-yellow { background: rgba(255, 173, 31, 0.2); color: var(--accent-yellow); }
.badge-orange { background: rgba(230, 126, 34, 0.2); color: var(--accent-orange); }
.badge-gray { background: rgba(101, 119, 134, 0.2); color: var(--text-muted); }

/* 빈 상태 */
.empty-state {
  text-align: center;
  padding: 48px;
  color: var(--text-secondary);
}

/* 차트 그리드 */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 24px;
  max-width: 100%;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

.chart-section {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.chart-header h3 {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.chart-filter {
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
}

.chart-filter:hover {
  border-color: var(--accent-color);
}

.chart-section h3 {
  color: var(--text-primary);
  font-size: 1rem;
  margin-bottom: 16px;
  font-weight: 600;
}

/* 토글 버튼 */
.view-toggle-container {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 8px;
}

.toggle-label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.toggle-buttons {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--accent-blue);
  color: white;
  border-color: var(--accent-blue);
}

/* 컴팩트 테이블 */
.compact-table th,
.compact-table td {
  padding: 10px 12px;
  font-size: 0.85rem;
}

.text-muted {
  color: var(--text-muted);
}

/* 필터 바 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
}

.filter-bar label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.filter-bar select {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}

.filter-result {
  color: var(--accent-blue);
  font-weight: 600;
  font-size: 0.9rem;
  margin-left: auto;
}

/* 필터 섹션 */
.filter-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  flex-wrap: wrap;
}

.filter-label {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.filter-options {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-blue);
}

.filter-btn.active {
  background: var(--accent-blue);
  color: white;
  border-color: var(--accent-blue);
}

.filter-info {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-left: auto;
}

/* 경고 행 스타일 */
.warning-row {
  background: rgba(255, 193, 7, 0.15) !important;
}

.warning-row:hover {
  background: rgba(255, 193, 7, 0.25) !important;
}

/* 하이라이트 행 (직영업) */
.highlight-row {
  background: rgba(52, 152, 219, 0.1) !important;
  border-left: 3px solid var(--accent-blue);
}

.highlight-row:hover {
  background: rgba(52, 152, 219, 0.2) !important;
}

/* 클릭 가능한 행 */
.clickable-row {
  transition: background-color 0.2s ease;
}

.clickable-row:hover {
  background: var(--bg-hover) !important;
}

/* 확장된 매장 목록 행 */
.expanded-row {
  background: var(--bg-secondary) !important;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.expanded-row table {
  border-collapse: collapse;
}

.expanded-row table thead tr {
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.expanded-row table tbody tr {
  transition: background-color 0.15s ease;
}

.expanded-row table tbody tr:hover {
  background: var(--bg-hover);
}

.expanded-row table th,
.expanded-row table td {
  border: none;
}

/* 매장 목록 하이라이트 */
.shop-risk {
  background: rgba(244, 33, 46, 0.15) !important;
  border-left: 3px solid var(--accent-red) !important;
}

.shop-risk:hover {
  background: rgba(244, 33, 46, 0.25) !important;
}

.shop-churned {
  background: rgba(230, 126, 34, 0.15) !important;
  border-left: 3px solid var(--accent-orange) !important;
}

.shop-churned:hover {
  background: rgba(230, 126, 34, 0.25) !important;
}

/* 리스크가 이탈보다 우선 */
.shop-risk.shop-churned {
  background: rgba(244, 33, 46, 0.15) !important;
  border-left: 3px solid var(--accent-red) !important;
}

/* 페이먼트 섹션 스타일 */
.payment-section {
  margin-bottom: 32px;
}

.payment-section h2 {
  margin-bottom: 16px;
  font-size: 1.2rem;
}

.subsection-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 20px 0 12px 0;
  padding-left: 8px;
  border-left: 3px solid var(--accent-blue);
}

.payment-summary-table {
  width: 100%;
}

.payment-summary-table th,
.payment-summary-table td {
  text-align: center;
  padding: 10px 12px;
  font-size: 0.85rem;
}

.payment-summary-table th {
  background: var(--bg-secondary);
}

.payment-summary-table .category-cell {
  background: var(--bg-secondary);
  font-weight: 600;
}

.payment-summary-table .total-row {
  background: var(--bg-secondary);
  font-weight: 600;
}

.payment-summary-table .indent-row td:first-child {
  padding-left: 24px;
}

.payment-summary-table .indent {
  text-align: left;
  padding-left: 24px !important;
  color: var(--text-secondary);
}

.payment-summary-table td:first-child {
  text-align: left;
}

/* ========== Executive Dashboard Styles ========== */

/* Hero Metrics */
.hero-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

@media (max-width: 1200px) {
  .hero-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .hero-metrics {
    grid-template-columns: 1fr;
  }
}

.hero-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid var(--border-color);
  transition: transform 0.2s, box-shadow 0.2s;
}

.hero-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.hero-icon {
  font-size: 2.5rem;
  line-height: 1;
}

.hero-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.hero-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.hero-change {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
  font-weight: 600;
}

.hero-change.positive {
  color: #17bf63;
}

.hero-change.negative {
  color: #f4212e;
}

.hero-change.neutral {
  color: var(--text-secondary);
  font-weight: 400;
  font-size: 0.8rem;
}

.hero-change .change-arrow {
  font-size: 1.1em;
}

.hero-change .change-rate {
  color: var(--text-muted);
  font-weight: 400;
}

.hero-kakao {
  border-left: 4px solid #ffd900;
}

.hero-solpay {
  border-left: 4px solid #e67e22;
}

.hero-amount {
  border-left: 4px solid #17bf63;
}

.hero-rate {
  border-left: 4px solid #1da1f2;
}

/* Change Summary */
.change-summary {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
  border: 1px solid var(--border-color);
}

.change-summary-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.change-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1000px) {
  .change-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

.change-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.change-card-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.change-card-icon {
  font-size: 1.2rem;
}

.change-card-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.change-card-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.change-card-value.positive {
  color: #17bf63;
}

.change-card-value.negative {
  color: #f4212e;
}

.change-card-value.warning {
  color: #ff9800;
}

.change-card-value.neutral {
  color: var(--text-secondary);
}

.change-card-breakdown {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.breakdown-item.kakao {
  color: #ffd900;
}

.breakdown-item.kakao-money {
  color: #ffd900;
}

.breakdown-item.kakao-pay {
  color: #7dd3fc;
}

.breakdown-item.solpay {
  color: #e67e22;
}

.breakdown-divider {
  margin: 0 6px;
  color: var(--text-muted);
}

/* Hero Breakdown */
.hero-breakdown {
  font-size: 0.85rem;
  margin-top: 4px;
  margin-bottom: 4px;
}

/* Compact Charts Grid */
.charts-grid.compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 32px;
}

@media (max-width: 1100px) {
  .charts-grid.compact {
    grid-template-columns: 1fr;
  }
}

/* Detail Accordion */
.detail-accordion {
  margin-top: 24px;
}

.accordion-section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.accordion-item {
  background: var(--bg-card);
  border-radius: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 600;
  text-align: left;
  transition: background 0.2s;
}

.accordion-header:hover {
  background: var(--bg-hover);
}

.accordion-icon {
  font-size: 1.3rem;
}

.accordion-title {
  flex: 1;
}

.accordion-arrow {
  font-size: 0.8rem;
  color: var(--text-muted);
  transition: transform 0.3s;
}

.accordion-arrow.open {
  transform: rotate(180deg);
}

.accordion-content {
  padding: 0 20px 20px 20px;
  border-top: 1px solid var(--border-color);
}

.detail-group {
  margin-top: 16px;
}

.detail-group-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid var(--accent-blue);
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 800px) {
  .detail-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

.detail-stat {
  background: var(--bg-secondary);
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.detail-stat .stat-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.detail-stat .stat-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

.detail-table th,
.detail-table td {
  padding: 10px 12px;
  text-align: center;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border-color);
}

.detail-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-secondary);
}

.detail-table td:first-child {
  text-align: left;
  font-weight: 500;
}

.detail-table tbody tr:hover {
  background: var(--bg-hover);
}
</style>
