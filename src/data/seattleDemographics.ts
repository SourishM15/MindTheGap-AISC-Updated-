import { NeighborhoodDemographics, DemographicsSummary, NeighborhoodForecast, NeighborhoodHistory } from '../types/demographics';

// Generate historical data from 2000 to 2019
const generateHistoricalData = (startValue: number, endValue: number, startYear = 2000) => {
  const years = 2020 - startYear;
  const yearlyGrowth = (endValue - startValue) / years;
  
  return Array.from({ length: years }, (_, i) => ({
    year: startYear + i,
    value: Math.round(startValue + yearlyGrowth * i)
  }));
};

// Generate forecast data from 2020 to 2026
const generateForecastData = (lastValue: number, growthRate: number) => {
  return Array.from({ length: 7 }, (_, i) => ({
    year: 2020 + i,
    value: Math.round(lastValue * Math.pow(1 + growthRate, i))
  }));
};

const rawData = {
  "Ballard": {
    demographics: {
      childrenUnder18: 1088 + 2599,
      workingAgeAdults: 9152 + 17128,
      olderAdults: 925 + 1638,
      aggregateAgeTotal: 369056.7 + 706129.1,
      aggregateAgeMale: 173536 + 352190.6,
      aggregateAgeFemale: 197761.1 + 356414.6,
      medianAgeTotal: (33 + 33) / 2,
      medianAgeMale: (32 + 32.5) / 2,
      medianAgeFemale: (34.3 + 33.7) / 2,
      medianIncome: 94250,
      history: {
        population: generateHistoricalData(20000, 29000),
        medianIncome: generateHistoricalData(65000, 87000),
        giniCoefficient: generateHistoricalData(0.42, 0.44),
        incomeRatio: generateHistoricalData(8.1, 8.5),
        povertyRate: generateHistoricalData(12, 11),
        wealthShare: generateHistoricalData(25, 27)
      },
      forecast: {
        population: generateForecastData(29000, 0.025),
        medianIncome: generateForecastData(87000, 0.035),
        giniCoefficient: generateForecastData(0.44, 0.005),
        incomeRatio: generateForecastData(8.5, 0.01),
        povertyRate: generateForecastData(11, -0.005),
        wealthShare: generateForecastData(27, 0.01)
      }
    }
  },
  "Capitol Hill": {
    demographics: {
      childrenUnder18: 579 + 1394,
      workingAgeAdults: 24726 + 43533,
      olderAdults: 1423 + 4290,
      aggregateAgeTotal: 851028.9 + 1609883.4,
      aggregateAgeMale: 505584.5 + 903901.6,
      aggregateAgeFemale: 343317.8 + 746375,
      medianAgeTotal: (31.8 + 32.7) / 2,
      medianAgeMale: (32.4 + 32.8) / 2,
      medianAgeFemale: (30.7 + 34.4) / 2,
      medianIncome: 89120,
      history: {
        population: generateHistoricalData(35000, 42000),
        medianIncome: generateHistoricalData(55000, 82000),
        giniCoefficient: generateHistoricalData(0.45, 0.48),
        incomeRatio: generateHistoricalData(9.0, 9.5),
        povertyRate: generateHistoricalData(15, 14),
        wealthShare: generateHistoricalData(28, 30)
      },
      forecast: {
        population: generateForecastData(42000, 0.028),
        medianIncome: generateForecastData(82000, 0.038),
        giniCoefficient: generateForecastData(0.48, 0.006),
        incomeRatio: generateForecastData(9.5, 0.012),
        povertyRate: generateForecastData(14, -0.006),
        wealthShare: generateForecastData(30, 0.012)
      }
    }
  },
  "Downtown": {
    demographics: {
      childrenUnder18: 1021,
      workingAgeAdults: 36389,
      olderAdults: 5378,
      aggregateAgeTotal: 1589150.5,
      aggregateAgeMale: 894624.1,
      aggregateAgeFemale: 704138.1,
      medianAgeTotal: 37.1,
      medianAgeMale: 36.9,
      medianAgeFemale: 37.9,
      medianIncome: 82460,
      history: {
        population: generateHistoricalData(30000, 42788),
        medianIncome: generateHistoricalData(50000, 75000),
        giniCoefficient: generateHistoricalData(0.50, 0.52),
        incomeRatio: generateHistoricalData(10.0, 10.5),
        povertyRate: generateHistoricalData(18, 17),
        wealthShare: generateHistoricalData(32, 34)
      },
      forecast: {
        population: generateForecastData(42788, 0.022),
        medianIncome: generateForecastData(75000, 0.032),
        giniCoefficient: generateForecastData(0.52, 0.004),
        incomeRatio: generateForecastData(10.5, 0.008),
        povertyRate: generateForecastData(17, -0.004),
        wealthShare: generateForecastData(34, 0.008)
      }
    }
  },
  "Fremont": {
    demographics: {
      childrenUnder18: 1700 + 501,
      workingAgeAdults: 15408 + 6391,
      olderAdults: 1511 + 429,
      aggregateAgeTotal: 622398.5 + 234744.3,
      aggregateAgeMale: 305926.4 + 116531.4,
      aggregateAgeFemale: 316414.8 + 116644.2,
      medianAgeTotal: (33.4 + 32) / 2,
      medianAgeMale: (33.6 + 31.4) / 2,
      medianAgeFemale: (33.1 + 32.2) / 2,
      medianIncome: 98340,
      history: {
        population: generateHistoricalData(18000, 25939),
        medianIncome: generateHistoricalData(60000, 90000),
        giniCoefficient: generateHistoricalData(0.40, 0.42),
        incomeRatio: generateHistoricalData(7.8, 8.2),
        povertyRate: generateHistoricalData(11, 10),
        wealthShare: generateHistoricalData(24, 26)
      },
      forecast: {
        population: generateForecastData(25939, 0.024),
        medianIncome: generateForecastData(90000, 0.034),
        giniCoefficient: generateForecastData(0.42, 0.005),
        incomeRatio: generateForecastData(8.2, 0.01),
        povertyRate: generateForecastData(10, -0.005),
        wealthShare: generateForecastData(26, 0.01)
      }
    }
  },
  "Queen Anne": {
    demographics: {
      childrenUnder18: 4314,
      workingAgeAdults: 36166,
      olderAdults: 5025,
      aggregateAgeTotal: 1598747,
      aggregateAgeMale: 782431.9,
      aggregateAgeFemale: 815743.8,
      medianAgeTotal: 35.1,
      medianAgeMale: 34.1,
      medianAgeFemale: 36.0,
      medianIncome: 109750,
      history: {
        population: generateHistoricalData(40000, 45505),
        medianIncome: generateHistoricalData(70000, 100000),
        giniCoefficient: generateHistoricalData(0.38, 0.40),
        incomeRatio: generateHistoricalData(7.5, 7.8),
        povertyRate: generateHistoricalData(9, 8),
        wealthShare: generateHistoricalData(22, 24)
      },
      forecast: {
        population: generateForecastData(45505, 0.02),
        medianIncome: generateForecastData(100000, 0.03),
        giniCoefficient: generateForecastData(0.40, 0.004),
        incomeRatio: generateForecastData(7.8, 0.008),
        povertyRate: generateForecastData(8, -0.004),
        wealthShare: generateForecastData(24, 0.008)
      }
    }
  },
  "University District": {
    demographics: {
      childrenUnder18: 912 + 793,
      workingAgeAdults: 21708 + 27843,
      olderAdults: 628 + 774,
      aggregateAgeTotal: 537324.5 + 668862.8,
      aggregateAgeMale: 276428.4 + 337312.9,
      aggregateAgeFemale: 268841.7 + 335317.6,
      medianAgeTotal: (23.1 + 22.7) / 2,
      medianAgeMale: (24.3 + 23.4) / 2,
      medianAgeFemale: (22.5 + 22.2) / 2,
      medianIncome: 52180,
      history: {
        population: generateHistoricalData(45000, 52658),
        medianIncome: generateHistoricalData(35000, 48000),
        giniCoefficient: generateHistoricalData(0.48, 0.50),
        incomeRatio: generateHistoricalData(9.5, 10.0),
        povertyRate: generateHistoricalData(20, 18),
        wealthShare: generateHistoricalData(30, 32)
      },
      forecast: {
        population: generateForecastData(52658, 0.015),
        medianIncome: generateForecastData(48000, 0.025),
        giniCoefficient: generateForecastData(0.50, 0.003),
        incomeRatio: generateForecastData(10.0, 0.006),
        povertyRate: generateForecastData(18, -0.003),
        wealthShare: generateForecastData(32, 0.006)
      }
    }
  },
  "South Lake Union": {
    demographics: {
      childrenUnder18: 322,
      workingAgeAdults: 10739,
      olderAdults: 915,
      aggregateAgeTotal: 361128.8,
      aggregateAgeMale: 208120.8,
      aggregateAgeFemale: 181019.4,
      medianAgeTotal: 30.1,
      medianAgeMale: 30.2,
      medianAgeFemale: 35.4,
      medianIncome: 115620,
      history: {
        population: generateHistoricalData(8000, 11976),
        medianIncome: generateHistoricalData(75000, 105000),
        giniCoefficient: generateHistoricalData(0.41, 0.43),
        incomeRatio: generateHistoricalData(8.0, 8.3),
        povertyRate: generateHistoricalData(10, 9),
        wealthShare: generateHistoricalData(26, 28)
      },
      forecast: {
        population: generateForecastData(11976, 0.035),
        medianIncome: generateForecastData(105000, 0.045),
        giniCoefficient: generateForecastData(0.43, 0.006),
        incomeRatio: generateForecastData(8.3, 0.012),
        povertyRate: generateForecastData(9, -0.006),
        wealthShare: generateForecastData(28, 0.012)
      }
    }
  }
};

export const getDemographicsSummary = (neighborhoodName: string): DemographicsSummary | null => {
  const neighborhood = rawData[neighborhoodName as keyof typeof rawData];
  if (!neighborhood) return null;

  const data = neighborhood.demographics;
  if (!data) return null;

  const totalPopulation = data.childrenUnder18 + data.workingAgeAdults + data.olderAdults;

  return {
    totalPopulation,
    ageDistribution: {
      children: Math.round((data.childrenUnder18 / totalPopulation) * 100),
      workingAge: Math.round((data.workingAgeAdults / totalPopulation) * 100),
      elderly: Math.round((data.olderAdults / totalPopulation) * 100)
    },
    medianAge: data.medianAgeTotal,
    genderRatio: {
      male: Math.round((data.aggregateAgeMale / data.aggregateAgeTotal) * 100),
      female: Math.round((data.aggregateAgeFemale / data.aggregateAgeTotal) * 100)
    },
    medianIncome: data.medianIncome,
    history: data.history,
    forecast: data.forecast
  };
};