import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DataPoint } from "../data/sampleData";
import { Activity } from "lucide-react";

interface PerformanceMetricsChartProps {
  data: DataPoint[];
  onDataClick?: (data: any) => void;
}

export function PerformanceMetricsChart({ data, onDataClick }: PerformanceMetricsChartProps) {
  // Aggregate performance metrics by quarter
  const quarterlyData = data.reduce((acc, item) => {
    const key = `${item.year}-${item.quarter}`;
    if (!acc[key]) {
      acc[key] = {
        quarter: item.quarter,
        year: item.year,
        customers: 0,
        units: 0,
        avgOrderValue: 0,
        revenue: 0,
        count: 0
      };
    }
    acc[key].customers += item.customers;
    acc[key].units += item.units;
    acc[key].revenue += item.revenue;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(quarterlyData)
    .map((item: any) => ({
      ...item,
      avgOrderValue: item.revenue / item.customers || 0,
      period: `${item.quarter} ${item.year}`
    }))
    .sort((a: any, b: any) => {
      if (a.year !== b.year) return a.year - b.year;
      return parseInt(a.quarter.replace('Q', '')) - parseInt(b.quarter.replace('Q', ''));
    })
    .slice(-8); // Show last 8 quarters

  const totalCustomers = chartData[chartData.length - 1]?.customers || 0;
  const customerGrowth = chartData.length > 1 ? 
    ((chartData[chartData.length - 1].customers - chartData[0].customers) / chartData[0].customers * 100) : 0;

  return (
    <Card className="h-[400px] border border-gray-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 text-lg font-semibold">
            <Activity className="w-5 h-5 text-purple-600" />
            Performance Metrics
          </CardTitle>
          <div className="text-right">
            <div className="text-xl font-semibold text-gray-900">{(totalCustomers / 1000).toFixed(1)}K</div>
            <div className={`text-sm ${customerGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {customerGrowth >= 0 ? '+' : ''}{customerGrowth.toFixed(1)}%
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} onClick={onDataClick}>
            <defs>
              <linearGradient id="customersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="unitsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="period" 
              tick={{ fontSize: 11, fill: '#737373' }}
              angle={-45}
              textAnchor="end"
              height={60}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#737373' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                name === 'customers' ? `${value.toLocaleString()} customers` : `${value.toLocaleString()} units`,
                name === 'customers' ? 'Customers' : 'Units Sold'
              ]}
              labelFormatter={(label) => `Period: ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="customers" 
              stackId="1"
              stroke="#8b5cf6" 
              fill="url(#customersGradient)"
              strokeWidth={2}
            />
            <Area 
              type="monotone" 
              dataKey="units" 
              stackId="2"
              stroke="#0ea5e9" 
              fill="url(#unitsGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
        
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">${(chartData[chartData.length - 1]?.avgOrderValue || 0).toFixed(0)}</div>
            <div className="text-sm text-gray-600">Avg Order Value</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">{((chartData[chartData.length - 1]?.units || 0) / 1000).toFixed(1)}K</div>
            <div className="text-sm text-gray-600">Units Sold</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}