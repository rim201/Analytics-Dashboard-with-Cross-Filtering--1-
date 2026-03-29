import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent } from "./ui/card";
import { Filter, Calendar, MapPin, Package } from "lucide-react";

export interface FilterState {
  category: string;
  region: string;
  timePeriod: string;
}

interface DashboardFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  categories: string[];
  regions: string[];
}

export function DashboardFilters({ filters, onFiltersChange, categories, regions }: DashboardFiltersProps) {
  const timePeriods = ['all', '2024', '2023', 'Q1', 'Q2', 'Q3', 'Q4'];

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card className="border border-gray-200 shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Package className="w-4 h-4" />
              Category
            </label>
            <Select 
              value={filters.category} 
              onValueChange={(value) => handleFilterChange('category', value)}
            >
              <SelectTrigger className="w-full border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                <SelectItem value="all" className="text-gray-900">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category} className="text-gray-900">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <MapPin className="w-4 h-4" />
              Region
            </label>
            <Select 
              value={filters.region} 
              onValueChange={(value) => handleFilterChange('region', value)}
            >
              <SelectTrigger className="w-full border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                <SelectItem value="all" className="text-gray-900">All Regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region} value={region} className="text-gray-900">
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4" />
              Time Period
            </label>
            <Select 
              value={filters.timePeriod} 
              onValueChange={(value) => handleFilterChange('timePeriod', value)}
            >
              <SelectTrigger className="w-full border-gray-300 focus:border-gray-500 focus:ring-gray-500">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200">
                <SelectItem value="all" className="text-gray-900">All Time</SelectItem>
                {timePeriods.slice(1).map((period) => (
                  <SelectItem key={period} value={period} className="text-gray-900">
                    {period}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}