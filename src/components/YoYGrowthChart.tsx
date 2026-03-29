import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DataPoint } from "../data/sampleData";
import { TrendingUp, TrendingDown } from "lucide-react";

interface YoYGrowthChartProps {
  data: DataPoint[];
  onDataClick?: (data: any) => void;
  selectedRegion?: string;
}

const REGION_COLORS = [
  "#0ea5e9", // Sky Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
];

export function YoYGrowthChart({ data, onDataClick, selectedRegion }: YoYGrowthChartProps) {
  // Calculate YoY growth by region
  const currentYearData = data.filter(item => item.year === 2024);
  const previousYearData = data.filter(item => item.year === 2023);

  const regionGrowth = currentYearData.reduce((acc, curr) => {
    if (!acc[curr.region]) {
      acc[curr.region] = {
        region: curr.region,
        current: 0,
        previous: 0,
        growth: 0
      };
    }
    acc[curr.region].current += curr.revenue;
    return acc;
  }, {} as Record<string, any>);

  previousYearData.forEach(item => {
    if (regionGrowth[item.region]) {
      regionGrowth[item.region].previous += item.revenue;
    }
  });

  const chartData = Object.values(regionGrowth).map((item: any) => {
    const growth = item.previous > 0 ? ((item.current - item.previous) / item.previous) * 100 : 0;
    return {
      ...item,
      growth: parseFloat(growth.toFixed(1))
    };
  }).sort((a: any, b: any) => b.growth - a.growth);

  const avgGrowth = chartData.reduce((sum: number, item: any) => sum + item.growth, 0) / chartData.length;

  const handleClick = (data: any) => {
    if (onDataClick) {
      onDataClick({ region: data.region });
    }
  };

  return (
    <Card className="h-[400px] border border-gray-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 text-lg font-semibold">
            {avgGrowth >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            YoY Growth by Region
          </CardTitle>
          <div className="text-right">
            <div className={`text-xl font-semibold ${avgGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {avgGrowth >= 0 ? '+' : ''}{avgGrowth.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">Average</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="region" 
              tick={{ fontSize: 11, fill: '#737373' }}
              angle={-45}
              textAnchor="end"
              height={80}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#737373' }}
              tickFormatter={(value) => `${value}%`}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value}%`, 'Growth']}
              labelFormatter={(label) => `Region: ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Bar 
              dataKey="growth" 
              fill="#0ea5e9"
              radius={[4, 4, 0, 0]}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry: any, index: number) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={entry.growth >= 0 ? "#10b981" : "#ef4444"}
                  stroke={selectedRegion === entry.region ? "#374151" : "none"}
                  strokeWidth={selectedRegion === entry.region ? 2 : 0}
                  style={{
                    filter: selectedRegion === entry.region ? 'brightness(1.1)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}