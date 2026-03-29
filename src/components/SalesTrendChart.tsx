import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { DataPoint } from "../data/sampleData";
import { TrendingUp } from "lucide-react";

interface SalesTrendChartProps {
  data: DataPoint[];
  onDataClick?: (data: any) => void;
  selectedCategory?: string;
}

export function SalesTrendChart({ data, onDataClick, selectedCategory }: SalesTrendChartProps) {
  // Aggregate data by month for trend visualization
  const monthlyData = data.reduce((acc, item) => {
    const key = `${item.year}-${item.month}`;
    if (!acc[key]) {
      acc[key] = {
        month: item.month,
        year: item.year,
        date: item.date,
        sales: 0,
        revenue: 0,
        count: 0
      };
    }
    acc[key].sales += item.sales;
    acc[key].revenue += item.revenue;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(monthlyData)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-12); // Show last 12 months

  const totalSales = chartData.reduce((sum: number, item: any) => sum + item.sales, 0);
  const avgGrowth = chartData.length > 1 ? 
    ((chartData[chartData.length - 1].sales - chartData[0].sales) / chartData[0].sales * 100) : 0;

  const handleClick = (data: any) => {
    if (onDataClick) {
      onDataClick(data);
    }
  };

  return (
    <Card className="h-[400px] border border-gray-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 text-lg font-semibold">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Sales Trend
          </CardTitle>
          <div className="text-right">
            <div className="text-xl font-semibold text-gray-900">${(totalSales / 1000000).toFixed(1)}M</div>
            <div className={`text-sm ${avgGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {avgGrowth >= 0 ? '+' : ''}{avgGrowth.toFixed(1)}%
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} onClick={handleClick}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12, fill: '#737373' }}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#737373' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              axisLine={{ stroke: '#d4d4d4' }}
              tickLine={{ stroke: '#d4d4d4' }}
            />
            <Tooltip 
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Sales']}
              labelFormatter={(label) => `Month: ${label}`}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#0ea5e9"
              strokeWidth={2}
              fill="url(#salesGradient)"
              dot={{ fill: "#0ea5e9", strokeWidth: 2, r: 4 }}
              activeDot={{ 
                r: 6, 
                stroke: "#0ea5e9", 
                strokeWidth: 2, 
                fill: "#ffffff"
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}