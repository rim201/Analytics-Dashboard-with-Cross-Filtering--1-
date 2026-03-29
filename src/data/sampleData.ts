export interface DataPoint {
  id: string;
  date: string;
  month: string;
  quarter: string;
  year: number;
  category: string;
  region: string;
  sales: number;
  revenue: number;
  previousYearSales: number;
  previousYearRevenue: number;
  units: number;
  customers: number;
  state?: string;
  storeCount?: number;
}

export const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books'];
export const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Africa'];

// Enhanced regional data with US state mapping
export const regionStateMapping = {
  'North America': ['California', 'Texas', 'New York', 'Florida', 'Illinois'],
  'Europe': ['Ohio', 'Pennsylvania', 'Michigan', 'Wisconsin', 'Indiana'], 
  'Asia Pacific': ['Georgia', 'North Carolina', 'Virginia', 'Tennessee', 'Kentucky'],
  'Latin America': ['Arizona', 'Nevada', 'Colorado', 'Utah', 'New Mexico'],
  'Africa': ['Maine', 'Vermont', 'New Hampshire', 'Massachusetts', 'Connecticut']
};

export const generateSampleData = (): DataPoint[] => {
  const data: DataPoint[] = [];
  const currentYear = 2024;
  const previousYear = 2023;
  
  // Regional multipliers based on US market characteristics
  const regionalMultipliers = {
    'North America': 1.4, // Major markets like CA, TX, NY
    'Europe': 1.1, // Midwest industrial centers
    'Asia Pacific': 1.2, // Growing Southeast markets
    'Latin America': 1.0, // Southwest emerging markets
    'Africa': 0.9 // Northeast premium but smaller markets
  };
  
  // Generate data for current year and previous year
  for (let year of [previousYear, currentYear]) {
    for (let month = 1; month <= 12; month++) {
      for (let category of categories) {
        for (let region of regions) {
          const date = new Date(year, month - 1, 1);
          const monthName = date.toLocaleDateString('en-US', { month: 'short' });
          const quarter = `Q${Math.ceil(month / 3)}`;
          
          // Generate realistic but varied data with regional characteristics
          const baseRevenue = Math.random() * 40000 + 30000;
          const seasonalMultiplier = month === 12 ? 1.6 : month >= 6 && month <= 8 ? 1.3 : month === 11 ? 1.4 : 1;
          const categoryMultiplier = category === 'Electronics' ? 1.4 : category === 'Clothing' ? 1.2 : category === 'Home & Garden' ? 1.1 : 1;
          const regionMultiplier = regionalMultipliers[region as keyof typeof regionalMultipliers] || 1;
          
          const revenue = Math.round(baseRevenue * seasonalMultiplier * categoryMultiplier * regionMultiplier);
          const sales = Math.round(revenue * (0.85 + Math.random() * 0.3));
          const units = Math.round(revenue / (60 + Math.random() * 180));
          const customers = Math.round(units * (0.4 + Math.random() * 0.4));
          
          // Add store count data for regional analysis
          const stateList = regionStateMapping[region as keyof typeof regionStateMapping];
          const randomState = stateList[Math.floor(Math.random() * stateList.length)];
          const storeCount = Math.floor(Math.random() * 8) + 3; // 3-10 stores per region/category
          
          data.push({
            id: `${year}-${month}-${category}-${region}`,
            date: date.toISOString().split('T')[0],
            month: monthName,
            quarter,
            year,
            category,
            region,
            sales,
            revenue,
            previousYearSales: year === currentYear ? Math.round(sales * (0.82 + Math.random() * 0.36)) : 0,
            previousYearRevenue: year === currentYear ? Math.round(revenue * (0.82 + Math.random() * 0.36)) : 0,
            units,
            customers,
            state: randomState,
            storeCount
          });
        }
      }
    }
  }
  
  return data;
};

export const sampleData = generateSampleData();

// Export US regions for mapping and filtering
export const usRegions = {
  'North America': {
    name: 'North America',
    description: 'Major Markets - CA, TX, NY, FL, IL',
    color: '#FF6B6B',
    states: regionStateMapping['North America']
  },
  'Europe': {
    name: 'Europe', 
    description: 'Midwest Industrial - OH, PA, MI, WI, IN',
    color: '#4ECDC4',
    states: regionStateMapping['Europe']
  },
  'Asia Pacific': {
    name: 'Asia Pacific',
    description: 'Southeast Growth - GA, NC, VA, TN, KY', 
    color: '#45B7D1',
    states: regionStateMapping['Asia Pacific']
  },
  'Latin America': {
    name: 'Latin America',
    description: 'Southwest Emerging - AZ, NV, CO, UT, NM',
    color: '#FECA57', 
    states: regionStateMapping['Latin America']
  },
  'Africa': {
    name: 'Africa',
    description: 'Northeast Premium - ME, VT, NH, MA, CT',
    color: '#FF9FF3',
    states: regionStateMapping['Africa']
  }
};