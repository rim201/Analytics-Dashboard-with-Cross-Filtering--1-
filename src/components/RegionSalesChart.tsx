import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DataPoint } from "../data/sampleData";
import { MapPin, Store, TrendingUp } from "lucide-react";

interface RegionSalesChartProps {
  data: DataPoint[];
  onDataClick?: (data: any) => void;
  selectedRegion?: string;
}

const US_REGIONS = {
  "North America": {
    states: ["California", "New York", "Texas", "Florida", "Illinois"],
    color: "#0ea5e9",
    description: "West Coast & Major Markets"
  },
  "Europe": {
    states: ["Ohio", "Pennsylvania", "Michigan", "Wisconsin", "Indiana"],
    color: "#10b981",
    description: "Midwest & Industrial Centers"
  },
  "Asia Pacific": {
    states: ["Georgia", "North Carolina", "Virginia", "Tennessee", "Kentucky"],
    color: "#f59e0b",
    description: "Southeast & Growth Markets"
  },
  "Latin America": {
    states: ["Arizona", "Nevada", "Colorado", "Utah", "New Mexico"],
    color: "#ef4444",
    description: "Southwest & Emerging Markets"
  },
  "Africa": {
    states: ["Maine", "Vermont", "New Hampshire", "Massachusetts", "Connecticut"],
    color: "#8b5cf6",
    description: "Northeast & Premium Markets"
  }
};

const REGION_SALES_DATA = [
  { region: "California", sales: 2850000, stores: 24, newStores: 3, variance: 12.5, color: "#0ea5e9" },
  { region: "Texas", sales: 2650000, stores: 22, newStores: 2, variance: 8.3, color: "#0ea5e9" },
  { region: "New York", sales: 2400000, stores: 18, newStores: 1, variance: -2.1, color: "#0ea5e9" },
  { region: "Florida", sales: 2200000, stores: 20, newStores: 4, variance: 15.7, color: "#0ea5e9" },
  { region: "Illinois", sales: 1950000, stores: 16, newStores: 1, variance: 5.2, color: "#0ea5e9" },
  { region: "Ohio", sales: 1800000, stores: 15, newStores: 2, variance: 9.8, color: "#10b981" },
  { region: "Pennsylvania", sales: 1650000, stores: 14, newStores: 1, variance: 3.4, color: "#10b981" },
  { region: "Michigan", sales: 1500000, stores: 12, newStores: 0, variance: -1.5, color: "#10b981" },
  { region: "Georgia", sales: 1750000, stores: 16, newStores: 3, variance: 18.2, color: "#f59e0b" },
  { region: "North Carolina", sales: 1600000, stores: 14, newStores: 2, variance: 11.9, color: "#f59e0b" },
  { region: "Arizona", sales: 1400000, stores: 11, newStores: 2, variance: 14.6, color: "#ef4444" },
  { region: "Colorado", sales: 1250000, stores: 10, newStores: 1, variance: 7.8, color: "#ef4444" },
];

export function RegionSalesChart({ data, onDataClick, selectedRegion }: RegionSalesChartProps) {
  // Create a copy of the array before sorting to avoid mutating the original
  const regionalData = [...REGION_SALES_DATA].sort((a, b) => b.sales - a.sales);

  const totalSales = regionalData.reduce((sum, item) => sum + item.sales, 0);
  const totalStores = regionalData.reduce((sum, item) => sum + item.stores, 0);
  const totalNewStores = regionalData.reduce((sum, item) => sum + item.newStores, 0);
  const avgVariance = regionalData.reduce((sum, item) => sum + item.variance, 0) / regionalData.length;

  const handleRegionClick = (data: any) => {
    if (onDataClick) {
      // Map state names to our region names for filtering
      const regionMapping: Record<string, string> = {
        "California": "North America",
        "Texas": "North America", 
        "New York": "North America",
        "Florida": "North America",
        "Illinois": "North America",
        "Ohio": "Europe",
        "Pennsylvania": "Europe",
        "Michigan": "Europe",
        "Georgia": "Asia Pacific",
        "North Carolina": "Asia Pacific",
        "Arizona": "Latin America",
        "Colorado": "Latin America"
      };
      
      onDataClick({ region: regionMapping[data.region] || data.region });
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardHeader className="pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-gray-900 text-xl font-semibold">
            <MapPin className="w-6 h-6 text-blue-600" />
            Regional Sales Distribution
          </CardTitle>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">{totalStores}</div>
              <div className="text-sm text-gray-600">Total Stores</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">{totalNewStores}</div>
              <div className="text-sm text-gray-600">New Stores</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-semibold ${avgVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {avgVariance >= 0 ? '+' : ''}{avgVariance.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Avg Growth</div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales by State Chart */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Performance by State</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={regionalData} onClick={handleRegionClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis 
                  dataKey="region" 
                  tick={{ fontSize: 11, fill: '#737373' }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  axisLine={{ stroke: '#d4d4d4' }}
                  tickLine={{ stroke: '#d4d4d4' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#737373' }}
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  axisLine={{ stroke: '#d4d4d4' }}
                  tickLine={{ stroke: '#d4d4d4' }}
                />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Sales']}
                  labelFormatter={(label) => `State: ${label}`}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar 
                  dataKey="sales" 
                  radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                >
                  {regionalData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={selectedRegion && US_REGIONS[selectedRegion as keyof typeof US_REGIONS]?.states.includes(entry.region) 
                        ? "#374151" : "none"}
                      strokeWidth={selectedRegion && US_REGIONS[selectedRegion as keyof typeof US_REGIONS]?.states.includes(entry.region) 
                        ? 2 : 0}
                      style={{
                        filter: selectedRegion && US_REGIONS[selectedRegion as keyof typeof US_REGIONS]?.states.includes(entry.region) 
                          ? 'brightness(1.1)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Regional Summary Cards */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Overview</h3>
            {Object.entries(US_REGIONS).map(([regionName, regionInfo]) => {
              const regionStates = regionalData.filter(state => regionInfo.states.includes(state.region));
              const regionTotal = regionStates.reduce((sum, state) => sum + state.sales, 0);
              const regionStores = regionStates.reduce((sum, state) => sum + state.stores, 0);
              const regionNewStores = regionStates.reduce((sum, state) => sum + state.newStores, 0);
              
              return (
                <Card 
                  key={regionName}
                  className={`cursor-pointer transition-all duration-200 border ${
                    selectedRegion === regionName 
                      ? 'border-blue-500 shadow-md bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => handleRegionClick({ region: regionName })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: regionInfo.color }}
                      />
                      <span className="font-medium text-gray-900">{regionName}</span>
                    </div>
                    <div className="text-xs text-gray-600 mb-3">{regionInfo.description}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          ${(regionTotal / 1000000).toFixed(1)}M
                        </div>
                        <div className="text-xs text-gray-600">Sales</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">{regionStores}</div>
                        <div className="text-xs text-gray-600">Stores</div>
                      </div>
                    </div>
                    {regionNewStores > 0 && (
                      <div className="mt-2 flex items-center gap-1">
                        <Store className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-green-600">+{regionNewStores} new stores</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Performance Indicators */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-semibold text-gray-900">${(totalSales / 1000000).toFixed(1)}M</div>
            <div className="text-sm text-gray-600">Total Regional Sales</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Store className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-semibold text-gray-900">{totalStores}</div>
            <div className="text-sm text-gray-600">Active Locations</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-lg flex items-center justify-center mx-auto mb-2 text-sm font-semibold">
              {totalNewStores}
            </div>
            <div className="text-2xl font-semibold text-gray-900">{totalNewStores}</div>
            <div className="text-sm text-gray-600">New Stores</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="w-8 h-8 bg-orange-600 text-white rounded-lg flex items-center justify-center mx-auto mb-2 text-xs font-semibold">
              %
            </div>
            <div className={`text-2xl font-semibold ${avgVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {avgVariance >= 0 ? '+' : ''}{avgVariance.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Growth Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}