import { computed, type Ref } from 'vue';
import type { PeriodComparison } from '../types';

// 차트 레이블 (MM/DD 형식)
export function useChartLabels(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() =>
    periodComparison.value.map(p => {
      const month = p.date.substring(4, 6);
      const day = p.date.substring(6, 8);
      return `${month}/${day}`;
    })
  );
}

// 전체 매장 수 추이 차트 데이터셋
export function useTotalShopDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '전체 매장',
      data: periodComparison.value.map(p => p.totalShops),
      borderColor: '#1da1f2',
    }
  ]);
}

// 이용 상태별 매장 수 추이 차트 데이터셋
export function useShopStatusDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '이용 매장',
      data: periodComparison.value.map(p => p.activeShops),
      borderColor: '#17bf63',
    },
    {
      label: '이용대기',
      data: periodComparison.value.map(p => p.pendingShops),
      borderColor: '#ffad1f',
    }
  ]);
}

// 신규 & 리스크 매장 차트 데이터셋
export function useNewRiskDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '신규 매장',
      data: periodComparison.value.map(p => p.newShops),
      borderColor: '#9b59b6',
    },
    {
      label: '리스크 매장',
      data: periodComparison.value.map(p => p.riskShops),
      borderColor: '#f4212e',
    }
  ]);
}

// 신규 매장만 차트 데이터셋
export function useNewShopsDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '신규 매장',
      data: periodComparison.value.map(p => p.newShops),
      borderColor: '#9b59b6',
    }
  ]);
}

// 리스크 매장만 차트 데이터셋
export function useRiskShopsDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '리스크 매장',
      data: periodComparison.value.map(p => p.riskShops),
      borderColor: '#f4212e',
    }
  ]);
}

// 일별 결제 추이 차트 데이터셋
export function useWeeklyPaymentDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '주차별 결제건수',
      data: periodComparison.value.map(p => p.weeklyPaymentCount),
      borderColor: '#1da1f2',
    }
  ]);
}

// 주별 결제금액 차트 데이터셋
export function useWeeklyPaymentAmountDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '주별 결제금액',
      data: periodComparison.value.map(p => p.weeklyPaymentAmount),
      borderColor: '#17bf63',
    }
  ]);
}

// 페이먼트사별 주별 추이 데이터셋
export function useWeeklyPaymentProviderDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '쏠페이 (주별)',
      data: periodComparison.value.map(p => p.weeklySolPayCount),
      borderColor: '#e67e22',
    },
    {
      label: '카카오페이 (주별)',
      data: periodComparison.value.map(p => p.weeklyKakaoPayCount),
      borderColor: '#f1c40f',
    }
  ]);
}

// 페이먼트사별 누적 추이 데이터셋
export function useCumulativePaymentProviderDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '쏠페이 (누적)',
      data: periodComparison.value.map(p => p.cumulativeSolPayCount),
      borderColor: '#e67e22',
    },
    {
      label: '카카오페이 (누적)',
      data: periodComparison.value.map(p => p.cumulativeKakaoPayCount),
      borderColor: '#f1c40f',
    }
  ]);
}

// 변동률 계산 데이터
export function useChangeRates(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => {
    const rates: {
      date: string;
      shopGrowth: number;
      activeGrowth: number;
      paymentGrowth: number;
      solPayGrowth: number;
      kakaoPayGrowth: number;
    }[] = [];

    for (let i = 0; i < periodComparison.value.length; i++) {
      const current = periodComparison.value[i];
      const prev = i > 0 ? periodComparison.value[i - 1] : null;

      if (!current) continue;

      rates.push({
        date: current.date,
        shopGrowth: prev && prev.totalShops > 0
          ? ((current.totalShops - prev.totalShops) / prev.totalShops) * 100
          : 0,
        activeGrowth: prev && prev.activeShops > 0
          ? ((current.activeShops - prev.activeShops) / prev.activeShops) * 100
          : 0,
        paymentGrowth: prev && prev.cumulativePaymentCount > 0
          ? ((current.cumulativePaymentCount - prev.cumulativePaymentCount) / prev.cumulativePaymentCount) * 100
          : 0,
        solPayGrowth: prev && prev.cumulativeSolPayCount > 0
          ? ((current.cumulativeSolPayCount - prev.cumulativeSolPayCount) / prev.cumulativeSolPayCount) * 100
          : 0,
        kakaoPayGrowth: prev && prev.cumulativeKakaoPayCount > 0
          ? ((current.cumulativeKakaoPayCount - prev.cumulativeKakaoPayCount) / prev.cumulativeKakaoPayCount) * 100
          : 0,
      });
    }

    return rates;
  });
}

// 변동률 차트 데이터셋
export function useGrowthRateDatasets(changeRates: ReturnType<typeof useChangeRates>) {
  return computed(() => [
    {
      label: '매장 증가율 (%)',
      data: changeRates.value.map(r => r.shopGrowth),
      borderColor: '#1da1f2',
    },
    {
      label: '이용매장 증가율 (%)',
      data: changeRates.value.map(r => r.activeGrowth),
      borderColor: '#17bf63',
    }
  ]);
}

// 페이먼트 성장률 차트 데이터셋
export function usePaymentGrowthDatasets(changeRates: ReturnType<typeof useChangeRates>) {
  return computed(() => [
    {
      label: '쏠페이 증가율 (%)',
      data: changeRates.value.map(r => r.solPayGrowth),
      borderColor: '#e67e22',
    },
    {
      label: '카카오페이 증가율 (%)',
      data: changeRates.value.map(r => r.kakaoPayGrowth),
      borderColor: '#f1c40f',
    }
  ]);
}

// 페이먼트사별 주별 금액 추이 데이터셋
export function useWeeklyPaymentProviderAmountDatasets(periodComparison: Ref<PeriodComparison[]>) {
  return computed(() => [
    {
      label: '쏠페이 금액 (주별)',
      data: periodComparison.value.map(p => p.weeklySolPayAmount),
      borderColor: '#e67e22',
    },
    {
      label: '카카오페이 금액 (주별)',
      data: periodComparison.value.map(p => p.weeklyKakaoPayAmount),
      borderColor: '#f1c40f',
    }
  ]);
}
