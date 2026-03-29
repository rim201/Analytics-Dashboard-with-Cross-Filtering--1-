import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { DataPoint } from "../data/sampleData";
import { DollarSign } from "lucide-react";

interface RevenueBreakdownChartProps {
  data: DataPoint[];
  onDataClick?: (data: any) => void;
  selectedCategory?: string;
}

const CHART_COLORS = [
  "#0ea5e9", // Sky Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#f97316", // Orange
];

export function RevenueBreakdownChart({ data, onDataClick, selectedCategory }: RevenueBreakdownChartProps) {
  // Aggregate revenue by category
  const categoryData = data.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = {
        category: item.category,
        revenue: 0,
        percentage: 0
      };
    }
    acc[item.category].revenue += item.revenue;
    return acc;
  }, {} as Record<string, any>);

  const totalRevenue = Object.values(categoryData).reduce((sum: number, item: any) => sum + item.revenue, 0);
  
  const chartData = Object.values(categoryData).map((item: any) => ({
    ...item,
    percentage: ((item.revenue / totalRevenue) * 100).toFixed(1)
  })).sort((a: any, b: any) => b.revenue - a.revenue);

  const handleClick = (data: any, index: number) => {
    if (onDataClick) {
      onDataClick({ category: data.category });
    }
  };

  return (
    <Card className="h-[400px] border border-gray-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-gray-900 text-lg font-semibold">
            <DollarSign className="w-5 h-5 text-green-600" />
            Revenue by Category
          </CardTitle>
          <div className="text-xl font-semibold text-gray-900">${(totalRevenue / 1000000).toFixed(1)}M</div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="revenue"
                onClick={handleClick}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    stroke={selectedCategory === entry.category ? "#374151" : "#ffffff"}
                    strokeWidth={selectedCategory === entry.category ? 2 : 1}
                    style={{ 
                      cursor: 'pointer',
                      filter: selectedCategory === entry.category ? 'brightness(1.1)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {chartData.slice(0, 5).map((item: any, index: number) => (
            <div 
              key={item.category} 
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                selectedCategory === item.category 
                  ? 'bg-gray-100' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleClick(item, index)}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="text-sm font-medium text-gray-900">{item.category}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{item.percentage}%</div>
                <div className="text-xs text-gray-500">
                  ${(item.revenue / 1000).toFixed(0)}K
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}